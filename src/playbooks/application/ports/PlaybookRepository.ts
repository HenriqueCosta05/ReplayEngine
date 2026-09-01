import type { Playbook } from '../../domain/Playbook.js';

/**
 * Persists and retrieves `Playbook` aggregates (adapters/persistence
 * implements this). No `delete` method: unlike journeys/templates, this
 * feature's CLI surface (`playbook create|add-entry|list|show|run|runs|
 * show-run`) never deletes a playbook, so the port stays limited to what is
 * actually used.
 */
export interface PlaybookRepository {
  save(playbook: Playbook): Promise<void>;
  findById(id: string): Promise<Playbook | null>;
  findAll(): Promise<Playbook[]>;
}
