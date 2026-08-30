import { describe, expect, it } from 'vitest';
import { createAction } from '../../../journeys/domain/Action.js';
import { createStep } from '../../../journeys/domain/Step.js';
import { createTemplate } from '../../domain/Template.js';
import { ListTemplatesUseCase } from './ListTemplatesUseCase.js';
import { FakeTemplateRepository } from '../../../../test/unit/fakes/FakeTemplateRepository.js';

function buildTemplate(id: string) {
  const gotoAction = createAction({ kind: 'goto', url: 'https://example.com' });
  return createTemplate({
    id,
    name: `Template ${id}`,
    startUrl: 'https://example.com',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    steps: [createStep({ id: 's1', order: 0, action: gotoAction })],
    parameters: [],
  });
}

describe('ListTemplatesUseCase', () => {
  it('returns all templates from the repository', async () => {
    const repository = new FakeTemplateRepository();
    await repository.save(buildTemplate('template-1'));
    await repository.save(buildTemplate('template-2'));

    const useCase = new ListTemplatesUseCase(repository);
    const templates = await useCase.execute();

    expect(templates).toHaveLength(2);
    expect(templates.map((template) => template.id).sort()).toEqual(['template-1', 'template-2']);
  });

  it('returns an empty array when there are no templates', async () => {
    const useCase = new ListTemplatesUseCase(new FakeTemplateRepository());

    await expect(useCase.execute()).resolves.toEqual([]);
  });
});
