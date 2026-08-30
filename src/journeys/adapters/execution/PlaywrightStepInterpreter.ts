import { expect } from '@playwright/test';
import { chromium, firefox, webkit, type Browser, type BrowserContext, type BrowserType, type Page } from 'playwright';

import type { ClockPort } from '../../../shared-kernel/application/ports/ClockPort.js';
import type { IdGeneratorPort } from '../../../shared-kernel/application/ports/IdGeneratorPort.js';
import type { Action } from '../../domain/Action.js';
import type { Journey } from '../../domain/Journey.js';
import { createJourneyRunResult, type JourneyRunResult } from '../../domain/JourneyRunResult.js';
import { createStepResult, type StepResult } from '../../domain/StepResult.js';
import type { Step } from '../../domain/Step.js';
import type {
  JourneyRunnerPort,
  RunOptions,
  SupportedBrowser,
} from '../../application/ports/JourneyRunnerPort.js';
import { resolveLocator } from './LocatorResolver.js';

const BROWSER_ENGINES: Readonly<Record<SupportedBrowser, BrowserType>> = {
  chromium,
  firefox,
  webkit,
};

export interface PlaywrightStepInterpreterOptions {
  /** Passed to `browserType.launch`. Headless by default - this is a CLI, not a debugger. */
  headless?: boolean;
}

function errorMessageOf(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  const asText = String(error);
  // `createStepResult` rejects a failed result without a message, and a
  // thrown `undefined` must not be allowed to turn a failure into a crash.
  return asText.length > 0 ? asText : 'Unknown error';
}

/**
 * Executes one action against a live page.
 *
 * The `switch` is exhaustive by construction: the `never` assignment in the
 * `default` branch fails to compile the moment a new member is added to the
 * `Action` union without a case here. That is the whole point of the pattern -
 * the playback engine cannot silently ignore an action kind the recorder has
 * learned to produce.
 *
 * The three `assert*` kinds go through `@playwright/test`'s `expect` used as a
 * plain library (no test runner involved) so that assertions retry until they
 * pass or time out, exactly as they would inside a Playwright test.
 */
async function executeAction(page: Page, action: Action): Promise<void> {
  switch (action.kind) {
    case 'goto':
      await page.goto(action.url);
      return;
    case 'click':
      await resolveLocator(page, action.locator).click();
      return;
    case 'fill':
      await resolveLocator(page, action.locator).fill(action.value);
      return;
    case 'check':
      await resolveLocator(page, action.locator).check();
      return;
    case 'uncheck':
      await resolveLocator(page, action.locator).uncheck();
      return;
    case 'press':
      await resolveLocator(page, action.locator).press(action.key);
      return;
    case 'selectOption':
      await resolveLocator(page, action.locator).selectOption(action.value);
      return;
    case 'hover':
      await resolveLocator(page, action.locator).hover();
      return;
    case 'assertVisible':
      await expect(resolveLocator(page, action.locator)).toBeVisible();
      return;
    case 'assertText':
      await expect(resolveLocator(page, action.locator)).toHaveText(action.expected);
      return;
    case 'assertValue':
      await expect(resolveLocator(page, action.locator)).toHaveValue(action.expected);
      return;
    default: {
      const exhaustive: never = action;
      throw new Error(`Unsupported action kind: ${String((exhaustive as { kind: string }).kind)}`);
    }
  }
}

/**
 * Replays a `Journey` against a real browser via the raw `playwright` package.
 *
 * Two deliberate behaviours:
 *
 * 1. **Every step runs.** A failing step is recorded as a `failed`
 *    `StepResult` and playback continues, so one run reports every problem in
 *    the journey rather than only the first. Aborting early would make the
 *    tool answer "what broke?" with one line when it could answer with all of
 *    them.
 * 2. **Time comes from `ClockPort`, ids from `IdGeneratorPort`.** The adapter
 *    reads no ambient `Date.now()`/uuid, which keeps run records reproducible
 *    and lets tests assert on exact timestamps.
 *
 * A failure *around* the steps (browser launch, tracing, context creation) is
 * reported as the run's top-level `error`, which `JourneyRunResult.status`
 * already treats as a failed run even when no step failed.
 */
export class PlaywrightStepInterpreter implements JourneyRunnerPort {
  private readonly headless: boolean;

  constructor(
    private readonly idGenerator: IdGeneratorPort,
    private readonly clock: ClockPort,
    options: PlaywrightStepInterpreterOptions = {},
  ) {
    this.headless = options.headless ?? true;
  }

  async run(journey: Journey, opts: RunOptions): Promise<JourneyRunResult> {
    const runId = this.idGenerator.generate();
    const startedAt = this.clock.now();
    const stepResults: StepResult[] = [];

    let browser: Browser | undefined;
    let context: BrowserContext | undefined;
    let tracePath: string | undefined;
    let runError: string | undefined;

    try {
      browser = await BROWSER_ENGINES[opts.browser].launch({ headless: this.headless });
      context = await browser.newContext(
        opts.storageStatePath !== undefined ? { storageState: opts.storageStatePath } : {},
      );

      if (opts.keepTrace) {
        await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
      }

      const page = await context.newPage();
      for (const step of orderedSteps(journey)) {
        stepResults.push(await this.executeStep(page, step));
      }

      if (opts.keepTrace) {
        await context.tracing.stop(opts.tracePath !== undefined ? { path: opts.tracePath } : {});
        tracePath = opts.tracePath;
      }
    } catch (error) {
      runError = errorMessageOf(error);
    } finally {
      // Best-effort teardown: a browser that will not close cleanly must not
      // discard the step results we already have.
      await context?.close().catch(() => undefined);
      await browser?.close().catch(() => undefined);
    }

    return createJourneyRunResult({
      id: runId,
      journeyId: journey.id,
      ...(journey.profileId !== undefined ? { profileId: journey.profileId } : {}),
      startedAt,
      finishedAt: this.clock.now(),
      stepResults,
      ...(tracePath !== undefined ? { tracePath } : {}),
      ...(runError !== undefined ? { error: runError } : {}),
    });
  }

  private async executeStep(page: Page, step: Step): Promise<StepResult> {
    const stepStartedAt = this.clock.now().getTime();

    try {
      await executeAction(page, step.action);
      return createStepResult({
        stepId: step.id,
        status: 'passed',
        durationMs: this.elapsedSince(stepStartedAt),
      });
    } catch (error) {
      return createStepResult({
        stepId: step.id,
        status: 'failed',
        durationMs: this.elapsedSince(stepStartedAt),
        errorMessage: errorMessageOf(error),
      });
    }
  }

  private elapsedSince(startMs: number): number {
    // A fake clock that never advances yields 0, which is valid; a clock that
    // somehow goes backwards must not produce a negative duration that the
    // domain would reject.
    return Math.max(0, this.clock.now().getTime() - startMs);
  }
}

/**
 * `Journey.steps` is ordered by the `order` field, not necessarily by array
 * position (the domain only guarantees the orders form 0..n-1), so playback
 * sorts before executing.
 */
function orderedSteps(journey: Journey): Step[] {
  return [...journey.steps].sort((a, b) => a.order - b.order);
}
