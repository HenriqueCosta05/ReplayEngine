import { describe, expect, it } from 'vitest';

import { mapToActions } from '../../src/journeys/adapters/recording/CodegenActionMapper.js';
import { parseCodegenScript } from '../../src/journeys/adapters/recording/CodegenScriptParser.js';
import { ParseError } from '../../src/journeys/adapters/recording/errors.js';
import type { Action } from '../../src/journeys/domain/Action.js';
import { DomainError } from '../../src/journeys/domain/errors.js';
import { readCodegenFixture } from './helpers/fixtures.js';

function actionsFromFixture(fileName: string): Action[] {
  return mapToActions(parseCodegenScript(readCodegenFixture(fileName))).map((mapped) => mapped.action);
}

function actionsFromStatements(...statements: string[]): Action[] {
  const source = [
    "import { test, expect } from '@playwright/test';",
    "test('test', async ({ page }) => {",
    ...statements.map((statement) => `  ${statement}`),
    '});',
  ].join('\n');
  return mapToActions(parseCodegenScript(source)).map((mapped) => mapped.action);
}

describe('mapToActions golden files', () => {
  it('maps the goto/click/fill/assertVisible fixture', () => {
    expect(actionsFromFixture('login-flow.spec.ts')).toEqual<Action[]>([
      { kind: 'goto', url: 'http://localhost:3000/login' },
      { kind: 'click', locator: { strategy: 'role', value: 'textbox', options: { name: 'Email' } } },
      {
        kind: 'fill',
        locator: { strategy: 'role', value: 'textbox', options: { name: 'Email' } },
        value: 'ada@example.com',
      },
      { kind: 'click', locator: { strategy: 'role', value: 'textbox', options: { name: 'Password' } } },
      {
        kind: 'fill',
        locator: { strategy: 'role', value: 'textbox', options: { name: 'Password' } },
        value: 'correct horse battery',
      },
      { kind: 'click', locator: { strategy: 'role', value: 'button', options: { name: 'Sign in' } } },
      { kind: 'assertVisible', locator: { strategy: 'text', value: 'Welcome back, Ada' } },
    ]);
  });

  it('maps the checkbox/select fixture', () => {
    expect(actionsFromFixture('checkbox-select-flow.spec.ts')).toEqual<Action[]>([
      { kind: 'goto', url: 'http://localhost:3000/preferences' },
      {
        kind: 'check',
        locator: { strategy: 'role', value: 'checkbox', options: { name: 'Subscribe to the newsletter' } },
      },
      { kind: 'check', locator: { strategy: 'label', value: 'Enable beta features' } },
      { kind: 'uncheck', locator: { strategy: 'label', value: 'Enable beta features' } },
      { kind: 'selectOption', locator: { strategy: 'label', value: 'Country' }, value: 'br' },
      {
        kind: 'selectOption',
        locator: { strategy: 'role', value: 'combobox', options: { name: 'Plan' } },
        value: 'pro',
      },
      { kind: 'click', locator: { strategy: 'role', value: 'button', options: { name: 'Save preferences' } } },
      { kind: 'assertVisible', locator: { strategy: 'text', value: 'Preferences saved' } },
    ]);
  });

  it('maps the assertText/assertValue fixture', () => {
    expect(actionsFromFixture('assert-text-value-flow.spec.ts')).toEqual<Action[]>([
      { kind: 'goto', url: 'http://localhost:3000/search' },
      { kind: 'click', locator: { strategy: 'placeholder', value: 'Search products' } },
      { kind: 'fill', locator: { strategy: 'placeholder', value: 'Search products' }, value: 'espresso' },
      { kind: 'press', locator: { strategy: 'placeholder', value: 'Search products' }, key: 'Enter' },
      {
        kind: 'assertValue',
        locator: { strategy: 'placeholder', value: 'Search products' },
        expected: 'espresso',
      },
      { kind: 'assertText', locator: { strategy: 'testId', value: 'result-count' }, expected: '3 results' },
      { kind: 'hover', locator: { strategy: 'role', value: 'link', options: { name: 'Espresso Machine' } } },
      {
        kind: 'assertText',
        locator: { strategy: 'testId', value: 'preview-title' },
        expected: 'Espresso Machine',
      },
    ]);
  });

  it('maps the css-fallback fixture, including refinements and alt/title strategies', () => {
    expect(actionsFromFixture('css-fallback-flow.spec.ts')).toEqual<Action[]>([
      { kind: 'goto', url: 'http://localhost:3000/dashboard' },
      { kind: 'click', locator: { strategy: 'css', value: '#sidebar-toggle' } },
      { kind: 'click', locator: { strategy: 'css', value: 'div.card > button.primary', options: { nth: 0 } } },
      { kind: 'hover', locator: { strategy: 'css', value: '[data-widget="chart"]', options: { nth: 2 } } },
      { kind: 'click', locator: { strategy: 'altText', value: 'Company logo' } },
      { kind: 'click', locator: { strategy: 'title', value: 'Close panel' } },
      { kind: 'click', locator: { strategy: 'text', value: 'Dashboard', options: { exact: true } } },
      {
        kind: 'assertText',
        locator: { strategy: 'css', value: '#status-banner' },
        expected: 'All systems operational',
      },
    ]);
  });

  it('labels each mapped action with the codegen line it came from', () => {
    const mapped = mapToActions(parseCodegenScript(readCodegenFixture('login-flow.spec.ts')));

    expect(mapped[1]?.label).toBe("await page.getByRole('textbox', { name: 'Email' }).click();");
  });
});

describe('mapToActions locator translation', () => {
  it('encodes `.last()` as nth: -1, matching Playwright’s own negative indexing', () => {
    expect(actionsFromStatements("await page.locator('li').last().click();")).toEqual<Action[]>([
      { kind: 'click', locator: { strategy: 'css', value: 'li', options: { nth: -1 } } },
    ]);
  });

  it('maps every getBy* factory to its domain strategy', () => {
    const actions = actionsFromStatements(
      "await page.getByRole('button').click();",
      "await page.getByTestId('save').click();",
      "await page.getByText('Hello').click();",
      "await page.getByLabel('Email').click();",
      "await page.getByPlaceholder('you@example.com').click();",
      "await page.getByAltText('Logo').click();",
      "await page.getByTitle('Help').click();",
      "await page.locator('#id').click();",
    );

    expect(actions.map((action) => (action.kind === 'click' ? action.locator.strategy : null))).toEqual([
      'role',
      'testId',
      'text',
      'label',
      'placeholder',
      'altText',
      'title',
      'css',
    ]);
  });

  it('accepts the single-value array form of selectOption', () => {
    expect(actionsFromStatements("await page.getByLabel('Country').selectOption(['pt']);")).toEqual<Action[]>([
      { kind: 'selectOption', locator: { strategy: 'label', value: 'Country' }, value: 'pt' },
    ]);
  });

  it('drops timing-only action options, which do not change what happened', () => {
    expect(actionsFromStatements("await page.getByRole('button').click({ timeout: 5000 });")).toEqual<Action[]>([
      { kind: 'click', locator: { strategy: 'role', value: 'button' } },
    ]);
  });
});

describe('mapToActions failure modes', () => {
  const cases: ReadonlyArray<readonly [description: string, statement: string, expected: RegExp]> = [
    [
      'a gesture-changing click option, which would otherwise replay as a plain left click',
      "await page.getByRole('button').click({ button: 'right' });",
      /Unsupported `click\(\.\.\.\)` option `button`/,
    ],
    [
      'an action with no domain equivalent',
      "await page.getByRole('button').dblclick();",
      /Unsupported action `dblclick\(\.\.\.\)`/,
    ],
    [
      'an assertion matcher with no domain equivalent',
      "await expect(page.getByTestId('x')).toContainText('partial');",
      /Unsupported assertion matcher `toContainText\(\.\.\.\)`/,
    ],
    [
      'a negated assertion',
      "await expect(page.getByText('Gone')).not.toBeVisible();",
      /Negated assertions/,
    ],
    [
      'a regular-expression locator value, which the domain stores as a string',
      'await page.getByText(/wel.ome/i).click();',
      /must be a string literal, got \/wel\.ome\/i/,
    ],
    [
      'an unsupported locator filter',
      "await page.getByRole('listitem').filter({ hasText: 'x' }).click();",
      /Unsupported locator refinement `filter\(\.\.\.\)`/,
    ],
    [
      'an unsupported locator option',
      "await page.getByRole('listitem', { hasText: 'x' }).click();",
      /Unsupported locator option `hasText`/,
    ],
    [
      '`name` on a strategy that has no accessible-name filter',
      "await page.getByLabel('Email', { name: 'x' }).click();",
      /`name` is only supported on getByRole/,
    ],
    [
      'an action with no locator in front of it',
      "await page.click('#id');",
      /Expected a locator before the action call/,
    ],
    [
      'a multi-value selectOption',
      "await page.getByLabel('Country').selectOption(['pt', 'br']);",
      /Only single-value `selectOption/,
    ],
  ];

  it.each(cases)('rejects %s', (_description, statement, expected) => {
    expect(() => actionsFromStatements(statement)).toThrow(ParseError);
    expect(() => actionsFromStatements(statement)).toThrow(expected);
  });

  it('names the offending source snippet in every message', () => {
    expect(() => actionsFromStatements("await page.getByRole('button').dblclick();")).toThrow(
      /`await page\.getByRole\('button'\)\.dblclick\(\);`/,
    );
  });
});

/**
 * A recognised shape carrying domain-invalid values must fail the same way an
 * unrecognised shape does: as a `ParseError` naming the line. Otherwise a raw
 * `DomainError` escapes to the recorder and aborts a whole recording session
 * with a message that does not say which of the recorded statements caused it.
 */
describe('mapToActions surfaces domain rejections against the source line', () => {
  const clearedFieldLine = "await page.getByLabel('Display name').fill('');";

  it('converts the DomainError from a recorded `fill("")` into a located ParseError', () => {
    expect(() => actionsFromFixture('cleared-field-flow.spec.ts')).toThrow(ParseError);
    expect(() => actionsFromFixture('cleared-field-flow.spec.ts')).toThrow(
      /requires a non-empty "value" field/,
    );
    expect(() => actionsFromFixture('cleared-field-flow.spec.ts')).toThrow(
      new RegExp(clearedFieldLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    );
  });

  it('keeps the original DomainError as `cause`, losing no information', () => {
    let thrown: unknown;
    try {
      actionsFromFixture('cleared-field-flow.spec.ts');
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ParseError);
    expect((thrown as ParseError).cause).toBeInstanceOf(DomainError);
    expect(((thrown as ParseError).cause as DomainError).message).toBe(
      'Action of kind "fill" requires a non-empty "value" field.',
    );
  });

  it('locates a domain rejection raised while building the locator, not the action', () => {
    expect(() => actionsFromStatements("await page.locator('').click();")).toThrow(ParseError);
    expect(() => actionsFromStatements("await page.locator('').click();")).toThrow(
      /Locator value must be a non-empty string: `await page\.locator\(''\)\.click\(\);`/,
    );
  });

  it('locates a domain rejection raised from an assertion', () => {
    expect(() => actionsFromStatements("await expect(page.getByTestId('x')).toHaveText('');")).toThrow(
      /requires a non-empty "expected" field: `await expect\(page\.getByTestId\('x'\)\)\.toHaveText\(''\);`/,
    );
  });

  it('leaves this adapter’s own ParseErrors untouched by the domain guard', () => {
    // A ParseError passing back out through `fromDomain` must not be rewrapped
    // or have a snippet appended twice.
    let thrown: unknown;
    try {
      actionsFromStatements("await page.getByRole('button').dblclick();");
    } catch (error) {
      thrown = error;
    }

    expect((thrown as ParseError).cause).toBeUndefined();
    expect((thrown as ParseError).message.match(/`await page/g)).toHaveLength(1);
  });
});
