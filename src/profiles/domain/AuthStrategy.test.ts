import { describe, expect, it } from 'vitest';
import { DomainError } from './errors.js';
import { createAuthStrategy } from './AuthStrategy.js';

describe('createAuthStrategy', () => {
  it('builds a "none" strategy', () => {
    expect(createAuthStrategy({ type: 'none' })).toEqual({ type: 'none' });
  });

  it('builds a "storageState" strategy', () => {
    expect(createAuthStrategy({ type: 'storageState', filePath: '/tmp/state.json' })).toEqual({
      type: 'storageState',
      filePath: '/tmp/state.json',
    });
  });

  it('throws DomainError when "storageState" filePath is empty', () => {
    expect(() => createAuthStrategy({ type: 'storageState', filePath: '' })).toThrow(DomainError);
  });

  it('builds a "loginJourney" strategy', () => {
    expect(
      createAuthStrategy({ type: 'loginJourney', journeyId: 'journey-1', storageStatePath: '/tmp/state.json' }),
    ).toEqual({ type: 'loginJourney', journeyId: 'journey-1', storageStatePath: '/tmp/state.json' });
  });

  it('throws DomainError when "loginJourney" journeyId is empty', () => {
    expect(() =>
      createAuthStrategy({ type: 'loginJourney', journeyId: '', storageStatePath: '/tmp/state.json' }),
    ).toThrow(DomainError);
  });

  it('throws DomainError when "loginJourney" storageStatePath is empty', () => {
    expect(() =>
      createAuthStrategy({ type: 'loginJourney', journeyId: 'journey-1', storageStatePath: '' }),
    ).toThrow(DomainError);
  });

  it('throws DomainError on an unknown type', () => {
    expect(() => createAuthStrategy({ type: 'oauth' } as never)).toThrow(DomainError);
  });
});
