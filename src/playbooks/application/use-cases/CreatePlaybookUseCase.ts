import { createPlaybook, type Playbook } from '../../domain/Playbook.js';
import type { PlaybookRepository } from '../ports/PlaybookRepository.js';
import type { ClockPort } from '../../../shared-kernel/application/ports/ClockPort.js';
import type { IdGeneratorPort } from '../../../shared-kernel/application/ports/IdGeneratorPort.js';

export interface CreatePlaybookInput {
  name: string;
}

/**
 * Creates an empty `Playbook` (no entries yet - `AddEntryToPlaybookUseCase`
 * appends them afterwards, one at a time) and saves it.
 */
export class CreatePlaybookUseCase {
  constructor(
    private readonly repository: PlaybookRepository,
    private readonly idGenerator: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: CreatePlaybookInput): Promise<Playbook> {
    const playbook = createPlaybook({
      id: this.idGenerator.generate(),
      name: input.name,
      entries: [],
      createdAt: this.clock.now(),
    });

    await this.repository.save(playbook);

    return playbook;
  }
}
