import { describe, expect, it } from 'vitest';

import { renderTable } from './renderTable.js';

describe('renderTable', () => {
  it('pads each column to the widest cell (header or row) plus a two-space gutter', () => {
    const result = renderTable(
      ['ID', 'NAME'],
      [
        ['a', 'short'],
        ['bbbbb', 'x'],
      ],
    );

    expect(result).toBe(['ID     NAME ', 'a      short', 'bbbbb  x    '].join('\n'));
  });

  it('renders just the header row when there are no rows', () => {
    expect(renderTable(['ID', 'NAME'], [])).toBe('ID  NAME');
  });

  it('does not widen a column beyond the header when every row omits that cell', () => {
    const result = renderTable(['ID', 'NAME'], [['a']]);

    expect(result).toBe(['ID  NAME', 'a '].join('\n'));
  });
});
