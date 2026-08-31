import type { Playbook } from '../../domain/Playbook.js';
import type { PlaybookRepository } from '../ports/PlaybookRepository.js';

/** Thin pass-through to `PlaybookRepository.findAll`. */
export class ListPlaybooksUseCase {
  constructor(private readonly repository: PlaybookRepository) {}

  async execute(): Promise<Playbook[]> {
    return this.repository.findAll();
  }
}
