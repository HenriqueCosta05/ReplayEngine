import type { StepResult } from '../../../journeys/domain/StepResult.js';
import type { PlaybookEntryStatus } from '../../domain/PlaybookRunResult.js';

/**
 * The on-disk shape of one `PlaybookEntryResult`: structurally identical to
 * the domain shape except that `startedAt`/`finishedAt` are ISO-8601
 * strings rather than `Date`s, because JSON has no date type. `stepResults`
 * is reused verbatim (`StepResult[]`) - already a plain, JSON-serialisable
 * shape, same rationale as `PlaybookEntrySnapshot.source` in
 * `PlaybookSnapshot.ts`.
 */
export interface PlaybookEntryResultSnapshot {
  entryId: string;
  status: PlaybookEntryStatus;
  runId?: string;
  journeyId?: string;
  profileId?: string;
  startedAt?: string;
  finishedAt?: string;
  stepResults: StepResult[];
  tracePath?: string;
  error?: string;
}

/**
 * The on-disk shape of a `PlaybookRunResult`: structurally identical to the
 * domain aggregate except that `startedAt`/`finishedAt` (both the top-level
 * ones and each entry result's own) are ISO-8601 strings rather than
 * `Date`s. `overallStatus` is deliberately absent - it is a derived getter
 * on the domain class, not stored state, same as `JourneyRunResult.status`
 * is never persisted by `JsonFileJourneyRepository`... (there is no such
 * repository for run results, but the principle carries: recompute derived
 * fields on load, never trust a stale persisted copy).
 */
export interface PlaybookRunResultSnapshot {
  id: string;
  playbookId: string;
  startedAt: string;
  finishedAt: string;
  entryResults: PlaybookEntryResultSnapshot[];
}
