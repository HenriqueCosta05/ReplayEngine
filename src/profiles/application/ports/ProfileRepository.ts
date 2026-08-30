import type { UserProfile } from '../../domain/UserProfile.js';

/**
 * Persists and retrieves `UserProfile` aggregates (adapters/persistence
 * implements this). `findByName` exists specifically so
 * `RegisterProfileUseCase` can enforce the "profile names are unique"
 * application rule without every adapter re-implementing that lookup.
 */
export interface ProfileRepository {
  save(profile: UserProfile): Promise<void>;
  findById(id: string): Promise<UserProfile | null>;
  findByName(name: string): Promise<UserProfile | null>;
  findAll(): Promise<UserProfile[]>;
}
