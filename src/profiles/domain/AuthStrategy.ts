import { DomainError } from './errors.js';

export interface NoneAuthStrategy {
  readonly type: 'none';
}

export interface StorageStateAuthStrategy {
  readonly type: 'storageState';
  readonly filePath: string;
}

export interface LoginJourneyAuthStrategy {
  readonly type: 'loginJourney';
  readonly journeyId: string;
  readonly storageStatePath: string;
}

/**
 * How a profile's authenticated browser state is obtained, discriminated on
 * `type`:
 * - `'none'` - no auth state is applied; runs/records start unauthenticated.
 * - `'storageState'` - a `storageState.json` file already sits at `filePath`
 *   (produced outside QAMachine, e.g. exported by hand).
 * - `'loginJourney'` - `journeyId` names a `Journey` that logs in; running it
 *   captures `context.storageState()` to `storageStatePath`, which is then
 *   reused on future resolves without re-running the login (see
 *   `AuthStateProviderPort.resolve` vs `.refresh`).
 */
export type AuthStrategy = NoneAuthStrategy | StorageStateAuthStrategy | LoginJourneyAuthStrategy;

/** Raw input for `createAuthStrategy`: same shape as `AuthStrategy`, unvalidated. */
export type CreateAuthStrategyInput =
  | { type: 'none' }
  | { type: 'storageState'; filePath: string }
  | { type: 'loginJourney'; journeyId: string; storageStatePath: string };

const AUTH_STRATEGY_TYPES: readonly AuthStrategy['type'][] = ['none', 'storageState', 'loginJourney'];

function isAuthStrategyType(value: string): value is AuthStrategy['type'] {
  return (AUTH_STRATEGY_TYPES as readonly string[]).includes(value);
}

function requireNonEmptyString(value: unknown, fieldName: string, type: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new DomainError(`AuthStrategy of type "${type}" requires a non-empty "${fieldName}" field.`);
  }
  return value;
}

/**
 * Builds an `AuthStrategy`, throwing `DomainError` on an unknown `type` or a
 * missing/empty required field for the given `type`.
 */
export function createAuthStrategy(input: CreateAuthStrategyInput): AuthStrategy {
  if (input == null || typeof input.type !== 'string' || !isAuthStrategyType(input.type)) {
    throw new DomainError(`Unknown auth strategy type "${String((input as { type?: unknown } | null)?.type)}".`);
  }

  switch (input.type) {
    case 'none':
      return { type: 'none' };
    case 'storageState':
      return { type: 'storageState', filePath: requireNonEmptyString(input.filePath, 'filePath', input.type) };
    case 'loginJourney':
      return {
        type: 'loginJourney',
        journeyId: requireNonEmptyString(input.journeyId, 'journeyId', input.type),
        storageStatePath: requireNonEmptyString(input.storageStatePath, 'storageStatePath', input.type),
      };
    /* istanbul ignore next -- unreachable: input.type was validated against AUTH_STRATEGY_TYPES above */
    default: {
      const exhaustive: never = input;
      throw new DomainError(`Unknown auth strategy type "${String((exhaustive as { type: string }).type)}".`);
    }
  }
}
