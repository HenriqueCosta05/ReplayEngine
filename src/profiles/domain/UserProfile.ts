import { DomainError } from './errors.js';
import type { AuthStrategy } from './AuthStrategy.js';

export interface CreateUserProfileInput {
  id: string;
  name: string;
  authStrategy: AuthStrategy;
  createdAt: Date;
  authLastRefreshedAt?: Date;
}

/**
 * A locally-registered user identity (e.g. "admin" vs. "regular user") whose
 * `authStrategy` says how to obtain an authenticated browser state for it.
 * `authLastRefreshedAt` is set only after `RefreshProfileAuthUseCase`
 * successfully re-runs a `loginJourney` strategy's journey - it is `undefined`
 * for a freshly-registered profile and for `'none'`/`'storageState'`
 * strategies that are never "refreshed" in that sense.
 */
export interface UserProfile {
  readonly id: string;
  readonly name: string;
  readonly authStrategy: AuthStrategy;
  readonly createdAt: Date;
  readonly authLastRefreshedAt?: Date;
}

export function createUserProfile(input: CreateUserProfileInput): UserProfile {
  if (input == null || typeof input.id !== 'string' || input.id.length === 0) {
    throw new DomainError('UserProfile id must be a non-empty string.');
  }
  if (typeof input.name !== 'string' || input.name.trim().length === 0) {
    throw new DomainError('UserProfile name must not be empty.');
  }
  if (input.authStrategy == null || typeof input.authStrategy.type !== 'string') {
    throw new DomainError('UserProfile requires a valid authStrategy.');
  }
  if (!(input.createdAt instanceof Date) || Number.isNaN(input.createdAt.getTime())) {
    throw new DomainError('UserProfile createdAt must be a valid Date.');
  }
  if (
    input.authLastRefreshedAt !== undefined &&
    (!(input.authLastRefreshedAt instanceof Date) || Number.isNaN(input.authLastRefreshedAt.getTime()))
  ) {
    throw new DomainError('UserProfile authLastRefreshedAt, when provided, must be a valid Date.');
  }

  return {
    id: input.id,
    name: input.name,
    authStrategy: input.authStrategy,
    createdAt: input.createdAt,
    ...(input.authLastRefreshedAt !== undefined ? { authLastRefreshedAt: input.authLastRefreshedAt } : {}),
  };
}
