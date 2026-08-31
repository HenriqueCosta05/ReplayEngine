import { createJourneyRunResult } from '../../../src/journeys/domain/JourneyRunResult.js';
import type { Journey } from '../../../src/journeys/domain/Journey.js';
import type { JourneyRunResult } from '../../../src/journeys/domain/JourneyRunResult.js';
import type { JourneyRunnerPort, RunOptions } from '../../../src/journeys/application/ports/JourneyRunnerPort.js';

/**
 * Scriptable `JourneyRunnerPort` fake. Tests configure the result to return
 * via `setNextResult`; `calls` records every `(journey, opts)` pair the use
 * case passed through, so tests can assert the run was driven correctly
 * without touching a real browser.
 *
 * `setNextResults` additionally queues a sequence of distinct results, one
 * per call to `run` (in order) - needed by `RunPlaybookUseCase` tests, whose
 * multi-entry playbooks require different entries to see different outcomes
 * (e.g. entry 1 passes, entry 2 fails) within a single `execute()` call.
 * Once the queue is drained, `run` falls back to `nextResult` as before, so
 * existing single-result tests using only `setNextResult` are unaffected.
 */
export class FakeJourneyRunnerPort implements JourneyRunnerPort {
  readonly calls: Array<{ journey: Journey; opts: RunOptions }> = [];
  private nextResult: JourneyRunResult = createJourneyRunResult({
    id: 'run-1',
    startedAt: new Date('2026-01-01T00:00:00.000Z'),
    finishedAt: new Date('2026-01-01T00:00:01.000Z'),
    stepResults: [],
  });
  private queuedResults: JourneyRunResult[] = [];

  setNextResult(result: JourneyRunResult): void {
    this.nextResult = result;
  }

  setNextResults(results: readonly JourneyRunResult[]): void {
    this.queuedResults = [...results];
  }

  async run(journey: Journey, opts: RunOptions): Promise<JourneyRunResult> {
    this.calls.push({ journey, opts });
    return this.queuedResults.shift() ?? this.nextResult;
  }
}
