import type { Action } from '../../../journeys/domain/Action.js';

/**
 * The on-disk shape of a `Template`'s snapshotted steps. Structurally the
 * same as journeys' own `StepSnapshot` (`journeys/adapters/persistence/
 * JourneySnapshot.ts`), but declared separately rather than imported from
 * there: this repository's only legitimate cross-feature dependency is on
 * `journeys/domain` (`Step`/`Action`, per `Template`'s own shape - see
 * `Template.ts`), not on another feature's adapters layer.
 */
export interface TemplateStepSnapshot {
  id: string;
  order: number;
  action: Action;
  label?: string;
}

export interface TemplateParameterSnapshot {
  id: string;
  name: string;
  description?: string;
  targetStepId: string;
  targetField: string;
  defaultValue?: string;
  required: boolean;
}

/**
 * The on-disk shape of a `Template`: structurally identical to the domain
 * entity except that `createdAt` is an ISO-8601 string rather than a `Date`,
 * because JSON has no date type.
 */
export interface TemplateSnapshot {
  id: string;
  name: string;
  startUrl: string;
  createdAt: string;
  steps: TemplateStepSnapshot[];
  parameters: TemplateParameterSnapshot[];
}
