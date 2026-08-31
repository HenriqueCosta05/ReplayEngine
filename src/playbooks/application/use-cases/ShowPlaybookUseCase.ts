import type { Playbook } from '../../domain/Playbook.js';
import type { PlaybookRepository } from '../ports/PlaybookRepository.js';
import { NotFoundError } from '../../../shared-kernel/application/errors.js';

/** Loads a single `Playbook` by id, throwing `NotFoundError` when absent. */
export class ShowPlaybookUseCase {
  constructor(private readonly repository: PlaybookRepository) {}

  async execute(id: string): Promise<Playbook> {
    const playbook = await this.repository.findById(id);
    if (playbook == null) {
      throw new NotFoundError(`Playbook with id "${id}" was not found.`);
    }
    return playbook;
  }
}
