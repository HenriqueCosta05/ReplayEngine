import { describe, expect, it, vi } from 'vitest';

import { createAction } from '../../domain/Action.js';
import { createJourney, type Journey } from '../../domain/Journey.js';
import { createStep } from '../../domain/Step.js';
import {
  JourneyController,
  type DeleteJourneyUseCaseLike,
  type ListJourneysUseCaseLike,
  type ShowJourneyUseCaseLike,
} from './JourneyController.js';
import { JourneyPresenter } from './JourneyPresenter.js';

function buildJourney(id: string): Journey {
  return createJourney({
    id,
    name: `Journey ${id}`,
    startUrl: 'https://example.com',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    steps: [createStep({ id: 's1', order: 0, action: createAction({ kind: 'goto', url: 'https://example.com' }) })],
  });
}

class FakeListJourneysUseCase implements ListJourneysUseCaseLike {
  calls = 0;
  constructor(private readonly result: Journey[]) {}
  async execute(): Promise<Journey[]> {
    this.calls += 1;
    return this.result;
  }
}

class FakeShowJourneyUseCase implements ShowJourneyUseCaseLike {
  readonly calls: string[] = [];
  constructor(private readonly result: Journey) {}
  async execute(id: string): Promise<Journey> {
    this.calls.push(id);
    return this.result;
  }
}

class FakeDeleteJourneyUseCase implements DeleteJourneyUseCaseLike {
  readonly calls: string[] = [];
  async execute(id: string): Promise<void> {
    this.calls.push(id);
  }
}

function buildController(journeys: Journey[] = [], one: Journey = buildJourney('journey-1')) {
  const listUseCase = new FakeListJourneysUseCase(journeys);
  const showUseCase = new FakeShowJourneyUseCase(one);
  const deleteUseCase = new FakeDeleteJourneyUseCase();
  const presenter = new JourneyPresenter();
  const controller = new JourneyController(listUseCase, showUseCase, deleteUseCase, presenter);
  return { controller, listUseCase, showUseCase, deleteUseCase, presenter };
}

describe('JourneyController', () => {
  describe('list', () => {
    it('calls ListJourneysUseCase and presents the result as a table by default', async () => {
      const journeys = [buildJourney('journey-1'), buildJourney('journey-2')];
      const { controller, listUseCase, presenter } = buildController(journeys);
      const presentListSpy = vi.spyOn(presenter, 'presentList');
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await controller.list({});

      expect(listUseCase.calls).toBe(1);
      expect(presentListSpy).toHaveBeenCalledWith(journeys);
      expect(logSpy).toHaveBeenCalledTimes(1);
      logSpy.mockRestore();
    });

    it('presents JSON when --json is set', async () => {
      const journeys = [buildJourney('journey-1')];
      const { controller, presenter } = buildController(journeys);
      const toJsonSpy = vi.spyOn(presenter, 'toJson');
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await controller.list({ json: true });

      expect(toJsonSpy).toHaveBeenCalledWith(journeys);
      logSpy.mockRestore();
    });

    it('prints nothing when --quiet is set', async () => {
      const { controller } = buildController([buildJourney('journey-1')]);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await controller.list({ quiet: true });

      expect(logSpy).not.toHaveBeenCalled();
      logSpy.mockRestore();
    });
  });

  describe('show', () => {
    it('calls ShowJourneyUseCase with the given id and presents the journey', async () => {
      const journey = buildJourney('journey-42');
      const { controller, showUseCase, presenter } = buildController([], journey);
      const presentSpy = vi.spyOn(presenter, 'present');
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await controller.show('journey-42', {});

      expect(showUseCase.calls).toEqual(['journey-42']);
      expect(presentSpy).toHaveBeenCalledWith(journey);
      logSpy.mockRestore();
    });

    it('propagates a NotFoundError without swallowing it', async () => {
      class ThrowingShowUseCase implements ShowJourneyUseCaseLike {
        async execute(): Promise<Journey> {
          throw new Error('not found');
        }
      }
      const controller = new JourneyController(
        new FakeListJourneysUseCase([]),
        new ThrowingShowUseCase(),
        new FakeDeleteJourneyUseCase(),
        new JourneyPresenter(),
      );

      await expect(controller.show('missing', {})).rejects.toThrow('not found');
    });
  });

  describe('delete', () => {
    it('calls DeleteJourneyUseCase with the given id and prints a confirmation', async () => {
      const { controller, deleteUseCase } = buildController();
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await controller.delete('journey-1', {});

      expect(deleteUseCase.calls).toEqual(['journey-1']);
      expect(logSpy).toHaveBeenCalledWith('Deleted journey journey-1.');
      logSpy.mockRestore();
    });

    it('prints JSON confirmation when --json is set', async () => {
      const { controller } = buildController();
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      await controller.delete('journey-1', { json: true });

      expect(logSpy).toHaveBeenCalledWith(JSON.stringify({ deleted: 'journey-1' }));
      logSpy.mockRestore();
    });
  });
});
