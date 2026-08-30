import type { Action } from './Action.js';
import { PARAMETERIZABLE_FIELDS } from './Action.js';
import { DomainError } from './errors.js';

export interface CreateStepInput {
  id: string;
  order: number;
  action: Action;
  label?: string;
}

/**
 * A single ordered action within a `Journey`. The private constructor means
 * the only way to obtain a `Step` is through `createStep`, so an invalid
 * instance can never exist.
 */
export class Step {
  readonly id: string;
  readonly order: number;
  readonly action: Action;
  readonly label?: string;

  private constructor(id: string, order: number, action: Action, label: string | undefined) {
    this.id = id;
    this.order = order;
    this.action = action;
    this.label = label;
  }

  static create(input: CreateStepInput): Step {
    if (input == null || typeof input.id !== 'string' || input.id.length === 0) {
      throw new DomainError('Step id must be a non-empty string.');
    }
    if (typeof input.order !== 'number' || !Number.isInteger(input.order) || input.order < 0) {
      throw new DomainError('Step order must be a non-negative integer.');
    }
    if (input.action == null || typeof input.action.kind !== 'string') {
      throw new DomainError('Step requires a valid action.');
    }
    if (input.label !== undefined && (typeof input.label !== 'string' || input.label.length === 0)) {
      throw new DomainError('Step label, when provided, must be a non-empty string.');
    }

    return new Step(input.id, input.order, input.action, input.label);
  }

  /** Whether `field` on this step's action can be swapped for a template parameter. */
  supportsParameterField(field: string): boolean {
    return PARAMETERIZABLE_FIELDS[this.action.kind].includes(field);
  }
}

export function createStep(input: CreateStepInput): Step {
  return Step.create(input);
}
