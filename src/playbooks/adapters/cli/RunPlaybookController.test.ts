import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { createPlaybookRunResult, type PlaybookRunResult } from '../../domain/PlaybookRunResult.js';
import type { RunPlaybookInput } from '../../application/use-cases/RunPlaybookUseCase.js';
import { RunPlaybookController, type RunPlaybookUseCaseLike } from './RunPlaybookController.js';
import { PlaybookRunPresenter } from './PlaybookRunPresenter.js';

function buildResult(status: 'passed' | 'failed'): PlaybookRunResult {
  return createPlaybookRunResult({
    id: 'run-1',
    playbookId: 'playbook-1',
    startedAt: new Date('2026-01-01T00:00:00.000Z'),
    finishedAt: new Date('2026-01-01T00:00:05.000Z'),
    entryResults: [
      {
        entryId: 'entry-1',
        status,
        stepResults: [],
        ...(status === 'failed' ? { error: 'boom' } : {}),
      },
    ],
  });
}

class FakeRunPlaybookUseCase implements RunPlaybookUseCaseLike {
  readonly calls: RunPlaybookInput[] = [];
  constructor(private readonly result: PlaybookRunResult) {}

  async execute(input: RunPlaybookInput): Promise<PlaybookRunResult> {
    this.calls.push(input);
    return this.result;
  }
}

const TRACES_DIR = path.join('home', 'traces');

describe('RunPlaybookController', () => {
  it('maps the CLI options into the use case input DTO', async () => {
    const useCase = new FakeRunPlaybookUseCase(buildResult('passed'));
    const controller = new RunPlaybookController(useCase, new PlaybookRunPresenter(), TRACES_DIR);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await controller.execute('playbook-1', {
      browser: 'webkit',
      keepTrace: false,
      stopOnFirstFailure: true,
    });

    expect(useCase.calls).toHaveLength(1);
    expect(useCase.calls[0]).toMatchObject({
      playbookId: 'playbook-1',
      browser: 'webkit',
      keepTrace: false,
      stopOnFirstFailure: true,
    });
    expect(useCase.calls[0]?.tracePathFor).toBeUndefined();

    logSpy.mockRestore();
  });

  it('derives a per-entry tracePathFor under the traces directory when --keep-trace is set', async () => {
    const useCase = new FakeRunPlaybookUseCase(buildResult('passed'));
    const controller = new RunPlaybookController(useCase, new PlaybookRunPresenter(), TRACES_DIR);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await controller.execute('playbook-1', { browser: 'chromium', keepTrace: true });

    const tracePathFor = useCase.calls[0]?.tracePathFor;
    expect(tracePathFor).toBeDefined();
    const tracePath = tracePathFor?.('entry-1');
    expect(tracePath?.startsWith(TRACES_DIR)).toBe(true);
    expect(tracePath?.endsWith('.zip')).toBe(true);
    expect(tracePath).toContain('playbook-1');
    expect(tracePath).toContain('entry-1');

    logSpy.mockRestore();
  });

  it('invokes the presenter with the run result, human mode by default', async () => {
    const result = buildResult('passed');
    const useCase = new FakeRunPlaybookUseCase(result);
    const presenter = new PlaybookRunPresenter();
    const presentSpy = vi.spyOn(presenter, 'present');
    const controller = new RunPlaybookController(useCase, presenter, TRACES_DIR);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await controller.execute('playbook-1', { browser: 'chromium', keepTrace: false });

    expect(presentSpy).toHaveBeenCalledWith(result);
    logSpy.mockRestore();
  });

  it('invokes the presenter in JSON mode when --json is set', async () => {
    const result = buildResult('passed');
    const useCase = new FakeRunPlaybookUseCase(result);
    const presenter = new PlaybookRunPresenter();
    const toJsonSpy = vi.spyOn(presenter, 'toJson');
    const controller = new RunPlaybookController(useCase, presenter, TRACES_DIR);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await controller.execute('playbook-1', { browser: 'chromium', keepTrace: false, json: true });

    expect(toJsonSpy).toHaveBeenCalledWith(result);
    logSpy.mockRestore();
  });

  it('prints nothing when --quiet is set', async () => {
    const useCase = new FakeRunPlaybookUseCase(buildResult('failed'));
    const controller = new RunPlaybookController(useCase, new PlaybookRunPresenter(), TRACES_DIR);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await controller.execute('playbook-1', { browser: 'chromium', keepTrace: false, quiet: true });

    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('leaves process.exitCode untouched when the run result overallStatus is failed - a playbook run\'s own pass/fail is data in the output, not a CLI-level failure (unlike journey/template run)', async () => {
    const useCase = new FakeRunPlaybookUseCase(buildResult('failed'));
    const controller = new RunPlaybookController(useCase, new PlaybookRunPresenter(), TRACES_DIR);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const originalExitCode = process.exitCode;
    process.exitCode = 0;

    await controller.execute('playbook-1', { browser: 'chromium', keepTrace: false });

    expect(process.exitCode).toBe(0);

    process.exitCode = originalExitCode;
    logSpy.mockRestore();
  });

  it('leaves process.exitCode untouched when the run result overallStatus is passed', async () => {
    const useCase = new FakeRunPlaybookUseCase(buildResult('passed'));
    const controller = new RunPlaybookController(useCase, new PlaybookRunPresenter(), TRACES_DIR);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const originalExitCode = process.exitCode;
    process.exitCode = 0;

    await controller.execute('playbook-1', { browser: 'chromium', keepTrace: false });

    expect(process.exitCode).toBe(0);

    process.exitCode = originalExitCode;
    logSpy.mockRestore();
  });

  it('propagates a use case error (e.g. NotFoundError) without swallowing it, letting the CLI-level catch-all set the exit code', async () => {
    const failingUseCase: RunPlaybookUseCaseLike = {
      execute: async () => {
        throw new Error('not found');
      },
    };
    const controller = new RunPlaybookController(failingUseCase, new PlaybookRunPresenter(), TRACES_DIR);

    await expect(
      controller.execute('missing', { browser: 'chromium', keepTrace: false }),
    ).rejects.toThrow('not found');
  });
});
