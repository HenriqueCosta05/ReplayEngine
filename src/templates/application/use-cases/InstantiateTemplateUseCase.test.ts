import { describe, expect, it } from 'vitest';
import { createAction } from '../../../journeys/domain/Action.js';
import { createLocator } from '../../../journeys/domain/Locator.js';
import { createStep } from '../../../journeys/domain/Step.js';
import { createTemplate } from '../../domain/Template.js';
import { createTemplateParameter } from '../../domain/TemplateParameter.js';
import { InstantiateTemplateUseCase } from './InstantiateTemplateUseCase.js';
import { DomainError } from '../../domain/errors.js';
import { FakeClock } from '../../../../test/unit/fakes/FakeClock.js';
import { FakeIdGenerator } from '../../../../test/unit/fakes/FakeIdGenerator.js';
import { FakeJourneyRepository } from '../../../../test/unit/fakes/FakeJourneyRepository.js';
import { FakeTemplateRepository } from '../../../../test/unit/fakes/FakeTemplateRepository.js';
import { NotFoundError } from '../../../shared-kernel/application/errors.js';

function buildTemplate() {
  const fillAction = createAction({
    kind: 'fill',
    locator: createLocator({ strategy: 'testId', value: 'username' }),
    value: 'placeholder',
  });
  return createTemplate({
    id: 'template-1',
    name: 'Login template',
    startUrl: 'https://example.com',
    steps: [
      createStep({ id: 's1', order: 0, action: createAction({ kind: 'goto', url: 'https://example.com' }) }),
      createStep({ id: 's2', order: 1, action: fillAction }),
    ],
    parameters: [
      createTemplateParameter({
        id: 'param-1',
        name: 'username',
        targetStepId: 's2',
        targetField: 'value',
        required: true,
      }),
    ],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

function buildUseCase() {
  const templateRepository = new FakeTemplateRepository();
  const journeyRepository = new FakeJourneyRepository();
  const idGenerator = new FakeIdGenerator();
  const clock = new FakeClock(new Date('2026-02-01T00:00:00.000Z'));
  const useCase = new InstantiateTemplateUseCase(templateRepository, journeyRepository, idGenerator, clock);
  return { templateRepository, journeyRepository, idGenerator, clock, useCase };
}

describe('InstantiateTemplateUseCase', () => {
  it('instantiates the template and persists the result as a fresh Journey with a minted id/createdAt', async () => {
    const { templateRepository, journeyRepository, useCase } = buildUseCase();
    const template = buildTemplate();
    await templateRepository.save(template);

    const journey = await useCase.execute({ templateId: template.id, values: { username: 'alice' } });

    expect(journey.id).toBe('id-1');
    expect(journey.createdAt).toEqual(new Date('2026-02-01T00:00:00.000Z'));
    expect(journey.name).toBe('Login template');
    expect(journey.startUrl).toBe('https://example.com');
    const fillStep = journey.steps.find((step) => step.id === 's2');
    expect(fillStep?.action).toMatchObject({ kind: 'fill', value: 'alice' });
    await expect(journeyRepository.findById(journey.id)).resolves.toEqual(journey);
  });

  it('honors an explicit name override', async () => {
    const { templateRepository, useCase } = buildUseCase();
    const template = buildTemplate();
    await templateRepository.save(template);

    const journey = await useCase.execute({
      templateId: template.id,
      values: { username: 'alice' },
      name: 'Custom name',
    });

    expect(journey.name).toBe('Custom name');
  });

  it('throws NotFoundError when the template does not exist', async () => {
    const { useCase } = buildUseCase();

    await expect(useCase.execute({ templateId: 'missing', values: {} })).rejects.toThrow(NotFoundError);
  });

  it('propagates the DomainError from Template.instantiate when a required parameter is missing', async () => {
    const { templateRepository, useCase } = buildUseCase();
    const template = buildTemplate();
    await templateRepository.save(template);

    await expect(useCase.execute({ templateId: template.id, values: {} })).rejects.toThrow(DomainError);
  });
});
