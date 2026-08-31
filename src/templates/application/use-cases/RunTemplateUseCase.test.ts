import { describe, expect, it } from 'vitest';
import { createAction } from '../../../journeys/domain/Action.js';
import { createLocator } from '../../../journeys/domain/Locator.js';
import { createStep } from '../../../journeys/domain/Step.js';
import { createTemplate } from '../../domain/Template.js';
import { createTemplateParameter } from '../../domain/TemplateParameter.js';
import { RunTemplateUseCase } from './RunTemplateUseCase.js';
import { createAuthStrategy } from '../../../profiles/domain/AuthStrategy.js';
import { createUserProfile } from '../../../profiles/domain/UserProfile.js';
import { createJourneyRunResult } from '../../../journeys/domain/JourneyRunResult.js';
import { createStepResult } from '../../../journeys/domain/StepResult.js';
import { DomainError } from '../../domain/errors.js';
import { FakeAuthStateProviderPort } from '../../../../test/unit/fakes/FakeAuthStateProviderPort.js';
import { FakeClock } from '../../../../test/unit/fakes/FakeClock.js';
import { FakeIdGenerator } from '../../../../test/unit/fakes/FakeIdGenerator.js';
import { FakeJourneyRunnerPort } from '../../../../test/unit/fakes/FakeJourneyRunnerPort.js';
import { FakeProfileRepository } from '../../../../test/unit/fakes/FakeProfileRepository.js';
import { FakeTemplateRepository } from '../../../../test/unit/fakes/FakeTemplateRepository.js';
import { NotFoundError } from '../../../shared-kernel/application/errors.js';

function buildTemplate() {
  const fillAction = createAction({
    kind: 'fill',
    locator: createLocator({ strategy: 'testId', value: 'username' }),
    value: 'placeholder',
  });
  return createTemplate({
    id: 'template-1',
    name: 'Login template',
    startUrl: 'https://example.com',
    steps: [
      createStep({ id: 's1', order: 0, action: createAction({ kind: 'goto', url: 'https://example.com' }) }),
      createStep({ id: 's2', order: 1, action: fillAction }),
    ],
    parameters: [
      createTemplateParameter({
        id: 'param-1',
        name: 'username',
        targetStepId: 's2',
        targetField: 'value',
        required: true,
      }),
    ],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

function buildUseCase() {
  const templateRepository = new FakeTemplateRepository();
  const runner = new FakeJourneyRunnerPort();
  const idGenerator = new FakeIdGenerator();
  const clock = new FakeClock(new Date('2026-02-01T00:00:00.000Z'));
  const profileRepository = new FakeProfileRepository();
  const authStateProvider = new FakeAuthStateProviderPort();
  const useCase = new RunTemplateUseCase(
    templateRepository,
    runner,
    idGenerator,
    clock,
    profileRepository,
    authStateProvider,
  );
  return { templateRepository, runner, idGenerator, clock, profileRepository, authStateProvider, useCase };
}

describe('RunTemplateUseCase', () => {
  it('instantiates the template, builds a fresh unpersisted Journey, and runs it via the runner port', async () => {
    const { templateRepository, runner, useCase } = buildUseCase();
    const template = buildTemplate();
    await templateRepository.save(template);

    const expectedResult = createJourneyRunResult({
      id: 'run-1',
      startedAt: new Date('2026-02-01T00:00:00.000Z'),
      finishedAt: new Date('2026-02-01T00:00:05.000Z'),
      stepResults: [createStepResult({ stepId: 's1', status: 'passed', durationMs: 5000 })],
    });
    runner.setNextResult(expectedResult);

    const result = await useCase.execute({
      templateId: template.id,
      values: { username: 'alice' },
      browser: 'chromium',
      keepTrace: false,
    });

    expect(result).toBe(expectedResult);
    expect(runner.calls).toHaveLength(1);
    const runJourney = runner.calls[0]?.journey;
    expect(runJourney?.id).toBe('id-1');
    expect(runJourney?.steps.find((step) => step.id === 's2')?.action).toMatchObject({
      kind: 'fill',
      value: 'alice',
    });
  });

  it('throws NotFoundError when the template does not exist', async () => {
    const { useCase } = buildUseCase();

    await expect(
      useCase.execute({ templateId: 'missing', values: {}, browser: 'chromium', keepTrace: false }),
    ).rejects.toThrow(NotFoundError);
  });

  it('propagates the DomainError from Template.instantiate when a required parameter is missing, without running', async () => {
    const { templateRepository, runner, useCase } = buildUseCase();
    const template = buildTemplate();
    await templateRepository.save(template);

    await expect(
      useCase.execute({ templateId: template.id, values: {}, browser: 'chromium', keepTrace: false }),
    ).rejects.toThrow(DomainError);
    expect(runner.calls).toHaveLength(0);
  });

  it('resolves profileId into a storageStatePath via AuthStateProviderPort before running', async () => {
    const { templateRepository, runner, profileRepository, authStateProvider, useCase } = buildUseCase();
    const template = buildTemplate();
    await templateRepository.save(template);
    const profile = createUserProfile({
      id: 'profile-1',
      name: 'admin',
      authStrategy: createAuthStrategy({ type: 'storageState', filePath: '/tmp/admin-state.json' }),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    profileRepository.seed(profile);
    authStateProvider.setResolveResult({ storageStatePath: '/tmp/admin-state.json' });

    await useCase.execute({
      templateId: template.id,
      values: { username: 'alice' },
      browser: 'chromium',
      keepTrace: false,
      profileId: 'profile-1',
    });

    expect(authStateProvider.resolveCalls).toEqual([profile]);
    expect(runner.calls[0]?.opts).toMatchObject({ storageStatePath: '/tmp/admin-state.json', profileId: 'profile-1' });
  });

  it('threads input.profileId through to the runner as opts.profileId, so the interpreter records the profile actually used for this run', async () => {
    const { templateRepository, runner, profileRepository, authStateProvider, useCase } = buildUseCase();
    const template = buildTemplate();
    await templateRepository.save(template);
    profileRepository.seed(
      createUserProfile({
        id: 'profile-2',
        name: 'other',
        authStrategy: createAuthStrategy({ type: 'storageState', filePath: '/tmp/other-state.json' }),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    );
    authStateProvider.setResolveResult({ storageStatePath: '/tmp/other-state.json' });

    await useCase.execute({
      templateId: template.id,
      values: { username: 'alice' },
      browser: 'chromium',
      keepTrace: false,
      profileId: 'profile-2',
    });

    expect(runner.calls[0]?.opts.profileId).toBe('profile-2');
  });

  it('throws NotFoundError when profileId does not resolve to an existing profile, without running', async () => {
    const { templateRepository, runner, useCase } = buildUseCase();
    const template = buildTemplate();
    await templateRepository.save(template);

    await expect(
      useCase.execute({
        templateId: template.id,
        values: { username: 'alice' },
        browser: 'chromium',
        keepTrace: false,
        profileId: 'missing',
      }),
    ).rejects.toThrow(NotFoundError);
    expect(runner.calls).toHaveLength(0);
  });
});
