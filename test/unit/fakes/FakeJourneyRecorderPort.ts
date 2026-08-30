import type {
  JourneyRecorderPort,
  RecordedJourneyDraft,
  RecordOptions,
} from '../../../src/journeys/application/ports/JourneyRecorderPort.js';

/**
 * Scriptable `JourneyRecorderPort` fake. Tests configure the draft to return
 * via `nextResult`; `calls` records every `opts` the use case passed through,
 * so tests can assert the recording session was driven with the right
 * options without touching a real browser.
 */
export class FakeJourneyRecorderPort implements JourneyRecorderPort {
  readonly calls: RecordOptions[] = [];
  private nextResult: RecordedJourneyDraft = {
    startUrl: 'https://example.com',
    steps: [{ action: { kind: 'goto', url: 'https://example.com' } }],
  };

  setNextResult(draft: RecordedJourneyDraft): void {
    this.nextResult = draft;
  }

  async record(opts: RecordOptions): Promise<RecordedJourneyDraft> {
    this.calls.push(opts);
    return this.nextResult;
  }
}
