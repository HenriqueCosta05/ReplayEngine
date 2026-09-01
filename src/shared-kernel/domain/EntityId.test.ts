import { describe, expect, it } from 'vitest';
import { isValidEntityId } from './EntityId.js';

describe('isValidEntityId', () => {
  it('accepts a non-empty string', () => {
    expect(isValidEntityId('journey-123')).toBe(true);
  });

  it('rejects an empty string', () => {
    expect(isValidEntityId('')).toBe(false);
  });

  it('rejects a whitespace-only string', () => {
    expect(isValidEntityId('   ')).toBe(false);
  });

  it('rejects non-string values', () => {
    expect(isValidEntityId(123)).toBe(false);
    expect(isValidEntityId(null)).toBe(false);
    expect(isValidEntityId(undefined)).toBe(false);
    expect(isValidEntityId({})).toBe(false);
  });
});
