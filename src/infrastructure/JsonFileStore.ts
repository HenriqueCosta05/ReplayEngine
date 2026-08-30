import fs from 'node:fs/promises';
import path from 'node:path';

const JSON_EXTENSION = '.json';
const TEMP_EXTENSION = '.json.tmp';

function isErrnoException(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as NodeJS.ErrnoException).code === code
  );
}

/**
 * A low-level "one JSON file per record" store: not a port, and not a
 * repository. It knows nothing about domain entities - it stores and returns
 * whatever plain-JSON-serialisable snapshot type `T` its owner hands it. Each
 * feature's repository adapter wraps one of these and owns the
 * snapshot<->domain translation, so validation stays in the domain factories.
 *
 * Writes are atomic against a reader in another process: the payload is
 * written to `<id>.json.tmp` first and then `rename`d over `<id>.json`, which
 * is atomic on both POSIX and Windows for a same-directory rename. A reader
 * therefore never observes a half-written file - it sees either the previous
 * version or the new one.
 */
export class JsonFileStore<T> {
  constructor(private readonly dirPath: string) {}

  private filePathFor(id: string, extension: string): string {
    // Ids become file names, so a separator or `..` would let a caller escape
    // the store's directory. This is file-system hygiene, not a domain rule:
    // entity id *validity* is enforced by the domain factories.
    if (id.length === 0 || id.includes('/') || id.includes('\\') || id === '.' || id === '..') {
      throw new Error(`Invalid record id "${id}": ids must not be empty or contain path separators.`);
    }
    return path.join(this.dirPath, `${id}${extension}`);
  }

  async save(id: string, data: T): Promise<void> {
    const tempPath = this.filePathFor(id, TEMP_EXTENSION);
    const finalPath = this.filePathFor(id, JSON_EXTENSION);

    await fs.mkdir(this.dirPath, { recursive: true });
    await fs.writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    await fs.rename(tempPath, finalPath);
  }

  async findById(id: string): Promise<T | null> {
    try {
      const raw = await fs.readFile(this.filePathFor(id, JSON_EXTENSION), 'utf8');
      return JSON.parse(raw) as T;
    } catch (error) {
      if (isErrnoException(error, 'ENOENT')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Every record in the store, in directory order. A missing directory means
   * "nothing has been saved yet", not an error. In-flight `.json.tmp` files
   * are skipped - only the committed `.json` names are records.
   */
  async findAll(): Promise<T[]> {
    let entries: string[];
    try {
      entries = await fs.readdir(this.dirPath);
    } catch (error) {
      if (isErrnoException(error, 'ENOENT')) {
        return [];
      }
      throw error;
    }

    const ids = entries
      .filter((entry) => entry.endsWith(JSON_EXTENSION))
      .map((entry) => entry.slice(0, -JSON_EXTENSION.length));

    const records: T[] = [];
    for (const id of ids) {
      const record = await this.findById(id);
      // A record deleted between `readdir` and `readFile` yields null; drop it
      // rather than reporting a phantom entry.
      if (record !== null) {
        records.push(record);
      }
    }
    return records;
  }

  /** Removes a record. Deleting an id that is not present is a no-op. */
  async delete(id: string): Promise<void> {
    try {
      await fs.unlink(this.filePathFor(id, JSON_EXTENSION));
    } catch (error) {
      if (isErrnoException(error, 'ENOENT')) {
        return;
      }
      throw error;
    }
  }
}
