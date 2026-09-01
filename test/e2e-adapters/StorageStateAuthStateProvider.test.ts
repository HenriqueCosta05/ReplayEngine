import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { StorageStateAuthStateProvider } from '../../src/profiles/adapters/auth/StorageStateAuthStateProvider.js';
import { createAuthStrategy } from '../../src/profiles/domain/AuthStrategy.js';
import { createUserProfile } from '../../src/profiles/domain/UserProfile.js';
import { PlaywrightStepInterpreter } from '../../src/journeys/adapters/execution/PlaywrightStepInterpreter.js';
import { createAction } from '../../src/journeys/domain/Action.js';
import { createJourney } from '../../src/journeys/domain/Journey.js';
import { createStep } from '../../src/journeys/domain/Step.js';
import type { ClockPort } from '../../src/shared-kernel/application/ports/ClockPort.js';
import type { IdGeneratorPort } from '../../src/shared-kernel/application/ports/IdGeneratorPort.js';
import { FakeJourneyRepository } from '../unit/fakes/FakeJourneyRepository.js';
import { pagesFixtureDir } from './helpers/fixtures.js';
import { startStaticServer, type StaticServer } from './helpers/staticServer.js';

let server: StaticServer;

beforeAll(async () => {
  server = await startStaticServer(pagesFixtureDir);
});

afterAll(async () => {
  await server.close();
});

const systemClock: ClockPort = { now: () => new Date() };

function sequentialIds(prefix: string): IdGeneratorPort {
  let next = 0;
  return { generate: () => `${prefix}-${++next}` };
}

/**
 * Real `PlaywrightStepInterpreter` (real headless Chromium), not a fake -
 * this test exists specifically to prove the failed-run/no-clobber guarantee
 * holds against the actual `context.storageState()` call, not just against a
 * scripted fake that can't observe a real file write.
 */
function realRunner(): PlaywrightStepInterpreter {
  return new PlaywrightStepInterpreter(sequentialIds('run'), systemClock, { headless: true });
}

describe('StorageStateAuthStateProvider.refresh against a real browser (no-clobber guarantee)', () => {
  it('leaves a previously-good storageStatePath file untouched when the login journey fails', async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qamachine-auth-refresh-'));
    const storageStatePath = path.join(stateDir, 'admin-state.json');
    const preExistingContent = JSON.stringify({
      cookies: [{ name: 'session', value: 'still-good' }],
      origins: [],
    });
    await fs.writeFile(storageStatePath, preExistingContent, 'utf8');

    try {
      const journeyRepository = new FakeJourneyRepository();
      const failingLoginJourney = createJourney({
        id: 'login-journey',
        name: 'Log in (broken)',
        startUrl: `${server.origin}/form.html`,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        steps: [
          createStep({ id: 's1', order: 0, action: createAction({ kind: 'goto', url: `${server.origin}/form.html` }) }),
          createStep({
            id: 's2',
            order: 1,
            action: createAction({
              kind: 'assertText',
              locator: { strategy: 'testId', value: 'status' },
              expected: 'This will never match',
            }),
          }),
        ],
      });
      journeyRepository.seed(failingLoginJourney);

      const profile = createUserProfile({
        id: 'profile-1',
        name: 'admin',
        authStrategy: createAuthStrategy({
          type: 'loginJourney',
          journeyId: 'login-journey',
          storageStatePath,
        }),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      });

      const provider = new StorageStateAuthStateProvider(journeyRepository, realRunner());

      await expect(provider.refresh(profile)).rejects.toThrow(/failed while refreshing/);
      expect(await fs.readFile(storageStatePath, 'utf8')).toBe(preExistingContent);
    } finally {
      await fs.rm(stateDir, { recursive: true, force: true });
    }
  });

  it('does overwrite storageStatePath when the login journey passes', async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qamachine-auth-refresh-'));
    const storageStatePath = path.join(stateDir, 'admin-state.json');
    await fs.writeFile(storageStatePath, JSON.stringify({ cookies: [], origins: [] }), 'utf8');

    try {
      const journeyRepository = new FakeJourneyRepository();
      const passingLoginJourney = createJourney({
        id: 'login-journey',
        name: 'Log in',
        startUrl: `${server.origin}/landing.html`,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        steps: [
          createStep({ id: 's1', order: 0, action: createAction({ kind: 'goto', url: `${server.origin}/landing.html` }) }),
        ],
      });
      journeyRepository.seed(passingLoginJourney);

      const profile = createUserProfile({
        id: 'profile-1',
        name: 'admin',
        authStrategy: createAuthStrategy({ type: 'loginJourney', journeyId: 'login-journey', storageStatePath }),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      });

      const provider = new StorageStateAuthStateProvider(journeyRepository, realRunner());

      await expect(provider.refresh(profile)).resolves.toBeUndefined();
      const raw = await fs.readFile(storageStatePath, 'utf8');
      const parsed = JSON.parse(raw) as { cookies: unknown[]; origins: unknown[] };
      expect(Array.isArray(parsed.cookies)).toBe(true);
      expect(Array.isArray(parsed.origins)).toBe(true);
    } finally {
      await fs.rm(stateDir, { recursive: true, force: true });
    }
  });
});
