import { describe, expect, it } from 'vitest';
import { createAuthStrategy } from './AuthStrategy.js';
import { DomainError } from './errors.js';
import { createUserProfile } from './UserProfile.js';

const NONE_STRATEGY = createAuthStrategy({ type: 'none' });

describe('createUserProfile', () => {
  it('builds a profile from valid input', () => {
    const profile = createUserProfile({
      id: 'profile-1',
      name: 'admin',
      authStrategy: NONE_STRATEGY,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    expect(profile).toEqual({
      id: 'profile-1',
      name: 'admin',
      authStrategy: NONE_STRATEGY,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    expect(profile.authLastRefreshedAt).toBeUndefined();
  });

  it('preserves authLastRefreshedAt when provided', () => {
    const profile = createUserProfile({
      id: 'profile-1',
      name: 'admin',
      authStrategy: NONE_STRATEGY,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      authLastRefreshedAt: new Date('2026-01-02T00:00:00.000Z'),
    });

    expect(profile.authLastRefreshedAt).toEqual(new Date('2026-01-02T00:00:00.000Z'));
  });

  it('throws DomainError when id is empty', () => {
    expect(() =>
      createUserProfile({ id: '', name: 'admin', authStrategy: NONE_STRATEGY, createdAt: new Date() }),
    ).toThrow(DomainError);
  });

  it('throws DomainError when name is empty or blank', () => {
    expect(() =>
      createUserProfile({ id: 'p1', name: '', authStrategy: NONE_STRATEGY, createdAt: new Date() }),
    ).toThrow(DomainError);
    expect(() =>
      createUserProfile({ id: 'p1', name: '   ', authStrategy: NONE_STRATEGY, createdAt: new Date() }),
    ).toThrow(DomainError);
  });

  it('throws DomainError when createdAt is not a valid Date', () => {
    expect(() =>
      createUserProfile({
        id: 'p1',
        name: 'admin',
        authStrategy: NONE_STRATEGY,
        createdAt: new Date('nonsense'),
      }),
    ).toThrow(DomainError);
  });

  it('throws DomainError when authLastRefreshedAt is provided but invalid', () => {
    expect(() =>
      createUserProfile({
        id: 'p1',
        name: 'admin',
        authStrategy: NONE_STRATEGY,
        createdAt: new Date(),
        authLastRefreshedAt: new Date('nonsense'),
      }),
    ).toThrow(DomainError);
  });
});
