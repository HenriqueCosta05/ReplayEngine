import { describe, expect, it } from 'vitest';
import { createAuthStrategy } from '../../domain/AuthStrategy.js';
import { createUserProfile } from '../../domain/UserProfile.js';
import { ShowProfileUseCase } from './ShowProfileUseCase.js';
import { NotFoundError } from '../../../shared-kernel/application/errors.js';
import { FakeProfileRepository } from '../../../../test/unit/fakes/FakeProfileRepository.js';

describe('ShowProfileUseCase', () => {
  it('returns the profile when it exists', async () => {
    const repository = new FakeProfileRepository();
    const profile = createUserProfile({
      id: 'p1',
      name: 'admin',
      authStrategy: createAuthStrategy({ type: 'none' }),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    repository.seed(profile);

    const useCase = new ShowProfileUseCase(repository);

    await expect(useCase.execute('p1')).resolves.toEqual(profile);
  });

  it('throws NotFoundError when the profile does not exist', async () => {
    const useCase = new ShowProfileUseCase(new FakeProfileRepository());

    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundError);
  });
});
