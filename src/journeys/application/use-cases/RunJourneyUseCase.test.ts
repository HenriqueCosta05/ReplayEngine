import { describe, expect, it } from 'vitest';
import { createAction } from '../../domain/Action.js';
import { createJourney } from '../../domain/Journey.js';
import { createStep } from '../../domain/Step.js';
import { createStepResult } from '../../domain/StepResult.js';
import { createJourneyRunResult } from '../../domain/JourneyRunResult.js';
import { RunJourneyUseCase } from './RunJourneyUseCase.js';
import { FakeJourneyRepository } from '../../../../test/unit/fakes/FakeJourneyRepository.js';
import { FakeJourneyRunnerPort } from '../../../../test/unit/fakes/FakeJourneyRunnerPort.js';
import { NotFoundError } from '../../../shared-kernel/application/errors.js';

function buildJourney() {
  const gotoAction = createAction({ kind: 'goto', url: 'https://example.com' });
  return createJourney({
    id: 'journey-1',
    name: 'Login flow',
    startUrl: 'https://example.com',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    steps: [createStep({ id: 's1', order: 0, action: gotoAction })],
  });
}

describe('RunJourneyUseCase', () => {
  it('loads the journey, runs it via the runner port, and returns the result unpersisted', async () => {
    const repository = new FakeJourneyRepository();
    const journey = buildJourney();
    await repository.save(journey);

    const runner = new FakeJourneyRunnerPort();
    const expectedResult = createJourneyRunResult({
      id: 'run-1',
      journeyId: journey.id,
      startedAt: new Date('2026-01-02T00:00:00.000Z'),
      finishedAt: new Date('2026-01-02T00:00:05.000Z'),
      stepResults: [createStepResult({ stepId: 's1', status: 'passed', durationMs: 5000 })],
    });
    runner.setNextResult(expectedResult);

    const useCase = new RunJourneyUseCase(repository, runner);

    const result = await useCase.execute({
      journeyId: journey.id,
      browser: 'chromium',
      keepTrace: false,
    });

    expect(result).toBe(expectedResult);
    expect(runner.calls).toHaveLength(1);
    expect(runner.calls[0]?.journey).toBe(journey);
    expect(runner.calls[0]?.opts).toMatchObject({ browser: 'chromium', keepTrace: false });
  });

  it('throws NotFoundError when the journey does not exist', async () => {
    const repository = new FakeJourneyRepository();
    const runner = new FakeJourneyRunnerPort();
    const useCase = new RunJourneyUseCase(repository, runner);

    await expect(
      useCase.execute({ journeyId: 'missing', browser: 'chromium', keepTrace: false }),
    ).rejects.toThrow(NotFoundError);
    expect(runner.calls).toHaveLength(0);
  });
});
