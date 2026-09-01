import type { AuthStrategy } from '../../domain/AuthStrategy.js';

/**
 * The on-disk shape of a `UserProfile`: structurally identical to the domain
 * entity except that `createdAt`/`authLastRefreshedAt` are ISO-8601 strings
 * rather than `Date`s, because JSON has no date type.
 *
 * `authStrategy` is typed as the domain `AuthStrategy` for the *writer*'s
 * benefit (the union is already plain-JSON-serialisable). Readers must not
 * trust that type: a file on disk can have been hand-edited or written by an
 * older version, so `JsonFileProfileRepository` re-validates every field
 * through the domain factories on the way back in.
 */
export interface ProfileSnapshot {
  id: string;
  name: string;
  authStrategy: AuthStrategy;
  createdAt: string;
  authLastRefreshedAt?: string;
}
