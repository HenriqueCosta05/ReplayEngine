import { DomainError } from './errors.js';
import type { PlaybookEntry } from './PlaybookEntry.js';

export interface CreatePlaybookInput {
  id: string;
  name: string;
  entries: readonly PlaybookEntry[];
  createdAt: Date;
}

/**
 * A named, ordered group of journeys/templates that can be re-run together
 * as a suite (project requirement 3: catch unexpected breakage across
 * several flows in one command). Immutable, like `Journey`: there are no
 * mutation methods, so `AddEntryToPlaybookUseCase` "edits" a playbook by
 * calling `createPlaybook` again with the appended `entries` array - the
 * factory re-validates the whole aggregate (including entry-id uniqueness)
 * on every such rebuild, the same way `createJourney` would on a
 * hypothetical step edit.
 *
 * `entries` may legitimately be empty: `CreatePlaybookUseCase` creates a
 * playbook with zero entries, and `AddEntryToPlaybookUseCase` appends them
 * one at a time afterwards - there is no single "create with entries"
 * command in this feature's CLI surface.
 */
export interface Playbook {
  readonly id: string;
  readonly name: string;
  readonly entries: readonly PlaybookEntry[];
  readonly createdAt: Date;
}

export function createPlaybook(input: CreatePlaybookInput): Playbook {
  if (input == null || typeof input.id !== 'string' || input.id.length === 0) {
    throw new DomainError('Playbook id must be a non-empty string.');
  }
  if (typeof input.name !== 'string' || input.name.trim().length === 0) {
    throw new DomainError('Playbook name must not be empty.');
  }
  if (!(input.createdAt instanceof Date) || Number.isNaN(input.createdAt.getTime())) {
    throw new DomainError('Playbook createdAt must be a valid Date.');
  }
  if (!Array.isArray(input.entries)) {
    throw new DomainError('Playbook entries must be an array.');
  }

  const seenIds = new Set<string>();
  for (const entry of input.entries) {
    if (seenIds.has(entry.id)) {
      throw new DomainError(`Playbook entry id "${entry.id}" is used more than once; entry ids must be unique.`);
    }
    seenIds.add(entry.id);
  }

  return {
    id: input.id,
    name: input.name,
    // Copy the array so a caller mutating the array reference they passed
    // in after construction cannot reach into this Playbook - same
    // snapshot-safety rationale as `Template`'s `steps`/`parameters` copy.
    entries: [...input.entries],
    createdAt: input.createdAt,
  };
}
