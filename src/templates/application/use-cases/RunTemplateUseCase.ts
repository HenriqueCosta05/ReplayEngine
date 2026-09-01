import type { TemplateRepository } from '../ports/TemplateRepository.js';
import { NotFoundError } from '../../../shared-kernel/application/errors.js';
import type { ClockPort } from '../../../shared-kernel/application/ports/ClockPort.js';
import type { IdGeneratorPort } from '../../../shared-kernel/application/ports/IdGeneratorPort.js';
import { createJourney } from '../../../journeys/domain/Journey.js';
import type { JourneyRunResult } from '../../../journeys/domain/JourneyRunResult.js';
import type { JourneyRunnerPort, SupportedBrowser } from '../../../journeys/application/ports/JourneyRunnerPort.js';
import type { AuthStateProviderPort } from '../../../profiles/application/ports/AuthStateProviderPort.js';
import type { ProfileRepository } from '../../../profiles/application/ports/ProfileRepository.js';

export interface RunTemplateInput {
  templateId: string;
  values: Record<string, string>;
  browser: SupportedBrowser;
  storageStatePath?: string;
  /** Resolved via `AuthStateProviderPort.resolve` into a `storageStatePath` before the run starts. */
  profileId?: string;
  keepTrace: boolean;
  tracePath?: string;
}

/**
 * Instantiates a `Template` against `values` and replays the result via
 * `JourneyRunnerPort` - the same port `RunJourneyUseCase` uses - without
 * persisting anything (a plain `template run` is stdout-only, mirroring
 * `journey run`).
 *
 * Per the brief's pre-flight ruling ("option (b)"): `Template.instantiate`
 * returns a `TransientJourneyDraft`, and this use case is the one that turns
 * it into a real `Journey` by supplying a fresh `id` (`IdGeneratorPort`) and
 * `createdAt` (`ClockPort`) immediately afterwards - `Journey`'s Task-1
 * factory itself is untouched. The resulting `Journey`'s `id` is only ever
 * handed to the runner for this one run; it is never persisted via a
 * `JourneyRepository`.
 *
 * Profile auth is resolved exactly like `RunJourneyUseCase`: `--profile`
 * always wins over whatever (if anything) the source journey/template
 * itself remembers, and resolving a missing profile id throws
 * `NotFoundError` before any browser work starts.
 */
export class RunTemplateUseCase {
  constructor(
    private readonly templateRepository: TemplateRepository,
    private readonly runner: JourneyRunnerPort,
    private readonly idGenerator: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly profileRepository: ProfileRepository,
    private readonly authStateProvider: AuthStateProviderPort,
  ) {}

  async execute(input: RunTemplateInput): Promise<JourneyRunResult> {
    const template = await this.templateRepository.findById(input.templateId);
    if (template == null) {
      throw new NotFoundError(`Template with id "${input.templateId}" was not found.`);
    }

    const draft = template.instantiate(input.values);

    const journey = createJourney({
      id: this.idGenerator.generate(),
      name: draft.name,
      startUrl: draft.startUrl,
      createdAt: this.clock.now(),
      steps: draft.steps,
    });

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
