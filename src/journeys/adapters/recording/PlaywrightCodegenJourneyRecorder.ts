import { spawn, type SpawnOptions } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

import type {
  JourneyRecorderPort,
  RecordOptions,
  RecordedJourneyDraft,
} from '../../application/ports/JourneyRecorderPort.js';
import { mapToActions } from './CodegenActionMapper.js';
import { parseCodegenScript } from './CodegenScriptParser.js';

/** The subset of `child_process.spawn` this adapter needs, so tests can fake it. */
export interface SpawnedProcess {
  on(event: 'error', listener: (error: Error) => void): unknown;
  on(event: 'close', listener: (code: number | null, signal: NodeJS.Signals | null) => void): unknown;
}

export type SpawnFn = (command: string, args: readonly string[], options: SpawnOptions) => SpawnedProcess;

/** File-system operations used by the recorder, injectable for the same reason. */
export interface RecorderFileSystem {
  readFile(filePath: string): Promise<string>;
  unlink(filePath: string): Promise<void>;
}

export interface PlaywrightCodegenJourneyRecorderDeps {
  spawnFn?: SpawnFn;
  fileSystem?: RecorderFileSystem;
  /** Absolute path of the script codegen should write. Defaults to a fresh temp file. */
  tempFilePathFactory?: () => string;
  /** Absolute path of the `playwright` CLI entry point. Defaults to the installed package's. */
  cliPathResolver?: () => string;
  /** Node executable used to run the CLI. Defaults to `process.execPath`. */
  nodeExecutable?: string;
}

const moduleRequire = createRequire(import.meta.url);

/**
 * Locates `node_modules/playwright/cli.js` through the package's own `bin`
 * field rather than hard-coding the file name. `playwright/cli.js` is not in
 * the package's `exports` map, so it cannot be `require.resolve`d directly -
 * but `playwright/package.json` is, which gives us the package root.
 */
function resolvePlaywrightCli(): string {
  const packageJsonPath = moduleRequire.resolve('playwright/package.json');
  const packageJson = moduleRequire(packageJsonPath) as { bin?: string | Record<string, string> };
  const binEntry = typeof packageJson.bin === 'string' ? packageJson.bin : packageJson.bin?.playwright;
  if (binEntry === undefined) {
    throw new Error('Could not locate the `playwright` CLI entry point in the installed playwright package.');
  }
  return path.join(path.dirname(packageJsonPath), binEntry);
}

function defaultTempFilePath(): string {
  return path.join(os.tmpdir(), `qamachine-codegen-${randomBytes(8).toString('hex')}.spec.ts`);
}

const nodeFileSystem: RecorderFileSystem = {
  readFile: (filePath) => fs.readFile(filePath, 'utf8'),
  unlink: (filePath) => fs.unlink(filePath),
};

/**
 * Builds the `playwright codegen` argument vector for a recording session.
 * Exported so the argument mapping can be asserted directly - it is the part
 * of this adapter that is worth testing, since the interactive session itself
 * cannot be automated.
 */
export function buildCodegenArgs(opts: RecordOptions, outputPath: string): string[] {
  const args = [
    'codegen',
    opts.startUrl,
    '--target=playwright-test',
    `--browser=${opts.browser}`,
    `--output=${outputPath}`,
  ];

  if (opts.storageStatePath !== undefined) {
    args.push(`--load-storage=${opts.storageStatePath}`);
  }
  if (opts.viewport !== undefined) {
    args.push(`--viewport-size=${opts.viewport.width},${opts.viewport.height}`);
  }
  if (opts.device !== undefined) {
    args.push(`--device=${opts.device}`);
  }
  if (opts.colorScheme !== undefined) {
    args.push(`--color-scheme=${opts.colorScheme}`);
  }
  if (opts.timezone !== undefined) {
    args.push(`--timezone=${opts.timezone}`);
  }
  if (opts.lang !== undefined) {
    args.push(`--lang=${opts.lang}`);
  }
  if (opts.geolocation !== undefined) {
    args.push(`--geolocation=${opts.geolocation.latitude},${opts.geolocation.longitude}`);
  }

  return args;
}

/**
 * Records a journey by driving `playwright codegen` in a child process and
 * parsing the `@playwright/test` script it writes.
 *
 * **Process launch strategy (Windows-driven).** The child is started as
 * `node <playwright-cli.js> codegen …` with `shell: false`, not as
 * `npx playwright codegen …`. Empirically on Windows + Node 26:
 * `spawn('npx', ...)` fails with `ENOENT` (there is no extension-less `npx`
 * executable), and `spawn('npx.cmd', ...)` throws `EINVAL` because Node
 * refuses to launch `.cmd`/`.bat` files without a shell since the
 * CVE-2024-27980 fix. That leaves `shell: true` as the only way to spawn
 * `npx` - but a shell interpolates the command line, so a recorded start URL
 * containing `&`, `|` or `"` would be interpreted by cmd.exe rather than
 * passed through (Node itself now warns about this as DEP0190). Resolving the
 * CLI's own entry point and running it with the current Node binary sidesteps
 * all three problems, is shell-free on every platform, and pins the recording
 * to the exact Playwright version this project depends on.
 *
 * The interactive Inspector window this opens cannot be automated, so this
 * class is covered by argument-construction and cleanup tests plus a
 * documented manual smoke test (`docs/MANUAL-SMOKE-TESTS.md`, item 1).
 */
export class PlaywrightCodegenJourneyRecorder implements JourneyRecorderPort {
  private readonly spawnFn: SpawnFn;
  private readonly fileSystem: RecorderFileSystem;
  private readonly tempFilePathFactory: () => string;
  private readonly cliPathResolver: () => string;
  private readonly nodeExecutable: string;

  constructor(deps: PlaywrightCodegenJourneyRecorderDeps = {}) {
    this.spawnFn = deps.spawnFn ?? ((command, args, options) => spawn(command, [...args], options));
    this.fileSystem = deps.fileSystem ?? nodeFileSystem;
    this.tempFilePathFactory = deps.tempFilePathFactory ?? defaultTempFilePath;
    this.cliPathResolver = deps.cliPathResolver ?? resolvePlaywrightCli;
    this.nodeExecutable = deps.nodeExecutable ?? process.execPath;
  }

  async record(opts: RecordOptions): Promise<RecordedJourneyDraft> {
    const outputPath = this.tempFilePathFactory();
    const args = [this.cliPathResolver(), ...buildCodegenArgs(opts, outputPath)];

    try {
      await this.runCodegen(args);
      const script = await this.fileSystem.readFile(outputPath);
      const steps = mapToActions(parseCodegenScript(script));
      return {
        startUrl: opts.startUrl,
        // The recorded `goto` is kept as a step of its own: `startUrl` names
        // where the journey begins, the step is what actually navigates, so
        // playback needs no implicit first move.
        steps: steps.map((step) => ({
          action: step.action,
          ...(step.label !== undefined ? { label: step.label } : {}),
        })),
      };
    } finally {
      // The temp script is scratch space, and a failure to remove it must
      // never mask the real error (or fail an otherwise good recording).
      await this.fileSystem.unlink(outputPath).catch(() => undefined);
    }
  }

  private runCodegen(args: readonly string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      // `stdio: 'inherit'` so the human sees codegen's own console output;
      // the Inspector window is what they actually interact with.
      const child = this.spawnFn(this.nodeExecutable, args, { stdio: 'inherit', shell: false });

      child.on('error', (error: Error) => {
        reject(new Error(`Failed to start \`playwright codegen\`: ${error.message}`));
      });

      child.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(
          new Error(
            `\`playwright codegen\` exited with ${code === null ? `signal ${String(signal)}` : `code ${code}`}.`,
          ),
        );
      });
    });
  }
}
