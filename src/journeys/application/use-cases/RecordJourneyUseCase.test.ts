import { describe, expect, it } from 'vitest';
import { RecordJourneyUseCase } from './RecordJourneyUseCase.js';
import { createAuthStrategy } from '../../../profiles/domain/AuthStrategy.js';
import { createUserProfile } from '../../../profiles/domain/UserProfile.js';
import { NotFoundError } from '../../../shared-kernel/application/errors.js';
import { FakeAuthStateProviderPort } from '../../../../test/unit/fakes/FakeAuthStateProviderPort.js';
import { FakeClock } from '../../../../test/unit/fakes/FakeClock.js';
import { FakeIdGenerator } from '../../../../test/unit/fakes/FakeIdGenerator.js';
import { FakeJourneyRecorderPort } from '../../../../test/unit/fakes/FakeJourneyRecorderPort.js';
import { FakeJourneyRepository } from '../../../../test/unit/fakes/FakeJourneyRepository.js';
import { FakeProfileRepository } from '../../../../test/unit/fakes/FakeProfileRepository.js';

function buildUseCase(overrides: {
  recorder?: FakeJourneyRecorderPort;
  repository?: FakeJourneyRepository;
  idGenerator?: FakeIdGenerator;
  clock?: FakeClock;
  profileRepository?: FakeProfileRepository;
  authStateProvider?: FakeAuthStateProviderPort;
} = {}): RecordJourneyUseCase {
  return new RecordJourneyUseCase(
    overrides.recorder ?? new FakeJourneyRecorderPort(),
    overrides.repository ?? new FakeJourneyRepository(),
    overrides.idGenerator ?? new FakeIdGenerator(),
    overrides.clock ?? new FakeClock(),
    overrides.profileRepository ?? new FakeProfileRepository(),
    overrides.authStateProvider ?? new FakeAuthStateProviderPort(),
  );
}

describe('RecordJourneyUseCase', () => {
  it('records a draft, assigns ids/order/createdAt, saves and returns the journey', async () => {
    const recorder = new FakeJourneyRecorderPort();
    recorder.setNextResult({
      startUrl: 'https://example.com/start',
      steps: [
        { action: { kind: 'goto', url: 'https://example.com/start' } },
        { action: { kind: 'click', locator: { strategy: 'role', value: 'button' } }, label: 'Submit' },
      ],
    });
    const repository = new FakeJourneyRepository();
    const idGenerator = new FakeIdGenerator();
    const clock = new FakeClock(new Date('2026-03-01T12:00:00.000Z'));
    const useCase = buildUseCase({ recorder, repository, idGenerator, clock });

    const journey = await useCase.execute({
      startUrl: 'https://example.com/start',
      name: 'Signup flow',
      browser: 'chromium',
    });

    expect(journey.id).toBe('id-3');
    expect(journey.name).toBe('Signup flow');
    expect(journey.startUrl).toBe('https://example.com/start');
    expect(journey.createdAt).toEqual(new Date('2026-03-01T12:00:00.000Z'));
    expect(journey.steps).toHaveLength(2);
    expect(journey.steps[0]?.id).toBe('id-1');
    expect(journey.steps[0]?.order).toBe(0);
    expect(journey.steps[1]?.id).toBe('id-2');
    expect(journey.steps[1]?.order).toBe(1);
    expect(journey.steps[1]?.label).toBe('Submit');

    await expect(repository.findById('id-3')).resolves.toEqual(journey);
  });

  it('forwards recording options to the recorder port', async () => {
    const recorder = new FakeJourneyRecorderPort();
    recorder.setNextResult({
      startUrl: 'https://example.com',
      steps: [{ action: { kind: 'goto', url: 'https://example.com' } }],
    });
    const useCase = buildUseCase({ recorder });

    await useCase.execute({
      startUrl: 'https://example.com',
      name: 'Empty flow',
      browser: 'firefox',
      storageStatePath: '/tmp/state.json',
      viewport: { width: 1280, height: 720 },
      timezone: 'America/Sao_Paulo',
    });

    expect(recorder.calls).toHaveLength(1);
    expect(recorder.calls[0]).toMatchObject({
      startUrl: 'https://example.com',
      browser: 'firefox',
      storageStatePath: '/tmp/state.json',
      viewport: { width: 1280, height: 720 },
      timezone: 'America/Sao_Paulo',
    });
  });

  it('resolves profileId into a storageStatePath via AuthStateProviderPort and persists it on the journey', async () => {
    const recorder = new FakeJourneyRecorderPort();
    recorder.setNextResult({
      startUrl: 'https://example.com',
      steps: [{ action: { kind: 'goto', url: 'https://example.com' } }],
    });
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
    const useCase = buildUseCase({ recorder, profileRepository, authStateProvider });

    const journey = await useCase.execute({
      startUrl: 'https://example.com',
      name: 'Admin flow',
      browser: 'chromium',
      profileId: 'profile-1',
    });

    expect(authStateProvider.resolveCalls).toEqual([profile]);
    expect(recorder.calls[0]).toMatchObject({ storageStatePath: '/tmp/admin-state.json' });
    expect(journey.profileId).toBe('profile-1');
  });

  it('lets an explicit storageStatePath win over a resolved profile one', async () => {
    const recorder = new FakeJourneyRecorderPort();
    recorder.setNextResult({
      startUrl: 'https://example.com',
      steps: [{ action: { kind: 'goto', url: 'https://example.com' } }],
    });
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
    const useCase = buildUseCase({ recorder, profileRepository, authStateProvider });

    await useCase.execute({
      startUrl: 'https://example.com',
      name: 'Admin flow',
      browser: 'chromium',
      profileId: 'profile-1',
      storageStatePath: '/tmp/explicit.json',
    });

    expect(recorder.calls[0]).toMatchObject({ storageStatePath: '/tmp/explicit.json' });
  });

  it('throws NotFoundError when profileId does not resolve to an existing profile', async () => {
    const useCase = buildUseCase();

    await expect(
      useCase.execute({
        startUrl: 'https://example.com',
        name: 'Admin flow',
        browser: 'chromium',
        profileId: 'missing',
      }),
    ).rejects.toThrow(NotFoundError);
  });
});
