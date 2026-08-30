import { EventEmitter } from 'node:events';
import { existsSync } from 'node:fs';
import type { SpawnOptions } from 'node:child_process';
import { describe, expect, it } from 'vitest';

import {
  buildCodegenArgs,
  PlaywrightCodegenJourneyRecorder,
  type RecorderFileSystem,
  type SpawnFn,
} from '../../src/journeys/adapters/recording/PlaywrightCodegenJourneyRecorder.js';
import type { RecordOptions } from '../../src/journeys/application/ports/JourneyRecorderPort.js';
import { readCodegenFixture } from './helpers/fixtures.js';

const TEMP_PATH = '/tmp/qamachine-codegen-test.spec.ts';
const CLI_PATH = '/fake/node_modules/playwright/cli.js';

interface SpawnCall {
  command: string;
  args: readonly string[];
  options: SpawnOptions;
}

/**
 * A spawn double that never starts a process: it records the invocation and
 * then emits the outcome the test asked for. The real recorder opens an
 * interactive Inspector window a human drives, which is exactly why only the
 * argument construction and the cleanup contract are asserted here.
 */
function fakeSpawn(outcome: { code?: number | null; error?: Error } = { code: 0 }): {
  spawnFn: SpawnFn;
  calls: SpawnCall[];
} {
  const calls: SpawnCall[] = [];
  const spawnFn: SpawnFn = (command, args, options) => {
    calls.push({ command, args, options });
    const emitter = new EventEmitter();
    setImmediate(() => {
      if (outcome.error !== undefined) {
        emitter.emit('error', outcome.error);
      } else {
        emitter.emit('close', outcome.code ?? 0, null);
      }
    });
    return emitter;
  };
  return { spawnFn, calls };
}

function fakeFileSystem(script: string): { fileSystem: RecorderFileSystem; unlinked: string[] } {
  const unlinked: string[] = [];
  return {
    unlinked,
    fileSystem: {
      readFile: () => Promise.resolve(script),
      unlink: (filePath) => {
        unlinked.push(filePath);
        return Promise.resolve();
      },
    },
  };
}

function makeRecorder(
  spawnFn: SpawnFn,
  fileSystem: RecorderFileSystem,
): PlaywrightCodegenJourneyRecorder {
  return new PlaywrightCodegenJourneyRecorder({
    spawnFn,
    fileSystem,
    tempFilePathFactory: () => TEMP_PATH,
    cliPathResolver: () => CLI_PATH,
    nodeExecutable: '/usr/bin/node',
  });
}

const minimalOptions: RecordOptions = { startUrl: 'https://example.test/', browser: 'chromium' };

describe('buildCodegenArgs', () => {
  it('always pins the target, browser and output file', () => {
    expect(buildCodegenArgs(minimalOptions, TEMP_PATH)).toEqual([
      'codegen',
      'https://example.test/',
      '--target=playwright-test',
      '--browser=chromium',
      `--output=${TEMP_PATH}`,
    ]);
  });

  it('translates every emulation option from RecordOptions', () => {
    const args = buildCodegenArgs(
      {
        startUrl: 'https://example.test/app',
        browser: 'webkit',
        storageStatePath: '/home/ada/.qamachine/profiles/p1/storageState.json',
        viewport: { width: 1280, height: 720 },
        device: 'iPhone 15',
        colorScheme: 'dark',
        timezone: 'America/Sao_Paulo',
        lang: 'pt-BR',
        geolocation: { latitude: -23.5505, longitude: -46.6333 },
      },
      TEMP_PATH,
    );

    expect(args).toEqual([
      'codegen',
      'https://example.test/app',
      '--target=playwright-test',
      '--browser=webkit',
      `--output=${TEMP_PATH}`,
      '--load-storage=/home/ada/.qamachine/profiles/p1/storageState.json',
      '--viewport-size=1280,720',
      '--device=iPhone 15',
      '--color-scheme=dark',
      '--timezone=America/Sao_Paulo',
      '--lang=pt-BR',
      '--geolocation=-23.5505,-46.6333',
    ]);
  });

  it('omits flags for options the caller did not set', () => {
    const args = buildCodegenArgs({ ...minimalOptions, lang: 'en-GB' }, TEMP_PATH);

    expect(args.filter((arg) => arg.startsWith('--device'))).toEqual([]);
    expect(args).toContain('--lang=en-GB');
  });
});

describe('PlaywrightCodegenJourneyRecorder', () => {
  it('runs the resolved Playwright CLI with the current node binary and no shell', async () => {
    const { spawnFn, calls } = fakeSpawn();
    const { fileSystem } = fakeFileSystem(readCodegenFixture('login-flow.spec.ts'));

    await makeRecorder(spawnFn, fileSystem).record(minimalOptions);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.command).toBe('/usr/bin/node');
    expect(calls[0]?.args[0]).toBe(CLI_PATH);
    expect(calls[0]?.args.slice(1)).toEqual(buildCodegenArgs(minimalOptions, TEMP_PATH));
    // A shell would re-interpret a start URL containing `&` or `|`.
    expect(calls[0]?.options.shell).toBe(false);
  });

  it('returns the parsed draft, keeping the recorded goto as its own step', async () => {
    const { spawnFn } = fakeSpawn();
    const { fileSystem } = fakeFileSystem(readCodegenFixture('login-flow.spec.ts'));

    const draft = await makeRecorder(spawnFn, fileSystem).record(minimalOptions);

    expect(draft.startUrl).toBe('https://example.test/');
    expect(draft.steps).toHaveLength(7);
    expect(draft.steps[0]?.action).toEqual({ kind: 'goto', url: 'http://localhost:3000/login' });
    expect(draft.steps[0]?.label).toBe("await page.goto('http://localhost:3000/login');");
    expect(draft.steps.at(-1)?.action.kind).toBe('assertVisible');
  });

  it('deletes the temp script after a successful recording', async () => {
    const { spawnFn } = fakeSpawn();
    const { fileSystem, unlinked } = fakeFileSystem(readCodegenFixture('login-flow.spec.ts'));

    await makeRecorder(spawnFn, fileSystem).record(minimalOptions);

    expect(unlinked).toEqual([TEMP_PATH]);
  });

  it('still deletes the temp script when the script cannot be parsed', async () => {
    const { spawnFn } = fakeSpawn();
    const { fileSystem, unlinked } = fakeFileSystem('this is not a playwright test');

    await expect(makeRecorder(spawnFn, fileSystem).record(minimalOptions)).rejects.toThrow();

    expect(unlinked).toEqual([TEMP_PATH]);
  });

  it('reports a non-zero exit code and still cleans up', async () => {
    const { spawnFn } = fakeSpawn({ code: 1 });
    const { fileSystem, unlinked } = fakeFileSystem('');

    await expect(makeRecorder(spawnFn, fileSystem).record(minimalOptions)).rejects.toThrow(
      /`playwright codegen` exited with code 1/,
    );
    expect(unlinked).toEqual([TEMP_PATH]);
  });

  it('reports a spawn failure with the underlying cause', async () => {
    const { spawnFn } = fakeSpawn({ error: new Error('spawn ENOENT') });
    const { fileSystem } = fakeFileSystem('');

    await expect(makeRecorder(spawnFn, fileSystem).record(minimalOptions)).rejects.toThrow(
      /Failed to start `playwright codegen`: spawn ENOENT/,
    );
  });

  it('resolves the real installed Playwright CLI by default', async () => {
    const { spawnFn, calls } = fakeSpawn();
    const { fileSystem } = fakeFileSystem(readCodegenFixture('login-flow.spec.ts'));
    const recorder = new PlaywrightCodegenJourneyRecorder({
      spawnFn,
      fileSystem,
      tempFilePathFactory: () => TEMP_PATH,
    });

    await recorder.record(minimalOptions);

    const cliPath = calls[0]?.args[0] ?? '';
    expect(cliPath).toMatch(/playwright[\\/]cli\.js$/);
    expect(existsSync(cliPath)).toBe(true);
    expect(calls[0]?.command).toBe(process.execPath);
  });

  it('does not let a cleanup failure mask a successful recording', async () => {
    const { spawnFn } = fakeSpawn();
    const fileSystem: RecorderFileSystem = {
      readFile: () => Promise.resolve(readCodegenFixture('login-flow.spec.ts')),
      unlink: () => Promise.reject(new Error('EPERM')),
    };

    await expect(makeRecorder(spawnFn, fileSystem).record(minimalOptions)).resolves.toMatchObject({
      startUrl: 'https://example.test/',
    });
  });
});
