import { describe, expect, it, vi } from 'vitest';

import { createAction } from '../../domain/Action.js';
import { createJourney, type Journey } from '../../domain/Journey.js';
import { createStep } from '../../domain/Step.js';
import type { RecordJourneyInput } from '../../application/use-cases/RecordJourneyUseCase.js';
import { RecordJourneyController, type RecordJourneyUseCaseLike } from './RecordJourneyController.js';
import { JourneyPresenter } from './JourneyPresenter.js';

function buildJourney(): Journey {
  return createJourney({
    id: 'journey-1',
    name: 'Smoke test',
    startUrl: 'https://example.com',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    steps: [createStep({ id: 's1', order: 0, action: createAction({ kind: 'goto', url: 'https://example.com' }) })],
  });
}

class FakeRecordJourneyUseCase implements RecordJourneyUseCaseLike {
  readonly calls: RecordJourneyInput[] = [];
  constructor(private readonly result: Journey) {}

  async execute(input: RecordJourneyInput): Promise<Journey> {
    this.calls.push(input);
    return this.result;
  }
}

describe('RecordJourneyController', () => {
  it('maps the CLI options into the use case input DTO', async () => {
    const journey = buildJourney();
    const useCase = new FakeRecordJourneyUseCase(journey);
    const presenter = new JourneyPresenter();
    const controller = new RecordJourneyController(useCase, presenter);

    await controller.execute('https://example.com', {
      name: 'Smoke test',
      browser: 'firefox',
      profile: 'some-profile',
      viewport: { width: 1280, height: 720 },
      device: 'iPhone 13',
      colorScheme: 'dark',
      timezone: 'America/Sao_Paulo',
      lang: 'pt-BR',
      geolocation: { latitude: -23.5, longitude: -46.6 },
      quiet: true,
    });

    expect(useCase.calls).toHaveLength(1);
    expect(useCase.calls[0]).toEqual({
      startUrl: 'https://example.com',
      name: 'Smoke test',
      browser: 'firefox',
      profileId: 'some-profile',
      viewport: { width: 1280, height: 720 },
      device: 'iPhone 13',
      colorScheme: 'dark',
      timezone: 'America/Sao_Paulo',
      lang: 'pt-BR',
      geolocation: { latitude: -23.5, longitude: -46.6 },
    });
  });

  it('forwards --profile onto the use case input as profileId', async () => {
    const useCase = new FakeRecordJourneyUseCase(buildJourney());
    const controller = new RecordJourneyController(useCase, new JourneyPresenter());

    await controller.execute('https://example.com', {
      name: 'Smoke test',
      browser: 'chromium',
      profile: 'some-profile',
      quiet: true,
    });

    expect(useCase.calls[0]?.profileId).toBe('some-profile');
  });

  it('leaves profileId undefined when --profile is not given', async () => {
    const useCase = new FakeRecordJourneyUseCase(buildJourney());
    const controller = new RecordJourneyController(useCase, new JourneyPresenter());

    await controller.execute('https://example.com', { name: 'Smoke test', browser: 'chromium', quiet: true });

    expect(useCase.calls[0]?.profileId).toBeUndefined();
  });

  it('invokes the presenter with the recorded journey, human mode by default', async () => {
    const journey = buildJourney();
    const useCase = new FakeRecordJourneyUseCase(journey);
    const presenter = new JourneyPresenter();
    const presentSpy = vi.spyOn(presenter, 'present');
    const toJsonSpy = vi.spyOn(presenter, 'toJson');
    const controller = new RecordJourneyController(useCase, presenter);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await controller.execute('https://example.com', { name: 'Smoke test', browser: 'chromium' });

    expect(presentSpy).toHaveBeenCalledWith(journey);
    expect(toJsonSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);

    logSpy.mockRestore();
  });

  it('invokes the presenter in JSON mode when --json is set', async () => {
    const journey = buildJourney();
    const useCase = new FakeRecordJourneyUseCase(journey);
    const presenter = new JourneyPresenter();
    const presentSpy = vi.spyOn(presenter, 'present');
    const toJsonSpy = vi.spyOn(presenter, 'toJson');
    const controller = new RecordJourneyController(useCase, presenter);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await controller.execute('https://example.com', { name: 'Smoke test', browser: 'chromium', json: true });

    expect(toJsonSpy).toHaveBeenCalledWith(journey);
    expect(presentSpy).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it('prints nothing when --quiet is set', async () => {
    const useCase = new FakeRecordJourneyUseCase(buildJourney());
    const controller = new RecordJourneyController(useCase, new JourneyPresenter());
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await controller.execute('https://example.com', { name: 'Smoke test', browser: 'chromium', quiet: true });

    expect(logSpy).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it('propagates a use case error without swallowing it', async () => {
    const failingUseCase: RecordJourneyUseCaseLike = {
      execute: async () => {
        throw new Error('boom');
      },
    };
    const controller = new RecordJourneyController(failingUseCase, new JourneyPresenter());

    await expect(controller.execute('https://example.com', { name: 'x', browser: 'chromium' })).rejects.toThrow(
      'boom',
    );
  });
});
