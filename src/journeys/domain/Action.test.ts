import { describe, expect, it } from 'vitest';
import { createAction, PARAMETERIZABLE_FIELDS, type CreateActionInput } from './Action.js';
import { DomainError } from './errors.js';

const locatorInput = { strategy: 'role', value: 'button' } as const;

describe('createAction', () => {
  it('builds a goto action from valid input', () => {
    const action = createAction({ kind: 'goto', url: 'https://example.com' });
    expect(action).toEqual({ kind: 'goto', url: 'https://example.com' });
  });

  it('builds a click action, validating the locator through createLocator', () => {
    const action = createAction({ kind: 'click', locator: locatorInput });
    expect(action).toEqual({ kind: 'click', locator: { strategy: 'role', value: 'button' } });
  });

  it('builds a fill action', () => {
    const action = createAction({ kind: 'fill', locator: locatorInput, value: 'hello' });
    expect(action).toEqual({
      kind: 'fill',
      locator: { strategy: 'role', value: 'button' },
      value: 'hello',
    });
  });

  it('builds a check action', () => {
    expect(createAction({ kind: 'check', locator: locatorInput })).toEqual({
      kind: 'check',
      locator: { strategy: 'role', value: 'button' },
    });
  });

  it('builds an uncheck action', () => {
    expect(createAction({ kind: 'uncheck', locator: locatorInput })).toEqual({
      kind: 'uncheck',
      locator: { strategy: 'role', value: 'button' },
    });
  });

  it('builds a press action', () => {
    expect(createAction({ kind: 'press', locator: locatorInput, key: 'Enter' })).toEqual({
      kind: 'press',
      locator: { strategy: 'role', value: 'button' },
      key: 'Enter',
    });
  });

  it('builds a selectOption action', () => {
    expect(createAction({ kind: 'selectOption', locator: locatorInput, value: 'opt-1' })).toEqual({
      kind: 'selectOption',
      locator: { strategy: 'role', value: 'button' },
      value: 'opt-1',
    });
  });

  it('builds a hover action', () => {
    expect(createAction({ kind: 'hover', locator: locatorInput })).toEqual({
      kind: 'hover',
      locator: { strategy: 'role', value: 'button' },
    });
  });

  it('builds an assertVisible action', () => {
    expect(createAction({ kind: 'assertVisible', locator: locatorInput })).toEqual({
      kind: 'assertVisible',
      locator: { strategy: 'role', value: 'button' },
    });
  });

  it('builds an assertText action', () => {
    expect(createAction({ kind: 'assertText', locator: locatorInput, expected: 'Hello' })).toEqual({
      kind: 'assertText',
      locator: { strategy: 'role', value: 'button' },
      expected: 'Hello',
    });
  });

  it('builds an assertValue action', () => {
    expect(createAction({ kind: 'assertValue', locator: locatorInput, expected: '42' })).toEqual({
      kind: 'assertValue',
      locator: { strategy: 'role', value: 'button' },
      expected: '42',
    });
  });

  it('throws DomainError for goto with an empty url', () => {
    expect(() => createAction({ kind: 'goto', url: '' })).toThrow(DomainError);
  });

  it('throws DomainError for fill with an empty value', () => {
    expect(() => createAction({ kind: 'fill', locator: locatorInput, value: '' })).toThrow(DomainError);
  });

  it('throws DomainError for press with an empty key', () => {
    expect(() => createAction({ kind: 'press', locator: locatorInput, key: '' })).toThrow(DomainError);
  });

  it('throws DomainError for selectOption with an empty value', () => {
    expect(() => createAction({ kind: 'selectOption', locator: locatorInput, value: '' })).toThrow(DomainError);
  });

  it('throws DomainError for assertText with an empty expected', () => {
    expect(() => createAction({ kind: 'assertText', locator: locatorInput, expected: '' })).toThrow(DomainError);
  });

  it('throws DomainError for assertValue with an empty expected', () => {
    expect(() => createAction({ kind: 'assertValue', locator: locatorInput, expected: '' })).toThrow(DomainError);
  });

  it('throws DomainError when the locator itself is invalid', () => {
    expect(() => createAction({ kind: 'click', locator: { strategy: 'xpath', value: '//x' } })).toThrow(DomainError);
  });

  it('throws DomainError for an unknown action kind', () => {
    const invalidInput = { kind: 'doubleClick', locator: locatorInput } as unknown as CreateActionInput;
    expect(() => createAction(invalidInput)).toThrow(DomainError);
  });
});

describe('PARAMETERIZABLE_FIELDS', () => {
  it('marks fill.value, goto.url, press.key and selectOption.value as parameterizable', () => {
    expect(PARAMETERIZABLE_FIELDS.fill).toEqual(['value']);
    expect(PARAMETERIZABLE_FIELDS.goto).toEqual(['url']);
    expect(PARAMETERIZABLE_FIELDS.press).toEqual(['key']);
    expect(PARAMETERIZABLE_FIELDS.selectOption).toEqual(['value']);
  });

  it('marks locator-only actions as having no parameterizable fields', () => {
    expect(PARAMETERIZABLE_FIELDS.click).toEqual([]);
    expect(PARAMETERIZABLE_FIELDS.check).toEqual([]);
    expect(PARAMETERIZABLE_FIELDS.uncheck).toEqual([]);
    expect(PARAMETERIZABLE_FIELDS.hover).toEqual([]);
    expect(PARAMETERIZABLE_FIELDS.assertVisible).toEqual([]);
    expect(PARAMETERIZABLE_FIELDS.assertText).toEqual([]);
    expect(PARAMETERIZABLE_FIELDS.assertValue).toEqual([]);
  });
});
