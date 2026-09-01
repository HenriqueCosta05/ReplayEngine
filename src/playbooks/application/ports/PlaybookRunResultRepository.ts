import type { PlaybookRunResult } from '../../domain/PlaybookRunResult.js';

/**
 * Persists and retrieves `PlaybookRunResult` aggregates (adapters/persistence
 * implements this). `findAllByPlaybookId` is what `playbook runs <id>` uses
 * to list every past run of one playbook - unlike `PlaybookRepository`,
 * multiple `PlaybookRunResult`s legitimately share the same `playbookId`.
 */
export interface PlaybookRunResultRepository {
  save(result: PlaybookRunResult): Promise<void>;
  findById(id: string): Promise<PlaybookRunResult | null>;
  findAllByPlaybookId(playbookId: string): Promise<PlaybookRunResult[]>;
}
