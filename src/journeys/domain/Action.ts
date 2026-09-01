import { DomainError } from './errors.js';
import { createLocator, type CreateLocatorInput, type Locator } from './Locator.js';

export interface GotoAction {
  readonly kind: 'goto';
  readonly url: string;
}

export interface ClickAction {
  readonly kind: 'click';
  readonly locator: Locator;
}

export interface FillAction {
  readonly kind: 'fill';
  readonly locator: Locator;
  readonly value: string;
}

export interface CheckAction {
  readonly kind: 'check';
  readonly locator: Locator;
}

export interface UncheckAction {
  readonly kind: 'uncheck';
  readonly locator: Locator;
}

export interface PressAction {
  readonly kind: 'press';
  readonly locator: Locator;
  readonly key: string;
}

export interface SelectOptionAction {
  readonly kind: 'selectOption';
  readonly locator: Locator;
  readonly value: string;
}

export interface HoverAction {
  readonly kind: 'hover';
  readonly locator: Locator;
}

export interface AssertVisibleAction {
  readonly kind: 'assertVisible';
  readonly locator: Locator;
}

export interface AssertTextAction {
  readonly kind: 'assertText';
  readonly locator: Locator;
  readonly expected: string;
}

export interface AssertValueAction {
  readonly kind: 'assertValue';
  readonly locator: Locator;
  readonly expected: string;
}

/** Every recordable/replayable browser interaction, discriminated on `kind`. */
export type Action =
  | GotoAction
  | ClickAction
  | FillAction
  | CheckAction
  | UncheckAction
  | PressAction
  | SelectOptionAction
  | HoverAction
  | AssertVisibleAction
  | AssertTextAction
  | AssertValueAction;

/**
 * Which fields of a given action kind are eligible to be swapped for a
 * template parameter at run time. Consulted by `Step.supportsParameterField`
 * and, later, by the templates domain.
 */
export const PARAMETERIZABLE_FIELDS: Record<Action['kind'], readonly string[]> = {
  goto: ['url'],
  click: [],
  fill: ['value'],
  check: [],
  uncheck: [],
  press: ['key'],
  selectOption: ['value'],
  hover: [],
  assertVisible: [],
  assertText: [],
  assertValue: [],
};

const ACTION_KINDS: readonly Action['kind'][] = [
  'goto',
  'click',
  'fill',
  'check',
  'uncheck',
  'press',
  'selectOption',
  'hover',
  'assertVisible',
  'assertText',
  'assertValue',
];

/** Raw input for `createAction`: same shape as `Action`, but `locator` is unvalidated. */
export type CreateActionInput =
  | { kind: 'goto'; url: string }
  | { kind: 'click'; locator: CreateLocatorInput }
  | { kind: 'fill'; locator: CreateLocatorInput; value: string }
  | { kind: 'check'; locator: CreateLocatorInput }
  | { kind: 'uncheck'; locator: CreateLocatorInput }
  | { kind: 'press'; locator: CreateLocatorInput; key: string }
  | { kind: 'selectOption'; locator: CreateLocatorInput; value: string }
  | { kind: 'hover'; locator: CreateLocatorInput }
  | { kind: 'assertVisible'; locator: CreateLocatorInput }
  | { kind: 'assertText'; locator: CreateLocatorInput; expected: string }
  | { kind: 'assertValue'; locator: CreateLocatorInput; expected: string };

function requireNonEmptyString(value: unknown, fieldName: string, kind: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new DomainError(`Action of kind "${kind}" requires a non-empty "${fieldName}" field.`);
  }
  return value;
}

/**
 * Builds a typed `Action` union member from raw input, validating that
 * every required field for the given `kind` is present and non-empty
 * (delegating locator validation to `createLocator`). Throws `DomainError`
 * on any unknown `kind` or missing/empty field.
 */
export function createAction(input: CreateActionInput): Action {
  if (input == null || typeof input.kind !== 'string' || !(ACTION_KINDS as readonly string[]).includes(input.kind)) {
    throw new DomainError(`Unknown action kind "${String((input as { kind?: unknown } | null)?.kind)}".`);
  }

  switch (input.kind) {
    case 'goto':
      return { kind: 'goto', url: requireNonEmptyString(input.url, 'url', input.kind) };
    case 'click':
      return { kind: 'click', locator: createLocator(input.locator) };
    case 'fill':
      return {
        kind: 'fill',
        locator: createLocator(input.locator),
        value: requireNonEmptyString(input.value, 'value', input.kind),
      };
    case 'check':
      return { kind: 'check', locator: createLocator(input.locator) };
    case 'uncheck':
      return { kind: 'uncheck', locator: createLocator(input.locator) };
    case 'press':
      return {
        kind: 'press',
        locator: createLocator(input.locator),
        key: requireNonEmptyString(input.key, 'key', input.kind),
      };
    case 'selectOption':
      return {
        kind: 'selectOption',
        locator: createLocator(input.locator),
        value: requireNonEmptyString(input.value, 'value', input.kind),
      };
    case 'hover':
      return { kind: 'hover', locator: createLocator(input.locator) };
    case 'assertVisible':
      return { kind: 'assertVisible', locator: createLocator(input.locator) };
    case 'assertText':
      return {
        kind: 'assertText',
        locator: createLocator(input.locator),
        expected: requireNonEmptyString(input.expected, 'expected', input.kind),
      };
    case 'assertValue':
      return {
        kind: 'assertValue',
        locator: createLocator(input.locator),
        expected: requireNonEmptyString(input.expected, 'expected', input.kind),
      };
    /* istanbul ignore next -- unreachable: input.kind was validated against ACTION_KINDS above */
    default: {
      const exhaustive: never = input;
      throw new DomainError(`Unknown action kind "${String((exhaustive as { kind: string }).kind)}".`);
    }
  }
}
