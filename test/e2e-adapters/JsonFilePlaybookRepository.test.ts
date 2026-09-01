import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { JsonFilePlaybookRepository } from '../../src/playbooks/adapters/persistence/JsonFilePlaybookRepository.js';
import { createPlaybook, type Playbook } from '../../src/playbooks/domain/Playbook.js';
import { createPlaybookEntry } from '../../src/playbooks/domain/PlaybookEntry.js';
import { DomainError } from '../../src/playbooks/domain/errors.js';

let tempRoot: string;

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'qamachine-playbook-repo-'));
});

afterEach(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
});

function playbooksDir(): string {
  return path.join(tempRoot, 'playbooks');
}

function samplePlaybook(overrides: Partial<{ id: string; name: string }> = {}): Playbook {
  return createPlaybook({
    id: overrides.id ?? 'playbook-1',
    name: overrides.name ?? 'smoke suite',
    createdAt: new Date('2026-01-02T03:04:05.000Z'),
    entries: [
      createPlaybookEntry({
        id: 'entry-1',
        source: { type: 'journey', journeyId: 'journey-1' },
        continueOnFailure: false,
      }),
      createPlaybookEntry({
        id: 'entry-2',
        source: { type: 'template', templateId: 'template-1', parameterBindings: { username: 'alice' } },
        profileOverride: 'profile-1',
        continueOnFailure: true,
      }),
    ],
  });
}

describe('JsonFilePlaybookRepository', () => {
  it('round-trips a playbook through the file system without losing a field', async () => {
    const repository = new JsonFilePlaybookRepository(playbooksDir());
    const playbook = samplePlaybook();

    await repository.save(playbook);
    const loaded = await repository.findById('playbook-1');

    expect(loaded).toEqual(playbook);
    expect(loaded?.createdAt).toBeInstanceOf(Date);
  });

  it('returns null for an unknown id and an empty list before anything is saved', async () => {
    const repository = new JsonFilePlaybookRepository(playbooksDir());

    expect(await repository.findById('nope')).toBeNull();
    expect(await repository.findAll()).toEqual([]);
  });

  it('lists every saved playbook', async () => {
    const repository = new JsonFilePlaybookRepository(playbooksDir());
    await repository.save(samplePlaybook({ id: 'a', name: 'A' }));
    await repository.save(samplePlaybook({ id: 'b', name: 'B' }));

    const names = (await repository.findAll()).map((playbook) => playbook.name).sort();
    expect(names).toEqual(['A', 'B']);
  });

  it('fails loudly on a corrupted record rather than returning a broken aggregate', async () => {
    const repository = new JsonFilePlaybookRepository(playbooksDir());
    await repository.save(samplePlaybook());

    const filePath = path.join(playbooksDir(), 'playbook-1.json');
    const raw = JSON.parse(await fs.readFile(filePath, 'utf8')) as { entries: Array<{ source: { type: string } }> };
    raw.entries[0]!.source.type = 'bogus';
    await fs.writeFile(filePath, JSON.stringify(raw), 'utf8');

    await expect(repository.findById('playbook-1')).rejects.toThrow(DomainError);
  });
});
