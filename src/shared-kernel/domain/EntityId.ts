// A minimal branded-string identifier type shared across feature domains.
//
// IDs are never generated here: generation (uuid, nanoid, etc.) is an
// infrastructure concern that lives behind an application-layer port and is
// *passed in* to domain factories. This module only models "a string that is
// shaped like a valid id" and lets call sites narrow an arbitrary string into
// that shape with a plain type guard - no I/O, no throwing constructor.

/**
 * A string identifier for an entity, branded at the type level so it cannot
 * be confused with an arbitrary `string` at compile time. At runtime it is
 * just a string - the brand is erased and costs nothing.
 */
export type EntityId = string & { readonly __entityIdBrand: unique symbol };

/**
 * Narrows an arbitrary value to `EntityId` if it is a non-empty string.
 * Kept as a plain predicate (not a throwing constructor) so callers decide
 * how to react to an invalid id - domain factories that embed ids in a
 * larger entity are expected to call this and raise their own `DomainError`
 * with context-specific messaging.
 */
export function isValidEntityId(value: unknown): value is EntityId {
  return typeof value === 'string' && value.trim().length > 0;
}
