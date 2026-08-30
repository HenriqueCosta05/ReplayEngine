import type { Template } from '../../domain/Template.js';

/** Persists and retrieves `Template` aggregates (adapters/persistence implements this). */
export interface TemplateRepository {
  save(template: Template): Promise<void>;
  findById(id: string): Promise<Template | null>;
  findAll(): Promise<Template[]>;
  delete(id: string): Promise<void>;
}
