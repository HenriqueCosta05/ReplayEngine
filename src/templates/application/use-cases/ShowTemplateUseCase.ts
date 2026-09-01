import type { Template } from '../../domain/Template.js';
import type { TemplateRepository } from '../ports/TemplateRepository.js';
import { NotFoundError } from '../../../shared-kernel/application/errors.js';

/** Loads a single `Template` by id, throwing `NotFoundError` when absent. */
export class ShowTemplateUseCase {
  constructor(private readonly repository: TemplateRepository) {}

  async execute(id: string): Promise<Template> {
    const template = await this.repository.findById(id);
    if (template == null) {
      throw new NotFoundError(`Template with id "${id}" was not found.`);
    }
    return template;
  }
}
