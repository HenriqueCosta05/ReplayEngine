import { NotFoundError } from '../../../shared-kernel/application/errors.js';
import type { JourneyRepository } from '../ports/JourneyRepository.js';

/** Deletes a `Journey` by id, throwing `NotFoundError` when it does not exist. */
export class DeleteJourneyUseCase {
  constructor(private readonly repository: JourneyRepository) {}

  async execute(id: string): Promise<void> {
    const journey = await this.repository.findById(id);
    if (journey == null) {
      throw new NotFoundError(`Journey with id "${id}" was not found.`);
    }
    await this.repository.delete(id);
  }
}
