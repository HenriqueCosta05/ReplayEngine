import { describe, expect, it } from 'vitest';
import { createPlaybook } from '../../domain/Playbook.js';
import { createPlaybookRunResult } from '../../domain/PlaybookRunResult.js';
import { ListPlaybookRunsUseCase } from './ListPlaybookRunsUseCase.js';
import { NotFoundError } from '../../../shared-kernel/application/errors.js';
import { FakePlaybookRepository } from '../../../../test/unit/fakes/FakePlaybookRepository.js';
import { FakePlaybookRunResultRepository } from '../../../../test/unit/fakes/FakePlaybookRunResultRepository.js';

async function seedPlaybook(repository: FakePlaybookRepository, id: string) {
  await repository.save(
    createPlaybook({ id, name: 'Smoke suite', entries: [], createdAt: new Date('2026-01-01T00:00:00.000Z') }),
  );
}

describe('ListPlaybookRunsUseCase', () => {
  it('returns every run result for the given playbook, and none for others', async () => {
    const playbookRepository = new FakePlaybookRepository();
    const runResultRepository = new FakePlaybookRunResultRepository();
    await seedPlaybook(playbookRepository, 'playbook-1');
    await seedPlaybook(playbookRepository, 'playbook-2');

    const runForPlaybook1 = createPlaybookRunResult({
      id: 'run-1',
      playbookId: 'playbook-1',
      startedAt: new Date('2026-01-01T00:00:00Z'),
      finishedAt: new Date('2026-01-01T00:00:01Z'),
      entryResults: [],
    });
    const runForPlaybook2 = createPlaybookRunResult({
      id: 'run-2',
      playbookId: 'playbook-2',
      startedAt: new Date('2026-01-01T00:00:00Z'),
      finishedAt: new Date('2026-01-01T00:00:01Z'),
      entryResults: [],
    });
    runResultRepository.seed(runForPlaybook1);
    runResultRepository.seed(runForPlaybook2);

    const useCase = new ListPlaybookRunsUseCase(playbookRepository, runResultRepository);

    expect(await useCase.execute('playbook-1')).toEqual([runForPlaybook1]);
  });

  it('returns an empty array for a playbook that exists but was never run', async () => {
    const playbookRepository = new FakePlaybookRepository();
    await seedPlaybook(playbookRepository, 'playbook-1');
    const useCase = new ListPlaybookRunsUseCase(playbookRepository, new FakePlaybookRunResultRepository());

    expect(await useCase.execute('playbook-1')).toEqual([]);
  });

  it('throws NotFoundError when the playbook itself does not exist', async () => {
    const useCase = new ListPlaybookRunsUseCase(new FakePlaybookRepository(), new FakePlaybookRunResultRepository());
    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundError);
  });
});
