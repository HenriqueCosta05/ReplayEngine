import { describe, expect, it } from 'vitest';
import { DomainError } from './errors.js';
import { createJourneyRunResult } from './JourneyRunResult.js';
import { createStepResult } from './StepResult.js';

const startedAt = new Date('2026-01-01T00:00:00Z');
const finishedAt = new Date('2026-01-01T00:00:05Z');

describe('createJourneyRunResult', () => {
  it('builds a run result from valid input', () => {
    const result = createJourneyRunResult({
      id: 'run-1',
      startedAt,
      finishedAt,
      stepResults: [createStepResult({ stepId: 's1', status: 'passed', durationMs: 10 })],
    });
    expect(result.id).toBe('run-1');
  });

  it('accepts optional journeyId, profileId, tracePath and error', () => {
    const result = createJourneyRunResult({
      id: 'run-1',
      journeyId: 'journey-1',
      profileId: 'profile-1',
      startedAt,
      finishedAt,
      stepResults: [],
      tracePath: '/tmp/trace.zip',
      error: 'browser crashed',
    });
    expect(result.journeyId).toBe('journey-1');
    expect(result.profileId).toBe('profile-1');
    expect(result.tracePath).toBe('/tmp/trace.zip');
    expect(result.error).toBe('browser crashed');
  });

  it('throws DomainError when id is empty', () => {
    expect(() => createJourneyRunResult({ id: '', startedAt, finishedAt, stepResults: [] })).toThrow(DomainError);
  });

  it('throws DomainError when finishedAt is before startedAt', () => {
    expect(() =>
      createJourneyRunResult({ id: 'run-1', startedAt: finishedAt, finishedAt: startedAt, stepResults: [] }),
    ).toThrow(DomainError);
  });

  it('throws DomainError when startedAt is an invalid Date', () => {
    expect(() =>
      createJourneyRunResult({ id: 'run-1', startedAt: new Date('not-a-date'), finishedAt, stepResults: [] }),
    ).toThrow(DomainError);
  });
});

describe('JourneyRunResult.status', () => {
  it('is "passed" when every step result passed', () => {
    const result = createJourneyRunResult({
      id: 'run-1',
      startedAt,
      finishedAt,
      stepResults: [
        createStepResult({ stepId: 's1', status: 'passed', durationMs: 10 }),
        createStepResult({ stepId: 's2', status: 'skipped', durationMs: 0 }),
      ],
    });
    expect(result.status).toBe('passed');
  });

  it('is "passed" when there are no step results and no top-level error', () => {
    const result = createJourneyRunResult({ id: 'run-1', startedAt, finishedAt, stepResults: [] });
    expect(result.status).toBe('passed');
  });

  it('is "failed" when stepResults is empty but a top-level error is set (e.g. browser failed to launch)', () => {
    const result = createJourneyRunResult({
      id: 'run-1',
      startedAt,
      finishedAt,
      stepResults: [],
      error: 'failed to launch browser',
    });
    expect(result.status).toBe('failed');
  });

  it('flips to "failed" the moment any step result is "failed"', () => {
    const result = createJourneyRunResult({
      id: 'run-1',
      startedAt,
      finishedAt,
      stepResults: [
        createStepResult({ stepId: 's1', status: 'passed', durationMs: 10 }),
        createStepResult({ stepId: 's2', status: 'failed', durationMs: 5, errorMessage: 'boom' }),
        createStepResult({ stepId: 's3', status: 'skipped', durationMs: 0 }),
      ],
    });
    expect(result.status).toBe('failed');
  });

  it('has no setter, so status cannot be assigned directly', () => {
    const result = createJourneyRunResult({
      id: 'run-1',
      startedAt,
      finishedAt,
      stepResults: [createStepResult({ stepId: 's1', status: 'failed', durationMs: 5, errorMessage: 'boom' })],
    });
    expect(() => {
      // @ts-expect-error status is a read-only derived getter, not an assignable property
      result.status = 'passed';
    }).toThrow();
    expect(result.status).toBe('failed');
  });
});
