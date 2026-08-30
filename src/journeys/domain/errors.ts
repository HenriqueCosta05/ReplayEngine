/**
 * Raised by every domain factory in `journeys/domain` when constructor input
 * fails to satisfy an entity's or value object's invariants. Domain objects
 * guard their own invariants at construction time - callers never receive a
 * half-built, not-yet-validated instance to check afterwards.
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}
