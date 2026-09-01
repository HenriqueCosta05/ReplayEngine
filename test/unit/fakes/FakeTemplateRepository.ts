import type { Template } from '../../../src/templates/domain/Template.js';
import type { TemplateRepository } from '../../../src/templates/application/ports/TemplateRepository.js';

/** In-memory `TemplateRepository` fake backed by a `Map`, keyed by `Template.id`. */
export class FakeTemplateRepository implements TemplateRepository {
  private readonly templates = new Map<string, Template>();

  async save(template: Template): Promise<void> {
    this.templates.set(template.id, template);
  }

  async findById(id: string): Promise<Template | null> {
    return this.templates.get(id) ?? null;
  }

  async findAll(): Promise<Template[]> {
    return Array.from(this.templates.values());
  }

  async delete(id: string): Promise<void> {
    this.templates.delete(id);
  }

  /** Test helper: seed the repository directly, bypassing `save`. */
  seed(template: Template): void {
    this.templates.set(template.id, template);
  }
}
