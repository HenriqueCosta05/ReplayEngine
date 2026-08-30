import { createAuthStrategy, type CreateAuthStrategyInput } from '../../domain/AuthStrategy.js';
import { createUserProfile, type UserProfile } from '../../domain/UserProfile.js';
import { ConflictError } from '../../../shared-kernel/application/errors.js';
import type { ClockPort } from '../../../shared-kernel/application/ports/ClockPort.js';
import type { IdGeneratorPort } from '../../../shared-kernel/application/ports/IdGeneratorPort.js';
import type { ProfileRepository } from '../ports/ProfileRepository.js';

export interface RegisterProfileInput {
  name: string;
  authStrategy: CreateAuthStrategyInput;
}

/**
 * Registers a new `UserProfile`. Rejects a duplicate `name` via
 * `ProfileRepository.findByName` with `ConflictError` - a real application
 * rule (profile names are how a human picks a profile on the CLI, so two
 * profiles sharing a name would make `--profile <name>` ambiguous), not
 * merely a nice-to-have.
 */
export class RegisterProfileUseCase {
  constructor(
    private readonly repository: ProfileRepository,
    private readonly idGenerator: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: RegisterProfileInput): Promise<UserProfile> {
    const existing = await this.repository.findByName(input.name);
    if (existing !== null) {
      throw new ConflictError(`A profile named "${input.name}" already exists.`);
    }

    const profile = createUserProfile({
      id: this.idGenerator.generate(),
      name: input.name,
      authStrategy: createAuthStrategy(input.authStrategy),
      createdAt: this.clock.now(),
    });

    await this.repository.save(profile);

    return profile;
  }
}
