import { createJourney, type Journey } from '../../domain/Journey.js';
import { createStep } from '../../domain/Step.js';
import type { ClockPort } from '../../../shared-kernel/application/ports/ClockPort.js';
import type { IdGeneratorPort } from '../../../shared-kernel/application/ports/IdGeneratorPort.js';
import type { JourneyRecorderPort, SupportedBrowser } from '../ports/JourneyRecorderPort.js';
import type { RecordOptions } from '../ports/JourneyRecorderPort.js';
import type { JourneyRepository } from '../ports/JourneyRepository.js';

export type RecordJourneyInput = Omit<RecordOptions, 'startUrl' | 'browser'> & {
  startUrl: string;
  browser: SupportedBrowser;
  name: string;
};

/**
 * Drives an interactive recording session via `JourneyRecorderPort`, turns
 * the raw draft it returns into a validated `Journey` (assigning `Step.id`
 * and `order` from `IdGeneratorPort`, and the journey's own `id`/`createdAt`
 * from `IdGeneratorPort`/`ClockPort`), persists it, and returns it.
 */
export class RecordJourneyUseCase {
  constructor(
    private readonly recorder: JourneyRecorderPort,
    private readonly repository: JourneyRepository,
    private readonly idGenerator: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: RecordJourneyInput): Promise<Journey> {
    const draft = await this.recorder.record({
      startUrl: input.startUrl,
      browser: input.browser,
      storageStatePath: input.storageStatePath,
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
      createdAt: this.clock.now(),
      steps,
    });

    await this.repository.save(journey);

    return journey;
  }
}
