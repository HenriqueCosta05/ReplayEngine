import type { TemplateRepository } from '../ports/TemplateRepository.js';
import { NotFoundError } from '../../../shared-kernel/application/errors.js';

/** Deletes a `Template` by id, throwing `NotFoundError` when it does not exist. */
export class DeleteTemplateUseCase {
  constructor(private readonly repository: TemplateRepository) {}

  async execute(id: string): Promise<void> {
    const template = await this.repository.findById(id);
    if (template == null) {
      throw new NotFoundError(`Template with id "${id}" was not found.`);
    }
    await this.repository.delete(id);
  }
}
