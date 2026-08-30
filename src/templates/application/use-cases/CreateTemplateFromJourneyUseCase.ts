import { createTemplate, type Template } from '../../domain/Template.js';
import { createTemplateParameter } from '../../domain/TemplateParameter.js';
import type { TemplateRepository } from '../ports/TemplateRepository.js';
import { NotFoundError } from '../../../shared-kernel/application/errors.js';
import type { ClockPort } from '../../../shared-kernel/application/ports/ClockPort.js';
import type { IdGeneratorPort } from '../../../shared-kernel/application/ports/IdGeneratorPort.js';
import type { JourneyRepository } from '../../../journeys/application/ports/JourneyRepository.js';

/**
 * One `--param` entry's DTO shape, as parsed (pure string parsing, no
 * business validation) by `TemplateController.parseTemplateParameterFlag`
 * from `--param <stepIndex>.<field>=<paramName>[:required][:default=<v>]`.
 *
 * `targetStepIndex` is 0-based and matches `Step.order` (the same indexing
 * `JourneySnapshot`/`JourneyPresenter` use), not a raw `Step.id` - a human
 * typing `--param` flags does not know a step's generated id, only its
 * position within the journey they just recorded or looked at via
 * `journey show`. This use case is what resolves that index to the actual
 * `Step.id` `TemplateParameter` needs, since it is the one place that has
 * both the flag and the loaded `Journey`'s steps in hand.
 */
export interface CreateTemplateFromJourneyParameterInput {
  targetStepIndex: number;
  targetField: string;
  name: string;
  description?: string;
  defaultValue?: string;
  required: boolean;
}

export interface CreateTemplateFromJourneyInput {
  journeyId: string;
  name: string;
  parameters: readonly CreateTemplateFromJourneyParameterInput[];
}

/**
 * Loads the source `Journey` via `JourneyRepository` (cross-feature port
 * reuse - same legitimate pattern as `profiles` depending on `journeys`'
 * application ports in Task 5), snapshots its `steps`/`startUrl`, resolves
 * each parameter's `targetStepIndex` to the matching step's real `id`, and
 * saves the result via `createTemplate` - which is the sole authority on
 * whether the resulting parameter set is actually valid (existing step,
 * parameterizable field, unique names).
 */
export class CreateTemplateFromJourneyUseCase {
  constructor(
    private readonly journeyRepository: JourneyRepository,
    private readonly templateRepository: TemplateRepository,
    private readonly idGenerator: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(input: CreateTemplateFromJourneyInput): Promise<Template> {
    const journey = await this.journeyRepository.findById(input.journeyId);
    if (journey == null) {
      throw new NotFoundError(`Journey with id "${input.journeyId}" was not found.`);
    }

    const stepsByOrder = new Map(journey.steps.map((step) => [step.order, step]));

    const parameters = input.parameters.map((parameterInput) => {
      const targetStep = stepsByOrder.get(parameterInput.targetStepIndex);
      if (targetStep === undefined) {
        throw new NotFoundError(
          `Journey "${input.journeyId}" has no step at index ${parameterInput.targetStepIndex}.`,
        );
      }

      return createTemplateParameter({
        id: this.idGenerator.generate(),
        name: parameterInput.name,
        ...(parameterInput.description !== undefined ? { description: parameterInput.description } : {}),
        targetStepId: targetStep.id,
        targetField: parameterInput.targetField,
        ...(parameterInput.defaultValue !== undefined ? { defaultValue: parameterInput.defaultValue } : {}),
        required: parameterInput.required,
      });
    });

    const template = createTemplate({
      id: this.idGenerator.generate(),
      name: input.name,
      startUrl: journey.startUrl,
      steps: journey.steps,
      parameters,
      createdAt: this.clock.now(),
    });

    await this.templateRepository.save(template);

    return template;
  }
}
