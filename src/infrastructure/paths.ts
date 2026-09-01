import path from 'node:path';

/**
 * The root directory under which every QAMachine collection is persisted
 * (`<root>/journeys/<id>.json`, `<root>/profiles/...`, `<root>/traces/...`).
 *
 * Resolution order is deliberately just two levels here: the
 * `QAMACHINE_HOME` environment variable, else `.qamachine` under the current
 * working directory. The `--home` CLI flag is *not* consulted in this module:
 * flags are a delivery-layer concern, so the composition root reads the flag
 * and passes an explicit root down, falling back to this function when the
 * flag is absent.
 */
export function resolveDataRoot(): string {
  return process.env.QAMACHINE_HOME ?? path.resolve(process.cwd(), '.qamachine');
}
