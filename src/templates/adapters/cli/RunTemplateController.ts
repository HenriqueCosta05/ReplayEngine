import { randomUUID } from 'node:crypto';
import path from 'node:path';

import type { RunTemplateInput } from '../../application/use-cases/RunTemplateUseCase.js';
import type { JourneyRunResult } from '../../../journeys/domain/JourneyRunResult.js';
import type { JourneyRunPresenter } from '../../../journeys/adapters/cli/JourneyRunPresenter.js';

/** Structural view of `RunTemplateUseCase` - see `RecordJourneyUseCaseLike` for why. */
export interface RunTemplateUseCaseLike {
  execute(input: RunTemplateInput): Promise<JourneyRunResult>;
}

export interface RunTemplateCommandOptions {
  browser: RunTemplateInput['browser'];
  keepTrace: boolean;
  /** Profile id, forwarded to the use case as `profileId` and resolved into a storage state there. */
  profile?: string;
  /** Raw `--param <name>=<value>` flag values, one per occurrence. */
  params?: readonly string[];
  json?: boolean;
  quiet?: boolean;
}

/**
 * Parses one `--param <name>=<value>` flag value for `template run`. Pure
 * string parsing - unlike `template create`'s `--param`, there is no
 * `[:required]`/`[:default=...]` suffix grammar here: required/default
 * handling is entirely `Template.instantiate`'s job, reached through
 * `RunTemplateUseCase`.
 */
export function parseTemplateRunParamFlag(raw: string): [name: string, value: string] {
  const equalsIndex = raw.indexOf('=');
  if (equalsIndex === -1) {
    throw new Error(`--param "${raw}" must look like <name>=<value>.`);
  }

  const name = raw.slice(0, equalsIndex);
  const value = raw.slice(equalsIndex + 1);
  if (name.length === 0) {
    throw new Error(`--param "${raw}" is missing a parameter name before "=".`);
  }

  return [name, value];
}

/**
 * Thin controller for `qamachine template run <id>`: maps parsed CLI
 * options (including repeatable `--param name=value` flags) into
 * `RunTemplateInput`, calls `RunTemplateUseCase`, and hands the result to
 * `JourneyRunPresenter` - reused as-is (not duplicated into a
 * templates-specific presenter) because `RunTemplateUseCase` returns a
 * plain `JourneyRunResult`, the exact same type `journey run` produces.
 *
 * Mirrors `RunJourneyController`'s per-invocation trace-path default; see
 * that controller's doc comment for why it lives here rather than in
 * `PlaywrightStepInterpreter`.
 */
export class RunTemplateController {
  constructor(
    private readonly useCase: RunTemplateUseCaseLike,
    private readonly presenter: JourneyRunPresenter,
    private readonly tracesDirPath: string,
  ) {}

  async execute(templateId: string, options: RunTemplateCommandOptions): Promise<void> {
    const values = Object.fromEntries((options.params ?? []).map(parseTemplateRunParamFlag));

    const result = await this.useCase.execute({
      templateId,
      values,
      browser: options.browser,
      profileId: options.profile,
      keepTrace: options.keepTrace,
      tracePath:
        options.keepTrace ? path.join(this.tracesDirPath, `${templateId}-${randomUUID()}.zip`) : undefined,
    });

    if (options.quiet !== true) {
      console.log(options.json === true ? this.presenter.toJson(result) : this.presenter.present(result));
    }

    if (result.status === 'failed') {
      process.exitCode = 1;
    }
  }
}
