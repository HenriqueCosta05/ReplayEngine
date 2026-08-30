import type { TemplateRepository } from '../ports/TemplateRepository.js';
import { NotFoundError } from '../../../shared-kernel/application/errors.js';
import type { ClockPort } from '../../../shared-kernel/application/ports/ClockPort.js';
import type { IdGeneratorPort } from '../../../shared-kernel/application/ports/IdGeneratorPort.js';
import { createJourney, type Journey } from '../../../journeys/domain/Journey.js';
import type { JourneyRepository } from '../../../journeys/application/ports/JourneyRepository.js';

export interface InstantiateTemplateInput {
  templateId: string;
  values: Record<string, string>;
  /** Overrides the resulting `Journey.name`; defaults to the template's own `name`. */
  name?: string;
}

/**
 * Turns a `Template` + parameter `values` into a real, persisted `Journey`,
 * without running it - the "materialize a template into a reusable journey"
 * path (as opposed to `RunTemplateUseCase`, which runs one transiently and
 * persists nothing).
 *
 * This is where the brief's pre-flight ruling "option (b)" is applied:
 * `Template.instantiate` returns a `TransientJourneyDraft` (no `id`/
 * `createdAt`), and this use case supplies both via the same
 * `IdGeneratorPort`/`ClockPort` ports `RecordJourneyUseCase` uses, then
 * calls the *unmodified* `createJourney` factory from Task 1.
 */
export class InstantiateTemplateUseCase {
  constructor(
    private readonly templateRepository: TemplateRepository,
    private readonly journeyRepository: JourneyRepository,
    private readonly idGenerator: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: InstantiateTemplateInput): Promise<Journey> {
    const template = await this.templateRepository.findById(input.templateId);
    if (template == null) {
      throw new NotFoundError(`Template with id "${input.templateId}" was not found.`);
    }

    const draft = template.instantiate(input.values);

    const journey = createJourney({
      id: this.idGenerator.generate(),
      name: input.name ?? draft.name,
      startUrl: draft.startUrl,
      createdAt: this.clock.now(),
      steps: draft.steps,
    });

    await this.journeyRepository.save(journey);

    return journey;
  }
}
