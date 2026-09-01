import type { PlaybookRunResult } from '../../../src/playbooks/domain/PlaybookRunResult.js';
import type { PlaybookRunResultRepository } from '../../../src/playbooks/application/ports/PlaybookRunResultRepository.js';

/** In-memory `PlaybookRunResultRepository` fake backed by a `Map`, keyed by `PlaybookRunResult.id`. */
export class FakePlaybookRunResultRepository implements PlaybookRunResultRepository {
  private readonly results = new Map<string, PlaybookRunResult>();

  async save(result: PlaybookRunResult): Promise<void> {
    this.results.set(result.id, result);
  }

  async findById(id: string): Promise<PlaybookRunResult | null> {
    return this.results.get(id) ?? null;
  }

  async findAllByPlaybookId(playbookId: string): Promise<PlaybookRunResult[]> {
    return Array.from(this.results.values()).filter((result) => result.playbookId === playbookId);
  }

  /** Test helper: seed the repository directly, bypassing `save`. */
  seed(result: PlaybookRunResult): void {
    this.results.set(result.id, result);
  }
}
