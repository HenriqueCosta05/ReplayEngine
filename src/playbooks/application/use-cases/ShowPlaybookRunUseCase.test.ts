import { describe, expect, it } from 'vitest';
import { createPlaybookRunResult } from '../../domain/PlaybookRunResult.js';
import { ShowPlaybookRunUseCase } from './ShowPlaybookRunUseCase.js';
import { NotFoundError } from '../../../shared-kernel/application/errors.js';
import { FakePlaybookRunResultRepository } from '../../../../test/unit/fakes/FakePlaybookRunResultRepository.js';

describe('ShowPlaybookRunUseCase', () => {
  it('returns the run result when it exists', async () => {
    const repository = new FakePlaybookRunResultRepository();
    const result = createPlaybookRunResult({
      id: 'run-1',
      playbookId: 'playbook-1',
      startedAt: new Date('2026-01-01T00:00:00Z'),
      finishedAt: new Date('2026-01-01T00:00:01Z'),
      entryResults: [],
    });
    repository.seed(result);

    const useCase = new ShowPlaybookRunUseCase(repository);

    expect(await useCase.execute('run-1')).toBe(result);
  });

  it('throws NotFoundError when the run result does not exist', async () => {
    const useCase = new ShowPlaybookRunUseCase(new FakePlaybookRunResultRepository());
    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundError);
  });
});
