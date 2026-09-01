import type { PlaybookRunResult } from '../../domain/PlaybookRunResult.js';
import type { PlaybookRepository } from '../ports/PlaybookRepository.js';
import type { PlaybookRunResultRepository } from '../ports/PlaybookRunResultRepository.js';
import { NotFoundError } from '../../../shared-kernel/application/errors.js';

/**
 * Lists every past run of one `Playbook`. Confirms the `Playbook` itself
 * exists first (`NotFoundError` on a bogus id) so a typo'd playbook id is
 * reported clearly rather than silently returning an empty list - an empty
 * list for a playbook that *does* exist but has never been run is the
 * normal, non-error case.
 */
export class ListPlaybookRunsUseCase {
  constructor(
    private readonly playbookRepository: PlaybookRepository,
    private readonly runResultRepository: PlaybookRunResultRepository,
  ) {}

  async execute(playbookId: string): Promise<PlaybookRunResult[]> {
    const playbook = await this.playbookRepository.findById(playbookId);
    if (playbook == null) {
      throw new NotFoundError(`Playbook with id "${playbookId}" was not found.`);
    }
    return this.runResultRepository.findAllByPlaybookId(playbookId);
  }
}
