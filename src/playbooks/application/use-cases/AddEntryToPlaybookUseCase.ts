import { createPlaybook, type Playbook } from '../../domain/Playbook.js';
import { createPlaybookEntry, type PlaybookEntrySource } from '../../domain/PlaybookEntry.js';
import { DomainError } from '../../domain/errors.js';
import type { PlaybookRepository } from '../ports/PlaybookRepository.js';
import { NotFoundError } from '../../../shared-kernel/application/errors.js';
import type { IdGeneratorPort } from '../../../shared-kernel/application/ports/IdGeneratorPort.js';
import type { JourneyRepository } from '../../../journeys/application/ports/JourneyRepository.js';
import type { TemplateRepository } from '../../../templates/application/ports/TemplateRepository.js';
import type { ProfileRepository } from '../../../profiles/application/ports/ProfileRepository.js';

export interface AddEntryToPlaybookInput {
  playbookId: string;
  source: PlaybookEntrySource;
  profileOverride?: string;
  continueOnFailure: boolean;
}

/**
 * Appends one `PlaybookEntry` to an existing `Playbook`, after validating
 * every reference the entry makes actually resolves:
 *
 * - the `Playbook` itself exists;
 * - the referenced `Journey` or `Template` exists (cross-feature port reuse
 *   - same legitimate pattern `CreateTemplateFromJourneyUseCase` and
 *   `RunTemplateUseCase` already use);
 * - for a template-sourced entry, every `required` `TemplateParameter` on
 *   that template has a binding in `parameterBindings`. This reuses
 *   `Template.parameters` (the template's own parameter list) to do the
 *   check rather than re-implementing the required-field rule that already
 *   lives in `Template`/`createTemplate` - `Template.instantiate` would
 *   enforce the same rule at run time, but failing fast here at add-entry
 *   time (before any browser work is ever attempted) gives a much clearer
 *   error;
 * - `profileOverride`, when given, resolves to an existing `UserProfile`.
 *
 * Only after all of that does it build the entry (`createPlaybookEntry`,
 * with a fresh id) and save the playbook with it appended.
 */
export class AddEntryToPlaybookUseCase {
  constructor(
    private readonly playbookRepository: PlaybookRepository,
    private readonly journeyRepository: JourneyRepository,
    private readonly templateRepository: TemplateRepository,
    private readonly profileRepository: ProfileRepository,
    private readonly idGenerator: IdGeneratorPort,
  ) {}

  async execute(input: AddEntryToPlaybookInput): Promise<Playbook> {
    const playbook = await this.playbookRepository.findById(input.playbookId);
    if (playbook == null) {
      throw new NotFoundError(`Playbook with id "${input.playbookId}" was not found.`);
    }

    if (input.source.type === 'journey') {
      const journey = await this.journeyRepository.findById(input.source.journeyId);
      if (journey == null) {
        throw new NotFoundError(`Journey with id "${input.source.journeyId}" was not found.`);
      }
    } else {
      const template = await this.templateRepository.findById(input.source.templateId);
      if (template == null) {
        throw new NotFoundError(`Template with id "${input.source.templateId}" was not found.`);
      }

      const parameterBindings = input.source.parameterBindings;
      const missingRequired = template.parameters.filter(
        (parameter) => parameter.required && parameterBindings[parameter.name] === undefined,
      );
      if (missingRequired.length > 0) {
        throw new DomainError(
          'Playbook entry is missing bindings for required template parameter(s): ' +
            `${missingRequired.map((parameter) => parameter.name).join(', ')}.`,
        );
      }
    }

    if (input.profileOverride !== undefined) {
      const profile = await this.profileRepository.findById(input.profileOverride);
      if (profile == null) {
        throw new NotFoundError(`Profile with id "${input.profileOverride}" was not found.`);
      }
    }

    const entry = createPlaybookEntry({
      id: this.idGenerator.generate(),
      source: input.source,
      ...(input.profileOverride !== undefined ? { profileOverride: input.profileOverride } : {}),
      continueOnFailure: input.continueOnFailure,
    });

    const updated = createPlaybook({
      id: playbook.id,
      name: playbook.name,
      entries: [...playbook.entries, entry],
      createdAt: playbook.createdAt,
    });

    await this.playbookRepository.save(updated);

    return updated;
  }
}
