import { describe, expect, it } from 'vitest';
import { createAuthStrategy } from '../../domain/AuthStrategy.js';
import { createUserProfile } from '../../domain/UserProfile.js';
import { StorageStateAuthStateProvider } from './StorageStateAuthStateProvider.js';
import { createAction } from '../../../journeys/domain/Action.js';
import { createJourney } from '../../../journeys/domain/Journey.js';
import { createJourneyRunResult } from '../../../journeys/domain/JourneyRunResult.js';
import { createStep } from '../../../journeys/domain/Step.js';
import { createStepResult } from '../../../journeys/domain/StepResult.js';
import { NotFoundError } from '../../../shared-kernel/application/errors.js';
import { FakeJourneyRepository } from '../../../../test/unit/fakes/FakeJourneyRepository.js';
import { FakeJourneyRunnerPort } from '../../../../test/unit/fakes/FakeJourneyRunnerPort.js';

function loginJourney() {
  return createJourney({
    id: 'journey-1',
    name: 'Log in',
    startUrl: 'https://example.com/login',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    steps: [createStep({ id: 's1', order: 0, action: createAction({ kind: 'goto', url: 'https://example.com/login' }) })],
  });
}

function loginJourneyProfile() {
  return createUserProfile({
    id: 'p1',
    name: 'admin',
    authStrategy: createAuthStrategy({
      type: 'loginJourney',
      journeyId: 'journey-1',
      storageStatePath: '/tmp/admin-state.json',
    }),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

describe('StorageStateAuthStateProvider.resolve', () => {
  it('resolves "none" to a null storageStatePath', async () => {
    const provider = new StorageStateAuthStateProvider(new FakeJourneyRepository(), new FakeJourneyRunnerPort());
    const profile = createUserProfile({
      id: 'p1',
      name: 'admin',
      authStrategy: createAuthStrategy({ type: 'none' }),
      createdAt: new Date(),
    });

    await expect(provider.resolve(profile)).resolves.toEqual({ storageStatePath: null });
  });

  it('resolves "storageState" to its filePath as-is', async () => {
    const provider = new StorageStateAuthStateProvider(new FakeJourneyRepository(), new FakeJourneyRunnerPort());
    const profile = createUserProfile({
      id: 'p1',
      name: 'admin',
      authStrategy: createAuthStrategy({ type: 'storageState', filePath: '/tmp/state.json' }),
      createdAt: new Date(),
    });

    await expect(provider.resolve(profile)).resolves.toEqual({ storageStatePath: '/tmp/state.json' });
  });

  it('resolves "loginJourney" to its storageStatePath field without running anything', async () => {
    const runner = new FakeJourneyRunnerPort();
    const provider = new StorageStateAuthStateProvider(new FakeJourneyRepository(), runner);

    await expect(provider.resolve(loginJourneyProfile())).resolves.toEqual({
      storageStatePath: '/tmp/admin-state.json',
    });
    expect(runner.calls).toHaveLength(0);
  });
});

describe('StorageStateAuthStateProvider.refresh', () => {
  it('runs the login journey with captureStorageStatePath set to the strategy path', async () => {
    const journeyRepository = new FakeJourneyRepository();
    const journey = loginJourney();
    journeyRepository.seed(journey);
    const runner = new FakeJourneyRunnerPort();
    runner.setNextResult(
      createJourneyRunResult({
        id: 'run-1',
        startedAt: new Date('2026-01-01T00:00:00.000Z'),
        finishedAt: new Date('2026-01-01T00:00:01.000Z'),
        stepResults: [createStepResult({ stepId: 's1', status: 'passed', durationMs: 10 })],
      }),
    );
    const provider = new StorageStateAuthStateProvider(journeyRepository, runner);

    await provider.refresh(loginJourneyProfile());

    expect(runner.calls).toHaveLength(1);
    expect(runner.calls[0]?.journey).toBe(journey);
    expect(runner.calls[0]?.opts).toMatchObject({ captureStorageStatePath: '/tmp/admin-state.json' });
  });

  it('rejects refresh on a "none" or "storageState" profile', async () => {
    const provider = new StorageStateAuthStateProvider(new FakeJourneyRepository(), new FakeJourneyRunnerPort());
    const noneProfile = createUserProfile({
      id: 'p1',
      name: 'admin',
      authStrategy: createAuthStrategy({ type: 'none' }),
      createdAt: new Date(),
    });

    await expect(provider.refresh(noneProfile)).rejects.toThrow(/does not support refresh/);
  });

  it('throws NotFoundError when the login journey no longer exists', async () => {
    const provider = new StorageStateAuthStateProvider(new FakeJourneyRepository(), new FakeJourneyRunnerPort());

    await expect(provider.refresh(loginJourneyProfile())).rejects.toThrow(NotFoundError);
  });

  it('throws when the login journey run fails, without swallowing the reason', async () => {
    const journeyRepository = new FakeJourneyRepository();
    journeyRepository.seed(loginJourney());
    const runner = new FakeJourneyRunnerPort();
    runner.setNextResult(
      createJourneyRunResult({
        id: 'run-1',
        startedAt: new Date('2026-01-01T00:00:00.000Z'),
        finishedAt: new Date('2026-01-01T00:00:01.000Z'),
        stepResults: [
          createStepResult({ stepId: 's1', status: 'failed', durationMs: 10, errorMessage: 'bad credentials' }),
        ],
      }),
    );
    const provider = new StorageStateAuthStateProvider(journeyRepository, runner);

    await expect(provider.refresh(loginJourneyProfile())).rejects.toThrow(/failed while refreshing/);
  });
});
