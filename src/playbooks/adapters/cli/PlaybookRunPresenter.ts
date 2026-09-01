import pc from 'picocolors';

import { renderTable } from '../../../shared-kernel/adapters/renderTable.js';
import type { PlaybookEntryResult, PlaybookEntryStatus, PlaybookRunResult } from '../../domain/PlaybookRunResult.js';

const LIST_HEADERS = ['ID', 'PLAYBOOK ID', 'STATUS', 'STARTED AT', 'FINISHED AT'] as const;

function entryMarker(status: PlaybookEntryStatus): string {
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

function entryLine(entryResult: PlaybookEntryResult): string {
  const suffix = entryResult.error !== undefined ? ` — ${entryResult.error}` : '';
  return `  ${entryMarker(entryResult.status)}  ${entryResult.entryId}${suffix}`;
}

/**
 * Formats a `PlaybookRunResult` for the CLI: a colored pass/fail/skip line
 * per entry, an overall summary line, a padded table for `playbook runs`
 * (a list of past runs), and a `toJson` path for `--json` mode. Mirrors
 * `JourneyRunPresenter`'s per-step formatting style, but for a whole suite
 * of entries rather than a single journey's steps - see this feature's
 * continuation brief for why a `PlaybookRunResult` cannot just be presented
 * as `JourneyRunResult[]`. `overallStatus` is a derived getter (not an own
 * enumerable property), so `toJson` builds the payload explicitly rather
 * than `JSON.stringify`-ing the instance directly, same reasoning as
 * `JourneyRunPresenter.toJson`.
 */
export class PlaybookRunPresenter {
  /** Full detail view of one run, for `playbook run`/`show-run`. */
  present(result: PlaybookRunResult): string {
    const lines = result.entryResults.map(entryLine);

    const passed = result.entryResults.filter((entry) => entry.status === 'passed').length;
    const failed = result.entryResults.filter((entry) => entry.status === 'failed').length;
    const skipped = result.entryResults.filter((entry) => entry.status === 'skipped').length;
    const durationMs = result.finishedAt.getTime() - result.startedAt.getTime();

    const summaryColor = result.overallStatus === 'passed' ? pc.green : pc.red;
    const summary = summaryColor(
      `${result.overallStatus.toUpperCase()} — ${passed} passed, ${failed} failed, ${skipped} skipped ` +
        `(${result.entryResults.length} entries, ${durationMs}ms)`,
    );

    return [...lines, summary].join('\n');
  }

  /** One row per run, for `playbook runs <id>`. */
  presentList(results: readonly PlaybookRunResult[]): string {
    if (results.length === 0) {
      return 'No runs recorded for this playbook yet.';
    }

    const rows = results.map((result) => [
      result.id,
      result.playbookId,
      result.overallStatus,
      result.startedAt.toISOString(),
      result.finishedAt.toISOString(),
    ]);

    return renderTable(LIST_HEADERS, rows);
  }

  /** Machine-readable form for `--json`, accepting either a single run or a list. */
  toJson(value: PlaybookRunResult | readonly PlaybookRunResult[]): string {
    const toPayload = (result: PlaybookRunResult) => ({
      id: result.id,
      playbookId: result.playbookId,
      overallStatus: result.overallStatus,
      startedAt: result.startedAt.toISOString(),
      finishedAt: result.finishedAt.toISOString(),
      entryResults: result.entryResults.map((entryResult) => ({
        entryId: entryResult.entryId,
        status: entryResult.status,
        runId: entryResult.runId,
        journeyId: entryResult.journeyId,
        profileId: entryResult.profileId,
        startedAt: entryResult.startedAt?.toISOString(),
        finishedAt: entryResult.finishedAt?.toISOString(),
        stepResults: entryResult.stepResults,
        tracePath: entryResult.tracePath,
        error: entryResult.error,
      })),
    });

    return JSON.stringify(Array.isArray(value) ? value.map(toPayload) : toPayload(value as PlaybookRunResult), null, 2);
  }
}
