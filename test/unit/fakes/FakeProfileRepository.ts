import type { UserProfile } from '../../../src/profiles/domain/UserProfile.js';
import type { ProfileRepository } from '../../../src/profiles/application/ports/ProfileRepository.js';

/** In-memory `ProfileRepository` fake backed by a `Map`, keyed by `UserProfile.id`. */
export class FakeProfileRepository implements ProfileRepository {
  private readonly profiles = new Map<string, UserProfile>();

  async save(profile: UserProfile): Promise<void> {
    this.profiles.set(profile.id, profile);
  }

  async findById(id: string): Promise<UserProfile | null> {
    return this.profiles.get(id) ?? null;
  }

  async findByName(name: string): Promise<UserProfile | null> {
    for (const profile of this.profiles.values()) {
      if (profile.name === name) {
        return profile;
      }
    }
    return null;
  }

  async findAll(): Promise<UserProfile[]> {
    return Array.from(this.profiles.values());
  }

  /** Test helper: seed the repository directly, bypassing `save`. */
  seed(profile: UserProfile): void {
    this.profiles.set(profile.id, profile);
  }
}
