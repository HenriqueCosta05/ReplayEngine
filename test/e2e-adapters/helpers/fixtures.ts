import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const fixturesRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'fixtures');

/** Reads a hand-authored `playwright codegen --target=playwright-test` fixture. */
export function readCodegenFixture(fileName: string): string {
  return readFileSync(path.join(fixturesRoot, 'codegen-output', fileName), 'utf8');
}

/** Absolute path of the directory holding the static HTML pages served in tests. */
export const pagesFixtureDir = path.join(fixturesRoot, 'pages');
