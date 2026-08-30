import { Command, InvalidArgumentError } from 'commander';
import pc from 'picocolors';

import type { Geolocation, SupportedBrowser, Viewport } from '../journeys/application/ports/JourneyRecorderPort.js';
import type { CreateAuthStrategyInput } from '../profiles/domain/AuthStrategy.js';
import { buildContainer, type Container } from './container.js';

const SUPPORTED_BROWSERS: readonly SupportedBrowser[] = ['chromium', 'firefox', 'webkit'];
const COLOR_SCHEMES = ['light', 'dark', 'no-preference'] as const;
const AUTH_TYPES: readonly CreateAuthStrategyInput['type'][] = ['none', 'storageState', 'loginJourney'];

interface GlobalOptions {
  home?: string;
  json?: boolean;
  quiet?: boolean;
  verbose?: boolean;
}

function parseBrowser(value: string): SupportedBrowser {
  if (!SUPPORTED_BROWSERS.includes(value as SupportedBrowser)) {
    throw new InvalidArgumentError(`Browser must be one of: ${SUPPORTED_BROWSERS.join(', ')}.`);
  }
  return value as SupportedBrowser;
}

function parseColorScheme(value: string): (typeof COLOR_SCHEMES)[number] {
  if (!(COLOR_SCHEMES as readonly string[]).includes(value)) {
    throw new InvalidArgumentError(`Color scheme must be one of: ${COLOR_SCHEMES.join(', ')}.`);
  }
  return value as (typeof COLOR_SCHEMES)[number];
}

function parseViewport(value: string): Viewport {
  const match = /^(\d+)x(\d+)$/.exec(value.trim());
  if (match === null) {
    throw new InvalidArgumentError('Viewport must be in the form <width>x<height>, e.g. 1280x720.');
  }
  return { width: Number(match[1]), height: Number(match[2]) };
}

function parseAuthType(value: string): CreateAuthStrategyInput['type'] {
  if (!(AUTH_TYPES as readonly string[]).includes(value)) {
    throw new InvalidArgumentError(`Auth type must be one of: ${AUTH_TYPES.join(', ')}.`);
  }
  return value as CreateAuthStrategyInput['type'];
}

function parseGeolocation(value: string): Geolocation {
  const parts = value.split(',').map((part) => Number(part.trim()));
  if (parts.length !== 2 || parts.some((part) => Number.isNaN(part))) {
    throw new InvalidArgumentError('Geolocation must be in the form <latitude>,<longitude>.');
  }
  const [latitude, longitude] = parts as [number, number];
  return { latitude, longitude };
}

/** Formats a caught error for the terminal: message only by default, `+stack` under `--verbose`. Never a raw uncaught throw. */
function formatError(error: unknown, verbose: boolean): string {
  const message = error instanceof Error ? error.message : String(error);
  if (verbose && error instanceof Error && error.stack !== undefined) {
    return `${message}\n${pc.dim(error.stack)}`;
  }
  return message;
}

/**
 * Every command's `.action()` funnels through here: build the container from
 * the merged global + local options, run the given task against it, and on
 * any thrown error print a formatted message (never a raw stack trace unless
 * `--verbose`) and set a non-zero exit code, rather than letting commander
 * surface an unhandled rejection.
 */
function runAction(
  command: Command,
  task: (container: Container, globalOptions: GlobalOptions) => Promise<void>,
): Promise<void> {
  const globalOptions = command.optsWithGlobals<GlobalOptions>();
  const container = buildContainer({ home: globalOptions.home });

  return task(container, globalOptions).catch((error: unknown) => {
    console.error(pc.red(formatError(error, globalOptions.verbose === true)));
    process.exitCode = 1;
  });
}

/** Builds the `qamachine` `commander` program. `bin/qamachine.ts` is the only caller. */
export function buildProgram(): Command {
  const program = new Command();

  program
    .name('qamachine')
    .description('Blackbox Playwright-powered CLI for recording, saving and replaying browser journeys.')
    .option('--home <path>', 'Override the QAMachine data directory (defaults to $QAMACHINE_HOME or ./.qamachine)')
    .option('--json', 'Print machine-readable JSON instead of human-readable text')
    .option('--quiet', 'Suppress non-essential output')
    .option('--verbose', 'Include stack traces when a command fails');

  program
    .command('record')
    .description('Record a new journey by driving `playwright codegen`')
    .argument('<url>', 'URL to start recording from')
    .requiredOption('--name <name>', 'Name for the recorded journey')
    .option('--profile <profileId>', 'Id of a registered profile to record with (applies its auth state)')
    .option('--browser <browser>', 'Browser engine to record with', parseBrowser, 'chromium')
    .option('--viewport <WxH>', 'Viewport size, e.g. 1280x720', parseViewport)
    .option('--device <device>', 'Emulate a known Playwright device, e.g. "iPhone 13"')
    .option('--color-scheme <scheme>', `Preferred color scheme (${COLOR_SCHEMES.join('|')})`, parseColorScheme)
    .option('--timezone <tz>', 'IANA timezone id, e.g. America/Sao_Paulo')
    .option('--lang <locale>', 'Locale, e.g. en-US')
    .option('--geolocation <lat,long>', 'Geolocation coordinates, e.g. -23.5,-46.6', parseGeolocation)
    .action(async (url: string, options, command: Command) => {
      await runAction(command, (container, globalOptions) =>
        container.recordJourneyController.execute(url, {
          name: options.name,
          profile: options.profile,
          browser: options.browser,
          viewport: options.viewport,
          device: options.device,
          colorScheme: options.colorScheme,
          timezone: options.timezone,
          lang: options.lang,
          geolocation: options.geolocation,
          json: globalOptions.json,
          quiet: globalOptions.quiet,
        }),
      );
    });

  const journey = program.command('journey').description('Manage recorded journeys');

  journey
    .command('list')
    .description('List recorded journeys')
    .action(async (options, command: Command) => {
      await runAction(command, (container, globalOptions) =>
        container.journeyController.list({ json: globalOptions.json, quiet: globalOptions.quiet }),
      );
    });

  journey
    .command('show')
    .description('Show one journey by id')
    .argument('<id>', 'Journey id')
    .action(async (id: string, options, command: Command) => {
      await runAction(command, (container, globalOptions) =>
        container.journeyController.show(id, { json: globalOptions.json, quiet: globalOptions.quiet }),
      );
    });

  journey
    .command('delete')
    .description('Delete one journey by id')
    .argument('<id>', 'Journey id')
    .action(async (id: string, options, command: Command) => {
      await runAction(command, (container, globalOptions) =>
        container.journeyController.delete(id, { json: globalOptions.json, quiet: globalOptions.quiet }),
      );
    });

  journey
    .command('run')
    .description('Replay one journey by id against a real browser')
    .argument('<id>', 'Journey id')
    .option('--profile <profileId>', 'Id of a registered profile to run with (applies its auth state)')
    .option('--keep-trace', 'Save a Playwright trace file for this run', false)
    .option('--browser <browser>', 'Browser engine to run with', parseBrowser, 'chromium')
    .action(async (id: string, options, command: Command) => {
      await runAction(command, (container, globalOptions) =>
        container.runJourneyController.execute(id, {
          profile: options.profile,
          browser: options.browser,
          keepTrace: options.keepTrace === true,
          json: globalOptions.json,
          quiet: globalOptions.quiet,
        }),
      );
    });

  const profile = program.command('profile').description('Manage locally-registered user profiles');

  profile
    .command('add')
    .description('Register a new profile')
    .requiredOption('--name <name>', 'Name for the profile (must be unique)')
    .requiredOption('--auth-type <type>', `Auth strategy (${AUTH_TYPES.join('|')})`, parseAuthType)
    .option('--storage-state-path <path>', 'Path to an existing storageState.json (auth-type=storageState)')
    .option('--login-journey-id <id>', 'Journey id that logs in (auth-type=loginJourney)')
    .option(
      '--login-storage-state-path <path>',
      'Path where the captured storage state will be written and read from (auth-type=loginJourney)',
    )
    .action(async (options, command: Command) => {
      await runAction(command, (container, globalOptions) =>
        container.profileController.add({
          name: options.name,
          authType: options.authType,
          storageStatePath: options.storageStatePath,
          loginJourneyId: options.loginJourneyId,
          loginStorageStatePath: options.loginStorageStatePath,
          json: globalOptions.json,
          quiet: globalOptions.quiet,
        }),
      );
    });

  profile
    .command('list')
    .description('List registered profiles')
    .action(async (options, command: Command) => {
      await runAction(command, (container, globalOptions) =>
        container.profileController.list({ json: globalOptions.json, quiet: globalOptions.quiet }),
      );
    });

  profile
    .command('show')
    .description('Show one profile by id')
    .argument('<id>', 'Profile id')
    .action(async (id: string, options, command: Command) => {
      await runAction(command, (container, globalOptions) =>
        container.profileController.show(id, { json: globalOptions.json, quiet: globalOptions.quiet }),
      );
    });

  profile
    .command('refresh')
    .description("Refresh a profile's stored auth state by re-running its login journey")
    .argument('<id>', 'Profile id')
    .action(async (id: string, options, command: Command) => {
      await runAction(command, (container, globalOptions) =>
        container.refreshProfileController.execute(id, { json: globalOptions.json, quiet: globalOptions.quiet }),
      );
    });

  const template = program.command('template').description('Manage reusable, parameterizable journey templates');

  template
    .command('create')
    .description('Save a recorded journey as a reusable template')
    .requiredOption('--journey-id <id>', 'Id of the journey to snapshot')
    .requiredOption('--name <name>', 'Name for the template')
    .option(
      '--param <stepIndex.field=paramName[:required][:default=value]>',
      'Declare a parameter, repeatable. stepIndex is 0-based, matching the step order shown by `journey show`.',
      (value: string, previous: string[]) => previous.concat([value]),
      [] as string[],
    )
    .action(async (options, command: Command) => {
      await runAction(command, (container, globalOptions) =>
        container.templateController.create({
          journeyId: options.journeyId,
          name: options.name,
          params: options.param,
          json: globalOptions.json,
          quiet: globalOptions.quiet,
        }),
      );
    });

  template
    .command('list')
    .description('List saved templates')
    .action(async (options, command: Command) => {
      await runAction(command, (container, globalOptions) =>
        container.templateController.list({ json: globalOptions.json, quiet: globalOptions.quiet }),
      );
    });

  template
    .command('show')
    .description('Show one template by id')
    .argument('<id>', 'Template id')
    .action(async (id: string, options, command: Command) => {
      await runAction(command, (container, globalOptions) =>
        container.templateController.show(id, { json: globalOptions.json, quiet: globalOptions.quiet }),
      );
    });

  template
    .command('delete')
    .description('Delete one template by id')
    .argument('<id>', 'Template id')
    .action(async (id: string, options, command: Command) => {
      await runAction(command, (container, globalOptions) =>
        container.templateController.delete(id, { json: globalOptions.json, quiet: globalOptions.quiet }),
      );
    });

  template
    .command('run')
    .description('Instantiate one template by id against a real browser and run it')
    .argument('<id>', 'Template id')
    .option(
      '--param <name=value>',
      'Supply a value for a declared template parameter, repeatable',
      (value: string, previous: string[]) => previous.concat([value]),
      [] as string[],
    )
    .option('--profile <profileId>', 'Id of a registered profile to run with (applies its auth state)')
    .option('--keep-trace', 'Save a Playwright trace file for this run', false)
    .option('--browser <browser>', 'Browser engine to run with', parseBrowser, 'chromium')
    .action(async (id: string, options, command: Command) => {
      await runAction(command, (container, globalOptions) =>
        container.runTemplateController.execute(id, {
          params: options.param,
          profile: options.profile,
          browser: options.browser,
          keepTrace: options.keepTrace === true,
          json: globalOptions.json,
          quiet: globalOptions.quiet,
        }),
      );
    });

  return program;
}
