import { describe, expect, it, vi } from 'vitest';

import { createAuthStrategy } from '../../domain/AuthStrategy.js';
import { createUserProfile, type UserProfile } from '../../domain/UserProfile.js';
import type { RegisterProfileInput } from '../../application/use-cases/RegisterProfileUseCase.js';
import {
  ProfileController,
  type ListProfilesUseCaseLike,
  type RegisterProfileUseCaseLike,
  type ShowProfileUseCaseLike,
} from './ProfileController.js';
import { ProfilePresenter } from './ProfilePresenter.js';

function buildProfile(): UserProfile {
  return createUserProfile({
    id: 'p1',
    name: 'admin',
    authStrategy: createAuthStrategy({ type: 'none' }),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

class FakeRegisterProfileUseCase implements RegisterProfileUseCaseLike {
  readonly calls: RegisterProfileInput[] = [];
  constructor(private readonly result: UserProfile) {}

  async execute(input: RegisterProfileInput): Promise<UserProfile> {
    this.calls.push(input);
    return this.result;
  }
}

class FakeListProfilesUseCase implements ListProfilesUseCaseLike {
  constructor(private readonly result: UserProfile[]) {}

  async execute(): Promise<UserProfile[]> {
    return this.result;
  }
}

class FakeShowProfileUseCase implements ShowProfileUseCaseLike {
  readonly calls: string[] = [];
  constructor(private readonly result: UserProfile) {}

  async execute(id: string): Promise<UserProfile> {
    this.calls.push(id);
    return this.result;
  }
}

describe('ProfileController.add', () => {
  it('maps a "none" auth-type into the use case input DTO', async () => {
    const useCase = new FakeRegisterProfileUseCase(buildProfile());
    const controller = new ProfileController(useCase, new FakeListProfilesUseCase([]), new FakeShowProfileUseCase(buildProfile()), new ProfilePresenter());

    await controller.add({ name: 'admin', authType: 'none', quiet: true });

    expect(useCase.calls).toEqual([{ name: 'admin', authStrategy: { type: 'none' } }]);
  });

  it('maps a "storageState" auth-type into the use case input DTO', async () => {
    const useCase = new FakeRegisterProfileUseCase(buildProfile());
    const controller = new ProfileController(useCase, new FakeListProfilesUseCase([]), new FakeShowProfileUseCase(buildProfile()), new ProfilePresenter());

    await controller.add({ name: 'admin', authType: 'storageState', storageStatePath: '/tmp/s.json', quiet: true });

    expect(useCase.calls).toEqual([
      { name: 'admin', authStrategy: { type: 'storageState', filePath: '/tmp/s.json' } },
    ]);
  });

  it('maps a "loginJourney" auth-type into the use case input DTO', async () => {
    const useCase = new FakeRegisterProfileUseCase(buildProfile());
    const controller = new ProfileController(useCase, new FakeListProfilesUseCase([]), new FakeShowProfileUseCase(buildProfile()), new ProfilePresenter());

    await controller.add({
      name: 'admin',
      authType: 'loginJourney',
      loginJourneyId: 'journey-1',
      loginStorageStatePath: '/tmp/s.json',
      quiet: true,
    });

    expect(useCase.calls).toEqual([
      {
        name: 'admin',
        authStrategy: { type: 'loginJourney', journeyId: 'journey-1', storageStatePath: '/tmp/s.json' },
      },
    ]);
  });

  it('invokes the presenter with the registered profile, human mode by default', async () => {
    const profile = buildProfile();
    const useCase = new FakeRegisterProfileUseCase(profile);
    const presenter = new ProfilePresenter();
    const presentSpy = vi.spyOn(presenter, 'present');
    const controller = new ProfileController(useCase, new FakeListProfilesUseCase([]), new FakeShowProfileUseCase(profile), presenter);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await controller.add({ name: 'admin', authType: 'none' });

    expect(presentSpy).toHaveBeenCalledWith(profile);
    logSpy.mockRestore();
  });

  it('prints nothing when --quiet is set', async () => {
    const useCase = new FakeRegisterProfileUseCase(buildProfile());
    const controller = new ProfileController(useCase, new FakeListProfilesUseCase([]), new FakeShowProfileUseCase(buildProfile()), new ProfilePresenter());
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await controller.add({ name: 'admin', authType: 'none', quiet: true });

    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('propagates a use case error without swallowing it (e.g. ConflictError)', async () => {
    const failingUseCase: RegisterProfileUseCaseLike = {
      execute: async () => {
        throw new Error('duplicate name');
      },
    };
    const controller = new ProfileController(failingUseCase, new FakeListProfilesUseCase([]), new FakeShowProfileUseCase(buildProfile()), new ProfilePresenter());

    await expect(controller.add({ name: 'admin', authType: 'none' })).rejects.toThrow('duplicate name');
  });
});

describe('ProfileController.list', () => {
  it('invokes the presenter in JSON mode when --json is set', async () => {
    const profiles = [buildProfile()];
    const listUseCase = new FakeListProfilesUseCase(profiles);
    const presenter = new ProfilePresenter();
    const toJsonSpy = vi.spyOn(presenter, 'toJson');
    const controller = new ProfileController(new FakeRegisterProfileUseCase(buildProfile()), listUseCase, new FakeShowProfileUseCase(buildProfile()), presenter);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await controller.list({ json: true });

    expect(toJsonSpy).toHaveBeenCalledWith(profiles);
    logSpy.mockRestore();
  });
});

describe('ProfileController.show', () => {
  it('passes the id through to the use case and presents the result', async () => {
    const profile = buildProfile();
    const showUseCase = new FakeShowProfileUseCase(profile);
    const presenter = new ProfilePresenter();
    const presentSpy = vi.spyOn(presenter, 'present');
    const controller = new ProfileController(new FakeRegisterProfileUseCase(buildProfile()), new FakeListProfilesUseCase([]), showUseCase, presenter);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await controller.show('p1', {});

    expect(showUseCase.calls).toEqual(['p1']);
    expect(presentSpy).toHaveBeenCalledWith(profile);
    logSpy.mockRestore();
  });
});
