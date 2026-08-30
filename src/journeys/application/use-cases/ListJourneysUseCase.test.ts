import { describe, expect, it } from 'vitest';
import { createAction } from '../../domain/Action.js';
import { createJourney } from '../../domain/Journey.js';
import { createStep } from '../../domain/Step.js';
import { ListJourneysUseCase } from './ListJourneysUseCase.js';
import { FakeJourneyRepository } from '../../../../test/unit/fakes/FakeJourneyRepository.js';

function buildJourney(id: string) {
  const gotoAction = createAction({ kind: 'goto', url: 'https://example.com' });
  return createJourney({
    id,
    name: `Journey ${id}`,
    startUrl: 'https://example.com',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    steps: [createStep({ id: 's1', order: 0, action: gotoAction })],
  });
}

describe('ListJourneysUseCase', () => {
  it('returns all journeys from the repository', async () => {
    const repository = new FakeJourneyRepository();
    await repository.save(buildJourney('journey-1'));
    await repository.save(buildJourney('journey-2'));

    const useCase = new ListJourneysUseCase(repository);

    const journeys = await useCase.execute();

    expect(journeys).toHaveLength(2);
    expect(journeys.map((journey) => journey.id).sort()).toEqual(['journey-1', 'journey-2']);
  });

  it('returns an empty array when there are no journeys', async () => {
    const useCase = new ListJourneysUseCase(new FakeJourneyRepository());

    await expect(useCase.execute()).resolves.toEqual([]);
  });
});
