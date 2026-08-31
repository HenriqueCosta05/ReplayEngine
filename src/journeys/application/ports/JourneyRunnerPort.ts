import type { Journey } from '../../domain/Journey.js';
import type { JourneyRunResult } from '../../domain/JourneyRunResult.js';
import type { SupportedBrowser } from './JourneyRecorderPort.js';

export type { SupportedBrowser };

export interface RunOptions {
  browser: SupportedBrowser;
  storageStatePath?: string;
  /**
   * The profile actually resolved and used for THIS run (`--profile` /
   * `entry.profileOverride`), as opposed to whatever profile (if any) the
   * journey was recorded under. When omitted entirely (caller resolved no
   * profile for this run), the adapter falls back to the journey's own
   * recorded `profileId` - see the WHY comment at that fallback in
   * `PlaywrightStepInterpreter.run` for the exact distinction this rests on.
   */
  profileId?: string;
  keepTrace: boolean;
  tracePath?: string;
  /**
   * When set, the runner captures `context.storageState()` to this path just
   * before tearing the browser context down, in addition to (not instead of)
   * running the journey normally. This is how `profiles/adapters/auth`'s
   * `StorageStateAuthStateProvider.refresh` captures a `loginJourney`
   * profile's authenticated state: it is a plain run whose `RunOptions` also
   * asks for a capture, not a distinct code path - so `keepTrace`,
   * `storageStatePath`, etc. all still apply normally alongside it. Mirrors
   * the existing `keepTrace`/`tracePath` pair rather than adding a second
   * `JourneyRunnerPort` method or changing `JourneyRunResult`'s shape - see
   * `PlaywrightStepInterpreter.run` for the capture itself.
   */
  captureStorageStatePath?: string;
}

/**
 * Replays a `Journey`'s steps against a real browser (adapters/execution is
 * expected to implement this against Playwright) and reports the outcome.
 */
export interface JourneyRunnerPort {
  run(journey: Journey, opts: RunOptions): Promise<JourneyRunResult>;
}
