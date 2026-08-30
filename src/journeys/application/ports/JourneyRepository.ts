import type { Journey } from '../../domain/Journey.js';

/** Persists and retrieves `Journey` aggregates (adapters/persistence implements this). */
export interface JourneyRepository {
  save(journey: Journey): Promise<void>;
  findById(id: string): Promise<Journey | null>;
  findAll(): Promise<Journey[]>;
  delete(id: string): Promise<void>;
}
