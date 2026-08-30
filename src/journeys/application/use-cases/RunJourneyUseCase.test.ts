import { describe, expect, it } from 'vitest';
import { createAction } from '../../domain/Action.js';
import { createJourney } from '../../domain/Journey.js';
import { createStep } from '../../domain/Step.js';
import { createStepResult } from '../../domain/StepResult.js';
import { createJourneyRunResult } from '../../domain/JourneyRunResult.js';
import { RunJourneyUseCase } from './RunJourneyUseCase.js';
import { createAuthStrategy } from '../../../profiles/domain/AuthStrategy.js';
import { createUserProfile } from '../../../profiles/domain/UserProfile.js';
import { FakeAuthStateProviderPort } from '../../../../test/unit/fakes/FakeAuthStateProviderPort.js';
import { FakeJourneyRepository } from '../../../../test/unit/fakes/FakeJourneyRepository.js';
import { FakeJourneyRunnerPort } from '../../../../test/unit/fakes/FakeJourneyRunnerPort.js';
import { FakeProfileRepository } from '../../../../test/unit/fakes/FakeProfileRepository.js';
import { NotFoundError } from '../../../shared-kernel/application/errors.js';

function buildJourney() {
  const gotoAction = createAction({ kind: 'goto', url: 'https://example.com' });
  return createJourney({
    id: 'journey-1',
    name: 'Login flow',
    startUrl: 'https://example.com',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    steps: [createStep({ id: 's1', order: 0, action: gotoAction })],
  });
}

describe('RunJourneyUseCase', () => {
  it('loads the journey, runs it via the runner port, and returns the result unpersisted', async () => {
    const repository = new FakeJourneyRepository();
    const journey = buildJourney();
    await repository.save(journey);

    const runner = new FakeJourneyRunnerPort();
    const expectedResult = createJourneyRunResult({
      id: 'run-1',
      journeyId: journey.id,
      startedAt: new Date('2026-01-02T00:00:00.000Z'),
      finishedAt: new Date('2026-01-02T00:00:05.000Z'),
      stepResults: [createStepResult({ stepId: 's1', status: 'passed', durationMs: 5000 })],
    });
    runner.setNextResult(expectedResult);

    const useCase = new RunJourneyUseCase(repository, runner, new FakeProfileRepository(), new FakeAuthStateProviderPort());

    const result = await useCase.execute({
      journeyId: journey.id,
      browser: 'chromium',
      keepTrace: false,
    });

    expect(result).toBe(expectedResult);
    expect(runner.calls).toHaveLength(1);
    expect(runner.calls[0]?.journey).toBe(journey);
    expect(runner.calls[0]?.opts).toMatchObject({ browser: 'chromium', keepTrace: false });
  });

  it('throws NotFoundError when the journey does not exist', async () => {
    const repository = new FakeJourneyRepository();
    const runner = new FakeJourneyRunnerPort();
    const useCase = new RunJourneyUseCase(repository, runner, new FakeProfileRepository(), new FakeAuthStateProviderPort());

    await expect(
      useCase.execute({ journeyId: 'missing', browser: 'chromium', keepTrace: false }),
    ).rejects.toThrow(NotFoundError);
    expect(runner.calls).toHaveLength(0);
  });

  it('resolves profileId into a storageStatePath via AuthStateProviderPort before running', async () => {
    const repository = new FakeJourneyRepository();
    const journey = buildJourney();
    await repository.save(journey);

    const runner = new FakeJourneyRunnerPort();
    const profileRepository = new FakeProfileRepository();
    const profile = createUserProfile({
      id: 'profile-1',
      name: 'admin',
      authStrategy: createAuthStrategy({ type: 'storageState', filePath: '/tmp/admin-state.json' }),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    profileRepository.seed(profile);
    const authStateProvider = new FakeAuthStateProviderPort();
    authStateProvider.setResolveResult({ storageStatePath: '/tmp/admin-state.json' });
    const useCase = new RunJourneyUseCase(repository, runner, profileRepository, authStateProvider);

    await useCase.execute({
      journeyId: journey.id,
      browser: 'chromium',
      keepTrace: false,
      profileId: 'profile-1',
    });

    expect(authStateProvider.resolveCalls).toEqual([profile]);
    expect(runner.calls[0]?.opts).toMatchObject({ storageStatePath: '/tmp/admin-state.json' });
  });

  it('lets an explicit storageStatePath win over a resolved profile one', async () => {
    const repository = new FakeJourneyRepository();
    const journey = buildJourney();
    await repository.save(journey);

    const runner = new FakeJourneyRunnerPort();
    const profileRepository = new FakeProfileRepository();
    profileRepository.seed(
      createUserProfile({
        id: 'profile-1',
        name: 'admin',
        authStrategy: createAuthStrategy({ type: 'none' }),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    );
    const authStateProvider = new FakeAuthStateProviderPort();
    authStateProvider.setResolveResult({ storageStatePath: '/tmp/resolved.json' });
    const useCase = new RunJourneyUseCase(repository, runner, profileRepository, authStateProvider);

    await useCase.execute({
      journeyId: journey.id,
      browser: 'chromium',
      keepTrace: false,
      profileId: 'profile-1',
      storageStatePath: '/tmp/explicit.json',
    });

    expect(runner.calls[0]?.opts).toMatchObject({ storageStatePath: '/tmp/explicit.json' });
  });

  it('throws NotFoundError when profileId does not resolve to an existing profile, without running', async () => {
    const repository = new FakeJourneyRepository();
    const journey = buildJourney();
    await repository.save(journey);
    const runner = new FakeJourneyRunnerPort();
    const useCase = new RunJourneyUseCase(repository, runner, new FakeProfileRepository(), new FakeAuthStateProviderPort());

    await expect(
      useCase.execute({ journeyId: journey.id, browser: 'chromium', keepTrace: false, profileId: 'missing' }),
    ).rejects.toThrow(NotFoundError);
    expect(runner.calls).toHaveLength(0);
  });
});
