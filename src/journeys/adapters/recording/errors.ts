/**
 * Raised when a Playwright codegen script contains something this adapter
 * cannot faithfully translate into the domain's `Action` vocabulary.
 *
 * This is an *adapter* error, not a `DomainError`: nothing about the domain
 * is violated, we simply met a source construct outside the supported subset.
 * It is always thrown rather than swallowed - dropping an unrecognised line
 * would produce a journey that silently does less than the human recorded,
 * which is the worst possible failure mode for a test tool.
 */
export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}
