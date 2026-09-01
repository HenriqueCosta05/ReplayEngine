import type { UserProfile } from '../../domain/UserProfile.js';
import type { ProfilePresenter } from './ProfilePresenter.js';

/** Structural view of `RefreshProfileAuthUseCase` - see `RegisterProfileUseCaseLike` for why. */
export interface RefreshProfileAuthUseCaseLike {
  execute(id: string): Promise<UserProfile>;
}

export interface RefreshProfileCommandOptions {
  json?: boolean;
  quiet?: boolean;
}

/**
 * Thin controller for `qamachine profile refresh <id>`: calls
 * `RefreshProfileAuthUseCase` and hands the refreshed profile to
 * `ProfilePresenter`. Kept as its own controller (rather than folded into
 * `ProfileController`) because it takes real browser-driving time and can
 * fail in a way the other three commands cannot (the login journey itself
 * failing) - worth a distinct seam even though it shares the presenter.
 */
export class RefreshProfileController {
  constructor(
    private readonly useCase: RefreshProfileAuthUseCaseLike,
    private readonly presenter: ProfilePresenter,
  ) {}

  async execute(id: string, options: RefreshProfileCommandOptions): Promise<void> {
    const profile = await this.useCase.execute(id);

    if (options.quiet === true) {
      return;
    }

    console.log(options.json === true ? this.presenter.toJson(profile) : this.presenter.present(profile));
  }
}
