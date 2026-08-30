import { randomUUID } from 'node:crypto';
import path from 'node:path';

import type { JourneyRunResult } from '../../domain/JourneyRunResult.js';
import type { RunJourneyInput } from '../../application/use-cases/RunJourneyUseCase.js';
import type { JourneyRunPresenter } from './JourneyRunPresenter.js';

/** Structural view of `RunJourneyUseCase` - see `RecordJourneyUseCaseLike` for why. */
export interface RunJourneyUseCaseLike {
  execute(input: RunJourneyInput): Promise<JourneyRunResult>;
}

export interface RunCommandOptions {
  browser: RunJourneyInput['browser'];
  keepTrace: boolean;
  /** Accepted but not yet wired to storage-state resolution - profiles land in Task 5. */
  profile?: string;
  json?: boolean;
  quiet?: boolean;
}

/**
 * Thin controller for `qamachine journey run <id>`: maps parsed CLI options
 * into `RunJourneyInput`, calls `RunJourneyUseCase`, and hands the result to
 * `JourneyRunPresenter`.
 *
 * One piece of non-trivial plumbing lives here rather than in `cli.ts`:
 * `PlaywrightStepInterpreter` (Task 3) passes `RunOptions.tracePath` through
 * to Playwright's `tracing.stop()` verbatim, and Playwright discards the
 * trace when no path is given - so `--keep-trace` would silently keep
 * nothing without a default path. There is no `--trace-path` flag in this
 * task's brief, and the run's own id (which the naming convention in
 * `docs/ARCHITECTURE.md` is built around) isn't known until *after* the use
 * case returns, so a per-journey, per-invocation file name is the best this
 * layer can do without changing the interpreter's contract.
 */
export class RunJourneyController {
  constructor(
    private readonly useCase: RunJourneyUseCaseLike,
    private readonly presenter: JourneyRunPresenter,
    private readonly tracesDirPath: string,
  ) {}

  async execute(journeyId: string, options: RunCommandOptions): Promise<void> {
    const result = await this.useCase.execute({
      journeyId,
      browser: options.browser,
      keepTrace: options.keepTrace,
      tracePath:
        options.keepTrace ? path.join(this.tracesDirPath, `${journeyId}-${randomUUID()}.zip`) : undefined,
    });

    if (options.quiet !== true) {
      console.log(options.json === true ? this.presenter.toJson(result) : this.presenter.present(result));
    }

    if (result.status === 'failed') {
      process.exitCode = 1;
    }
  }
}
