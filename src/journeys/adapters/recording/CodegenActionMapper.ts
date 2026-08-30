import { createAction, type Action } from '../../domain/Action.js';
import { createLocator, type Locator, type LocatorOptions, type LocatorStrategy } from '../../domain/Locator.js';
import { ParseError } from './errors.js';
import { RecordedRegex, type RecordedActionIR, type RecordedCall } from './CodegenScriptParser.js';

/** A mapped step, ready for `RecordJourneyUseCase` to assign an id and order. */
export interface MappedAction {
  readonly action: Action;
  readonly label?: string;
}

/** Playwright's locator factories, and the domain strategy each one denotes. */
const LOCATOR_FACTORIES: Readonly<Record<string, LocatorStrategy | undefined>> = {
  getByRole: 'role',
  getByTestId: 'testId',
  getByText: 'text',
  getByLabel: 'label',
  getByPlaceholder: 'placeholder',
  getByAltText: 'altText',
  getByTitle: 'title',
  locator: 'css',
};

/**
 * Options on an action call that change *timing* but not *what happened*, and
 * so can be dropped when translating a recording into a replayable action.
 * Anything outside this set (`{ button: 'right' }`, `{ modifiers: [...] }`,
 * `{ position: {...} }`) genuinely changes the interaction, so it is rejected
 * rather than quietly replayed as a different gesture.
 */
const IGNORABLE_ACTION_OPTIONS: ReadonlySet<string> = new Set(['timeout', 'force', 'noWaitAfter', 'trial']);

function describe(value: unknown): string {
  if (value instanceof RecordedRegex) {
    return value.toString();
  }
  return typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);
}

function fail(source: string, reason: string): never {
  throw new ParseError(`${reason}: \`${source}\``);
}

function requireString(value: unknown, source: string, what: string): string {
  if (typeof value !== 'string') {
    fail(source, `${what} must be a string literal, got ${describe(value)}`);
  }
  return value;
}

function asPlainObject(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof RecordedRegex)
    ? (value as Record<string, unknown>)
    : null;
}

function locatorOptionsFrom(call: RecordedCall, strategy: LocatorStrategy, source: string): LocatorOptions {
  const raw = call.args[1];
  if (raw === undefined) {
    return {};
  }
  const options = asPlainObject(raw);
  if (options === null) {
    fail(source, `Second argument to \`${call.name}(...)\` must be an options object`);
  }

  const mapped: { name?: string; exact?: boolean } = {};
  for (const [key, value] of Object.entries(options)) {
    if (key === 'exact') {
      if (typeof value !== 'boolean') {
        fail(source, '`exact` must be a boolean literal');
      }
      mapped.exact = value;
    } else if (key === 'name') {
      // Only `getByRole` has an accessible-name option; a `name` anywhere
      // else would be silently dropped, so refuse it instead.
      if (strategy !== 'role') {
        fail(source, `\`name\` is only supported on getByRole, not on \`${call.name}(...)\``);
      }
      mapped.name = requireString(value, source, '`name`');
    } else {
      fail(source, `Unsupported locator option \`${key}\``);
    }
  }
  return mapped;
}

/**
 * Applies a chain refinement (`.first()`, `.last()`, `.nth(n)`) as the
 * domain's `options.nth`. `.last()` becomes `-1`, which is exactly how
 * Playwright's own `nth(-1)` addresses the last match, so the resolver needs
 * no special case for it.
 */
function nthFromRefinement(call: RecordedCall, source: string): number {
  switch (call.name) {
    case 'first':
      return 0;
    case 'last':
      return -1;
    case 'nth': {
      const index = call.args[0];
      if (typeof index !== 'number' || !Number.isInteger(index)) {
        fail(source, '`nth(...)` needs an integer literal');
      }
      return index;
    }
    default:
      return fail(source, `Unsupported locator refinement \`${call.name}(...)\``);
  }
}

function buildLocator(calls: readonly RecordedCall[], source: string): Locator {
  const [factory, ...refinements] = calls;
  if (factory === undefined) {
    fail(source, 'Expected a locator before the action call');
  }

  const strategy = LOCATOR_FACTORIES[factory.name];
  if (strategy === undefined) {
    fail(source, `Unsupported locator factory \`${factory.name}(...)\``);
  }

  const value = requireString(factory.args[0], source, `First argument to \`${factory.name}(...)\``);
  const options: LocatorOptions = locatorOptionsFrom(factory, strategy, source);

  if (refinements.length > 1) {
    fail(source, 'Only one locator refinement (`first`/`last`/`nth`) is supported');
  }
  const nth = refinements.length === 1 ? nthFromRefinement(refinements[0]!, source) : undefined;

  const merged: LocatorOptions = { ...options, ...(nth !== undefined ? { nth } : {}) };

  return createLocator({
    strategy,
    value,
    ...(Object.keys(merged).length > 0 ? { options: merged } : {}),
  });
}

/** Rejects an action-call option bag that would change what the step does. */
function assertNeutralActionOptions(call: RecordedCall, argIndex: number, source: string): void {
  const raw = call.args[argIndex];
  if (raw === undefined) {
    return;
  }
  const options = asPlainObject(raw);
  if (options === null) {
    fail(source, `Unexpected argument to \`${call.name}(...)\``);
  }
  for (const key of Object.keys(options)) {
    if (!IGNORABLE_ACTION_OPTIONS.has(key)) {
      fail(source, `Unsupported \`${call.name}(...)\` option \`${key}\``);
    }
  }
  if (call.args.length > argIndex + 1) {
    fail(source, `Too many arguments to \`${call.name}(...)\``);
  }
}

/** `selectOption` accepts several shapes in Playwright; the domain stores one string. */
function selectOptionValue(call: RecordedCall, source: string): string {
  const raw = call.args[0];
  if (typeof raw === 'string') {
    return raw;
  }
  if (Array.isArray(raw)) {
    const items = raw as unknown[];
    const [only] = items;
    if (items.length !== 1 || typeof only !== 'string') {
      fail(source, 'Only single-value `selectOption([...])` is supported');
    }
    return only;
  }
  const object = asPlainObject(raw);
  if (object !== null && typeof object.value === 'string') {
    return object.value;
  }
  return fail(source, `Unsupported \`selectOption(...)\` argument ${describe(raw)}`);
}

function mapPageAction(ir: Extract<RecordedActionIR, { kind: 'page' }>): Action {
  const { chain, source } = ir;
  const last = chain[chain.length - 1]!;

  if (last.name === 'goto') {
    if (chain.length !== 1) {
      fail(source, '`goto` must be called directly on `page`');
    }
    assertNeutralActionOptions(last, 1, source);
    return createAction({ kind: 'goto', url: requireString(last.args[0], source, 'The `goto(...)` url') });
  }

  const locator = buildLocator(chain.slice(0, -1), source);

  switch (last.name) {
    case 'click':
      assertNeutralActionOptions(last, 0, source);
      return createAction({ kind: 'click', locator });
    case 'hover':
      assertNeutralActionOptions(last, 0, source);
      return createAction({ kind: 'hover', locator });
    case 'check':
      assertNeutralActionOptions(last, 0, source);
      return createAction({ kind: 'check', locator });
    case 'uncheck':
      assertNeutralActionOptions(last, 0, source);
      return createAction({ kind: 'uncheck', locator });
    case 'fill':
      assertNeutralActionOptions(last, 1, source);
      return createAction({
        kind: 'fill',
        locator,
        value: requireString(last.args[0], source, 'The `fill(...)` value'),
      });
    case 'press':
      assertNeutralActionOptions(last, 1, source);
      return createAction({
        kind: 'press',
        locator,
        key: requireString(last.args[0], source, 'The `press(...)` key'),
      });
    case 'selectOption':
      assertNeutralActionOptions(last, 1, source);
      return createAction({ kind: 'selectOption', locator, value: selectOptionValue(last, source) });
    default:
      return fail(source, `Unsupported action \`${last.name}(...)\``);
  }
}

function mapExpectAction(ir: Extract<RecordedActionIR, { kind: 'expect' }>): Action {
  const { chain, matcher, negated, source } = ir;

  if (negated) {
    fail(source, 'Negated assertions (`expect(...).not.…`) have no domain equivalent');
  }

  const locator = buildLocator(chain, source);

  switch (matcher.name) {
    case 'toBeVisible':
      assertNeutralActionOptions(matcher, 0, source);
      return createAction({ kind: 'assertVisible', locator });
    case 'toHaveText':
      assertNeutralActionOptions(matcher, 1, source);
      return createAction({
        kind: 'assertText',
        locator,
        expected: requireString(matcher.args[0], source, 'The `toHaveText(...)` expectation'),
      });
    case 'toHaveValue':
      assertNeutralActionOptions(matcher, 1, source);
      return createAction({
        kind: 'assertValue',
        locator,
        expected: requireString(matcher.args[0], source, 'The `toHaveValue(...)` expectation'),
      });
    default:
      return fail(source, `Unsupported assertion matcher \`${matcher.name}(...)\``);
  }
}

/**
 * Translates the parser's structural IR into validated domain `Action`s.
 *
 * This is the single place that knows the correspondence between Playwright's
 * API surface and QAMachine's vocabulary. It builds every result through
 * `createAction`/`createLocator` rather than object-literal casts, so the
 * domain - not this adapter - remains the authority on what a valid action is.
 *
 * Each mapped action carries the original source line as its `label`, which
 * makes `journey show` self-explanatory and keeps a recorded step traceable
 * back to the exact codegen line it came from.
 */
export function mapToActions(ir: readonly RecordedActionIR[]): MappedAction[] {
  return ir.map((entry) => ({
    action: entry.kind === 'page' ? mapPageAction(entry) : mapExpectAction(entry),
    label: entry.source,
  }));
}
