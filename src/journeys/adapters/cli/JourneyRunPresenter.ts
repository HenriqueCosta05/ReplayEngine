import pc from 'picocolors';

import type { JourneyRunResult } from '../../domain/JourneyRunResult.js';
import type { StepResult } from '../../domain/StepResult.js';

function stepMarker(status: StepResult['status']): string {
  switch (status) {
    case 'passed':
      return pc.green('PASS');
    case 'failed':
      return pc.red('FAIL');
    case 'skipped':
      return pc.yellow('SKIP');
    default: {
      const exhaustive: never = status;
      return String(exhaustive);
    }
  }
}

function stepLine(step: StepResult, index: number): string {
  const suffix = step.errorMessage !== undefined ? ` — ${step.errorMessage}` : '';
  return `  ${stepMarker(step.status)}  step ${index + 1} (${step.stepId}) ${step.durationMs}ms${suffix}`;
}

/**
 * Formats a `JourneyRunResult` for the CLI: a colored pass/fail line per
 * step, a summary line, and a `toJson` path for `--json` mode. `status` is a
 * derived getter on the domain object (not an own enumerable property), so
 * `toJson` builds the payload explicitly rather than `JSON.stringify`-ing
 * the instance directly - a plain stringify would silently drop it.
 */
export class JourneyRunPresenter {
  present(result: JourneyRunResult): string {
    const lines = result.stepResults.map(stepLine);

    const passed = result.stepResults.filter((step) => step.status === 'passed').length;
    const failed = result.stepResults.filter((step) => step.status === 'failed').length;
    const skipped = result.stepResults.filter((step) => step.status === 'skipped').length;
    const durationMs = result.finishedAt.getTime() - result.startedAt.getTime();

    const summaryColor = result.status === 'passed' ? pc.green : pc.red;
    const summary = summaryColor(
      `${result.status.toUpperCase()} — ${passed} passed, ${failed} failed, ${skipped} skipped ` +
        `(${result.stepResults.length} steps, ${durationMs}ms)`,
    );

    const errorLine = result.error !== undefined ? pc.red(`Run error: ${result.error}`) : undefined;

    return [...lines, ...(errorLine !== undefined ? [errorLine] : []), summary].join('\n');
  }

  toJson(result: JourneyRunResult): string {
    return JSON.stringify(
      {
        id: result.id,
        journeyId: result.journeyId,
        profileId: result.profileId,
        status: result.status,
        startedAt: result.startedAt.toISOString(),
        finishedAt: result.finishedAt.toISOString(),
        stepResults: result.stepResults,
        tracePath: result.tracePath,
        error: result.error,
      },
      null,
      2,
    );
  }
}
