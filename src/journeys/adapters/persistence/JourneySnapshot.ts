import type { Action } from '../../domain/Action.js';

/**
 * The on-disk shape of a `Journey`: structurally identical to the domain
 * entity except that `createdAt` is an ISO-8601 string rather than a `Date`,
 * because JSON has no date type.
 *
 * `action` is typed as the domain `Action` for the *writer*'s benefit (the
 * union is already plain-JSON-serialisable, so serialising it is lossless).
 * Readers must not trust that type: a file on disk can have been hand-edited
 * or written by an older version, so `JsonFileJourneyRepository` re-validates
 * every field through the domain factories on the way back in.
 */
export interface StepSnapshot {
  id: string;
  order: number;
  action: Action;
  label?: string;
}

export interface JourneySnapshot {
  id: string;
  name: string;
  startUrl: string;
  profileId?: string;
  createdAt: string;
  steps: StepSnapshot[];
}
