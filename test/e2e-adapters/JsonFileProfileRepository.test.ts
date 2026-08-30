import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { JsonFileProfileRepository } from '../../src/profiles/adapters/persistence/JsonFileProfileRepository.js';
import { createAuthStrategy } from '../../src/profiles/domain/AuthStrategy.js';
import { createUserProfile, type UserProfile } from '../../src/profiles/domain/UserProfile.js';
import { DomainError } from '../../src/profiles/domain/errors.js';

let tempRoot: string;

beforeEach(async () => {
  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'qamachine-profile-repo-'));
});

afterEach(async () => {
  await fs.rm(tempRoot, { recursive: true, force: true });
});

function profilesDir(): string {
  return path.join(tempRoot, 'profiles');
}

function sampleProfile(overrides: Partial<{ id: string; name: string }> = {}): UserProfile {
  return createUserProfile({
    id: overrides.id ?? 'profile-1',
    name: overrides.name ?? 'admin',
    authStrategy: createAuthStrategy({
      type: 'loginJourney',
      journeyId: 'journey-1',
      storageStatePath: path.join(tempRoot, 'admin-state.json'),
    }),
    createdAt: new Date('2026-01-02T03:04:05.000Z'),
  });
}

describe('JsonFileProfileRepository', () => {
  it('round-trips a profile through the file system without losing a field', async () => {
    const repository = new JsonFileProfileRepository(profilesDir());
    const profile = sampleProfile();

    await repository.save(profile);
    const loaded = await repository.findById('profile-1');

    expect(loaded).toEqual(profile);
    expect(loaded?.createdAt).toBeInstanceOf(Date);
  });

  it('preserves authLastRefreshedAt across a save/load round trip', async () => {
    const repository = new JsonFileProfileRepository(profilesDir());
    const profile = createUserProfile({
      id: 'profile-1',
      name: 'admin',
      authStrategy: createAuthStrategy({ type: 'none' }),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      authLastRefreshedAt: new Date('2026-01-05T00:00:00.000Z'),
    });

    await repository.save(profile);
    const loaded = await repository.findById('profile-1');

    expect(loaded?.authLastRefreshedAt).toEqual(new Date('2026-01-05T00:00:00.000Z'));
  });

  it('finds a profile by name and returns null for an unknown name', async () => {
    const repository = new JsonFileProfileRepository(profilesDir());
    await repository.save(sampleProfile({ id: 'a', name: 'admin' }));
    await repository.save(sampleProfile({ id: 'b', name: 'regular-user' }));

    await expect(repository.findByName('regular-user')).resolves.toMatchObject({ id: 'b' });
    await expect(repository.findByName('nope')).resolves.toBeNull();
  });

  it('returns null for an unknown id and an empty list before anything is saved', async () => {
    const repository = new JsonFileProfileRepository(profilesDir());

    expect(await repository.findById('nope')).toBeNull();
    expect(await repository.findAll()).toEqual([]);
  });

  it('lists every saved profile', async () => {
    const repository = new JsonFileProfileRepository(profilesDir());
    await repository.save(sampleProfile({ id: 'a', name: 'A' }));
    await repository.save(sampleProfile({ id: 'b', name: 'B' }));

    const names = (await repository.findAll()).map((profile) => profile.name).sort();
    expect(names).toEqual(['A', 'B']);
  });

  it('fails loudly on a corrupted record rather than returning a broken aggregate', async () => {
    const repository = new JsonFileProfileRepository(profilesDir());
    await repository.save(sampleProfile());

    const filePath = path.join(profilesDir(), 'profile-1.json');
    const raw = JSON.parse(await fs.readFile(filePath, 'utf8')) as { authStrategy: { type: string } };
    raw.authStrategy.type = 'oauth';
    await fs.writeFile(filePath, JSON.stringify(raw), 'utf8');

    await expect(repository.findById('profile-1')).rejects.toThrow(DomainError);
  });
});
