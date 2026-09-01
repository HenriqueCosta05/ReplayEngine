function padEnd(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length);
}

/**
 * Renders a fixed, small column set as a padded plain-text table: one header
 * row, columns sized to the widest cell in each column, two spaces between
 * columns. No table-library dependency - shared by every list-style CLI
 * presenter (`journey list`, `template list`, `playbook list`, `profile
 * list`, `playbook runs`, etc.) so column padding stays byte-for-byte
 * consistent across commands.
 */
export function renderTable(header: readonly string[], rows: readonly string[][]): string {
  const widths = header.map((cell, index) =>
    Math.max(cell.length, ...rows.map((row) => row[index]?.length ?? 0)),
  );
  const renderRow = (cells: readonly string[]): string =>
    cells.map((cell, index) => padEnd(cell, widths[index] ?? cell.length)).join('  ');

  return [renderRow(header), ...rows.map(renderRow)].join('\n');
}
