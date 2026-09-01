import { describe, expect, it } from 'vitest';
import { DomainError } from './errors.js';
import { createPlaybookRunResult, type PlaybookEntryResult } from './PlaybookRunResult.js';

const startedAt = new Date('2026-01-01T00:00:00Z');
const finishedAt = new Date('2026-01-01T00:00:05Z');

function passedEntry(entryId: string): PlaybookEntryResult {
  return { entryId, status: 'passed', stepResults: [] };
}

function failedEntry(entryId: string): PlaybookEntryResult {
  return { entryId, status: 'failed', stepResults: [], error: 'boom' };
}

function skippedEntry(entryId: string): PlaybookEntryResult {
  return { entryId, status: 'skipped', stepResults: [] };
}

describe('createPlaybookRunResult', () => {
  it('builds a run result from valid input', () => {
    const result = createPlaybookRunResult({
      id: 'run-1',
      playbookId: 'playbook-1',
      startedAt,
      finishedAt,
      entryResults: [passedEntry('entry-1')],
    });
    expect(result.id).toBe('run-1');
    expect(result.playbookId).toBe('playbook-1');
  });

  it('throws DomainError when id is empty', () => {
    expect(() =>
      createPlaybookRunResult({ id: '', playbookId: 'playbook-1', startedAt, finishedAt, entryResults: [] }),
    ).toThrow(DomainError);
  });

  it('throws DomainError when playbookId is empty', () => {
    expect(() =>
      createPlaybookRunResult({ id: 'run-1', playbookId: '', startedAt, finishedAt, entryResults: [] }),
    ).toThrow(DomainError);
  });

  it('throws DomainError when finishedAt is before startedAt', () => {
    expect(() =>
      createPlaybookRunResult({
        id: 'run-1',
        playbookId: 'playbook-1',
        startedAt: finishedAt,
        finishedAt: startedAt,
        entryResults: [],
      }),
    ).toThrow(DomainError);
  });

  it('throws DomainError when startedAt is an invalid Date', () => {
    expect(() =>
      createPlaybookRunResult({
        id: 'run-1',
        playbookId: 'playbook-1',
        startedAt: new Date('not-a-date'),
        finishedAt,
        entryResults: [],
      }),
    ).toThrow(DomainError);
  });
});

describe('PlaybookRunResult.overallStatus', () => {
  it('is "passed" when every entry result passed', () => {
    const result = createPlaybookRunResult({
      id: 'run-1',
      playbookId: 'playbook-1',
      startedAt,
      finishedAt,
      entryResults: [passedEntry('entry-1'), passedEntry('entry-2')],
    });
    expect(result.overallStatus).toBe('passed');
  });

  it('is "passed" when there are no entry results', () => {
    const result = createPlaybookRunResult({
      id: 'run-1',
      playbookId: 'playbook-1',
      startedAt,
      finishedAt,
      entryResults: [],
    });
    expect(result.overallStatus).toBe('passed');
  });

  it('flips to "failed" the moment any entry result is "failed"', () => {
    const result = createPlaybookRunResult({
      id: 'run-1',
      playbookId: 'playbook-1',
      startedAt,
      finishedAt,
      entryResults: [passedEntry('entry-1'), failedEntry('entry-2'), skippedEntry('entry-3')],
    });
    expect(result.overallStatus).toBe('failed');
  });

  it('is "failed" when an entry was skipped, even with no failed entries', () => {
    const result = createPlaybookRunResult({
      id: 'run-1',
      playbookId: 'playbook-1',
      startedAt,
      finishedAt,
      entryResults: [passedEntry('entry-1'), skippedEntry('entry-2')],
    });
    expect(result.overallStatus).toBe('failed');
  });

  it('has no setter, so overallStatus cannot be assigned directly', () => {
    const result = createPlaybookRunResult({
      id: 'run-1',
      playbookId: 'playbook-1',
      startedAt,
      finishedAt,
      entryResults: [failedEntry('entry-1')],
    });
    expect(() => {
      // @ts-expect-error overallStatus is a read-only derived getter, not an assignable property
      result.overallStatus = 'passed';
    }).toThrow();
    expect(result.overallStatus).toBe('failed');
  });
});
