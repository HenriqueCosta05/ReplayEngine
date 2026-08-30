/**
 * Raised when a line of a Playwright codegen script cannot become a domain
 * `Action`. That covers two situations, and the distinction matters to whoever
 * reads the message:
 *
 * 1. The AST shape is outside the supported subset (`dblclick()`, a negated
 *    assertion, a regex locator).
 * 2. The shape is understood, but the values it carries are not valid domain
 *    input - `fill('')`, which real codegen emits when the person recording
 *    clears a text field. The domain factory raises `DomainError` for that,
 *    and this adapter re-throws it as a `ParseError` carrying the offending
 *    source line (with the `DomainError` as `cause`), because a bare
 *    "requires a non-empty value field" with no line reference is unactionable
 *    when it has just aborted a whole recording session.
 *
 * Either way this is an *adapter* error: the domain remains the authority on
 * what is valid, and the adapter's job is only to say which recorded line it
 * came from. It is always thrown rather than swallowed - dropping a line would
 * produce a journey that silently does less than the human recorded, which is
 * the worst possible failure mode for a test tool.
 */
export class ParseError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ParseError';
  }
}
