import type { IdGeneratorPort } from '../../../src/shared-kernel/application/ports/IdGeneratorPort.js';

/** Deterministic `IdGeneratorPort` fake: yields sequential `id-1`, `id-2`, ... */
export class FakeIdGenerator implements IdGeneratorPort {
  private counter = 0;

  generate(): string {
    this.counter += 1;
    return `id-${this.counter}`;
  }
}
