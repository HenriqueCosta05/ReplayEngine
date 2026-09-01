import { parse } from 'acorn';
import type {
  ArrowFunctionExpression,
  BlockStatement,
  CallExpression,
  Expression,
  FunctionExpression,
  MemberExpression,
  Node,
  Program,
  SpreadElement,
  Statement,
  Super,
} from 'acorn';
import * as walk from 'acorn-walk';

import { ParseError } from './errors.js';

/**
 * A regular-expression argument, preserved structurally rather than compiled.
 * Playwright accepts regexes in `getByText(/x/)` and friends, but the domain
 * `Locator.value` is a plain string - so the parser echoes the regex
 * faithfully and lets `CodegenActionMapper` be the single place that decides
 * it cannot be represented, with a message that names the offending source.
 */
export class RecordedRegex {
  constructor(
    readonly pattern: string,
    readonly flags: string,
  ) {}

  toString(): string {
    return `/${this.pattern}/${this.flags}`;
  }
}

/** One `.name(...args)` link of a parsed method chain. */
export interface RecordedCall {
  readonly name: string;
  readonly args: readonly unknown[];
}

/**
 * The intermediate representation between Playwright's generated source and
 * the domain's `Action`. Deliberately a *thin structural echo* of the call
 * that was parsed: it carries no notion of locator strategies, action kinds
 * or assertions. All of that meaning is assigned by `CodegenActionMapper`,
 * which keeps AST-shape concerns and translation concerns separable and
 * separately testable.
 *
 * `args` are kept per-call (rather than one flat list beside a flat
 * `methodChain: string[]`) because the association between a link and its own
 * arguments is exactly what the mapper needs - `getByRole('button', {name})`
 * followed by `.fill('x')` is not recoverable from two concatenated lists.
 */
export type RecordedActionIR =
  | {
      readonly kind: 'page';
      /** e.g. `[getByRole('button', {...}), click()]`, in source order. */
      readonly chain: readonly RecordedCall[];
      readonly source: string;
    }
  | {
      readonly kind: 'expect';
      /** The `page.…` chain *inside* `expect(...)`. */
      readonly chain: readonly RecordedCall[];
      /** The matcher applied to it, e.g. `toBeVisible()`. */
      readonly matcher: RecordedCall;
      readonly negated: boolean;
      readonly source: string;
    };

function snippet(source: string, node: Node): string {
  return source.slice(node.start, node.end).replace(/\s+/g, ' ').trim();
}

function unsupported(source: string, node: Node, reason: string): ParseError {
  return new ParseError(`${reason}: \`${snippet(source, node)}\``);
}

function isBlockBodiedFunction(node: Expression | SpreadElement): node is (ArrowFunctionExpression | FunctionExpression) & {
  body: BlockStatement;
} {
  return (
    (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') &&
    node.body.type === 'BlockStatement'
  );
}

/**
 * Codegen wraps everything in a single `test('test', async ({ page }) => {…})`
 * call. We locate it by walking (rather than assuming it is the program's
 * second top-level statement) so a script wrapped in `test.describe(...)`, or
 * one preceded by extra imports, still parses.
 */
function findTestCallback(program: Program, source: string): BlockStatement {
  const candidates: CallExpression[] = [];

  walk.simple(program, {
    CallExpression(node: CallExpression) {
      const callee = node.callee;
      const isTestIdentifier = callee.type === 'Identifier' && callee.name === 'test';
      const isTestMember =
        callee.type === 'MemberExpression' &&
        callee.object.type === 'Identifier' &&
        callee.object.name === 'test' &&
        callee.property.type === 'Identifier' &&
        callee.property.name !== 'describe';

      if (isTestIdentifier || isTestMember) {
        candidates.push(node);
      }
    },
  });

  if (candidates.length === 0) {
    throw new ParseError(
      'No `test(...)` call was found in the codegen script. Expected Playwright `--target=playwright-test` output.',
    );
  }

  // Source order, so the first `test(...)` block wins if codegen ever emits
  // more than one (we record a single journey per session).
  candidates.sort((a, b) => a.start - b.start);
  const testCall = candidates[0]!;
  const callback = testCall.arguments.find(isBlockBodiedFunction);

  if (callback === undefined) {
    throw unsupported(source, testCall, 'The `test(...)` call has no block-bodied callback');
  }

  return callback.body;
}

function literalValue(node: Expression | SpreadElement, source: string): unknown {
  switch (node.type) {
    case 'Literal': {
      if (node.regex !== undefined) {
        return new RecordedRegex(node.regex.pattern, node.regex.flags);
      }
      return node.value;
    }
    case 'TemplateLiteral': {
      // A template with no interpolation is just a string; one *with*
      // interpolation depends on runtime values we do not have.
      if (node.expressions.length === 0 && node.quasis.length === 1) {
        return node.quasis[0]!.value.cooked ?? node.quasis[0]!.value.raw;
      }
      throw unsupported(source, node, 'Template literals with interpolation are not supported');
    }
    case 'UnaryExpression': {
      if (node.operator === '-' && node.argument.type === 'Literal' && typeof node.argument.value === 'number') {
        return -node.argument.value;
      }
      throw unsupported(source, node, 'Unsupported argument expression');
    }
    case 'ArrayExpression': {
      return node.elements.map((element) => {
        if (element === null) {
          throw unsupported(source, node, 'Array holes are not supported in arguments');
        }
        return literalValue(element, source);
      });
    }
    case 'ObjectExpression': {
      const record: Record<string, unknown> = {};
      for (const property of node.properties) {
        if (property.type !== 'Property' || property.computed) {
          throw unsupported(source, property, 'Unsupported object property in arguments');
        }
        const key =
          property.key.type === 'Identifier'
            ? property.key.name
            : property.key.type === 'Literal' && typeof property.key.value === 'string'
              ? property.key.value
              : undefined;
        if (key === undefined) {
          throw unsupported(source, property, 'Unsupported object key in arguments');
        }
        record[key] = literalValue(property.value, source);
      }
      return record;
    }
    default:
      throw unsupported(source, node, 'Unsupported argument expression');
  }
}

interface FlattenedChain {
  /** The innermost expression the chain hangs off (`page`, `expect(...)`, …). */
  readonly root: Expression | Super;
  readonly calls: RecordedCall[];
}

/**
 * Turns `a.b(1).c(2)` into `{root: a, calls: [b(1), c(2)]}`. Recursion stops
 * at anything that is not a `<call>.<identifier>(...)` link, so `expect(x)`
 * (whose callee is a bare identifier) and `expect(x).not` (a member access,
 * not a call) are both returned as roots for the caller to interpret.
 */
function flattenChain(node: Expression | Super, source: string): FlattenedChain {
  if (node.type !== 'CallExpression') {
    return { root: node, calls: [] };
  }

  const callee = node.callee;
  if (callee.type !== 'MemberExpression' || callee.computed || callee.property.type !== 'Identifier') {
    return { root: node, calls: [] };
  }

  const inner = flattenChain(callee.object, source);
  inner.calls.push({
    name: callee.property.name,
    args: node.arguments.map((argument) => literalValue(argument, source)),
  });
  return inner;
}

function isPageRoot(root: Expression | Super): boolean {
  return root.type === 'Identifier' && root.name === 'page';
}

function asExpectCall(root: Expression | Super): CallExpression | null {
  return root.type === 'CallExpression' && root.callee.type === 'Identifier' && root.callee.name === 'expect'
    ? root
    : null;
}

function asNegatedExpectCall(root: Expression | Super): CallExpression | null {
  if (root.type !== 'MemberExpression' || root.computed || root.property.type !== 'Identifier') {
    return null;
  }
  const member: MemberExpression = root;
  return member.property.type === 'Identifier' && member.property.name === 'not'
    ? asExpectCall(member.object)
    : null;
}

function parseExpectStatement(
  expectCall: CallExpression,
  calls: readonly RecordedCall[],
  negated: boolean,
  statementNode: Node,
  source: string,
): RecordedActionIR {
  if (calls.length !== 1) {
    throw unsupported(source, statementNode, 'Expected exactly one matcher after `expect(...)`');
  }
  const subject = expectCall.arguments[0];
  if (subject === undefined || subject.type === 'SpreadElement') {
    throw unsupported(source, statementNode, '`expect(...)` needs a single locator argument');
  }

  const inner = flattenChain(subject, source);
  if (!isPageRoot(inner.root)) {
    throw unsupported(source, statementNode, '`expect(...)` argument must be a `page.…` locator chain');
  }

  return {
    kind: 'expect',
    chain: inner.calls,
    matcher: calls[0]!,
    negated,
    source: snippet(source, statementNode),
  };
}

function parseAwaitedCall(call: CallExpression, statementNode: Node, source: string): RecordedActionIR {
  const { root, calls } = flattenChain(call, source);

  if (isPageRoot(root)) {
    if (calls.length === 0) {
      throw unsupported(source, statementNode, 'Unrecognised `page` expression');
    }
    return { kind: 'page', chain: calls, source: snippet(source, statementNode) };
  }

  const expectCall = asExpectCall(root);
  if (expectCall !== null) {
    return parseExpectStatement(expectCall, calls, false, statementNode, source);
  }

  const negatedExpectCall = asNegatedExpectCall(root);
  if (negatedExpectCall !== null) {
    return parseExpectStatement(negatedExpectCall, calls, true, statementNode, source);
  }

  throw unsupported(
    source,
    statementNode,
    'Unrecognised statement: expected `await page.…(…)` or `await expect(page.…).toX(…)`',
  );
}

function parseStatement(statement: Statement, source: string): RecordedActionIR {
  if (statement.type !== 'ExpressionStatement') {
    throw unsupported(source, statement, 'Unrecognised statement in the recorded test body');
  }
  const expression = statement.expression;
  if (expression.type !== 'AwaitExpression' || expression.argument.type !== 'CallExpression') {
    throw unsupported(source, statement, 'Unrecognised statement in the recorded test body');
  }
  return parseAwaitedCall(expression.argument, statement, source);
}

/**
 * Parses Playwright codegen `--target=playwright-test` output into an ordered
 * list of structural `RecordedActionIR`s - one per statement in the recorded
 * test body, in source order.
 *
 * Pure: no I/O, no globals, deterministic for a given string. Every statement
 * must be recognised; an unsupported construct raises `ParseError` naming the
 * exact source snippet rather than being skipped, so a recorded journey can
 * never come back quietly shorter than what the human actually did.
 */
export function parseCodegenScript(source: string): RecordedActionIR[] {
  let program: Program;
  try {
    program = parse(source, { ecmaVersion: 2022, sourceType: 'module' });
  } catch (error) {
    throw new ParseError(
      `Codegen script is not valid ES2022 module source: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const body = findTestCallback(program, source);
  return body.body.map((statement) => parseStatement(statement, source));
}
