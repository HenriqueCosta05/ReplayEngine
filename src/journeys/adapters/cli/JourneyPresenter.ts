import pc from 'picocolors';

import { renderTable } from '../../../shared-kernel/adapters/renderTable.js';
import type { Journey } from '../../domain/Journey.js';

const LIST_HEADERS = ['ID', 'NAME', 'START URL', 'STEPS', 'CREATED AT'] as const;

function orderedSteps(journey: Journey): Journey['steps'] {
  return [...journey.steps].sort((a, b) => a.order - b.order);
}

/**
 * Formats `Journey` aggregates for the CLI: a padded plain-text table for
 * `journey list`, a detail view for `journey show`/`record`, and a `toJson`
 * path for `--json` mode. No table-library dependency - simple string
 * padding is all a fixed, small column set needs.
 */
export class JourneyPresenter {
  /** One row per journey, for `journey list`. */
  presentList(journeys: readonly Journey[]): string {
    if (journeys.length === 0) {
      return 'No journeys recorded yet.';
    }

    const rows = journeys.map((journey) => [
      journey.id,
      journey.name,
      journey.startUrl,
      String(journey.steps.length),
      journey.createdAt.toISOString(),
    ]);

    return renderTable(LIST_HEADERS, rows);
  }

  /** Full detail view of one journey, for `journey show` and `record`. */
  present(journey: Journey): string {
    const stepLines = orderedSteps(journey).map((step) => {
      const label = step.label !== undefined ? ` — ${step.label}` : '';
      return `  ${step.order + 1}. ${step.action.kind}${label}`;
    });

    return [
      `${pc.bold('ID:')} ${journey.id}`,
      `${pc.bold('Name:')} ${journey.name}`,
      `${pc.bold('Start URL:')} ${journey.startUrl}`,
      `${pc.bold('Created at:')} ${journey.createdAt.toISOString()}`,
      `${pc.bold('Steps:')} (${journey.steps.length})`,
      ...stepLines,
    ].join('\n');
  }

  /** Machine-readable form for `--json`, accepting either a single journey or a list. */
  toJson(value: Journey | readonly Journey[]): string {
    return JSON.stringify(value, null, 2);
  }
}
