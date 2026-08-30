import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PlaywrightStepInterpreter } from '../../src/journeys/adapters/execution/PlaywrightStepInterpreter.js';
import type { SupportedBrowser } from '../../src/journeys/application/ports/JourneyRunnerPort.js';
import { createAction, type CreateActionInput } from '../../src/journeys/domain/Action.js';
import { createJourney, type Journey } from '../../src/journeys/domain/Journey.js';
import { createStep, type Step } from '../../src/journeys/domain/Step.js';
import type { ClockPort } from '../../src/shared-kernel/application/ports/ClockPort.js';
import type { IdGeneratorPort } from '../../src/shared-kernel/application/ports/IdGeneratorPort.js';
import { pagesFixtureDir } from './helpers/fixtures.js';
import { startStaticServer, type StaticServer } from './helpers/staticServer.js';

const BROWSERS: readonly SupportedBrowser[] = ['chromium', 'firefox', 'webkit'];

let server: StaticServer;

beforeAll(async () => {
  server = await startStaticServer(pagesFixtureDir);
});

afterAll(async () => {
  await server.close();
});

/** A real (not fake) clock: the interpreter reads time only through this port. */
const systemClock: ClockPort = { now: () => new Date() };

function sequentialIds(prefix: string): IdGeneratorPort {
  let next = 0;
  return { generate: () => `${prefix}-${++next}` };
}

function interpreter(): PlaywrightStepInterpreter {
  return new PlaywrightStepInterpreter(sequentialIds('run'), systemClock, { headless: true });
}

/** Builds a journey whose step ids are `s1..sn`, in the order given. */
function journeyOf(...actions: CreateActionInput[]): Journey {
  const steps: Step[] = actions.map((action, index) =>
    createStep({ id: `s${index + 1}`, order: index, action: createAction(action) }),
  );
  return createJourney({
    id: 'journey-under-test',
    name: 'Fixture journey',
    startUrl: `${server.origin}/landing.html`,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    steps,
  });
}

describe.each(BROWSERS)('PlaywrightStepInterpreter on %s', (browser) => {
  it('executes every action kind against a real page', async () => {
    const journey = journeyOf(
      { kind: 'goto', url: `${server.origin}/landing.html` },
      { kind: 'assertVisible', locator: { strategy: 'role', value: 'heading', options: { name: 'QAMachine fixtures' } } },
      { kind: 'click', locator: { strategy: 'role', value: 'link', options: { name: 'Open the sign-up form' } } },
      { kind: 'assertVisible', locator: { strategy: 'role', value: 'heading', options: { name: 'Sign up' } } },
      { kind: 'fill', locator: { strategy: 'label', value: 'Email' }, value: 'ada@example.com' },
      { kind: 'assertValue', locator: { strategy: 'placeholder', value: 'you@example.com' }, expected: 'ada@example.com' },
      { kind: 'press', locator: { strategy: 'label', value: 'Email' }, key: 'Enter' },
      { kind: 'assertText', locator: { strategy: 'testId', value: 'status' }, expected: 'Submitted with Enter' },
      { kind: 'check', locator: { strategy: 'label', value: 'Newsletter' } },
      { kind: 'uncheck', locator: { strategy: 'label', value: 'Newsletter' } },
      { kind: 'selectOption', locator: { strategy: 'label', value: 'Country' }, value: 'pt' },
      { kind: 'hover', locator: { strategy: 'css', value: '#hover-target' } },
      { kind: 'assertText', locator: { strategy: 'css', value: '#hover-output' }, expected: 'hovered' },
      { kind: 'click', locator: { strategy: 'role', value: 'button', options: { name: 'Create account' } } },
      { kind: 'assertText', locator: { strategy: 'testId', value: 'status' }, expected: 'Account created' },
      { kind: 'assertVisible', locator: { strategy: 'altText', value: 'Company logo' } },
      { kind: 'assertVisible', locator: { strategy: 'title', value: 'Get help' } },
      { kind: 'assertVisible', locator: { strategy: 'text', value: 'Hover me' } },
    );

    const result = await interpreter().run(journey, { browser, keepTrace: false });

    const failures = result.stepResults.filter((step) => step.status === 'failed');
    expect(failures.map((step) => `${step.stepId}: ${step.errorMessage ?? ''}`)).toEqual([]);
    expect(result.stepResults).toHaveLength(journey.steps.length);
    expect(result.status).toBe('passed');
    expect(result.journeyId).toBe('journey-under-test');
    expect(result.id).toBe('run-1');
  });

  it('covers all eight locator strategies in one run', async () => {
    const journey = journeyOf(
      { kind: 'goto', url: `${server.origin}/form.html` },
      { kind: 'assertVisible', locator: { strategy: 'role', value: 'heading', options: { name: 'Sign up' } } },
      { kind: 'assertText', locator: { strategy: 'testId', value: 'status' }, expected: 'Not submitted' },
      { kind: 'assertVisible', locator: { strategy: 'text', value: 'Hover me' } },
      { kind: 'assertVisible', locator: { strategy: 'label', value: 'Email' } },
      { kind: 'assertVisible', locator: { strategy: 'placeholder', value: 'you@example.com' } },
      { kind: 'assertVisible', locator: { strategy: 'altText', value: 'Company logo' } },
      { kind: 'assertVisible', locator: { strategy: 'title', value: 'Get help' } },
      { kind: 'assertVisible', locator: { strategy: 'css', value: '#hover-output' } },
    );

    const result = await interpreter().run(journey, { browser, keepTrace: false });

    expect(result.stepResults.map((step) => step.status)).toEqual(Array(9).fill('passed'));
  });

  it('runs every step even after one fails, and reports the failure with a message', async () => {
    const journey = journeyOf(
      { kind: 'goto', url: `${server.origin}/form.html` },
      { kind: 'assertText', locator: { strategy: 'testId', value: 'status' }, expected: 'This will never match' },
      { kind: 'click', locator: { strategy: 'role', value: 'button', options: { name: 'Create account' } } },
      { kind: 'assertText', locator: { strategy: 'testId', value: 'status' }, expected: 'Account created' },
    );

    const result = await interpreter().run(journey, { browser, keepTrace: false });

    expect(result.stepResults.map((step) => step.status)).toEqual(['passed', 'failed', 'passed', 'passed']);
    expect(result.stepResults.map((step) => step.stepId)).toEqual(['s1', 's2', 's3', 's4']);
    expect(result.stepResults[1]?.errorMessage).toBeTruthy();
    expect(result.stepResults[1]?.errorMessage).toContain('This will never match');
    expect(result.status).toBe('failed');
    expect(result.error).toBeUndefined();
  });
});

describe('PlaywrightStepInterpreter (chromium-only behaviours)', () => {
  it('replays steps in `order`, not in array position', async () => {
    const outOfOrder = createJourney({
      id: 'ordering',
      name: 'Out-of-order steps',
      startUrl: `${server.origin}/form.html`,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      steps: [
        createStep({
          id: 'second',
          order: 1,
          action: createAction({
            kind: 'assertText',
            locator: { strategy: 'testId', value: 'status' },
            expected: 'Not submitted',
          }),
        }),
        createStep({
          id: 'first',
          order: 0,
          action: createAction({ kind: 'goto', url: `${server.origin}/form.html` }),
        }),
      ],
    });

    const result = await interpreter().run(outOfOrder, { browser: 'chromium', keepTrace: false });

    expect(result.stepResults.map((step) => step.stepId)).toEqual(['first', 'second']);
    expect(result.status).toBe('passed');
  });

  it('writes a trace archive when one is requested', async () => {
    const traceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qamachine-trace-'));
    const tracePath = path.join(traceDir, 'run.zip');

    try {
      const journey = journeyOf({ kind: 'goto', url: `${server.origin}/landing.html` });
      const result = await interpreter().run(journey, { browser: 'chromium', keepTrace: true, tracePath });

      expect(result.tracePath).toBe(tracePath);
      expect((await fs.stat(tracePath)).size).toBeGreaterThan(0);
      expect(result.status).toBe('passed');
    } finally {
      await fs.rm(traceDir, { recursive: true, force: true });
    }
  });

  it('captures storageState to captureStorageStatePath when requested', async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qamachine-storage-state-'));
    const capturePath = path.join(stateDir, 'state.json');

    try {
      const journey = journeyOf({ kind: 'goto', url: `${server.origin}/landing.html` });
      const result = await interpreter().run(journey, {
        browser: 'chromium',
        keepTrace: false,
        captureStorageStatePath: capturePath,
      });

      expect(result.status).toBe('passed');
      const raw = await fs.readFile(capturePath, 'utf8');
      const parsed = JSON.parse(raw) as { cookies: unknown[]; origins: unknown[] };
      expect(Array.isArray(parsed.cookies)).toBe(true);
      expect(Array.isArray(parsed.origins)).toBe(true);
    } finally {
      await fs.rm(stateDir, { recursive: true, force: true });
    }
  });

  it('does not write captureStorageStatePath when a step fails', async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qamachine-storage-state-'));
    const capturePath = path.join(stateDir, 'state.json');

    try {
      const journey = journeyOf(
        { kind: 'goto', url: `${server.origin}/form.html` },
        { kind: 'assertText', locator: { strategy: 'testId', value: 'status' }, expected: 'This will never match' },
      );
      const result = await interpreter().run(journey, {
        browser: 'chromium',
        keepTrace: false,
        captureStorageStatePath: capturePath,
      });

      expect(result.status).toBe('failed');
      await expect(fs.access(capturePath)).rejects.toThrow();
    } finally {
      await fs.rm(stateDir, { recursive: true, force: true });
    }
  });

  it('leaves a pre-existing captureStorageStatePath file untouched when a step fails', async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qamachine-storage-state-'));
    const capturePath = path.join(stateDir, 'state.json');
    const preExistingContent = JSON.stringify({ cookies: [{ name: 'session', value: 'still-good' }], origins: [] });
    await fs.writeFile(capturePath, preExistingContent, 'utf8');

    try {
      const journey = journeyOf(
        { kind: 'goto', url: `${server.origin}/form.html` },
        { kind: 'assertText', locator: { strategy: 'testId', value: 'status' }, expected: 'This will never match' },
      );
      const result = await interpreter().run(journey, {
        browser: 'chromium',
        keepTrace: false,
        captureStorageStatePath: capturePath,
      });

      expect(result.status).toBe('failed');
      expect(await fs.readFile(capturePath, 'utf8')).toBe(preExistingContent);
    } finally {
      await fs.rm(stateDir, { recursive: true, force: true });
    }
  });

  it('reports a launch-time failure as a top-level run error, not as a passed run', async () => {
    const journey = journeyOf({ kind: 'goto', url: `${server.origin}/landing.html` });

    const result = await interpreter().run(journey, {
      browser: 'chromium',
      keepTrace: false,
      storageStatePath: path.join(os.tmpdir(), 'qamachine-does-not-exist.json'),
    });

    expect(result.stepResults).toEqual([]);
    expect(result.error).toBeTruthy();
    expect(result.status).toBe('failed');
  });
});
