import { describe, expect, it } from 'vitest';
import { createAction } from './Action.js';
import { DomainError } from './errors.js';
import { createLocator } from './Locator.js';
import { createStep } from './Step.js';

const gotoAction = createAction({ kind: 'goto', url: 'https://example.com' });
const fillAction = createAction({
  kind: 'fill',
  locator: createLocator({ strategy: 'testId', value: 'email' }),
  value: 'a@example.com',
});

describe('createStep', () => {
  it('builds a step from valid input', () => {
    const step = createStep({ id: 'step-1', order: 0, action: gotoAction });
    expect(step.id).toBe('step-1');
    expect(step.order).toBe(0);
    expect(step.action).toBe(gotoAction);
  });

  it('accepts an optional label', () => {
    const step = createStep({ id: 'step-1', order: 0, action: gotoAction, label: 'Go to homepage' });
    expect(step.label).toBe('Go to homepage');
  });

  it('throws DomainError when id is empty', () => {
    expect(() => createStep({ id: '', order: 0, action: gotoAction })).toThrow(DomainError);
  });

  it('throws DomainError when order is negative', () => {
    expect(() => createStep({ id: 'step-1', order: -1, action: gotoAction })).toThrow(DomainError);
  });

  it('throws DomainError when order is not an integer', () => {
    expect(() => createStep({ id: 'step-1', order: 1.5, action: gotoAction })).toThrow(DomainError);
  });

  it('throws DomainError when action is missing', () => {
    expect(() =>
      createStep({ id: 'step-1', order: 0, action: undefined as unknown as ReturnType<typeof createAction> }),
    ).toThrow(DomainError);
  });

  it('throws DomainError when label is an empty string', () => {
    expect(() => createStep({ id: 'step-1', order: 0, action: gotoAction, label: '' })).toThrow(DomainError);
  });
});

describe('Step.supportsParameterField', () => {
  it('returns true for a field listed as parameterizable for the action kind', () => {
    const step = createStep({ id: 'step-1', order: 0, action: fillAction });
    expect(step.supportsParameterField('value')).toBe(true);
  });

  it('returns false for a field not listed as parameterizable for the action kind', () => {
    const step = createStep({ id: 'step-1', order: 0, action: fillAction });
    expect(step.supportsParameterField('locator')).toBe(false);
  });

  it('returns false for every field on an action kind with no parameterizable fields', () => {
    const step = createStep({
      id: 'step-1',
      order: 0,
      action: createAction({ kind: 'click', locator: createLocator({ strategy: 'role', value: 'button' }) }),
    });
    expect(step.supportsParameterField('value')).toBe(false);
  });
});
