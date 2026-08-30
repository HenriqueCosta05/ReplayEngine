/**
 * Raised by every domain factory in `templates/domain` when constructor
 * input fails to satisfy an entity's or value object's invariants. Mirrors
 * `journeys/domain/errors.ts` / `profiles/domain/errors.ts` - kept as a
 * separate class (not shared) so each feature's domain stays self-contained
 * per Clean Architecture's "domain depends on nothing" rule, including not
 * depending on a sibling feature's domain.
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}
