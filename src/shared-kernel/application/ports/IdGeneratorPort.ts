/**
 * Abstracts identifier generation behind a port so use cases stay
 * deterministic and I/O-free in tests. Infrastructure provides a real
 * implementation (uuid, nanoid, etc.); tests inject a fake that returns
 * predictable, sequential ids.
 */
export interface IdGeneratorPort {
  generate(): string;
}
