import { createJourneyRunResult } from '../../../src/journeys/domain/JourneyRunResult.js';
import type { Journey } from '../../../src/journeys/domain/Journey.js';
import type { JourneyRunResult } from '../../../src/journeys/domain/JourneyRunResult.js';
import type { JourneyRunnerPort, RunOptions } from '../../../src/journeys/application/ports/JourneyRunnerPort.js';

/**
 * Scriptable `JourneyRunnerPort` fake. Tests configure the result to return
 * via `setNextResult`; `calls` records every `(journey, opts)` pair the use
 * case passed through, so tests can assert the run was driven correctly
 * without touching a real browser.
 */
export class FakeJourneyRunnerPort implements JourneyRunnerPort {
  readonly calls: Array<{ journey: Journey; opts: RunOptions }> = [];
  private nextResult: JourneyRunResult = createJourneyRunResult({
    id: 'run-1',
    startedAt: new Date('2026-01-01T00:00:00.000Z'),
    finishedAt: new Date('2026-01-01T00:00:01.000Z'),
    stepResults: [],
  });

  setNextResult(result: JourneyRunResult): void {
    this.nextResult = result;
  }

  async run(journey: Journey, opts: RunOptions): Promise<JourneyRunResult> {
    this.calls.push({ journey, opts });
    return this.nextResult;
  }
}
