import type { UserProfile } from '../../domain/UserProfile.js';

export interface ResolvedAuthState {
  /** A `storageState.json` path to hand to Playwright's `newContext`, or `null` for `'none'`. */
  storageStatePath: string | null;
}

/**
 * Turns a `UserProfile.authStrategy` into something a browser context can
 * actually use (adapters/auth implements this).
 *
 * `resolve` is the fast, read-only path consulted on every
 * record/run: `'none'` -> `null`; `'storageState'` -> its `filePath` as-is;
 * `'loginJourney'` -> its `storageStatePath` field as-is, on the assumption
 * that the file was already produced by a prior `refresh`. `resolve` never
 * runs a browser itself - a stale or missing `loginJourney` file is the
 * caller's problem (surfaced by Playwright when it tries to load it), not
 * something `resolve` silently repairs.
 *
 * `refresh` is the slow, explicit path (`qamachine profile refresh <id>`):
 * only meaningful for `'loginJourney'`, where it drives a real run of that
 * strategy's journey and (re)writes `storageStatePath` from the resulting
 * browser context. Implementations should reject `refresh` on `'none'`/
 * `'storageState'` profiles rather than silently no-op, since a user asking
 * to refresh a profile that cannot be refreshed almost certainly has a wrong
 * assumption about it that deserves a clear error, not silence.
 *
 * This port intentionally depends on nothing from the journeys feature in
 * its own signatures - `UserProfile`/`ResolvedAuthState` are all it needs.
 * The concrete adapter (`StorageStateAuthStateProvider`) is where the
 * legitimate cross-feature dependency on journeys' `JourneyRunnerPort` /
 * `JourneyRepository` actually lives, to run and load the login journey.
 */
export interface AuthStateProviderPort {
  resolve(profile: UserProfile): Promise<ResolvedAuthState>;
  refresh(profile: UserProfile): Promise<void>;
}
