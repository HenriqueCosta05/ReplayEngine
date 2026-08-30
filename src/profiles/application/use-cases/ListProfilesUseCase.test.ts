import { describe, expect, it } from 'vitest';
import { createAuthStrategy } from '../../domain/AuthStrategy.js';
import { createUserProfile } from '../../domain/UserProfile.js';
import { ListProfilesUseCase } from './ListProfilesUseCase.js';
import { FakeProfileRepository } from '../../../../test/unit/fakes/FakeProfileRepository.js';

describe('ListProfilesUseCase', () => {
  it('returns every profile from the repository', async () => {
    const repository = new FakeProfileRepository();
    const profile = createUserProfile({
      id: 'p1',
      name: 'admin',
      authStrategy: createAuthStrategy({ type: 'none' }),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    repository.seed(profile);

    const useCase = new ListProfilesUseCase(repository);

    await expect(useCase.execute()).resolves.toEqual([profile]);
  });

  it('returns an empty array when nothing is registered', async () => {
    const useCase = new ListProfilesUseCase(new FakeProfileRepository());

    await expect(useCase.execute()).resolves.toEqual([]);
  });
});
