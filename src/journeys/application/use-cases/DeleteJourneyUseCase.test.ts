import { describe, expect, it } from 'vitest';
import { createAction } from '../../domain/Action.js';
import { createJourney } from '../../domain/Journey.js';
import { createStep } from '../../domain/Step.js';
import { DeleteJourneyUseCase } from './DeleteJourneyUseCase.js';
import { FakeJourneyRepository } from '../../../../test/unit/fakes/FakeJourneyRepository.js';
import { NotFoundError } from '../../../shared-kernel/application/errors.js';

describe('DeleteJourneyUseCase', () => {
  it('deletes the journey when it exists', async () => {
    const repository = new FakeJourneyRepository();
    const gotoAction = createAction({ kind: 'goto', url: 'https://example.com' });
    const journey = createJourney({
      id: 'journey-1',
      name: 'Login flow',
      startUrl: 'https://example.com',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      steps: [createStep({ id: 's1', order: 0, action: gotoAction })],
    });
    await repository.save(journey);

    const useCase = new DeleteJourneyUseCase(repository);
    await useCase.execute('journey-1');

    await expect(repository.findById('journey-1')).resolves.toBeNull();
  });

  it('throws NotFoundError when the journey does not exist', async () => {
    const useCase = new DeleteJourneyUseCase(new FakeJourneyRepository());

    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundError);
  });
});
