import { describe, expect, it, vi } from 'vitest';

import { createAuthStrategy } from '../../domain/AuthStrategy.js';
import { createUserProfile, type UserProfile } from '../../domain/UserProfile.js';
import { RefreshProfileController, type RefreshProfileAuthUseCaseLike } from './RefreshProfileController.js';
import { ProfilePresenter } from './ProfilePresenter.js';

function buildProfile(): UserProfile {
  return createUserProfile({
    id: 'p1',
    name: 'admin',
    authStrategy: createAuthStrategy({ type: 'loginJourney', journeyId: 'journey-1', storageStatePath: '/tmp/s.json' }),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    authLastRefreshedAt: new Date('2026-01-02T00:00:00.000Z'),
  });
}

class FakeRefreshProfileAuthUseCase implements RefreshProfileAuthUseCaseLike {
  readonly calls: string[] = [];
  constructor(private readonly result: UserProfile) {}

  async execute(id: string): Promise<UserProfile> {
    this.calls.push(id);
    return this.result;
  }
}

describe('RefreshProfileController', () => {
  it('passes the id through and presents the refreshed profile, human mode by default', async () => {
    const profile = buildProfile();
    const useCase = new FakeRefreshProfileAuthUseCase(profile);
    const presenter = new ProfilePresenter();
    const presentSpy = vi.spyOn(presenter, 'present');
    const controller = new RefreshProfileController(useCase, presenter);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await controller.execute('p1', {});

    expect(useCase.calls).toEqual(['p1']);
    expect(presentSpy).toHaveBeenCalledWith(profile);
    logSpy.mockRestore();
  });

  it('invokes the presenter in JSON mode when --json is set', async () => {
    const profile = buildProfile();
    const useCase = new FakeRefreshProfileAuthUseCase(profile);
    const presenter = new ProfilePresenter();
    const toJsonSpy = vi.spyOn(presenter, 'toJson');
    const controller = new RefreshProfileController(useCase, presenter);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await controller.execute('p1', { json: true });

    expect(toJsonSpy).toHaveBeenCalledWith(profile);
    logSpy.mockRestore();
  });

  it('prints nothing when --quiet is set', async () => {
    const controller = new RefreshProfileController(new FakeRefreshProfileAuthUseCase(buildProfile()), new ProfilePresenter());
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await controller.execute('p1', { quiet: true });

    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('propagates a use case error without swallowing it (e.g. a failed login journey)', async () => {
    const failingUseCase: RefreshProfileAuthUseCaseLike = {
      execute: async () => {
        throw new Error('login journey failed');
      },
    };
    const controller = new RefreshProfileController(failingUseCase, new ProfilePresenter());

    await expect(controller.execute('p1', {})).rejects.toThrow('login journey failed');
  });
});
