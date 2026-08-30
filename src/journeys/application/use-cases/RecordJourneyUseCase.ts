import { createJourney, type Journey } from '../../domain/Journey.js';
import { createStep } from '../../domain/Step.js';
import type { AuthStateProviderPort } from '../../../profiles/application/ports/AuthStateProviderPort.js';
import type { ProfileRepository } from '../../../profiles/application/ports/ProfileRepository.js';
import { NotFoundError } from '../../../shared-kernel/application/errors.js';
import type { ClockPort } from '../../../shared-kernel/application/ports/ClockPort.js';
import type { IdGeneratorPort } from '../../../shared-kernel/application/ports/IdGeneratorPort.js';
import type { JourneyRecorderPort, SupportedBrowser } from '../ports/JourneyRecorderPort.js';
import type { RecordOptions } from '../ports/JourneyRecorderPort.js';
import type { JourneyRepository } from '../ports/JourneyRepository.js';

export type RecordJourneyInput = Omit<RecordOptions, 'startUrl' | 'browser'> & {
  startUrl: string;
  browser: SupportedBrowser;
  name: string;
  /** Resolved via `AuthStateProviderPort.resolve` into a `storageStatePath` before recording starts. */
  profileId?: string;
};

/**
 * Drives an interactive recording session via `JourneyRecorderPort`, turns
 * the raw draft it returns into a validated `Journey` (assigning `Step.id`
 * and `order` from `IdGeneratorPort`, and the journey's own `id`/`createdAt`
 * from `IdGeneratorPort`/`ClockPort`), persists it, and returns it.
 *
 * When `input.profileId` is given, it is resolved to a `storageStatePath` via
 * `ProfileRepository` + `AuthStateProviderPort.resolve` before recording
 * starts, so the Inspector opens already authenticated as that profile - and
 * the journey is persisted with that `profileId` attached, so a later
 * `journey run` without an explicit `--profile` still knows which profile it
 * was recorded under (informational only; `RunJourneyUseCase` does not apply
 * it automatically - see that file).
 */
export class RecordJourneyUseCase {
  constructor(
    private readonly recorder: JourneyRecorderPort,
    private readonly repository: JourneyRepository,
    private readonly idGenerator: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly profileRepository: ProfileRepository,
    private readonly authStateProvider: AuthStateProviderPort,
  ) {}

  async execute(input: RecordJourneyInput): Promise<Journey> {
    const resolvedStorageStatePath = await this.resolveStorageStatePath(input.profileId);

    const draft = await this.recorder.record({
      startUrl: input.startUrl,
      browser: input.browser,
      storageStatePath: input.storageStatePath ?? resolvedStorageStatePath,
      viewport: input.viewport,
      device: input.device,
      colorScheme: input.colorScheme,
      timezone: input.timezone,
      lang: input.lang,
      geolocation: input.geolocation,
    });

    const steps = draft.steps.map((stepDraft, index) =>
      createStep({
        id: this.idGenerator.generate(),
        order: index,
        action: stepDraft.action,
        label: stepDraft.label,
      }),
    );

    const journey = createJourney({
      id: this.idGenerator.generate(),
      name: input.name,
      startUrl: draft.startUrl,
      ...(input.profileId !== undefined ? { profileId: input.profileId } : {}),
      createdAt: this.clock.now(),
      steps,
    });

    await this.repository.save(journey);

    return journey;
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
