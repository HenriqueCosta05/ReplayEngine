import { describe, expect, it } from 'vitest';

// Trivial smoke test to keep `vitest run` from erroring on "no test files"
// while the real domain/application layers are still unimplemented (Task 0).
// Delete this once Task 1 adds real tests under src/journeys/domain/*.test.ts.
describe('smoke', () => {
  it('arithmetic works', () => {
    expect(1 + 1).toBe(2);
  });
});
