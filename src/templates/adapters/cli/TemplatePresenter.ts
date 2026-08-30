import pc from 'picocolors';

import type { Template } from '../../domain/Template.js';

const LIST_HEADERS = ['ID', 'NAME', 'STEPS', 'PARAMETERS', 'CREATED AT'] as const;

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

function orderedSteps(template: Template): Template['steps'] {
  return [...template.steps].sort((a, b) => a.order - b.order);
}

function parameterLine(parameter: Template['parameters'][number]): string {
  const requiredLabel = parameter.required ? 'required' : 'optional';
  const defaultLabel = parameter.defaultValue !== undefined ? `, default: ${parameter.defaultValue}` : '';
  return (
    `  ${parameter.name} -> step "${parameter.targetStepId}".${parameter.targetField} ` +
    `(${requiredLabel}${defaultLabel})`
  );
}

/**
 * Formats `Template` aggregates for the CLI: a padded plain-text table for
 * `template list`, a detail view for `template create`/`show`, and a
 * `toJson` path for `--json` mode. Mirrors `JourneyPresenter`/
 * `ProfilePresenter`'s shape.
 *
 * `template run`'s result is a plain `JourneyRunResult` (the same type
 * `journey run` produces), so it is presented via the existing
 * `JourneyRunPresenter` instead of duplicating that formatting here - see
 * `RunTemplateController`.
 */
export class TemplatePresenter {
  /** One row per template, for `template list`. */
  presentList(templates: readonly Template[]): string {
    if (templates.length === 0) {
      return 'No templates saved yet.';
    }

    const rows = templates.map((template) => [
      template.id,
      template.name,
      String(template.steps.length),
      String(template.parameters.length),
      template.createdAt.toISOString(),
    ]);

    return renderTable(LIST_HEADERS, rows);
  }

  /** Full detail view of one template, for `template create`/`show`. */
  present(template: Template): string {
    const stepLines = orderedSteps(template).map((step) => {
      const label = step.label !== undefined ? ` — ${step.label}` : '';
      return `  ${step.order}. ${step.action.kind}${label}`;
    });

    return [
      `${pc.bold('ID:')} ${template.id}`,
      `${pc.bold('Name:')} ${template.name}`,
      `${pc.bold('Start URL:')} ${template.startUrl}`,
      `${pc.bold('Created at:')} ${template.createdAt.toISOString()}`,
      `${pc.bold('Steps:')} (${template.steps.length})`,
      ...stepLines,
      `${pc.bold('Parameters:')} (${template.parameters.length})`,
      ...template.parameters.map(parameterLine),
    ].join('\n');
  }

  /** Machine-readable form for `--json`, accepting either a single template or a list. */
  toJson(value: Template | readonly Template[]): string {
    return JSON.stringify(value, null, 2);
  }
}
