import type { Journey } from '../../domain/Journey.js';
import { NotFoundError } from '../../../shared-kernel/application/errors.js';
import type { JourneyRepository } from '../ports/JourneyRepository.js';

/** Loads a single `Journey` by id, throwing `NotFoundError` when absent. */
export class ShowJourneyUseCase {
  constructor(private readonly repository: JourneyRepository) {}

  async execute(id: string): Promise<Journey> {
    const journey = await this.repository.findById(id);
    if (journey == null) {
      throw new NotFoundError(`Journey with id "${id}" was not found.`);
    }
    return journey;
  }
}
