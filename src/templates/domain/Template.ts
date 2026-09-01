import { DomainError } from './errors.js';
import type { TemplateParameter } from './TemplateParameter.js';
import { createStep, type Step } from '../../journeys/domain/Step.js';

export interface CreateTemplateInput {
  id: string;
  name: string;
  /**
   * Not listed in this feature's brief-level shape summary, but required in
   * practice: `Journey.startUrl` is a field distinct from `steps` (see
   * `journeys/domain/Journey.ts`), and `instantiate` must be able to hand
   * back a complete `TransientJourneyDraft` (steps + startUrl + name) without
   * consulting the source `Journey` again - which may since have been
   * mutated or deleted, per this feature's snapshot invariant. So `Template`
   * snapshots `startUrl` alongside `steps`.
   */
  startUrl: string;
  steps: readonly Step[];
  parameters: readonly TemplateParameter[];
  createdAt: Date;
}

/**
 * The shape `Template.instantiate` hands back: everything needed to build a
 * real `Journey` except `id`/`createdAt`. Those two are Task 1's `Journey`
 * invariants (assigned at construction, never optional) and stay that way -
 * `instantiate` does not try to construct a `Journey` itself. Instead the
 * calling use case (`InstantiateTemplateUseCase`, `RunTemplateUseCase`) mints
 * a fresh `id` via `IdGeneratorPort` and `createdAt` via `ClockPort` - the
 * same ports `RecordJourneyUseCase` already uses - and calls `createJourney`
 * with this draft's fields plus those two. This is "option (b)" from the
 * brief's pre-flight ruling: it keeps `Journey`'s Task-1 factory completely
 * unchanged.
 */
export interface TransientJourneyDraft {
  readonly name: string;
  readonly startUrl: string;
  readonly steps: readonly Step[];
}

/**
 * A reusable, parameterizable snapshot of a `Journey`'s steps, taken at
 * creation time. "Snapshot" is load-bearing: a `Template` holds its own copy
 * of `steps` (and `startUrl`/`name`), not a live reference to the source
 * `Journey` - so deleting or re-recording that `Journey` after the fact
 * cannot change or invalidate an already-created `Template`. `Step` is
 * itself an immutable value object (no mutation methods, private
 * constructor), so copying the array is enough; no deep-cloning of the
 * `Step` instances themselves is needed.
 *
 * Implemented as a class (like `Step`, unlike the plain-interface `Journey`)
 * because it carries real behaviour: `instantiate`.
 */
export class Template {
  readonly id: string;
  readonly name: string;
  readonly startUrl: string;
  readonly steps: readonly Step[];
  readonly parameters: readonly TemplateParameter[];
  readonly createdAt: Date;

  private constructor(
    id: string,
    name: string,
    startUrl: string,
    steps: readonly Step[],
    parameters: readonly TemplateParameter[],
    createdAt: Date,
  ) {
    this.id = id;
    this.name = name;
    this.startUrl = startUrl;
    this.steps = steps;
    this.parameters = parameters;
    this.createdAt = createdAt;
  }

  static create(input: CreateTemplateInput): Template {
    if (input == null || typeof input.id !== 'string' || input.id.length === 0) {
      throw new DomainError('Template id must be a non-empty string.');
    }
    if (typeof input.name !== 'string' || input.name.trim().length === 0) {
      throw new DomainError('Template name must not be empty.');
    }
    if (typeof input.startUrl !== 'string' || input.startUrl.length === 0) {
      throw new DomainError('Template startUrl must not be empty.');
    }
    if (!(input.createdAt instanceof Date) || Number.isNaN(input.createdAt.getTime())) {
      throw new DomainError('Template createdAt must be a valid Date.');
    }
    if (!Array.isArray(input.steps) || input.steps.length === 0) {
      throw new DomainError('Template must snapshot at least one step.');
    }
    if (!Array.isArray(input.parameters)) {
      throw new DomainError('Template parameters must be an array.');
    }

    const stepsById = new Map(input.steps.map((step) => [step.id, step]));
    const seenNames = new Set<string>();

    for (const parameter of input.parameters) {
      const targetStep = stepsById.get(parameter.targetStepId);
      if (targetStep === undefined) {
        throw new DomainError(
          `Template parameter "${parameter.name}" targets step id "${parameter.targetStepId}", ` +
            'which does not exist in this template\'s steps.',
        );
      }
      if (!targetStep.supportsParameterField(parameter.targetField)) {
        throw new DomainError(
          `Template parameter "${parameter.name}" targets field "${parameter.targetField}", which is not ` +
            `parameterizable on a "${targetStep.action.kind}" step.`,
        );
      }
      if (seenNames.has(parameter.name)) {
        throw new DomainError(
          `Template parameter name "${parameter.name}" is used more than once; parameter names must be unique.`,
        );
      }
      seenNames.add(parameter.name);
    }

    return new Template(
      input.id,
      input.name,
      input.startUrl,
      // Copy the arrays so a caller mutating the array reference they passed
      // in (e.g. an alias of `journey.steps`) after construction cannot
      // reach into this Template - the snapshot invariant.
      [...input.steps],
      [...input.parameters],
      input.createdAt,
    );
  }

  /**
   * Resolves every parameter against `values` (falling back to
   * `defaultValue`, then throwing `DomainError` for a still-unresolved
   * `required` parameter), substitutes each resolved value into its
   * targeted step's targeted action field, and returns the result as a
   * `TransientJourneyDraft` - never a `Journey` (see that type's doc
   * comment for why).
   */
  instantiate(values: Record<string, string>): TransientJourneyDraft {
    const overridesByStepId = new Map<string, Record<string, string>>();

    for (const parameter of this.parameters) {
      const resolved = values[parameter.name] ?? parameter.defaultValue;
      if (resolved === undefined) {
        if (parameter.required) {
          throw new DomainError(`Missing value for required template parameter "${parameter.name}".`);
        }
        continue;
      }

      const overridesForStep = overridesByStepId.get(parameter.targetStepId) ?? {};
      overridesForStep[parameter.targetField] = resolved;
      overridesByStepId.set(parameter.targetStepId, overridesForStep);
    }

    const steps = this.steps.map((step) => {
      const overrides = overridesByStepId.get(step.id);
      if (overrides === undefined) {
        return step;
      }

      return createStep({
        id: step.id,
        order: step.order,
        action: { ...step.action, ...overrides } as Step['action'],
        ...(step.label !== undefined ? { label: step.label } : {}),
      });
    });

    return { name: this.name, startUrl: this.startUrl, steps };
  }
}

export function createTemplate(input: CreateTemplateInput): Template {
  return Template.create(input);
}
