import type { UserProfile } from '../../domain/UserProfile.js';
import type { ProfileRepository } from '../ports/ProfileRepository.js';

/** Thin pass-through to `ProfileRepository.findAll`. */
export class ListProfilesUseCase {
  constructor(private readonly repository: ProfileRepository) {}

  async execute(): Promise<UserProfile[]> {
    return this.repository.findAll();
  }
}
