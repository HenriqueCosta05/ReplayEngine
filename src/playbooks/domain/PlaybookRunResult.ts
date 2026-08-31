import { DomainError } from './errors.js';
import type { StepResult } from '../../journeys/domain/StepResult.js';

export type PlaybookEntryStatus = 'passed' | 'failed' | 'skipped';

/**
 * One playbook entry's outcome, as recorded by `RunPlaybookUseCase`.
 *
 * The brief describes this shape as `JourneyRunResult & {entryId, status}`.
 * Taken as a literal TypeScript intersection that does not hold up:
 * `JourneyRunResult.status` is itself a derived getter typed
 * `'passed'|'failed'`, and intersecting that with `'passed'|'failed'|
 * 'skipped'` collapses back down to `'passed'|'failed'` (the narrower union)
 * - so `'skipped'`, the one status a halted entry actually needs, could
 * never be assigned. Mirroring how Task 6 reconciled `Template.instantiate`'s
 * brief-level shape into an actual buildable type (`TransientJourneyDraft`
 * instead of a literal `Journey`), this is its own plain value shape: the
 * same run-result fields `JourneyRunResult` carries (all optional here,
 * since a `'skipped'` entry never actually ran and so has none of them) plus
 * this entry's own `entryId` and `status` - not a real `JourneyRunResult`
 * instance and not a literal `&` intersection with one.
 */
export interface PlaybookEntryResult {
  readonly entryId: string;
  readonly status: PlaybookEntryStatus;
  readonly runId?: string;
  readonly journeyId?: string;
  readonly profileId?: string;
  readonly startedAt?: Date;
  readonly finishedAt?: Date;
  readonly stepResults: readonly StepResult[];
  readonly tracePath?: string;
  readonly error?: string;
}

export interface CreatePlaybookRunResultInput {
  id: string;
  playbookId: string;
  startedAt: Date;
  finishedAt: Date;
  entryResults: readonly PlaybookEntryResult[];
}

/**
 * The record of one execution of a `Playbook` - a suite run across all its
 * entries. `overallStatus` is a derived getter, never an independently
 * settable field, mirroring `JourneyRunResult.status`'s Task-1 invariant
 * exactly: `'passed'` iff every `entryResults[i].status === 'passed'`, so it
 * is structurally impossible to construct an `overallStatus: 'passed'`
 * result that actually contains a failed or skipped entry.
 */
export class PlaybookRunResult {
  readonly id: string;
  readonly playbookId: string;
  readonly startedAt: Date;
  readonly finishedAt: Date;
  readonly entryResults: readonly PlaybookEntryResult[];

  private constructor(input: CreatePlaybookRunResultInput) {
    this.id = input.id;
    this.playbookId = input.playbookId;
    this.startedAt = input.startedAt;
    this.finishedAt = input.finishedAt;
    this.entryResults = input.entryResults;
  }

  get overallStatus(): 'passed' | 'failed' {
    return this.entryResults.every((entryResult) => entryResult.status === 'passed') ? 'passed' : 'failed';
  }

  static create(input: CreatePlaybookRunResultInput): PlaybookRunResult {
    if (input == null || typeof input.id !== 'string' || input.id.length === 0) {
      throw new DomainError('PlaybookRunResult id must be a non-empty string.');
    }
    if (typeof input.playbookId !== 'string' || input.playbookId.length === 0) {
      throw new DomainError('PlaybookRunResult playbookId must be a non-empty string.');
    }
    if (!(input.startedAt instanceof Date) || Number.isNaN(input.startedAt.getTime())) {
      throw new DomainError('PlaybookRunResult startedAt must be a valid Date.');
    }
    if (!(input.finishedAt instanceof Date) || Number.isNaN(input.finishedAt.getTime())) {
      throw new DomainError('PlaybookRunResult finishedAt must be a valid Date.');
    }
    if (input.finishedAt.getTime() < input.startedAt.getTime()) {
      throw new DomainError('PlaybookRunResult finishedAt must not be before startedAt.');
    }
    if (!Array.isArray(input.entryResults)) {
      throw new DomainError('PlaybookRunResult entryResults must be an array.');
    }

    return new PlaybookRunResult(input);
  }
}

export function createPlaybookRunResult(input: CreatePlaybookRunResultInput): PlaybookRunResult {
  return PlaybookRunResult.create(input);
}
