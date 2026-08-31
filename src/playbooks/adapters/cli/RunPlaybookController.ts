import { randomUUID } from 'node:crypto';
import path from 'node:path';

import type { RunPlaybookInput } from '../../application/use-cases/RunPlaybookUseCase.js';
import type { PlaybookRunResult } from '../../domain/PlaybookRunResult.js';
import type { PlaybookRunPresenter } from './PlaybookRunPresenter.js';

/** Structural view of `RunPlaybookUseCase` - see `RecordJourneyUseCaseLike` for why. */
export interface RunPlaybookUseCaseLike {
  execute(input: RunPlaybookInput): Promise<PlaybookRunResult>;
}

export interface RunPlaybookCommandOptions {
  browser: RunPlaybookInput['browser'];
  keepTrace: boolean;
  stopOnFirstFailure?: boolean;
  json?: boolean;
  quiet?: boolean;
}

/**
 * Thin controller for `qamachine playbook run <id>`: maps parsed CLI
 * options into `RunPlaybookInput` and hands the result to
 * `PlaybookRunPresenter`. Mirrors `RunTemplateController`'s shape.
 *
 * Unlike `journey run`/`template run`, there is no `--profile` flag here:
 * per-entry profile resolution already happens inside `RunPlaybookUseCase`
 * via each entry's own stored `profileOverride` (set at `add-entry` time),
 * so a single top-level profile would not even make sense for a suite that
 * can legitimately mix entries against different profiles.
 */
export class RunPlaybookController {
  constructor(
    private readonly useCase: RunPlaybookUseCaseLike,
    private readonly presenter: PlaybookRunPresenter,
    private readonly tracesDirPath: string,
  ) {}

  async execute(playbookId: string, options: RunPlaybookCommandOptions): Promise<void> {
    const result = await this.useCase.execute({
      playbookId,
      browser: options.browser,
      keepTrace: options.keepTrace,
      tracePathFor: options.keepTrace
        ? (entryId: string) => path.join(this.tracesDirPath, `${playbookId}-${entryId}-${randomUUID()}.zip`)
        : undefined,
      stopOnFirstFailure: options.stopOnFirstFailure === true,
    });

    if (options.quiet !== true) {
      console.log(options.json === true ? this.presenter.toJson(result) : this.presenter.present(result));
    }

    if (result.overallStatus === 'failed') {
      process.exitCode = 1;
    }
  }
}
