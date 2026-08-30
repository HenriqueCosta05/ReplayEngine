import { DomainError } from './errors.js';

/** The eight element-location strategies QAMachine can record and replay. */
export type LocatorStrategy =
  | 'role'
  | 'testId'
  | 'text'
  | 'label'
  | 'placeholder'
  | 'altText'
  | 'title'
  | 'css';

const LOCATOR_STRATEGIES: readonly LocatorStrategy[] = [
  'role',
  'testId',
  'text',
  'label',
  'placeholder',
  'altText',
  'title',
  'css',
];

export interface LocatorOptions {
  readonly name?: string;
  readonly exact?: boolean;
  readonly nth?: number;
}

/** Value object describing how to find a single element on a page. */
export interface Locator {
  readonly strategy: LocatorStrategy;
  readonly value: string;
  readonly options?: LocatorOptions;
}

export interface CreateLocatorInput {
  strategy: string;
  value: string;
  options?: LocatorOptions;
}

function isLocatorStrategy(value: string): value is LocatorStrategy {
  return (LOCATOR_STRATEGIES as readonly string[]).includes(value);
}

/**
 * Builds a `Locator`, throwing `DomainError` if `value` is empty or
 * `strategy` isn't one of the eight known strategies.
 */
export function createLocator(input: CreateLocatorInput): Locator {
  if (input == null || typeof input.value !== 'string' || input.value.length === 0) {
    throw new DomainError('Locator value must be a non-empty string.');
  }
  if (typeof input.strategy !== 'string' || !isLocatorStrategy(input.strategy)) {
    throw new DomainError(
      `Locator strategy must be one of ${LOCATOR_STRATEGIES.join(', ')}, got "${String(input.strategy)}".`,
    );
  }

  return {
    strategy: input.strategy,
    value: input.value,
    ...(input.options !== undefined ? { options: input.options } : {}),
  };
}
