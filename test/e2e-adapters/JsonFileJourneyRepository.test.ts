import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { JsonFileStore } from '../../src/infrastructure/JsonFileStore.js';
import { resolveDataRoot } from '../../src/infrastructure/paths.js';
import { JsonFileJourneyRepository } from '../../src/journeys/adapters/persistence/JsonFileJourneyRepository.js';
import { createAction } from '../../src/journeys/domain/Action.js';
import { createJourney, type Journey } from '../../src/journeys/domain/Journey.js';
import { createStep } from '../../src/journeys/domain/Step.js';
import { DomainError } from '../../src/journeys/domain/errors.js';

let tempRoot: string;

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'qamachine-repo-'));
});

afterEach(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
});

function journeysDir(): string {
  return path.join(tempRoot, 'journeys');
}

function sampleJourney(overrides: Partial<{ id: string; name: string }> = {}): Journey {
  return createJourney({
    id: overrides.id ?? 'journey-1',
    name: overrides.name ?? 'Sign up',
    startUrl: 'http://localhost:3000/',
    profileId: 'profile-1',
    createdAt: new Date('2026-01-02T03:04:05.000Z'),
    steps: [
      createStep({
        id: 'step-1',
        order: 0,
        action: createAction({ kind: 'goto', url: 'http://localhost:3000/' }),
        label: "await page.goto('http://localhost:3000/');",
      }),
      createStep({
        id: 'step-2',
        order: 1,
        action: createAction({
          kind: 'fill',
          locator: { strategy: 'label', value: 'Email', options: { exact: true } },
          value: 'ada@example.com',
        }),
      }),
    ],
  });
}

describe('JsonFileJourneyRepository', () => {
  it('round-trips a journey through the file system without losing a field', async () => {
    const repository = new JsonFileJourneyRepository(journeysDir());
    const journey = sampleJourney();

    await repository.save(journey);
    const loaded = await repository.findById('journey-1');

    expect(loaded).not.toBeNull();
    expect(loaded).toEqual(journey);
    expect(loaded?.createdAt).toBeInstanceOf(Date);
    expect(loaded?.createdAt.toISOString()).toBe('2026-01-02T03:04:05.000Z');
    expect(loaded?.steps[1]?.action).toEqual(journey.steps[1]?.action);
  });

  it('creates the collection directory on first save', async () => {
    const repository = new JsonFileJourneyRepository(journeysDir());

    await expect(fs.access(journeysDir())).rejects.toThrow();
    await repository.save(sampleJourney());

    await expect(fs.access(path.join(journeysDir(), 'journey-1.json'))).resolves.toBeUndefined();
  });

  it('returns null for an unknown id and an empty list before anything is saved', async () => {
    const repository = new JsonFileJourneyRepository(journeysDir());

    expect(await repository.findById('nope')).toBeNull();
    expect(await repository.findAll()).toEqual([]);
  });

  it('lists every saved journey and forgets a deleted one', async () => {
    const repository = new JsonFileJourneyRepository(journeysDir());
    await repository.save(sampleJourney({ id: 'a', name: 'A' }));
    await repository.save(sampleJourney({ id: 'b', name: 'B' }));

    const names = (await repository.findAll()).map((journey) => journey.name).sort();
    expect(names).toEqual(['A', 'B']);

    await repository.delete('a');
    expect((await repository.findAll()).map((journey) => journey.id)).toEqual(['b']);
  });

  it('treats deleting an unknown id as a no-op', async () => {
    const repository = new JsonFileJourneyRepository(journeysDir());

    await expect(repository.delete('never-existed')).resolves.toBeUndefined();
  });

  it('fails loudly on a corrupted record rather than returning a broken aggregate', async () => {
    const repository = new JsonFileJourneyRepository(journeysDir());
    await repository.save(sampleJourney());

    const filePath = path.join(journeysDir(), 'journey-1.json');
    const raw = JSON.parse(await fs.readFile(filePath, 'utf8')) as { steps: { action: { kind: string } }[] };
    raw.steps[0]!.action.kind = 'teleport';
    await fs.writeFile(filePath, JSON.stringify(raw), 'utf8');

    await expect(repository.findById('journey-1')).rejects.toThrow(DomainError);
  });

  it('rejects a record whose timestamp is no longer a valid date', async () => {
    const repository = new JsonFileJourneyRepository(journeysDir());
    await repository.save(sampleJourney());

    const filePath = path.join(journeysDir(), 'journey-1.json');
    const raw = JSON.parse(await fs.readFile(filePath, 'utf8')) as { createdAt: string };
    raw.createdAt = 'the day before yesterday';
    await fs.writeFile(filePath, JSON.stringify(raw), 'utf8');

    await expect(repository.findById('journey-1')).rejects.toThrow(DomainError);
  });
});

describe('JsonFileStore', () => {
  it('leaves no temp file behind after a save', async () => {
    const store = new JsonFileStore<{ value: number }>(path.join(tempRoot, 'things'));

    await store.save('one', { value: 1 });

    expect(await fs.readdir(path.join(tempRoot, 'things'))).toEqual(['one.json']);
  });

  it('overwrites an existing record in place', async () => {
    const store = new JsonFileStore<{ value: number }>(path.join(tempRoot, 'things'));

    await store.save('one', { value: 1 });
    await store.save('one', { value: 2 });

    expect(await store.findById('one')).toEqual({ value: 2 });
    expect(await store.findAll()).toEqual([{ value: 2 }]);
  });

  it('ignores in-flight `.json.tmp` files when listing', async () => {
    const dir = path.join(tempRoot, 'things');
    const store = new JsonFileStore<{ value: number }>(dir);
    await store.save('one', { value: 1 });
    await fs.writeFile(path.join(dir, 'two.json.tmp'), '{"value":2}', 'utf8');

    expect(await store.findAll()).toEqual([{ value: 1 }]);
  });

  it('refuses an id that would escape the store directory', async () => {
    const store = new JsonFileStore<{ value: number }>(path.join(tempRoot, 'things'));

    await expect(store.save('../escape', { value: 1 })).rejects.toThrow(/path separators/);
    await expect(store.findById('..')).rejects.toThrow(/path separators/);
  });
});

describe('resolveDataRoot', () => {
  const originalHome = process.env.QAMACHINE_HOME;

  afterEach(() => {
    if (originalHome === undefined) {
      delete process.env.QAMACHINE_HOME;
    } else {
      process.env.QAMACHINE_HOME = originalHome;
    }
  });

  it('prefers QAMACHINE_HOME when it is set', () => {
    process.env.QAMACHINE_HOME = path.join(tempRoot, 'custom-home');

    expect(resolveDataRoot()).toBe(path.join(tempRoot, 'custom-home'));
  });

  it('falls back to `.qamachine` under the working directory', () => {
    delete process.env.QAMACHINE_HOME;

    expect(resolveDataRoot()).toBe(path.resolve(process.cwd(), '.qamachine'));
  });
});
