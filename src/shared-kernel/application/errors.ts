/**
 * Raised by a use case when it is asked to operate on an aggregate that does
 * not exist (e.g. `findById` returns null). This is an application-level
 * concern, not a domain invariant violation (`DomainError`), and not a
 * delivery-layer concern (adapters decide how to present it - e.g. mapping
 * to a CLI exit code or an HTTP 404 - by catching this type).
 */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}
