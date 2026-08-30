import { describe, expect, it } from 'vitest';
import { createAction } from '../../../journeys/domain/Action.js';
import { createStep } from '../../../journeys/domain/Step.js';
import { createTemplate } from '../../domain/Template.js';
import { ShowTemplateUseCase } from './ShowTemplateUseCase.js';
import { FakeTemplateRepository } from '../../../../test/unit/fakes/FakeTemplateRepository.js';
import { NotFoundError } from '../../../shared-kernel/application/errors.js';

describe('ShowTemplateUseCase', () => {
  it('returns the template when it exists', async () => {
    const repository = new FakeTemplateRepository();
    const gotoAction = createAction({ kind: 'goto', url: 'https://example.com' });
    const template = createTemplate({
      id: 'template-1',
      name: 'Login template',
      startUrl: 'https://example.com',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      steps: [createStep({ id: 's1', order: 0, action: gotoAction })],
      parameters: [],
    });
    await repository.save(template);

    const useCase = new ShowTemplateUseCase(repository);

    await expect(useCase.execute('template-1')).resolves.toEqual(template);
  });

  it('throws NotFoundError when the template does not exist', async () => {
    const useCase = new ShowTemplateUseCase(new FakeTemplateRepository());

    await expect(useCase.execute('missing')).rejects.toThrow(NotFoundError);
  });
});
