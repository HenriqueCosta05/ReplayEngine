import pc from 'picocolors';

import type { Playbook } from '../../domain/Playbook.js';
import type { PlaybookEntry } from '../../domain/PlaybookEntry.js';

const LIST_HEADERS = ['ID', 'NAME', 'ENTRIES', 'CREATED AT'] as const;

function padEnd(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length);
}

function renderTable(header: readonly string[], rows: readonly string[][]): string {
  const widths = header.map((cell, index) =>
    Math.max(cell.length, ...rows.map((row) => row[index]?.length ?? 0)),
  );
  const renderRow = (cells: readonly string[]): string =>
    cells.map((cell, index) => padEnd(cell, widths[index] ?? cell.length)).join('  ');

  return [renderRow(header), ...rows.map(renderRow)].join('\n');
}

function sourceLabel(source: PlaybookEntry['source']): string {
  return source.type === 'journey' ? `journey:${source.journeyId}` : `template:${source.templateId}`;
}

function entryLine(entry: PlaybookEntry): string {
  const profileLabel = entry.profileOverride !== undefined ? `, profile: ${entry.profileOverride}` : '';
  const continueLabel = entry.continueOnFailure ? 'continue-on-failure' : 'stop-on-failure';
  return `  ${entry.id} — ${sourceLabel(entry.source)} (${continueLabel}${profileLabel})`;
}

/**
 * Formats `Playbook` aggregates for the CLI: a padded plain-text table for
 * `playbook list`, a detail view for `playbook create`/`add-entry`/`show`,
 * and a `toJson` path for `--json` mode. Mirrors `TemplatePresenter`'s
 * shape.
 */
export class PlaybookPresenter {
  /** One row per playbook, for `playbook list`. */
  presentList(playbooks: readonly Playbook[]): string {
    if (playbooks.length === 0) {
      return 'No playbooks saved yet.';
    }

    const rows = playbooks.map((playbook) => [
      playbook.id,
      playbook.name,
      String(playbook.entries.length),
      playbook.createdAt.toISOString(),
    ]);

    return renderTable(LIST_HEADERS, rows);
  }

  /** Full detail view of one playbook, for `playbook create`/`add-entry`/`show`. */
  present(playbook: Playbook): string {
    return [
      `${pc.bold('ID:')} ${playbook.id}`,
      `${pc.bold('Name:')} ${playbook.name}`,
      `${pc.bold('Created at:')} ${playbook.createdAt.toISOString()}`,
      `${pc.bold('Entries:')} (${playbook.entries.length})`,
      ...playbook.entries.map(entryLine),
    ].join('\n');
  }

  /** Machine-readable form for `--json`, accepting either a single playbook or a list. */
  toJson(value: Playbook | readonly Playbook[]): string {
    return JSON.stringify(value, null, 2);
  }
}
