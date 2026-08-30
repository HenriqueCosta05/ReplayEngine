import { createUserProfile, type UserProfile } from '../../domain/UserProfile.js';
import { NotFoundError } from '../../../shared-kernel/application/errors.js';
import type { ClockPort } from '../../../shared-kernel/application/ports/ClockPort.js';
import type { AuthStateProviderPort } from '../ports/AuthStateProviderPort.js';
import type { ProfileRepository } from '../ports/ProfileRepository.js';

/**
 * Loads a `UserProfile` by id, drives `AuthStateProviderPort.refresh` against
 * it (re-running its `loginJourney`, if that is its strategy), and persists
 * the profile again with `authLastRefreshedAt` advanced to now.
 *
 * `authLastRefreshedAt` is only ever set here, and only after `refresh`
 * resolves without throwing: if the login journey fails, `refresh` rejects
 * (see `StorageStateAuthStateProvider`) and this use case never reaches the
 * save - a failed refresh must not be recorded as if it succeeded.
 */
export class RefreshProfileAuthUseCase {
  constructor(
    private readonly repository: ProfileRepository,
    private readonly authStateProvider: AuthStateProviderPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(id: string): Promise<UserProfile> {
    const profile = await this.repository.findById(id);
    if (profile == null) {
      throw new NotFoundError(`Profile with id "${id}" was not found.`);
    }

    await this.authStateProvider.refresh(profile);

    const refreshed = createUserProfile({
      id: profile.id,
      name: profile.name,
      authStrategy: profile.authStrategy,
      createdAt: profile.createdAt,
      authLastRefreshedAt: this.clock.now(),
    });

    await this.repository.save(refreshed);

    return refreshed;
  }
}
