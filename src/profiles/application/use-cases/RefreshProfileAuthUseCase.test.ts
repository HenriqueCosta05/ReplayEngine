import { describe, expect, it } from 'vitest';
import { createAuthStrategy } from '../../domain/AuthStrategy.js';
import { createUserProfile } from '../../domain/UserProfile.js';
import { RefreshProfileAuthUseCase } from './RefreshProfileAuthUseCase.js';
import { NotFoundError } from '../../../shared-kernel/application/errors.js';
import { FakeAuthStateProviderPort } from '../../../../test/unit/fakes/FakeAuthStateProviderPort.js';
import { FakeClock } from '../../../../test/unit/fakes/FakeClock.js';
import { FakeProfileRepository } from '../../../../test/unit/fakes/FakeProfileRepository.js';

function loginJourneyProfile() {
  return createUserProfile({
    id: 'p1',
    name: 'admin',
    authStrategy: createAuthStrategy({
      type: 'loginJourney',
      journeyId: 'journey-1',
      storageStatePath: '/tmp/state.json',
    }),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

describe('RefreshProfileAuthUseCase', () => {
  it('drives AuthStateProviderPort.refresh and persists authLastRefreshedAt from the clock', async () => {
    const repository = new FakeProfileRepository();
    const profile = loginJourneyProfile();
    repository.seed(profile);
    const authStateProvider = new FakeAuthStateProviderPort();
    const clock = new FakeClock(new Date('2026-02-01T00:00:00.000Z'));
    const useCase = new RefreshProfileAuthUseCase(repository, authStateProvider, clock);

    const refreshed = await useCase.execute('p1');

    expect(authStateProvider.refreshCalls).toEqual([profile]);
    expect(refreshed.authLastRefreshedAt).toEqual(new Date('2026-02-01T00:00:00.000Z'));
    await expect(repository.findById('p1')).resolves.toEqual(refreshed);
  });

  it('throws NotFoundError when the profile does not exist, without calling refresh', async () => {
    const authStateProvider = new FakeAuthStateProviderPort();
    const useCase = new RefreshProfileAuthUseCase(new FakeProfileRepository(), authStateProvider, new FakeClock());

    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundError);
    expect(authStateProvider.refreshCalls).toHaveLength(0);
  });

  it('propagates a refresh failure and leaves the persisted profile unrefreshed', async () => {
    const repository = new FakeProfileRepository();
    const profile = loginJourneyProfile();
    repository.seed(profile);
    const authStateProvider = new FakeAuthStateProviderPort();
    authStateProvider.setRefreshError(new Error('login journey failed'));
    const useCase = new RefreshProfileAuthUseCase(repository, authStateProvider, new FakeClock());

    await expect(useCase.execute('p1')).rejects.toThrow('login journey failed');
    await expect(repository.findById('p1')).resolves.toEqual(profile);
  });
});
