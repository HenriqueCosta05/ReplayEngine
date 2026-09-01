import type { ClockPort } from '../../../src/shared-kernel/application/ports/ClockPort.js';

/** Deterministic `ClockPort` fake: always returns a fixed (or replaceable) instant. */
export class FakeClock implements ClockPort {
  constructor(private current: Date = new Date('2026-01-01T00:00:00.000Z')) {}

  now(): Date {
    return this.current;
  }

  setNow(date: Date): void {
    this.current = date;
  }
}
