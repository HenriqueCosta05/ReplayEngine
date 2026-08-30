import type { Template } from '../../domain/Template.js';
import type { TemplateRepository } from '../ports/TemplateRepository.js';

/** Thin pass-through to `TemplateRepository.findAll`. */
export class ListTemplatesUseCase {
  constructor(private readonly repository: TemplateRepository) {}

  async execute(): Promise<Template[]> {
    return this.repository.findAll();
  }
}
