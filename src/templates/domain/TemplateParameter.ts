import { DomainError } from './errors.js';

export interface CreateTemplateParameterInput {
  id: string;
  name: string;
  description?: string;
  targetStepId: string;
  targetField: string;
  defaultValue?: string;
  required: boolean;
}

/**
 * One named substitution point within a `Template`: `targetStepId` +
 * `targetField` say which step and which field of that step's action get
 * overridden at `Template.instantiate` time, `name` is what a caller (CLI
 * flag, playbook input, ...) supplies a value under, and `defaultValue` /
 * `required` say what happens when no value is supplied for `name`.
 *
 * This factory only validates this value object's own shape - it has no
 * `steps` to check `targetStepId`/`targetField` against. That cross-entity
 * validation (does `targetStepId` actually exist? does that step's action
 * actually support `targetField`? are parameter `name`s unique within the
 * template?) is `createTemplate`'s job, since only it has both the
 * parameters and the steps in hand.
 */
export interface TemplateParameter {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly targetStepId: string;
  readonly targetField: string;
  readonly defaultValue?: string;
  readonly required: boolean;
}

/**
 * A safe CLI-identifier: starts with a letter or underscore, followed by any
 * number of letters/digits/underscores. This is what a caller writes as
 * `--param <name>=<value>` at run time, so it must never contain characters
 * that would be awkward or ambiguous on a command line (spaces, `=`, `.`,
 * etc.).
 */
const PARAMETER_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export function createTemplateParameter(input: CreateTemplateParameterInput): TemplateParameter {
  if (input == null || typeof input.id !== 'string' || input.id.length === 0) {
    throw new DomainError('TemplateParameter id must be a non-empty string.');
  }
  if (typeof input.name !== 'string' || !PARAMETER_NAME_PATTERN.test(input.name)) {
    throw new DomainError(
      `TemplateParameter name must match ${PARAMETER_NAME_PATTERN.toString()}, got "${String(input.name)}".`,
    );
  }
  if (input.description !== undefined && (typeof input.description !== 'string' || input.description.length === 0)) {
    throw new DomainError('TemplateParameter description, when provided, must be a non-empty string.');
  }
  if (typeof input.targetStepId !== 'string' || input.targetStepId.length === 0) {
    throw new DomainError('TemplateParameter targetStepId must be a non-empty string.');
  }
  if (typeof input.targetField !== 'string' || input.targetField.length === 0) {
    throw new DomainError('TemplateParameter targetField must be a non-empty string.');
  }
  if (input.defaultValue !== undefined && typeof input.defaultValue !== 'string') {
    throw new DomainError('TemplateParameter defaultValue, when provided, must be a string.');
  }
  if (typeof input.required !== 'boolean') {
    throw new DomainError('TemplateParameter required must be a boolean.');
  }

  return {
    id: input.id,
    name: input.name,
    ...(input.description !== undefined ? { description: input.description } : {}),
    targetStepId: input.targetStepId,
    targetField: input.targetField,
    ...(input.defaultValue !== undefined ? { defaultValue: input.defaultValue } : {}),
    required: input.required,
  };
}
