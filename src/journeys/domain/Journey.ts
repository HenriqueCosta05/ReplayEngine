import { DomainError } from './errors.js';
import type { Step } from './Step.js';

export interface CreateJourneyInput {
  id: string;
  name: string;
  startUrl: string;
  profileId?: string;
  createdAt: Date;
  steps: readonly Step[];
}

/**
 * An ordered, named sequence of steps starting from a URL. Immutable: there
 * are no mutation methods, so any "edit" is simply a fresh `createJourney`
 * call with the new step list.
 */
export interface Journey {
  readonly id: string;
  readonly name: string;
  readonly startUrl: string;
  readonly profileId?: string;
  readonly createdAt: Date;
  readonly steps: readonly Step[];
}

/**
 * Step ordering convention: `order` values must be a contiguous, unique
 * sequence starting at 0 (0..n-1), regardless of array position.
 */
function hasContiguousZeroBasedOrders(steps: readonly Step[]): boolean {
  const orders = steps.map((step) => step.order).sort((a, b) => a - b);
  return orders.every((order, index) => order === index);
}

export function createJourney(input: CreateJourneyInput): Journey {
  if (input == null || typeof input.id !== 'string' || input.id.length === 0) {
    throw new DomainError('Journey id must be a non-empty string.');
  }
  if (typeof input.name !== 'string' || input.name.trim().length === 0) {
    throw new DomainError('Journey name must not be empty.');
  }
  if (typeof input.startUrl !== 'string' || input.startUrl.length === 0) {
    throw new DomainError('Journey startUrl must not be empty.');
  }
  if (!(input.createdAt instanceof Date) || Number.isNaN(input.createdAt.getTime())) {
    throw new DomainError('Journey createdAt must be a valid Date.');
  }
  if (!Array.isArray(input.steps) || input.steps.length === 0) {
    throw new DomainError('Journey must have at least one step.');
  }
  if (!hasContiguousZeroBasedOrders(input.steps)) {
    throw new DomainError('Journey steps must have unique order values forming a contiguous 0..n-1 sequence.');
  }

  return {
    id: input.id,
    name: input.name,
    startUrl: input.startUrl,
    ...(input.profileId !== undefined ? { profileId: input.profileId } : {}),
    createdAt: input.createdAt,
    steps: input.steps,
  };
}
