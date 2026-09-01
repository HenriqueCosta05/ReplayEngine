import type { ClockPort } from '../application/ports/ClockPort.js';

/** Real-time `ClockPort` implementation, backed by `Date`. */
export class SystemClock implements ClockPort {
  now(): Date {
    return new Date();
  }
}
