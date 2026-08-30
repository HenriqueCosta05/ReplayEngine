import type { Journey } from '../../domain/Journey.js';
import type { JourneyRepository } from '../ports/JourneyRepository.js';

/** Thin pass-through to `JourneyRepository.findAll`. */
export class ListJourneysUseCase {
  constructor(private readonly repository: JourneyRepository) {}

  async execute(): Promise<Journey[]> {
    return this.repository.findAll();
  }
}
