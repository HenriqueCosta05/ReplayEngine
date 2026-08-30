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

/**
 * Raised by a use case when it is asked to create an aggregate that would
 * violate a uniqueness rule enforced at the application layer (e.g.
 * registering a profile name that already exists). Like `NotFoundError`,
 * this is an application-level concern - adapters decide how to present it
 * (e.g. a non-zero CLI exit code with a clear message).
 */
export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}
