import { describe, expect, it } from 'vitest';
import { createPlaybook } from '../../domain/Playbook.js';
import { ShowPlaybookUseCase } from './ShowPlaybookUseCase.js';
import { NotFoundError } from '../../../shared-kernel/application/errors.js';
import { FakePlaybookRepository } from '../../../../test/unit/fakes/FakePlaybookRepository.js';

describe('ShowPlaybookUseCase', () => {
  it('returns the playbook when it exists', async () => {
    const repository = new FakePlaybookRepository();
    const playbook = createPlaybook({
      id: 'playbook-1',
      name: 'Smoke suite',
      entries: [],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await repository.save(playbook);

    const useCase = new ShowPlaybookUseCase(repository);

    expect(await useCase.execute('playbook-1')).toBe(playbook);
  });

  it('throws NotFoundError when the playbook does not exist', async () => {
    const useCase = new ShowPlaybookUseCase(new FakePlaybookRepository());
    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundError);
  });
});
