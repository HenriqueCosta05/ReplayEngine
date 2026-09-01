import { describe, expect, it } from 'vitest';
import { DomainError } from './errors.js';
import { createStepResult } from './StepResult.js';

describe('createStepResult', () => {
  it('builds a passed step result', () => {
    const result = createStepResult({ stepId: 'step-1', status: 'passed', durationMs: 120 });
    expect(result).toEqual({ stepId: 'step-1', status: 'passed', durationMs: 120 });
  });

  it('builds a skipped step result', () => {
    const result = createStepResult({ stepId: 'step-1', status: 'skipped', durationMs: 0 });
    expect(result.status).toBe('skipped');
  });

  it('builds a failed step result with an errorMessage', () => {
    const result = createStepResult({
      stepId: 'step-1',
      status: 'failed',
      durationMs: 500,
      errorMessage: 'element not found',
    });
    expect(result.errorMessage).toBe('element not found');
  });

  it('accepts an optional screenshotPath', () => {
    const result = createStepResult({
      stepId: 'step-1',
      status: 'passed',
      durationMs: 10,
      screenshotPath: '/tmp/shot.png',
    });
    expect(result.screenshotPath).toBe('/tmp/shot.png');
  });

  it('throws DomainError when stepId is empty', () => {
    expect(() => createStepResult({ stepId: '', status: 'passed', durationMs: 0 })).toThrow(DomainError);
  });

  it('throws DomainError for an unknown status', () => {
    expect(() =>
      createStepResult({ stepId: 'step-1', status: 'errored' as unknown as 'passed', durationMs: 0 }),
    ).toThrow(DomainError);
  });

  it('throws DomainError when durationMs is negative', () => {
    expect(() => createStepResult({ stepId: 'step-1', status: 'passed', durationMs: -1 })).toThrow(DomainError);
  });

  it('throws DomainError when status is "failed" but errorMessage is missing', () => {
    expect(() => createStepResult({ stepId: 'step-1', status: 'failed', durationMs: 10 })).toThrow(DomainError);
  });

  it('throws DomainError when status is "failed" and errorMessage is an empty string', () => {
    expect(() =>
      createStepResult({ stepId: 'step-1', status: 'failed', durationMs: 10, errorMessage: '' }),
    ).toThrow(DomainError);
  });
});
