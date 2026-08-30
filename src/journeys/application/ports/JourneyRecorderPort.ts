import type { Action } from '../../domain/Action.js';

export type SupportedBrowser = 'chromium' | 'firefox' | 'webkit';

export interface Viewport {
  width: number;
  height: number;
}

export interface Geolocation {
  latitude: number;
  longitude: number;
}

export interface RecordOptions {
  startUrl: string;
  browser: SupportedBrowser;
  storageStatePath?: string;
  viewport?: Viewport;
  device?: string;
  colorScheme?: 'light' | 'dark' | 'no-preference';
  timezone?: string;
  lang?: string;
  geolocation?: Geolocation;
}

/** One recorded action, not yet assigned a `Step.id`/`order` by the use case. */
export interface RecordedStepDraft {
  action: Action;
  label?: string;
}

/** The raw output of a recording session, before it is turned into a `Journey`. */
export interface RecordedJourneyDraft {
  startUrl: string;
  steps: RecordedStepDraft[];
}

/**
 * Drives an interactive browser recording session (adapters/recording is
 * expected to implement this against Playwright's codegen) and returns the
 * raw draft for the use case to turn into a `Journey`.
 */
export interface JourneyRecorderPort {
  record(opts: RecordOptions): Promise<RecordedJourneyDraft>;
}
