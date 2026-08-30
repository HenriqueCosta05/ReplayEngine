import { randomUUID } from 'node:crypto';

import type { IdGeneratorPort } from '../application/ports/IdGeneratorPort.js';

/** Real `IdGeneratorPort` implementation, backed by `crypto.randomUUID()`. */
export class CryptoIdGenerator implements IdGeneratorPort {
  generate(): string {
    return randomUUID();
  }
}
