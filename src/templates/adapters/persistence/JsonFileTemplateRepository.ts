import { JsonFileStore } from '../../../infrastructure/JsonFileStore.js';
import { createTemplate, type Template } from '../../domain/Template.js';
import { createTemplateParameter, type TemplateParameter } from '../../domain/TemplateParameter.js';
import type { TemplateRepository } from '../../application/ports/TemplateRepository.js';
import type { TemplateParameterSnapshot, TemplateSnapshot, TemplateStepSnapshot } from './TemplateSnapshot.js';
import { createAction, type CreateActionInput } from '../../../journeys/domain/Action.js';
import { createStep, type Step } from '../../../journeys/domain/Step.js';

function toStepSnapshot(step: Step): TemplateStepSnapshot {
  return {
    id: step.id,
    order: step.order,
    action: step.action,
    ...(step.label !== undefined ? { label: step.label } : {}),
  };
}

function toStep(snapshot: TemplateStepSnapshot): Step {
  return createStep({
    id: snapshot.id,
    order: snapshot.order,
    // Re-run the domain factory rather than casting: a file that was
    // hand-edited into an unknown action kind or a locator with an empty
    // value must fail loudly here, not surface as a broken Template later.
    action: createAction(snapshot.action as unknown as CreateActionInput),
    ...(snapshot.label !== undefined ? { label: snapshot.label } : {}),
  });
}

function toParameterSnapshot(parameter: TemplateParameter): TemplateParameterSnapshot {
  return {
    id: parameter.id,
    name: parameter.name,
    ...(parameter.description !== undefined ? { description: parameter.description } : {}),
    targetStepId: parameter.targetStepId,
    targetField: parameter.targetField,
    ...(parameter.defaultValue !== undefined ? { defaultValue: parameter.defaultValue } : {}),
    required: parameter.required,
  };
}

function toParameter(snapshot: TemplateParameterSnapshot): TemplateParameter {
  return createTemplateParameter({
    id: snapshot.id,
    name: snapshot.name,
    ...(snapshot.description !== undefined ? { description: snapshot.description } : {}),
    targetStepId: snapshot.targetStepId,
    targetField: snapshot.targetField,
    ...(snapshot.defaultValue !== undefined ? { defaultValue: snapshot.defaultValue } : {}),
    required: snapshot.required,
  });
}

function toSnapshot(template: Template): TemplateSnapshot {
  return {
    id: template.id,
    name: template.name,
    startUrl: template.startUrl,
    createdAt: template.createdAt.toISOString(),
    steps: template.steps.map(toStepSnapshot),
    parameters: template.parameters.map(toParameterSnapshot),
  };
}

function toDomain(snapshot: TemplateSnapshot): Template {
  // `new Date('nonsense')` is an Invalid Date, which `createTemplate` rejects
  // - so a corrupt timestamp is caught by the domain rather than silently
  // becoming NaN.
  return createTemplate({
    id: snapshot.id,
    name: snapshot.name,
    startUrl: snapshot.startUrl,
    createdAt: new Date(snapshot.createdAt),
    steps: (snapshot.steps ?? []).map(toStep),
    parameters: (snapshot.parameters ?? []).map(toParameter),
  });
}

/**
 * File-backed `TemplateRepository`: one `<dataRoot>/templates/<id>.json`
 * per template, via the generic `JsonFileStore` - same pattern as
 * `JsonFileJourneyRepository`/`JsonFileProfileRepository`. Reconstructs
 * reads through `createTemplate`/`createTemplateParameter`/`createStep`/
 * `createAction` so a corrupted or hand-edited file raises a `DomainError`
 * instead of yielding an invalid aggregate.
 */
export class JsonFileTemplateRepository implements TemplateRepository {
  private readonly store: JsonFileStore<TemplateSnapshot>;

  constructor(templatesDirPath: string) {
    this.store = new JsonFileStore<TemplateSnapshot>(templatesDirPath);
  }

  async save(template: Template): Promise<void> {
    await this.store.save(template.id, toSnapshot(template));
  }

  async findById(id: string): Promise<Template | null> {
    const snapshot = await this.store.findById(id);
    return snapshot === null ? null : toDomain(snapshot);
  }

  async findAll(): Promise<Template[]> {
    const snapshots = await this.store.findAll();
    return snapshots.map(toDomain);
  }

  async delete(id: string): Promise<void> {
    await this.store.delete(id);
  }
}
