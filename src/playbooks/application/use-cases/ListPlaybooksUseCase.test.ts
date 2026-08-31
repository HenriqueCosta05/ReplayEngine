import { describe, expect, it } from 'vitest';
import { createPlaybook } from '../../domain/Playbook.js';
import { ListPlaybooksUseCase } from './ListPlaybooksUseCase.js';
import { FakePlaybookRepository } from '../../../../test/unit/fakes/FakePlaybookRepository.js';

describe('ListPlaybooksUseCase', () => {
  it('returns every saved playbook', async () => {
    const repository = new FakePlaybookRepository();
    const playbook = createPlaybook({
      id: 'playbook-1',
      name: 'Smoke suite',
      entries: [],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    await repository.save(playbook);

    const useCase = new ListPlaybooksUseCase(repository);

    expect(await useCase.execute()).toEqual([playbook]);
  });

  it('returns an empty array when nothing is saved', async () => {
    const useCase = new ListPlaybooksUseCase(new FakePlaybookRepository());
    expect(await useCase.execute()).toEqual([]);
  });
});
