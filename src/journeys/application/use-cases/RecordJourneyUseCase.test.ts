import { describe, expect, it } from 'vitest';
import { RecordJourneyUseCase } from './RecordJourneyUseCase.js';
import { FakeClock } from '../../../../test/unit/fakes/FakeClock.js';
import { FakeIdGenerator } from '../../../../test/unit/fakes/FakeIdGenerator.js';
import { FakeJourneyRecorderPort } from '../../../../test/unit/fakes/FakeJourneyRecorderPort.js';
import { FakeJourneyRepository } from '../../../../test/unit/fakes/FakeJourneyRepository.js';

describe('RecordJourneyUseCase', () => {
  it('records a draft, assigns ids/order/createdAt, saves and returns the journey', async () => {
    const recorder = new FakeJourneyRecorderPort();
    recorder.setNextResult({
      startUrl: 'https://example.com/start',
      steps: [
        { action: { kind: 'goto', url: 'https://example.com/start' } },
        { action: { kind: 'click', locator: { strategy: 'role', value: 'button' } }, label: 'Submit' },
      ],
    });
    const repository = new FakeJourneyRepository();
    const idGenerator = new FakeIdGenerator();
    const clock = new FakeClock(new Date('2026-03-01T12:00:00.000Z'));
    const useCase = new RecordJourneyUseCase(recorder, repository, idGenerator, clock);

    const journey = await useCase.execute({
      startUrl: 'https://example.com/start',
      name: 'Signup flow',
      browser: 'chromium',
    });

    expect(journey.id).toBe('id-3');
    expect(journey.name).toBe('Signup flow');
    expect(journey.startUrl).toBe('https://example.com/start');
    expect(journey.createdAt).toEqual(new Date('2026-03-01T12:00:00.000Z'));
    expect(journey.steps).toHaveLength(2);
    expect(journey.steps[0]?.id).toBe('id-1');
    expect(journey.steps[0]?.order).toBe(0);
    expect(journey.steps[1]?.id).toBe('id-2');
    expect(journey.steps[1]?.order).toBe(1);
    expect(journey.steps[1]?.label).toBe('Submit');

    await expect(repository.findById('id-3')).resolves.toEqual(journey);
  });

  it('forwards recording options to the recorder port', async () => {
    const recorder = new FakeJourneyRecorderPort();
    recorder.setNextResult({
      startUrl: 'https://example.com',
      steps: [{ action: { kind: 'goto', url: 'https://example.com' } }],
    });
    const useCase = new RecordJourneyUseCase(
      recorder,
      new FakeJourneyRepository(),
      new FakeIdGenerator(),
      new FakeClock(),
    );

    await useCase.execute({
      startUrl: 'https://example.com',
      name: 'Empty flow',
      browser: 'firefox',
      storageStatePath: '/tmp/state.json',
      viewport: { width: 1280, height: 720 },
      timezone: 'America/Sao_Paulo',
    });

    expect(recorder.calls).toHaveLength(1);
    expect(recorder.calls[0]).toMatchObject({
      startUrl: 'https://example.com',
      browser: 'firefox',
      storageStatePath: '/tmp/state.json',
      viewport: { width: 1280, height: 720 },
      timezone: 'America/Sao_Paulo',
    });
  });
});
