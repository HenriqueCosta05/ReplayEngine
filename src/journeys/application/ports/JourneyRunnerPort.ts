import type { Journey } from '../../domain/Journey.js';
import type { JourneyRunResult } from '../../domain/JourneyRunResult.js';
import type { SupportedBrowser } from './JourneyRecorderPort.js';

export type { SupportedBrowser };

export interface RunOptions {
  browser: SupportedBrowser;
  storageStatePath?: string;
  keepTrace: boolean;
  tracePath?: string;
}

/**
 * Replays a `Journey`'s steps against a real browser (adapters/execution is
 * expected to implement this against Playwright) and reports the outcome.
 */
export interface JourneyRunnerPort {
  run(journey: Journey, opts: RunOptions): Promise<JourneyRunResult>;
}
