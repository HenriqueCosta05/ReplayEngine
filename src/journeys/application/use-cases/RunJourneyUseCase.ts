import type { JourneyRunResult } from '../../domain/JourneyRunResult.js';
import type { AuthStateProviderPort } from '../../../profiles/application/ports/AuthStateProviderPort.js';
import type { ProfileRepository } from '../../../profiles/application/ports/ProfileRepository.js';
import { NotFoundError } from '../../../shared-kernel/application/errors.js';
import type { JourneyRepository } from '../ports/JourneyRepository.js';
import type { JourneyRunnerPort, SupportedBrowser } from '../ports/JourneyRunnerPort.js';

export interface RunJourneyInput {
  journeyId: string;
  browser: SupportedBrowser;
  storageStatePath?: string;
  /** Resolved via `AuthStateProviderPort.resolve` into a `storageStatePath` before the run starts. */
  profileId?: string;
  keepTrace: boolean;
  tracePath?: string;
}

/**
 * Loads a `Journey` by id and replays it via `JourneyRunnerPort`. The result
 * is returned to the caller but not persisted here: a plain `journey run` is
 * stdout-only (per the plan); playbook runs persist their own aggregate
 * (Task 7).
 *
 * When `input.profileId` is given (from `--profile`), it is resolved to a
 * `storageStatePath` via `ProfileRepository` + `AuthStateProviderPort.resolve`
 * before the run starts. This is deliberately independent of whichever
 * profile (if any) the journey was *recorded* under (`journey.profileId`,
 * set by `RecordJourneyUseCase`): a run's `--profile` always wins, and a run
 * with no `--profile` runs unauthenticated even if the journey remembers a
 * profile - re-applying a journey's own recording-time profile automatically
 * would be a surprising implicit behaviour to guess at without the brief
 * asking for it.
 */
export class RunJourneyUseCase {
  constructor(
    private readonly repository: JourneyRepository,
    private readonly runner: JourneyRunnerPort,
    private readonly profileRepository: ProfileRepository,
    private readonly authStateProvider: AuthStateProviderPort,
  ) {}

  async execute(input: RunJourneyInput): Promise<JourneyRunResult> {
    const journey = await this.repository.findById(input.journeyId);
    if (journey == null) {
      throw new NotFoundError(`Journey with id "${input.journeyId}" was not found.`);
    }

    const resolvedStorageStatePath = await this.resolveStorageStatePath(input.profileId);

    return this.runner.run(journey, {
      browser: input.browser,
      storageStatePath: input.storageStatePath ?? resolvedStorageStatePath,
      profileId: input.profileId,
      keepTrace: input.keepTrace,
      tracePath: input.tracePath,
    });
  }

  private async resolveStorageStatePath(profileId: string | undefined): Promise<string | undefined> {
    if (profileId === undefined) {
      return undefined;
    }

    const profile = await this.profileRepository.findById(profileId);
    if (profile == null) {
      throw new NotFoundError(`Profile with id "${profileId}" was not found.`);
    }

    const { storageStatePath } = await this.authStateProvider.resolve(profile);
    return storageStatePath ?? undefined;
  }
}
