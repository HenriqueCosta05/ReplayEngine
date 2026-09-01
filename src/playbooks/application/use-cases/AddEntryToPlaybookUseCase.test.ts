import { describe, expect, it } from 'vitest';
import { createAction } from '../../../journeys/domain/Action.js';
import { createStep } from '../../../journeys/domain/Step.js';
import { createJourney } from '../../../journeys/domain/Journey.js';
import { createTemplate } from '../../../templates/domain/Template.js';
import { createTemplateParameter } from '../../../templates/domain/TemplateParameter.js';
import { createAuthStrategy } from '../../../profiles/domain/AuthStrategy.js';
import { createUserProfile } from '../../../profiles/domain/UserProfile.js';
import { createPlaybook } from '../../domain/Playbook.js';
import { DomainError } from '../../domain/errors.js';
import { AddEntryToPlaybookUseCase } from './AddEntryToPlaybookUseCase.js';
import { NotFoundError } from '../../../shared-kernel/application/errors.js';
import { FakeIdGenerator } from '../../../../test/unit/fakes/FakeIdGenerator.js';
import { FakeJourneyRepository } from '../../../../test/unit/fakes/FakeJourneyRepository.js';
import { FakePlaybookRepository } from '../../../../test/unit/fakes/FakePlaybookRepository.js';
import { FakeProfileRepository } from '../../../../test/unit/fakes/FakeProfileRepository.js';
import { FakeTemplateRepository } from '../../../../test/unit/fakes/FakeTemplateRepository.js';

function buildJourney(id: string) {
  return createJourney({
    id,
    name: `Journey ${id}`,
    startUrl: 'https://example.com',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    steps: [createStep({ id: 's1', order: 0, action: createAction({ kind: 'goto', url: 'https://example.com' }) })],
  });
}

function buildTemplate(id: string) {
  return createTemplate({
    id,
    name: `Template ${id}`,
    startUrl: 'https://example.com',
    steps: [createStep({ id: 's1', order: 0, action: createAction({ kind: 'goto', url: 'https://example.com' }) })],
    parameters: [
      createTemplateParameter({
        id: 'param-1',
        name: 'startUrl',
        targetStepId: 's1',
        targetField: 'url',
        required: true,
      }),
    ],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

function buildUseCase() {
  const playbookRepository = new FakePlaybookRepository();
  const journeyRepository = new FakeJourneyRepository();
  const templateRepository = new FakeTemplateRepository();
  const profileRepository = new FakeProfileRepository();
  const idGenerator = new FakeIdGenerator();
  const useCase = new AddEntryToPlaybookUseCase(
    playbookRepository,
    journeyRepository,
    templateRepository,
    profileRepository,
    idGenerator,
  );
  return { playbookRepository, journeyRepository, templateRepository, profileRepository, idGenerator, useCase };
}

async function seedEmptyPlaybook(playbookRepository: FakePlaybookRepository) {
  const playbook = createPlaybook({
    id: 'playbook-1',
    name: 'Smoke suite',
    entries: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  });
  await playbookRepository.save(playbook);
}

describe('AddEntryToPlaybookUseCase', () => {
  it('adds a journey-sourced entry when the referenced journey exists', async () => {
    const { playbookRepository, journeyRepository, useCase } = buildUseCase();
    await seedEmptyPlaybook(playbookRepository);
    await journeyRepository.save(buildJourney('journey-1'));

    const updated = await useCase.execute({
      playbookId: 'playbook-1',
      source: { type: 'journey', journeyId: 'journey-1' },
      continueOnFailure: false,
    });

    expect(updated.entries).toHaveLength(1);
    expect(updated.entries[0]).toMatchObject({
      id: 'id-1',
      source: { type: 'journey', journeyId: 'journey-1' },
      continueOnFailure: false,
    });
  });

  it('throws NotFoundError when the playbook does not exist', async () => {
    const { useCase } = buildUseCase();
    await expect(
      useCase.execute({
        playbookId: 'missing',
        source: { type: 'journey', journeyId: 'journey-1' },
        continueOnFailure: false,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError when the referenced journey does not exist', async () => {
    const { playbookRepository, useCase } = buildUseCase();
    await seedEmptyPlaybook(playbookRepository);

    await expect(
      useCase.execute({
        playbookId: 'playbook-1',
        source: { type: 'journey', journeyId: 'missing' },
        continueOnFailure: false,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError when the referenced template does not exist', async () => {
    const { playbookRepository, useCase } = buildUseCase();
    await seedEmptyPlaybook(playbookRepository);

    await expect(
      useCase.execute({
        playbookId: 'playbook-1',
        source: { type: 'template', templateId: 'missing', parameterBindings: {} },
        continueOnFailure: false,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('adds a template-sourced entry when every required parameter has a binding', async () => {
    const { playbookRepository, templateRepository, useCase } = buildUseCase();
    await seedEmptyPlaybook(playbookRepository);
    await templateRepository.save(buildTemplate('template-1'));

    const updated = await useCase.execute({
      playbookId: 'playbook-1',
      source: { type: 'template', templateId: 'template-1', parameterBindings: { startUrl: 'https://example.com' } },
      continueOnFailure: false,
    });

    expect(updated.entries[0]?.source).toEqual({
      type: 'template',
      templateId: 'template-1',
      parameterBindings: { startUrl: 'https://example.com' },
    });
  });

  it('throws DomainError when a required template parameter has no binding, reusing Template.parameters', async () => {
    const { playbookRepository, templateRepository, useCase } = buildUseCase();
    await seedEmptyPlaybook(playbookRepository);
    await templateRepository.save(buildTemplate('template-1'));

    await expect(
      useCase.execute({
        playbookId: 'playbook-1',
        source: { type: 'template', templateId: 'template-1', parameterBindings: {} },
        continueOnFailure: false,
      }),
    ).rejects.toThrow(DomainError);
  });

  it('adds an entry with a profileOverride when the referenced profile exists', async () => {
    const { playbookRepository, journeyRepository, profileRepository, useCase } = buildUseCase();
    await seedEmptyPlaybook(playbookRepository);
    await journeyRepository.save(buildJourney('journey-1'));
    profileRepository.seed(
      createUserProfile({
        id: 'profile-1',
        name: 'admin',
        authStrategy: createAuthStrategy({ type: 'none' }),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    );

    const updated = await useCase.execute({
      playbookId: 'playbook-1',
      source: { type: 'journey', journeyId: 'journey-1' },
      profileOverride: 'profile-1',
      continueOnFailure: false,
    });

    expect(updated.entries[0]?.profileOverride).toBe('profile-1');
  });

  it('throws NotFoundError when profileOverride does not resolve to an existing profile', async () => {
    const { playbookRepository, journeyRepository, useCase } = buildUseCase();
    await seedEmptyPlaybook(playbookRepository);
    await journeyRepository.save(buildJourney('journey-1'));

    await expect(
      useCase.execute({
        playbookId: 'playbook-1',
        source: { type: 'journey', journeyId: 'journey-1' },
        profileOverride: 'missing',
        continueOnFailure: false,
      }),
    ).rejects.toThrow(NotFoundError);
  });
});
