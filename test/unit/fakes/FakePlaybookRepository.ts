import type { Playbook } from '../../../src/playbooks/domain/Playbook.js';
import type { PlaybookRepository } from '../../../src/playbooks/application/ports/PlaybookRepository.js';

/** In-memory `PlaybookRepository` fake backed by a `Map`, keyed by `Playbook.id`. */
export class FakePlaybookRepository implements PlaybookRepository {
  private readonly playbooks = new Map<string, Playbook>();

  async save(playbook: Playbook): Promise<void> {
    this.playbooks.set(playbook.id, playbook);
  }

  async findById(id: string): Promise<Playbook | null> {
    return this.playbooks.get(id) ?? null;
  }

  async findAll(): Promise<Playbook[]> {
    return Array.from(this.playbooks.values());
  }

  /** Test helper: seed the repository directly, bypassing `save`. */
  seed(playbook: Playbook): void {
    this.playbooks.set(playbook.id, playbook);
  }
}
