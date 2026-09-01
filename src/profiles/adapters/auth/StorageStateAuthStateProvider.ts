import type { JourneyRepository } from '../../../journeys/application/ports/JourneyRepository.js';
import type { JourneyRunnerPort } from '../../../journeys/application/ports/JourneyRunnerPort.js';
import { NotFoundError } from '../../../shared-kernel/application/errors.js';
import type { AuthStateProviderPort, ResolvedAuthState } from '../../application/ports/AuthStateProviderPort.js';
import type { UserProfile } from '../../domain/UserProfile.js';

/**
 * The one `AuthStateProviderPort` implementation. This is deliberately the
 * single place in `profiles` that depends on the journeys feature's
 * application ports (`JourneyRepository`, `JourneyRunnerPort`) - a
 * legitimate same-layer, cross-feature adapter dependency (see the port's
 * own doc comment for why `AuthStateProviderPort` itself stays free of it).
 */
export class StorageStateAuthStateProvider implements AuthStateProviderPort {
  constructor(
    private readonly journeyRepository: JourneyRepository,
    private readonly journeyRunner: JourneyRunnerPort,
  ) {}

  /**
   * Never runs a browser. `'loginJourney'` resolves to whatever is currently
   * on disk at `storageStatePath` - fresh only if `refresh` was called first
   * (or the file was placed there by hand); a missing/stale file surfaces
   * later, as a Playwright context-creation error, not here.
   */
  async resolve(profile: UserProfile): Promise<ResolvedAuthState> {
    const { authStrategy } = profile;
    switch (authStrategy.type) {
      case 'none':
        return { storageStatePath: null };
      case 'storageState':
        return { storageStatePath: authStrategy.filePath };
      case 'loginJourney':
        return { storageStatePath: authStrategy.storageStatePath };
      /* istanbul ignore next -- unreachable: AuthStrategy is a closed, validated union */
      default: {
        const exhaustive: never = authStrategy;
        throw new Error(`Unknown auth strategy type "${String((exhaustive as { type: string }).type)}".`);
      }
    }
  }

  /**
   * Only `'loginJourney'` profiles can be refreshed: loads that strategy's
   * journey, runs it with `captureStorageStatePath` set to the strategy's
   * `storageStatePath` (see `JourneyRunnerPort.RunOptions`), and rejects if
   * either the journey is missing or the run itself failed - a failed login
   * must never leave behind a storage-state file that looks freshly
   * refreshed but is actually stale or empty.
   */
  async refresh(profile: UserProfile): Promise<void> {
    const { authStrategy } = profile;
    if (authStrategy.type !== 'loginJourney') {
      throw new Error(
        `Profile "${profile.name}" uses auth strategy "${authStrategy.type}", which does not support refresh ` +
          '(only "loginJourney" profiles can be refreshed).',
      );
    }

    const journey = await this.journeyRepository.findById(authStrategy.journeyId);
    if (journey == null) {
      throw new NotFoundError(
        `Login journey "${authStrategy.journeyId}" for profile "${profile.name}" was not found.`,
      );
    }

    const result = await this.journeyRunner.run(journey, {
      browser: 'chromium',
      keepTrace: false,
      captureStorageStatePath: authStrategy.storageStatePath,
    });

    if (result.status === 'failed') {
      throw new Error(
        `Login journey "${authStrategy.journeyId}" failed while refreshing profile "${profile.name}": ` +
          `${result.error ?? 'one or more steps failed'}.`,
      );
    }
  }
}
