import type { JourneyRunResult } from '../../domain/JourneyRunResult.js';
import { NotFoundError } from '../../../shared-kernel/application/errors.js';
import type { JourneyRepository } from '../ports/JourneyRepository.js';
import type { JourneyRunnerPort, SupportedBrowser } from '../ports/JourneyRunnerPort.js';

export interface RunJourneyInput {
  journeyId: string;
  browser: SupportedBrowser;
  storageStatePath?: string;
  keepTrace: boolean;
  tracePath?: string;
}

/**
 * Loads a `Journey` by id and replays it via `JourneyRunnerPort`. The result
 * is returned to the caller but not persisted here: a plain `journey run` is
 * stdout-only (per the plan); playbook runs persist their own aggregate
 * (Task 7).
 */
export class RunJourneyUseCase {
  constructor(
    private readonly repository: JourneyRepository,
    private readonly runner: JourneyRunnerPort,
  ) {}

  async execute(input: RunJourneyInput): Promise<JourneyRunResult> {
    const journey = await this.repository.findById(input.journeyId);
    if (journey == null) {
      throw new NotFoundError(`Journey with id "${input.journeyId}" was not found.`);
    }

    return this.runner.run(journey, {
      browser: input.browser,
      storageStatePath: input.storageStatePath,
      keepTrace: input.keepTrace,
      tracePath: input.tracePath,
    });
  }
}
