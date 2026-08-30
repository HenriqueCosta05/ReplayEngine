import { describe, expect, it } from 'vitest';

import {
  parseCodegenScript,
  RecordedRegex,
  type RecordedActionIR,
} from '../../src/journeys/adapters/recording/CodegenScriptParser.js';
import { ParseError } from '../../src/journeys/adapters/recording/errors.js';
import { readCodegenFixture } from './helpers/fixtures.js';

/** Wraps statements in the exact envelope Playwright codegen emits. */
function codegenScript(...statements: string[]): string {
  return [
    "import { test, expect } from '@playwright/test';",
    '',
    "test('test', async ({ page }) => {",
    ...statements.map((statement) => `  ${statement}`),
    '});',
    '',
  ].join('\n');
}

describe('parseCodegenScript golden files', () => {
  it('parses the goto/click/fill/assertVisible fixture into an ordered IR', () => {
    const ir = parseCodegenScript(readCodegenFixture('login-flow.spec.ts'));

    expect(ir).toEqual<RecordedActionIR[]>([
      {
        kind: 'page',
        chain: [{ name: 'goto', args: ['http://localhost:3000/login'] }],
        source: "await page.goto('http://localhost:3000/login');",
      },
      {
        kind: 'page',
        chain: [
          { name: 'getByRole', args: ['textbox', { name: 'Email' }] },
          { name: 'click', args: [] },
        ],
        source: "await page.getByRole('textbox', { name: 'Email' }).click();",
      },
      {
        kind: 'page',
        chain: [
          { name: 'getByRole', args: ['textbox', { name: 'Email' }] },
          { name: 'fill', args: ['ada@example.com'] },
        ],
        source: "await page.getByRole('textbox', { name: 'Email' }).fill('ada@example.com');",
      },
      {
        kind: 'page',
        chain: [
          { name: 'getByRole', args: ['textbox', { name: 'Password' }] },
          { name: 'click', args: [] },
        ],
        source: "await page.getByRole('textbox', { name: 'Password' }).click();",
      },
      {
        kind: 'page',
        chain: [
          { name: 'getByRole', args: ['textbox', { name: 'Password' }] },
          { name: 'fill', args: ['correct horse battery'] },
        ],
        source: "await page.getByRole('textbox', { name: 'Password' }).fill('correct horse battery');",
      },
      {
        kind: 'page',
        chain: [
          { name: 'getByRole', args: ['button', { name: 'Sign in' }] },
          { name: 'click', args: [] },
        ],
        source: "await page.getByRole('button', { name: 'Sign in' }).click();",
      },
      {
        kind: 'expect',
        chain: [{ name: 'getByText', args: ['Welcome back, Ada'] }],
        matcher: { name: 'toBeVisible', args: [] },
        negated: false,
        source: "await expect(page.getByText('Welcome back, Ada')).toBeVisible();",
      },
    ]);
  });

  it('keeps `.first()` / `.nth(n)` refinements as their own chain links', () => {
    const ir = parseCodegenScript(readCodegenFixture('css-fallback-flow.spec.ts'));

    expect(ir[2]).toEqual<RecordedActionIR>({
      kind: 'page',
      chain: [
        { name: 'locator', args: ['div.card > button.primary'] },
        { name: 'first', args: [] },
        { name: 'click', args: [] },
      ],
      source: "await page.locator('div.card > button.primary').first().click();",
    });
    expect(ir[3]).toEqual<RecordedActionIR>({
      kind: 'page',
      chain: [
        { name: 'locator', args: ['[data-widget="chart"]'] },
        { name: 'nth', args: [2] },
        { name: 'hover', args: [] },
      ],
      source: 'await page.locator(\'[data-widget="chart"]\').nth(2).hover();',
    });
  });

  it('parses every fixture without loss: one IR entry per statement', () => {
    const fixtures = [
      'login-flow.spec.ts',
      'checkbox-select-flow.spec.ts',
      'assert-text-value-flow.spec.ts',
      'css-fallback-flow.spec.ts',
    ];

    for (const fixture of fixtures) {
      const source = readCodegenFixture(fixture);
      const statementCount = source.split('\n').filter((line) => line.trim().startsWith('await ')).length;
      expect(parseCodegenScript(source), fixture).toHaveLength(statementCount);
    }
  });
});

describe('parseCodegenScript argument handling', () => {
  it('reads object option bags, booleans and numbers as plain values', () => {
    const [ir] = parseCodegenScript(
      codegenScript("await page.getByText('Dashboard', { exact: true }).nth(3).click();"),
    );

    expect(ir).toMatchObject({
      kind: 'page',
      chain: [
        { name: 'getByText', args: ['Dashboard', { exact: true }] },
        { name: 'nth', args: [3] },
        { name: 'click', args: [] },
      ],
    });
  });

  it('preserves regular-expression arguments structurally instead of compiling them', () => {
    const [ir] = parseCodegenScript(codegenScript('await page.getByText(/wel.ome/i).click();'));

    const regex = ir?.kind === 'page' ? ir.chain[0]?.args[0] : undefined;
    expect(regex).toBeInstanceOf(RecordedRegex);
    expect(String(regex)).toBe('/wel.ome/i');
  });

  it('records negation so the mapper can reject it with context', () => {
    const [ir] = parseCodegenScript(codegenScript("await expect(page.getByText('Gone')).not.toBeVisible();"));

    expect(ir).toMatchObject({ kind: 'expect', negated: true, matcher: { name: 'toBeVisible' } });
  });
});

describe('parseCodegenScript failure modes', () => {
  it('never silently drops a statement it cannot echo', () => {
    const source = codegenScript("await page.goto('http://x.test/');", 'const total = 1 + 1;');

    expect(() => parseCodegenScript(source)).toThrow(ParseError);
    expect(() => parseCodegenScript(source)).toThrow(/const total = 1 \+ 1;/);
  });

  it('rejects an awaited call that is rooted in neither `page` nor `expect`', () => {
    const source = codegenScript("await context.storageState({ path: 'x.json' });");

    expect(() => parseCodegenScript(source)).toThrow(ParseError);
    expect(() => parseCodegenScript(source)).toThrow(/context\.storageState/);
  });

  it('rejects a script with no `test(...)` call', () => {
    expect(() => parseCodegenScript("import { test } from '@playwright/test';")).toThrow(
      /No `test\(\.\.\.\)` call was found/,
    );
  });

  it('reports a syntax error as a ParseError rather than an acorn error', () => {
    expect(() => parseCodegenScript('test(')).toThrow(ParseError);
  });

  it('rejects an interpolated template literal, whose value is not knowable statically', () => {
    const source = codegenScript('await page.goto(`http://x.test/${slug}`);');

    expect(() => parseCodegenScript(source)).toThrow(/Template literals with interpolation/);
  });
});
