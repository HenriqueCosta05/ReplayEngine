import { describe, expect, it } from 'vitest';
import { createAction } from '../../../journeys/domain/Action.js';
import { createLocator } from '../../../journeys/domain/Locator.js';
import { createJourney } from '../../../journeys/domain/Journey.js';
import { createStep } from '../../../journeys/domain/Step.js';
import { CreateTemplateFromJourneyUseCase } from './CreateTemplateFromJourneyUseCase.js';
import { DomainError } from '../../domain/errors.js';
import { FakeClock } from '../../../../test/unit/fakes/FakeClock.js';
import { FakeIdGenerator } from '../../../../test/unit/fakes/FakeIdGenerator.js';
import { FakeJourneyRepository } from '../../../../test/unit/fakes/FakeJourneyRepository.js';
import { FakeTemplateRepository } from '../../../../test/unit/fakes/FakeTemplateRepository.js';
import { NotFoundError } from '../../../shared-kernel/application/errors.js';

function buildJourney() {
  const gotoAction = createAction({ kind: 'goto', url: 'https://example.com' });
  const fillAction = createAction({
    kind: 'fill',
    locator: createLocator({ strategy: 'testId', value: 'username' }),
    value: 'placeholder',
  });
  return createJourney({
    id: 'journey-1',
    name: 'Login flow',
    startUrl: 'https://example.com',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    steps: [
      createStep({ id: 's1', order: 0, action: gotoAction }),
      createStep({ id: 's2', order: 1, action: fillAction }),
    ],
  });
}

function buildUseCase() {
  const journeyRepository = new FakeJourneyRepository();
  const templateRepository = new FakeTemplateRepository();
  const idGenerator = new FakeIdGenerator();
  const clock = new FakeClock(new Date('2026-02-01T00:00:00.000Z'));
  const useCase = new CreateTemplateFromJourneyUseCase(journeyRepository, templateRepository, idGenerator, clock);
  return { journeyRepository, templateRepository, idGenerator, clock, useCase };
}

describe('CreateTemplateFromJourneyUseCase', () => {
  it('snapshots the journey steps/startUrl and saves the template', async () => {
    const { journeyRepository, templateRepository, useCase } = buildUseCase();
    const journey = buildJourney();
    await journeyRepository.save(journey);

    const template = await useCase.execute({ journeyId: journey.id, name: 'Login template', parameters: [] });

    expect(template.name).toBe('Login template');
    expect(template.startUrl).toBe(journey.startUrl);
    expect(template.steps).toHaveLength(2);
    await expect(templateRepository.findById(template.id)).resolves.toEqual(template);
  });

  it('resolves targetStepIndex (0-based, matching Step.order) to the actual step id', async () => {
    const { journeyRepository, useCase } = buildUseCase();
    const journey = buildJourney();
    await journeyRepository.save(journey);

    const template = await useCase.execute({
      journeyId: journey.id,
      name: 'Login template',
      parameters: [{ targetStepIndex: 1, targetField: 'value', name: 'username', required: true }],
    });

    expect(template.parameters).toHaveLength(1);
    expect(template.parameters[0]?.targetStepId).toBe('s2');
  });

  it('throws NotFoundError when the journey does not exist', async () => {
    const { useCase } = buildUseCase();

    await expect(
      useCase.execute({ journeyId: 'missing', name: 'Login template', parameters: [] }),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError when a parameter targets a step index out of range', async () => {
    const { journeyRepository, useCase } = buildUseCase();
    const journey = buildJourney();
    await journeyRepository.save(journey);

    await expect(
      useCase.execute({
        journeyId: journey.id,
        name: 'Login template',
        parameters: [{ targetStepIndex: 5, targetField: 'value', name: 'username', required: true }],
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('propagates a DomainError from createTemplate when a targetField is not parameterizable', async () => {
    const { journeyRepository, useCase } = buildUseCase();
    const journey = buildJourney();
    await journeyRepository.save(journey);

    await expect(
      useCase.execute({
        journeyId: journey.id,
        name: 'Login template',
        // step 0 is a `goto` action - "value" is not one of its parameterizable fields.
        parameters: [{ targetStepIndex: 0, targetField: 'value', name: 'username', required: true }],
      }),
    ).rejects.toThrow(DomainError);
  });

  it('does not affect an already-created template when the source journey is later mutated (re-saved with different steps)', async () => {
    const { journeyRepository, useCase } = buildUseCase();
    const journey = buildJourney();
    await journeyRepository.save(journey);

    const template = await useCase.execute({ journeyId: journey.id, name: 'Login template', parameters: [] });
    const originalStepIds = template.steps.map((step) => step.id);

    // "Mutate" the journey the way this codebase actually allows: delete it
    // (Journey has no in-place mutation methods) and save a fresh Journey at
    // the same id with completely different steps.
    await journeyRepository.delete(journey.id);
    const replacementJourney = createJourney({
      id: journey.id,
      name: 'Replaced flow',
      startUrl: 'https://changed.example',
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      steps: [createStep({ id: 'new-step', order: 0, action: createAction({ kind: 'goto', url: 'https://changed.example' }) })],
    });
    await journeyRepository.save(replacementJourney);

    expect(template.steps.map((step) => step.id)).toEqual(originalStepIds);
    expect(template.startUrl).toBe('https://example.com');
  });
});
