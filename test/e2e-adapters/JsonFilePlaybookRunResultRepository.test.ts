import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { JsonFilePlaybookRunResultRepository } from '../../src/playbooks/adapters/persistence/JsonFilePlaybookRunResultRepository.js';
import { createPlaybookRunResult, type PlaybookRunResult } from '../../src/playbooks/domain/PlaybookRunResult.js';
// The corrupted field below (a `StepResult.status`) is reconstructed
// through `journeys/domain/StepResult`'s own factory, so the failure it
// raises is `journeys/domain`'s `DomainError`, not `playbooks/domain`'s -
// see `PlaybookEntryResultSnapshot.stepResults`'s doc comment for why
// `StepResult` is reused verbatim rather than re-declared per feature.
import { DomainError } from '../../src/journeys/domain/errors.js';

let tempRoot: string;

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'qamachine-playbook-run-repo-'));
});

afterEach(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
});

function runsDir(): string {
  return path.join(tempRoot, 'playbook-runs');
}

function sampleResult(overrides: Partial<{ id: string; playbookId: string }> = {}): PlaybookRunResult {
  return createPlaybookRunResult({
    id: overrides.id ?? 'run-1',
    playbookId: overrides.playbookId ?? 'playbook-1',
    startedAt: new Date('2026-01-02T03:04:05.000Z'),
    finishedAt: new Date('2026-01-02T03:04:10.000Z'),
    entryResults: [
      {
        entryId: 'entry-1',
        status: 'passed',
        runId: 'jrun-1',
        journeyId: 'journey-1',
        profileId: 'profile-1',
        startedAt: new Date('2026-01-02T03:04:05.500Z'),
        finishedAt: new Date('2026-01-02T03:04:07.000Z'),
        stepResults: [{ stepId: 'step-1', status: 'passed', durationMs: 120 }],
        tracePath: '/tmp/trace.zip',
      },
      { entryId: 'entry-2', status: 'skipped', stepResults: [] },
    ],
  });
}

describe('JsonFilePlaybookRunResultRepository', () => {
  it('round-trips a run result through the file system without losing a field', async () => {
    const repository = new JsonFilePlaybookRunResultRepository(runsDir());
    const result = sampleResult();

    await repository.save(result);
    const loaded = await repository.findById('run-1');

    expect(loaded).toEqual(result);
    expect(loaded?.overallStatus).toBe('failed');
    expect(loaded?.startedAt).toBeInstanceOf(Date);
    expect(loaded?.entryResults[0]?.startedAt).toBeInstanceOf(Date);
  });

  it('returns null for an unknown id', async () => {
    const repository = new JsonFilePlaybookRunResultRepository(runsDir());

    expect(await repository.findById('nope')).toBeNull();
  });

  it('finds every run for a playbook id and excludes runs of other playbooks', async () => {
    const repository = new JsonFilePlaybookRunResultRepository(runsDir());
    await repository.save(sampleResult({ id: 'run-a', playbookId: 'playbook-1' }));
    await repository.save(sampleResult({ id: 'run-b', playbookId: 'playbook-1' }));
    await repository.save(sampleResult({ id: 'run-c', playbookId: 'playbook-2' }));

    const ids = (await repository.findAllByPlaybookId('playbook-1')).map((result) => result.id).sort();
    expect(ids).toEqual(['run-a', 'run-b']);
    expect(await repository.findAllByPlaybookId('unknown-playbook')).toEqual([]);
  });

  it('fails loudly on a corrupted record rather than returning a broken aggregate', async () => {
    const repository = new JsonFilePlaybookRunResultRepository(runsDir());
    await repository.save(sampleResult());

    const filePath = path.join(runsDir(), 'run-1.json');
    const raw = JSON.parse(await fs.readFile(filePath, 'utf8')) as {
      entryResults: Array<{ stepResults: Array<{ status: string }> }>;
    };
    raw.entryResults[0]!.stepResults[0]!.status = 'bogus';
    await fs.writeFile(filePath, JSON.stringify(raw), 'utf8');

    await expect(repository.findById('run-1')).rejects.toThrow(DomainError);
  });
});
