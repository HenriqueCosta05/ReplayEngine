import { describe, expect, it } from 'vitest';
import { CreatePlaybookUseCase } from './CreatePlaybookUseCase.js';
import { FakeClock } from '../../../../test/unit/fakes/FakeClock.js';
import { FakeIdGenerator } from '../../../../test/unit/fakes/FakeIdGenerator.js';
import { FakePlaybookRepository } from '../../../../test/unit/fakes/FakePlaybookRepository.js';

describe('CreatePlaybookUseCase', () => {
  it('creates and saves an empty playbook', async () => {
    const repository = new FakePlaybookRepository();
    const clock = new FakeClock(new Date('2026-01-01T00:00:00.000Z'));
    const useCase = new CreatePlaybookUseCase(repository, new FakeIdGenerator(), clock);

    const playbook = await useCase.execute({ name: 'Smoke suite' });

    expect(playbook).toMatchObject({ id: 'id-1', name: 'Smoke suite', entries: [] });
    expect(await repository.findById('id-1')).toBe(playbook);
  });
});
