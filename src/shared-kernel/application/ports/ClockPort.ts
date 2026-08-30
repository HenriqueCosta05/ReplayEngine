/**
 * Abstracts "what time is it" behind a port so use cases stay deterministic
 * and I/O-free in tests. Infrastructure provides a real implementation
 * (`new Date()`); tests inject a fake with a fixed or scripted clock.
 */
export interface ClockPort {
  now(): Date;
}
