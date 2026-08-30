import type { UserProfile } from '../../domain/UserProfile.js';
import { NotFoundError } from '../../../shared-kernel/application/errors.js';
import type { ProfileRepository } from '../ports/ProfileRepository.js';

/** Loads a single `UserProfile` by id, throwing `NotFoundError` when absent. */
export class ShowProfileUseCase {
  constructor(private readonly repository: ProfileRepository) {}

  async execute(id: string): Promise<UserProfile> {
    const profile = await this.repository.findById(id);
    if (profile == null) {
      throw new NotFoundError(`Profile with id "${id}" was not found.`);
    }
    return profile;
  }
}
