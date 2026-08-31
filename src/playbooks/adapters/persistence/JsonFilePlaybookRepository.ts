import { JsonFileStore } from '../../../infrastructure/JsonFileStore.js';
import { createPlaybook, type Playbook } from '../../domain/Playbook.js';
import { createPlaybookEntry, type PlaybookEntry } from '../../domain/PlaybookEntry.js';
import type { PlaybookRepository } from '../../application/ports/PlaybookRepository.js';
import type { PlaybookEntrySnapshot, PlaybookSnapshot } from './PlaybookSnapshot.js';

function toEntrySnapshot(entry: PlaybookEntry): PlaybookEntrySnapshot {
  return {
    id: entry.id,
    source: entry.source,
    ...(entry.profileOverride !== undefined ? { profileOverride: entry.profileOverride } : {}),
    continueOnFailure: entry.continueOnFailure,
  };
}

function toEntry(snapshot: PlaybookEntrySnapshot): PlaybookEntry {
  return createPlaybookEntry({
    id: snapshot.id,
    // Re-run the domain factory rather than casting: a file that was
    // hand-edited into an unknown source type or an invalid
    // parameterBindings shape must fail loudly here, not surface as a
    // broken Playbook later.
    source: snapshot.source,
    ...(snapshot.profileOverride !== undefined ? { profileOverride: snapshot.profileOverride } : {}),
    continueOnFailure: snapshot.continueOnFailure,
  });
}

function toSnapshot(playbook: Playbook): PlaybookSnapshot {
  return {
    id: playbook.id,
    name: playbook.name,
    createdAt: playbook.createdAt.toISOString(),
    entries: playbook.entries.map(toEntrySnapshot),
  };
}

function toDomain(snapshot: PlaybookSnapshot): Playbook {
  // `new Date('nonsense')` is an Invalid Date, which `createPlaybook`
  // rejects - so a corrupt timestamp is caught by the domain rather than
  // silently becoming NaN.
  return createPlaybook({
    id: snapshot.id,
    name: snapshot.name,
    createdAt: new Date(snapshot.createdAt),
    entries: (snapshot.entries ?? []).map(toEntry),
  });
}

/**
 * File-backed `PlaybookRepository`: one `<dataRoot>/playbooks/<id>.json`
 * per playbook, via the generic `JsonFileStore` - same pattern as
 * `JsonFileTemplateRepository`/`JsonFileProfileRepository`. Reconstructs
 * reads through `createPlaybook`/`createPlaybookEntry` so a corrupted or
 * hand-edited file raises a `DomainError` instead of yielding an invalid
 * aggregate.
 */
export class JsonFilePlaybookRepository implements PlaybookRepository {
  private readonly store: JsonFileStore<PlaybookSnapshot>;

  constructor(playbooksDirPath: string) {
    this.store = new JsonFileStore<PlaybookSnapshot>(playbooksDirPath);
  }

  async save(playbook: Playbook): Promise<void> {
    await this.store.save(playbook.id, toSnapshot(playbook));
  }

  async findById(id: string): Promise<Playbook | null> {
    const snapshot = await this.store.findById(id);
    return snapshot === null ? null : toDomain(snapshot);
  }

  async findAll(): Promise<Playbook[]> {
    const snapshots = await this.store.findAll();
    return snapshots.map(toDomain);
  }
}
