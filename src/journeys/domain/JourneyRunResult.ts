import { DomainError } from './errors.js';
import type { StepResult } from './StepResult.js';

export type JourneyRunStatus = 'passed' | 'failed';

export interface CreateJourneyRunResultInput {
  id: string;
  journeyId?: string;
  profileId?: string;
  startedAt: Date;
  finishedAt: Date;
  stepResults: readonly StepResult[];
  tracePath?: string;
  error?: string;
}

/**
 * The record of one execution of a `Journey`. `status` is a derived getter,
 * never an independently settable field, so it is structurally impossible to
 * construct a `'passed'` result that contains a failed step or a top-level
 * run error: the moment any `stepResults[i].status === 'failed'`, or the
 * `error` field is set, `status` flips to `'failed'`.
 */
export class JourneyRunResult {
  readonly id: string;
  readonly journeyId?: string;
  readonly profileId?: string;
  readonly startedAt: Date;
  readonly finishedAt: Date;
  readonly stepResults: readonly StepResult[];
  readonly tracePath?: string;
  readonly error?: string;

  private constructor(input: CreateJourneyRunResultInput) {
    this.id = input.id;
    this.journeyId = input.journeyId;
    this.profileId = input.profileId;
    this.startedAt = input.startedAt;
    this.finishedAt = input.finishedAt;
    this.stepResults = input.stepResults;
    this.tracePath = input.tracePath;
    this.error = input.error;
  }

  /**
   * `'failed'` iff any step result failed OR the top-level `error` field is
   * set (a run can fail before any step executes, e.g. the browser fails to
   * launch - that must never present as `'passed'`); otherwise `'passed'`.
   */
  get status(): JourneyRunStatus {
    const hasFailedStep = this.stepResults.some((result) => result.status === 'failed');
    return hasFailedStep || Boolean(this.error) ? 'failed' : 'passed';
  }

  static create(input: CreateJourneyRunResultInput): JourneyRunResult {
    if (input == null || typeof input.id !== 'string' || input.id.length === 0) {
      throw new DomainError('JourneyRunResult id must be a non-empty string.');
    }
    if (!(input.startedAt instanceof Date) || Number.isNaN(input.startedAt.getTime())) {
      throw new DomainError('JourneyRunResult startedAt must be a valid Date.');
    }
    if (!(input.finishedAt instanceof Date) || Number.isNaN(input.finishedAt.getTime())) {
      throw new DomainError('JourneyRunResult finishedAt must be a valid Date.');
    }
    if (input.finishedAt.getTime() < input.startedAt.getTime()) {
      throw new DomainError('JourneyRunResult finishedAt must not be before startedAt.');
    }
    if (!Array.isArray(input.stepResults)) {
      throw new DomainError('JourneyRunResult stepResults must be an array.');
    }

    return new JourneyRunResult(input);
  }
}

export function createJourneyRunResult(input: CreateJourneyRunResultInput): JourneyRunResult {
  return JourneyRunResult.create(input);
}
