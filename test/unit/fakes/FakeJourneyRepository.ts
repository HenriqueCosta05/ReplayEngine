import type { Journey } from '../../../src/journeys/domain/Journey.js';
import type { JourneyRepository } from '../../../src/journeys/application/ports/JourneyRepository.js';

/** In-memory `JourneyRepository` fake backed by a `Map`, keyed by `Journey.id`. */
export class FakeJourneyRepository implements JourneyRepository {
  private readonly journeys = new Map<string, Journey>();

  async save(journey: Journey): Promise<void> {
    this.journeys.set(journey.id, journey);
  }

  async findById(id: string): Promise<Journey | null> {
    return this.journeys.get(id) ?? null;
  }

  async findAll(): Promise<Journey[]> {
    return Array.from(this.journeys.values());
  }

  async delete(id: string): Promise<void> {
    this.journeys.delete(id);
  }

  /** Test helper: seed the repository directly, bypassing `save`. */
  seed(journey: Journey): void {
    this.journeys.set(journey.id, journey);
  }
}
