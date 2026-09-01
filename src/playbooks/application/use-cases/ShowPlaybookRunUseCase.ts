import type { PlaybookRunResult } from '../../domain/PlaybookRunResult.js';
import type { PlaybookRunResultRepository } from '../ports/PlaybookRunResultRepository.js';
import { NotFoundError } from '../../../shared-kernel/application/errors.js';

/** Loads a single `PlaybookRunResult` by id, throwing `NotFoundError` when absent. */
export class ShowPlaybookRunUseCase {
  constructor(private readonly repository: PlaybookRunResultRepository) {}

  async execute(id: string): Promise<PlaybookRunResult> {
    const result = await this.repository.findById(id);
    if (result == null) {
      throw new NotFoundError(`Playbook run with id "${id}" was not found.`);
    }
    return result;
  }
}
