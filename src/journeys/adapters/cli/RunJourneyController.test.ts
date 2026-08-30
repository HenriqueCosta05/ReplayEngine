import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { createJourneyRunResult, type JourneyRunResult } from '../../domain/JourneyRunResult.js';
import { createStepResult } from '../../domain/StepResult.js';
import type { RunJourneyInput } from '../../application/use-cases/RunJourneyUseCase.js';
import { RunJourneyController, type RunJourneyUseCaseLike } from './RunJourneyController.js';
import { JourneyRunPresenter } from './JourneyRunPresenter.js';

function buildResult(status: 'passed' | 'failed'): JourneyRunResult {
  return createJourneyRunResult({
    id: 'run-1',
    journeyId: 'journey-1',
    startedAt: new Date('2026-01-01T00:00:00.000Z'),
    finishedAt: new Date('2026-01-01T00:00:05.000Z'),
    stepResults: [
      createStepResult({
        stepId: 's1',
        status,
        durationMs: 5000,
        ...(status === 'failed' ? { errorMessage: 'boom' } : {}),
      }),
    ],
  });
}

class FakeRunJourneyUseCase implements RunJourneyUseCaseLike {
  readonly calls: RunJourneyInput[] = [];
  constructor(private readonly result: JourneyRunResult) {}

  async execute(input: RunJourneyInput): Promise<JourneyRunResult> {
    this.calls.push(input);
    return this.result;
  }
}

const TRACES_DIR = path.join('home', 'traces');

describe('RunJourneyController', () => {
  it('maps the CLI options into the use case input DTO', async () => {
    const useCase = new FakeRunJourneyUseCase(buildResult('passed'));
    const controller = new RunJourneyController(useCase, new JourneyRunPresenter(), TRACES_DIR);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await controller.execute('journey-1', { browser: 'webkit', keepTrace: false, profile: 'some-profile' });

    expect(useCase.calls).toHaveLength(1);
    expect(useCase.calls[0]).toMatchObject({
      journeyId: 'journey-1',
      browser: 'webkit',
      keepTrace: false,
      profileId: 'some-profile',
    });
    expect(useCase.calls[0]?.tracePath).toBeUndefined();

    logSpy.mockRestore();
  });

  it('leaves profileId undefined when --profile is not given', async () => {
    const useCase = new FakeRunJourneyUseCase(buildResult('passed'));
    const controller = new RunJourneyController(useCase, new JourneyRunPresenter(), TRACES_DIR);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await controller.execute('journey-1', { browser: 'chromium', keepTrace: false });

    expect(useCase.calls[0]?.profileId).toBeUndefined();

    logSpy.mockRestore();
  });

  it('derives a tracePath under the traces directory when --keep-trace is set', async () => {
    const useCase = new FakeRunJourneyUseCase(buildResult('passed'));
    const controller = new RunJourneyController(useCase, new JourneyRunPresenter(), TRACES_DIR);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await controller.execute('journey-1', { browser: 'chromium', keepTrace: true });

    const tracePath = useCase.calls[0]?.tracePath;
    expect(tracePath).toBeDefined();
    expect(tracePath?.startsWith(TRACES_DIR)).toBe(true);
    expect(tracePath?.endsWith('.zip')).toBe(true);
    expect(tracePath).toContain('journey-1');

    logSpy.mockRestore();
  });

  it('invokes the presenter with the run result, human mode by default', async () => {
    const result = buildResult('passed');
    const useCase = new FakeRunJourneyUseCase(result);
    const presenter = new JourneyRunPresenter();
    const presentSpy = vi.spyOn(presenter, 'present');
    const controller = new RunJourneyController(useCase, presenter, TRACES_DIR);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await controller.execute('journey-1', { browser: 'chromium', keepTrace: false });

    expect(presentSpy).toHaveBeenCalledWith(result);
    logSpy.mockRestore();
  });

  it('invokes the presenter in JSON mode when --json is set', async () => {
    const result = buildResult('passed');
    const useCase = new FakeRunJourneyUseCase(result);
    const presenter = new JourneyRunPresenter();
    const toJsonSpy = vi.spyOn(presenter, 'toJson');
    const controller = new RunJourneyController(useCase, presenter, TRACES_DIR);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await controller.execute('journey-1', { browser: 'chromium', keepTrace: false, json: true });

    expect(toJsonSpy).toHaveBeenCalledWith(result);
    logSpy.mockRestore();
  });

  it('prints nothing when --quiet is set, but still reports the result via exit code', async () => {
    const useCase = new FakeRunJourneyUseCase(buildResult('failed'));
    const controller = new RunJourneyController(useCase, new JourneyRunPresenter(), TRACES_DIR);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const originalExitCode = process.exitCode;

    await controller.execute('journey-1', { browser: 'chromium', keepTrace: false, quiet: true });

    expect(logSpy).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);

    process.exitCode = originalExitCode;
    logSpy.mockRestore();
  });

  it('sets process.exitCode = 1 when the run result status is failed', async () => {
    const useCase = new FakeRunJourneyUseCase(buildResult('failed'));
    const controller = new RunJourneyController(useCase, new JourneyRunPresenter(), TRACES_DIR);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const originalExitCode = process.exitCode;

    await controller.execute('journey-1', { browser: 'chromium', keepTrace: false });

    expect(process.exitCode).toBe(1);

    process.exitCode = originalExitCode;
    logSpy.mockRestore();
  });

  it('leaves process.exitCode untouched when the run result status is passed', async () => {
    const useCase = new FakeRunJourneyUseCase(buildResult('passed'));
    const controller = new RunJourneyController(useCase, new JourneyRunPresenter(), TRACES_DIR);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const originalExitCode = process.exitCode;
    process.exitCode = 0;

    await controller.execute('journey-1', { browser: 'chromium', keepTrace: false });

    expect(process.exitCode).toBe(0);

    process.exitCode = originalExitCode;
    logSpy.mockRestore();
  });

  it('propagates a use case error (e.g. NotFoundError) without swallowing it', async () => {
    const failingUseCase: RunJourneyUseCaseLike = {
      execute: async () => {
        throw new Error('not found');
      },
    };
    const controller = new RunJourneyController(failingUseCase, new JourneyRunPresenter(), TRACES_DIR);

    await expect(
      controller.execute('missing', { browser: 'chromium', keepTrace: false }),
    ).rejects.toThrow('not found');
  });
});
