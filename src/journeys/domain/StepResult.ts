import { DomainError } from './errors.js';

export type StepOutcome = 'passed' | 'failed' | 'skipped';

const STEP_OUTCOMES: readonly StepOutcome[] = ['passed', 'failed', 'skipped'];

export interface CreateStepResultInput {
  stepId: string;
  status: StepOutcome;
  durationMs: number;
  errorMessage?: string;
  screenshotPath?: string;
}

/** The outcome of executing a single `Step` during a journey run. */
export interface StepResult {
  readonly stepId: string;
  readonly status: StepOutcome;
  readonly durationMs: number;
  readonly errorMessage?: string;
  readonly screenshotPath?: string;
}

export function createStepResult(input: CreateStepResultInput): StepResult {
  if (input == null || typeof input.stepId !== 'string' || input.stepId.length === 0) {
    throw new DomainError('StepResult stepId must be a non-empty string.');
  }
  if (typeof input.status !== 'string' || !(STEP_OUTCOMES as readonly string[]).includes(input.status)) {
    throw new DomainError(`StepResult status must be one of ${STEP_OUTCOMES.join(', ')}.`);
  }
  if (typeof input.durationMs !== 'number' || !Number.isFinite(input.durationMs) || input.durationMs < 0) {
    throw new DomainError('StepResult durationMs must be a non-negative finite number.');
  }
  if (input.status === 'failed' && (typeof input.errorMessage !== 'string' || input.errorMessage.length === 0)) {
    throw new DomainError('StepResult with status "failed" must include a non-empty errorMessage.');
  }

  return {
    stepId: input.stepId,
    status: input.status,
    durationMs: input.durationMs,
    ...(input.errorMessage !== undefined ? { errorMessage: input.errorMessage } : {}),
    ...(input.screenshotPath !== undefined ? { screenshotPath: input.screenshotPath } : {}),
  };
}
