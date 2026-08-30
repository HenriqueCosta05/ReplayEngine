import type { CreateAuthStrategyInput } from '../../domain/AuthStrategy.js';
import type { UserProfile } from '../../domain/UserProfile.js';
import type { RegisterProfileInput } from '../../application/use-cases/RegisterProfileUseCase.js';
import type { ProfilePresenter } from './ProfilePresenter.js';

/** Structural (not nominal) views of the three use cases - see journeys' `RecordJourneyUseCaseLike` for why. */
export interface RegisterProfileUseCaseLike {
  execute(input: RegisterProfileInput): Promise<UserProfile>;
}
export interface ListProfilesUseCaseLike {
  execute(): Promise<UserProfile[]>;
}
export interface ShowProfileUseCaseLike {
  execute(id: string): Promise<UserProfile>;
}

export interface ProfileCommandOptions {
  json?: boolean;
  quiet?: boolean;
}

/**
 * CLI-facing shape of `profile add`'s options, already coerced/validated by
 * `commander` (`authType` checked against the three known values) - this
 * controller's only job is turning them into the use case's
 * `CreateAuthStrategyInput` DTO. Which of `storageStatePath` /
 * `loginJourneyId` + `loginStorageStatePath` is required depends on
 * `authType`; that requirement is enforced by the domain factory
 * (`createAuthStrategy`, called inside `RegisterProfileUseCase`), not here -
 * an empty/missing field for the chosen type surfaces as a `DomainError`
 * from the use case, same as every other domain rule in this codebase.
 */
export interface AddProfileCommandOptions extends ProfileCommandOptions {
  name: string;
  authType: CreateAuthStrategyInput['type'];
  storageStatePath?: string;
  loginJourneyId?: string;
  loginStorageStatePath?: string;
}

/**
 * Thin controller for `qamachine profile add|list|show`. One class per the
 * `JourneyController` precedent: these three commands share the same
 * presenter and read/create-by-id shape.
 */
export class ProfileController {
  constructor(
    private readonly registerUseCase: RegisterProfileUseCaseLike,
    private readonly listUseCase: ListProfilesUseCaseLike,
    private readonly showUseCase: ShowProfileUseCaseLike,
    private readonly presenter: ProfilePresenter,
  ) {}

  async add(options: AddProfileCommandOptions): Promise<void> {
    const profile = await this.registerUseCase.execute({
      name: options.name,
      authStrategy: this.toAuthStrategyInput(options),
    });

    if (options.quiet === true) {
      return;
    }

    console.log(options.json === true ? this.presenter.toJson(profile) : this.presenter.present(profile));
  }

  async list(options: ProfileCommandOptions): Promise<void> {
    const profiles = await this.listUseCase.execute();

    if (options.quiet === true) {
      return;
    }

    console.log(options.json === true ? this.presenter.toJson(profiles) : this.presenter.presentList(profiles));
  }

  async show(id: string, options: ProfileCommandOptions): Promise<void> {
    const profile = await this.showUseCase.execute(id);

    if (options.quiet === true) {
      return;
    }

    console.log(options.json === true ? this.presenter.toJson(profile) : this.presenter.present(profile));
  }

  private toAuthStrategyInput(options: AddProfileCommandOptions): CreateAuthStrategyInput {
    switch (options.authType) {
      case 'none':
        return { type: 'none' };
      case 'storageState':
        return { type: 'storageState', filePath: options.storageStatePath ?? '' };
      case 'loginJourney':
        return {
          type: 'loginJourney',
          journeyId: options.loginJourneyId ?? '',
          storageStatePath: options.loginStorageStatePath ?? '',
        };
      default: {
        const exhaustive: never = options.authType;
        throw new Error(`Unknown auth type "${String(exhaustive)}".`);
      }
    }
  }
}
