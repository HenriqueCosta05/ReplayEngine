import { describe, expect, it } from 'vitest';
import { createAction } from '../../../journeys/domain/Action.js';
import { createLocator } from '../../../journeys/domain/Locator.js';
import { createStep } from '../../../journeys/domain/Step.js';
import { createJourney } from '../../../journeys/domain/Journey.js';
import { createJourneyRunResult } from '../../../journeys/domain/JourneyRunResult.js';
import { createStepResult } from '../../../journeys/domain/StepResult.js';
import { createTemplate } from '../../../templates/domain/Template.js';
import { createTemplateParameter } from '../../../templates/domain/TemplateParameter.js';
import { createAuthStrategy } from '../../../profiles/domain/AuthStrategy.js';
import { createUserProfile } from '../../../profiles/domain/UserProfile.js';
import { createPlaybook } from '../../domain/Playbook.js';
import { createPlaybookEntry } from '../../domain/PlaybookEntry.js';
import { RunPlaybookUseCase } from './RunPlaybookUseCase.js';
import { NotFoundError } from '../../../shared-kernel/application/errors.js';
import { FakeAuthStateProviderPort } from '../../../../test/unit/fakes/FakeAuthStateProviderPort.js';
import { FakeClock } from '../../../../test/unit/fakes/FakeClock.js';
import { FakeIdGenerator } from '../../../../test/unit/fakes/FakeIdGenerator.js';
import { FakeJourneyRepository } from '../../../../test/unit/fakes/FakeJourneyRepository.js';
import { FakeJourneyRunnerPort } from '../../../../test/unit/fakes/FakeJourneyRunnerPort.js';
import { FakePlaybookRepository } from '../../../../test/unit/fakes/FakePlaybookRepository.js';
import { FakePlaybookRunResultRepository } from '../../../../test/unit/fakes/FakePlaybookRunResultRepository.js';
import { FakeProfileRepository } from '../../../../test/unit/fakes/FakeProfileRepository.js';
import { FakeTemplateRepository } from '../../../../test/unit/fakes/FakeTemplateRepository.js';

function buildJourney(id: string) {
  return createJourney({
    id,
    name: `Journey ${id}`,
    startUrl: 'https://example.com',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    steps: [createStep({ id: 's1', order: 0, action: createAction({ kind: 'goto', url: 'https://example.com' }) })],
  });
}

function buildTemplate(id: string) {
  const fillAction = createAction({
    kind: 'fill',
    locator: createLocator({ strategy: 'testId', value: 'username' }),
    value: 'placeholder',
  });
  return createTemplate({
    id,
    name: `Template ${id}`,
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

function passResult(id: string) {
  return createJourneyRunResult({
    id,
    startedAt: new Date('2026-02-01T00:00:00.000Z'),
    finishedAt: new Date('2026-02-01T00:00:01.000Z'),
    stepResults: [createStepResult({ stepId: 's1', status: 'passed', durationMs: 1000 })],
  });
}

function failResult(id: string) {
  return createJourneyRunResult({
    id,
    startedAt: new Date('2026-02-01T00:00:00.000Z'),
    finishedAt: new Date('2026-02-01T00:00:01.000Z'),
    stepResults: [createStepResult({ stepId: 's1', status: 'failed', durationMs: 1000, errorMessage: 'boom' })],
  });
}

function buildUseCase() {
  const playbookRepository = new FakePlaybookRepository();
  const journeyRepository = new FakeJourneyRepository();
  const templateRepository = new FakeTemplateRepository();
  const runner = new FakeJourneyRunnerPort();
  const profileRepository = new FakeProfileRepository();
  const authStateProvider = new FakeAuthStateProviderPort();
  const idGenerator = new FakeIdGenerator();
  const clock = new FakeClock(new Date('2026-03-01T00:00:00.000Z'));
  const runResultRepository = new FakePlaybookRunResultRepository();

  const useCase = new RunPlaybookUseCase(
    playbookRepository,
    journeyRepository,
    templateRepository,
    runner,
    profileRepository,
    authStateProvider,
    idGenerator,
    clock,
    runResultRepository,
  );

  return {
    playbookRepository,
    journeyRepository,
    templateRepository,
    runner,
    profileRepository,
    authStateProvider,
    idGenerator,
    clock,
    runResultRepository,
    useCase,
  };
}

describe('RunPlaybookUseCase', () => {
  it('runs every entry and reports overallStatus "passed" when all entries pass', async () => {
    const { playbookRepository, journeyRepository, runner, runResultRepository, useCase } = buildUseCase();
    const journeyA = buildJourney('journey-a');
    const journeyB = buildJourney('journey-b');
    await journeyRepository.save(journeyA);
    await journeyRepository.save(journeyB);

    const entryA = createPlaybookEntry({
      id: 'entry-a',
      source: { type: 'journey', journeyId: 'journey-a' },
      continueOnFailure: false,
    });
    const entryB = createPlaybookEntry({
      id: 'entry-b',
      source: { type: 'journey', journeyId: 'journey-b' },
      continueOnFailure: false,
    });
    const playbook = createPlaybook({
      id: 'playbook-1',
      name: 'Smoke suite',
      entries: [entryA, entryB],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await playbookRepository.save(playbook);

    runner.setNextResults([passResult('run-a'), passResult('run-b')]);

    const result = await useCase.execute({ playbookId: 'playbook-1', browser: 'chromium', keepTrace: false });

    expect(result.overallStatus).toBe('passed');
    expect(result.entryResults.map((entryResult) => entryResult.status)).toEqual(['passed', 'passed']);
    expect(runner.calls).toHaveLength(2);
    expect(await runResultRepository.findById(result.id)).toBe(result);
  });

  it('stop-on-first-failure path: once an entry fails with continueOnFailure:false, every remaining entry is skipped without running', async () => {
    const { playbookRepository, journeyRepository, runner, useCase } = buildUseCase();
    for (const id of ['journey-a', 'journey-b', 'journey-c']) {
      await journeyRepository.save(buildJourney(id));
    }

    const entries = [
      createPlaybookEntry({
        id: 'entry-a',
        source: { type: 'journey', journeyId: 'journey-a' },
        continueOnFailure: false,
      }),
      createPlaybookEntry({
        id: 'entry-b',
        source: { type: 'journey', journeyId: 'journey-b' },
        continueOnFailure: false,
      }),
      createPlaybookEntry({
        id: 'entry-c',
        source: { type: 'journey', journeyId: 'journey-c' },
        continueOnFailure: false,
      }),
    ];
    const playbook = createPlaybook({
      id: 'playbook-1',
      name: 'Smoke suite',
      entries,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await playbookRepository.save(playbook);

    // entry-a passes, entry-b fails (continueOnFailure:false) -> entry-c must be skipped, never run.
    runner.setNextResults([passResult('run-a'), failResult('run-b')]);

    const result = await useCase.execute({ playbookId: 'playbook-1', browser: 'chromium', keepTrace: false });

    expect(result.entryResults.map((entryResult) => ({ entryId: entryResult.entryId, status: entryResult.status }))).toEqual([
      { entryId: 'entry-a', status: 'passed' },
      { entryId: 'entry-b', status: 'failed' },
      { entryId: 'entry-c', status: 'skipped' },
    ]);
    expect(result.overallStatus).toBe('failed');
    // Only entry-a and entry-b were actually run; entry-c's journey was never even resolved/run.
    expect(runner.calls).toHaveLength(2);
  });

  it('continue-on-failure path: an entry failing with continueOnFailure:true still lets the remainder run normally', async () => {
    const { playbookRepository, journeyRepository, runner, useCase } = buildUseCase();
    await journeyRepository.save(buildJourney('journey-a'));
    await journeyRepository.save(buildJourney('journey-b'));

    const entries = [
      createPlaybookEntry({
        id: 'entry-a',
        source: { type: 'journey', journeyId: 'journey-a' },
        continueOnFailure: true,
      }),
      createPlaybookEntry({
        id: 'entry-b',
        source: { type: 'journey', journeyId: 'journey-b' },
        continueOnFailure: false,
      }),
    ];
    const playbook = createPlaybook({
      id: 'playbook-1',
      name: 'Smoke suite',
      entries,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await playbookRepository.save(playbook);

    runner.setNextResults([failResult('run-a'), passResult('run-b')]);

    const result = await useCase.execute({ playbookId: 'playbook-1', browser: 'chromium', keepTrace: false });

    expect(result.entryResults.map((entryResult) => ({ entryId: entryResult.entryId, status: entryResult.status }))).toEqual([
      { entryId: 'entry-a', status: 'failed' },
      { entryId: 'entry-b', status: 'passed' },
    ]);
    expect(result.overallStatus).toBe('failed');
    // entry-b was actually run (not skipped) despite entry-a's failure.
    expect(runner.calls).toHaveLength(2);
  });

  it('--stop-on-first-failure globally overrides a failed entry\'s own continueOnFailure:true, so the remainder is still skipped', async () => {
    const { playbookRepository, journeyRepository, runner, useCase } = buildUseCase();
    await journeyRepository.save(buildJourney('journey-a'));
    await journeyRepository.save(buildJourney('journey-b'));

    const entries = [
      createPlaybookEntry({
        id: 'entry-a',
        source: { type: 'journey', journeyId: 'journey-a' },
        continueOnFailure: true,
      }),
      createPlaybookEntry({
        id: 'entry-b',
        source: { type: 'journey', journeyId: 'journey-b' },
        continueOnFailure: false,
      }),
    ];
    const playbook = createPlaybook({
      id: 'playbook-1',
      name: 'Smoke suite',
      entries,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await playbookRepository.save(playbook);

    runner.setNextResults([failResult('run-a')]);

    const result = await useCase.execute({
      playbookId: 'playbook-1',
      browser: 'chromium',
      keepTrace: false,
      stopOnFirstFailure: true,
    });

    expect(result.entryResults.map((entryResult) => ({ entryId: entryResult.entryId, status: entryResult.status }))).toEqual([
      { entryId: 'entry-a', status: 'failed' },
      { entryId: 'entry-b', status: 'skipped' },
    ]);
    expect(runner.calls).toHaveLength(1);
  });

  it('resolves a template-sourced entry via Template.instantiate, minting a fresh Journey id and applying parameterBindings', async () => {
    const { playbookRepository, templateRepository, runner, useCase } = buildUseCase();
    const template = buildTemplate('template-1');
    await templateRepository.save(template);

    const entry = createPlaybookEntry({
      id: 'entry-a',
      source: { type: 'template', templateId: 'template-1', parameterBindings: { username: 'alice' } },
      continueOnFailure: false,
    });
    const playbook = createPlaybook({
      id: 'playbook-1',
      name: 'Smoke suite',
      entries: [entry],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await playbookRepository.save(playbook);

    runner.setNextResults([passResult('run-a')]);

    await useCase.execute({ playbookId: 'playbook-1', browser: 'chromium', keepTrace: false });

    expect(runner.calls).toHaveLength(1);
    const runJourney = runner.calls[0]?.journey;
    // The Journey id used for the run is freshly minted by IdGeneratorPort, never persisted.
    expect(runJourney?.id).toBe('id-1');
    expect(runJourney?.steps.find((step) => step.id === 's2')?.action).toMatchObject({
      kind: 'fill',
      value: 'alice',
    });
  });

  it('resolves entry.profileOverride into a storageStatePath via AuthStateProviderPort before running', async () => {
    const { playbookRepository, journeyRepository, runner, profileRepository, authStateProvider, useCase } =
      buildUseCase();
    await journeyRepository.save(buildJourney('journey-a'));
    const profile = createUserProfile({
      id: 'profile-1',
      name: 'admin',
      authStrategy: createAuthStrategy({ type: 'storageState', filePath: '/tmp/admin-state.json' }),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    profileRepository.seed(profile);
    authStateProvider.setResolveResult({ storageStatePath: '/tmp/admin-state.json' });

    const entry = createPlaybookEntry({
      id: 'entry-a',
      source: { type: 'journey', journeyId: 'journey-a' },
      profileOverride: 'profile-1',
      continueOnFailure: false,
    });
    const playbook = createPlaybook({
      id: 'playbook-1',
      name: 'Smoke suite',
      entries: [entry],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await playbookRepository.save(playbook);

    runner.setNextResults([passResult('run-a')]);

    await useCase.execute({ playbookId: 'playbook-1', browser: 'chromium', keepTrace: false });

    expect(authStateProvider.resolveCalls).toEqual([profile]);
    expect(authStateProvider.refreshCalls).toEqual([]);
    expect(runner.calls[0]?.opts).toMatchObject({ storageStatePath: '/tmp/admin-state.json', profileId: 'profile-1' });
  });

  it('persists entry.profileOverride (not the source journey\'s recorded profileId) as the entry result\'s profileId', async () => {
    const { playbookRepository, journeyRepository, runner, profileRepository, authStateProvider, runResultRepository, useCase } =
      buildUseCase();
    // journey-a was itself recorded under "profile-recorded" - the override at add-entry time ("profile-override")
    // must be what gets reported, not this.
    const journeyRecordedUnderAnotherProfile = createJourney({
      id: 'journey-a',
      name: 'Journey journey-a',
      startUrl: 'https://example.com',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      profileId: 'profile-recorded',
      steps: [createStep({ id: 's1', order: 0, action: createAction({ kind: 'goto', url: 'https://example.com' }) })],
    });
    await journeyRepository.save(journeyRecordedUnderAnotherProfile);

    const profile = createUserProfile({
      id: 'profile-override',
      name: 'override-user',
      authStrategy: createAuthStrategy({ type: 'storageState', filePath: '/tmp/override-state.json' }),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    profileRepository.seed(profile);
    authStateProvider.setResolveResult({ storageStatePath: '/tmp/override-state.json' });

    const entry = createPlaybookEntry({
      id: 'entry-a',
      source: { type: 'journey', journeyId: 'journey-a' },
      profileOverride: 'profile-override',
      continueOnFailure: false,
    });
    const playbook = createPlaybook({
      id: 'playbook-1',
      name: 'Smoke suite',
      entries: [entry],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await playbookRepository.save(playbook);

    // Simulates what the real PlaywrightStepInterpreter now does: prefer opts.profileId over journey.profileId.
    runner.setNextResults([
      createJourneyRunResult({
        id: 'run-a',
        profileId: 'profile-override',
        startedAt: new Date('2026-02-01T00:00:00.000Z'),
        finishedAt: new Date('2026-02-01T00:00:01.000Z'),
        stepResults: [createStepResult({ stepId: 's1', status: 'passed', durationMs: 1000 })],
      }),
    ]);

    const result = await useCase.execute({ playbookId: 'playbook-1', browser: 'chromium', keepTrace: false });

    expect(runner.calls[0]?.opts).toMatchObject({ profileId: 'profile-override' });
    expect(result.entryResults[0]?.profileId).toBe('profile-override');
    expect(await runResultRepository.findById(result.id)).toBe(result);
  });

  it('throws NotFoundError when the playbook does not exist', async () => {
    const { useCase } = buildUseCase();
    await expect(useCase.execute({ playbookId: 'missing', browser: 'chromium', keepTrace: false })).rejects.toThrow(
      NotFoundError,
    );
  });

  it('records a "failed" entry (not a thrown error) when a journey-sourced entry references a journey that no longer exists', async () => {
    const { playbookRepository, runner, useCase } = buildUseCase();
    const entry = createPlaybookEntry({
      id: 'entry-a',
      source: { type: 'journey', journeyId: 'missing-journey' },
      continueOnFailure: false,
    });
    const playbook = createPlaybook({
      id: 'playbook-1',
      name: 'Smoke suite',
      entries: [entry],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await playbookRepository.save(playbook);

    const result = await useCase.execute({ playbookId: 'playbook-1', browser: 'chromium', keepTrace: false });

    expect(result.entryResults).toHaveLength(1);
    expect(result.entryResults[0]).toMatchObject({ entryId: 'entry-a', status: 'failed', stepResults: [] });
    expect(result.entryResults[0]?.error).toContain('missing-journey');
    // The unresolvable entry is never handed to the runner - there is no Journey to run.
    expect(runner.calls).toHaveLength(0);
  });

  it('records a "failed" entry (not a thrown error) when entry.profileOverride does not resolve to an existing profile', async () => {
    const { playbookRepository, journeyRepository, runner, useCase } = buildUseCase();
    await journeyRepository.save(buildJourney('journey-a'));
    const entry = createPlaybookEntry({
      id: 'entry-a',
      source: { type: 'journey', journeyId: 'journey-a' },
      profileOverride: 'missing-profile',
      continueOnFailure: false,
    });
    const playbook = createPlaybook({
      id: 'playbook-1',
      name: 'Smoke suite',
      entries: [entry],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await playbookRepository.save(playbook);

    const result = await useCase.execute({ playbookId: 'playbook-1', browser: 'chromium', keepTrace: false });

    expect(result.entryResults).toHaveLength(1);
    expect(result.entryResults[0]).toMatchObject({ entryId: 'entry-a', status: 'failed', stepResults: [] });
    expect(result.entryResults[0]?.error).toContain('missing-profile');
    expect(runner.calls).toHaveLength(0);
  });

  it('an unresolvable entry mid-playbook under continueOnFailure:true still lets the remainder run', async () => {
    const { playbookRepository, journeyRepository, runner, runResultRepository, useCase } = buildUseCase();
    await journeyRepository.save(buildJourney('journey-a'));
    await journeyRepository.save(buildJourney('journey-c'));

    const entries = [
      createPlaybookEntry({
        id: 'entry-a',
        source: { type: 'journey', journeyId: 'journey-a' },
        continueOnFailure: true,
      }),
      createPlaybookEntry({
        id: 'entry-b',
        source: { type: 'journey', journeyId: 'missing-journey' },
        continueOnFailure: true,
      }),
      createPlaybookEntry({
        id: 'entry-c',
        source: { type: 'journey', journeyId: 'journey-c' },
        continueOnFailure: false,
      }),
    ];
    const playbook = createPlaybook({
      id: 'playbook-1',
      name: 'Smoke suite',
      entries,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await playbookRepository.save(playbook);

    runner.setNextResults([passResult('run-a'), passResult('run-c')]);

    const result = await useCase.execute({ playbookId: 'playbook-1', browser: 'chromium', keepTrace: false });

    expect(result.entryResults.map((entryResult) => ({ entryId: entryResult.entryId, status: entryResult.status }))).toEqual([
      { entryId: 'entry-a', status: 'passed' },
      { entryId: 'entry-b', status: 'failed' },
      { entryId: 'entry-c', status: 'passed' },
    ]);
    // entry-a and entry-c were actually run; entry-b's unresolvable journey was never handed to the runner.
    expect(runner.calls).toHaveLength(2);
    expect(await runResultRepository.findById(result.id)).toBe(result);
  });

  it('an unresolvable entry mid-playbook under stop-on-first-failure (default) skips the remainder and preserves/persists prior successful results', async () => {
    const { playbookRepository, journeyRepository, runner, runResultRepository, useCase } = buildUseCase();
    await journeyRepository.save(buildJourney('journey-a'));

    const entries = [
      createPlaybookEntry({
        id: 'entry-a',
        source: { type: 'journey', journeyId: 'journey-a' },
        continueOnFailure: false,
      }),
      createPlaybookEntry({
        id: 'entry-b',
        source: { type: 'journey', journeyId: 'missing-journey' },
        continueOnFailure: false,
      }),
      createPlaybookEntry({
        id: 'entry-c',
        source: { type: 'journey', journeyId: 'never-reached' },
        continueOnFailure: false,
      }),
    ];
    const playbook = createPlaybook({
      id: 'playbook-1',
      name: 'Smoke suite',
      entries,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await playbookRepository.save(playbook);

    runner.setNextResults([passResult('run-a')]);

    const result = await useCase.execute({ playbookId: 'playbook-1', browser: 'chromium', keepTrace: false });

    expect(result.entryResults.map((entryResult) => ({ entryId: entryResult.entryId, status: entryResult.status }))).toEqual([
      { entryId: 'entry-a', status: 'passed' },
      { entryId: 'entry-b', status: 'failed' },
      { entryId: 'entry-c', status: 'skipped' },
    ]);
    // entry-a's successful result is preserved even though entry-b later failed to resolve.
    expect(runner.calls).toHaveLength(1);
    expect(await runResultRepository.findById(result.id)).toBe(result);
  });
});
