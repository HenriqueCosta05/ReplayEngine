import { describe, expect, it } from 'vitest';
import { DomainError } from './errors.js';
import { createLocator } from './Locator.js';

describe('createLocator', () => {
  it('builds a locator from valid input', () => {
    const locator = createLocator({ strategy: 'role', value: 'button' });
    expect(locator).toEqual({ strategy: 'role', value: 'button' });
  });

  it('preserves options when provided', () => {
    const locator = createLocator({
      strategy: 'text',
      value: 'Submit',
      options: { name: 'submit-button', exact: true, nth: 0 },
    });
    expect(locator.options).toEqual({ name: 'submit-button', exact: true, nth: 0 });
  });

  it.each(['role', 'testId', 'text', 'label', 'placeholder', 'altText', 'title', 'css'] as const)(
    'accepts the "%s" strategy',
    (strategy) => {
      expect(() => createLocator({ strategy, value: 'x' })).not.toThrow();
    },
  );

  it('throws DomainError when value is empty', () => {
    expect(() => createLocator({ strategy: 'css', value: '' })).toThrow(DomainError);
  });

  it('throws DomainError when strategy is not one of the known 8', () => {
    expect(() => createLocator({ strategy: 'xpath', value: '//button' })).toThrow(DomainError);
  });
});
