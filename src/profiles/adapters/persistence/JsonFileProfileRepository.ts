import { JsonFileStore } from '../../../infrastructure/JsonFileStore.js';
import { createAuthStrategy, type CreateAuthStrategyInput } from '../../domain/AuthStrategy.js';
import { createUserProfile, type UserProfile } from '../../domain/UserProfile.js';
import type { ProfileRepository } from '../../application/ports/ProfileRepository.js';
import type { ProfileSnapshot } from './ProfileSnapshot.js';

function toSnapshot(profile: UserProfile): ProfileSnapshot {
  return {
    id: profile.id,
    name: profile.name,
    authStrategy: profile.authStrategy,
    createdAt: profile.createdAt.toISOString(),
    ...(profile.authLastRefreshedAt !== undefined
      ? { authLastRefreshedAt: profile.authLastRefreshedAt.toISOString() }
      : {}),
  };
}

function toDomain(snapshot: ProfileSnapshot): UserProfile {
  // `new Date('nonsense')` is an Invalid Date, which `createUserProfile`
  // rejects - so a corrupt timestamp is caught by the domain rather than
  // silently becoming NaN.
  return createUserProfile({
    id: snapshot.id,
    name: snapshot.name,
    // Re-run the domain factory rather than casting: a file that was
    // hand-edited into an unknown auth strategy type or an empty required
    // field must fail loudly here, not surface as a broken UserProfile later.
    authStrategy: createAuthStrategy(snapshot.authStrategy as unknown as CreateAuthStrategyInput),
    createdAt: new Date(snapshot.createdAt),
    ...(snapshot.authLastRefreshedAt !== undefined
      ? { authLastRefreshedAt: new Date(snapshot.authLastRefreshedAt) }
      : {}),
  });
}

/**
 * File-backed `ProfileRepository`: one `<dataRoot>/profiles/<id>.json` per
 * profile, via the generic `JsonFileStore` - same pattern as
 * `JsonFileJourneyRepository`. `findByName` has no index to consult, so it
 * loads every record and filters in memory; that is the right tradeoff at
 * this collection's expected size (a handful of locally-registered profiles,
 * not thousands), and keeps this adapter free of a second on-disk structure
 * to keep in sync.
 */
export class JsonFileProfileRepository implements ProfileRepository {
  private readonly store: JsonFileStore<ProfileSnapshot>;

  constructor(profilesDirPath: string) {
    this.store = new JsonFileStore<ProfileSnapshot>(profilesDirPath);
  }

  async save(profile: UserProfile): Promise<void> {
    await this.store.save(profile.id, toSnapshot(profile));
  }

  async findById(id: string): Promise<UserProfile | null> {
    const snapshot = await this.store.findById(id);
    return snapshot === null ? null : toDomain(snapshot);
  }

  async findByName(name: string): Promise<UserProfile | null> {
    const snapshots = await this.store.findAll();
    const match = snapshots.find((snapshot) => snapshot.name === name);
    return match === undefined ? null : toDomain(match);
  }

  async findAll(): Promise<UserProfile[]> {
    const snapshots = await this.store.findAll();
    return snapshots.map(toDomain);
  }
}
