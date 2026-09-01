import { describe, expect, it, vi } from 'vitest';
import { createAction } from '../../../journeys/domain/Action.js';
import { createStep } from '../../../journeys/domain/Step.js';
import { createTemplate, type Template } from '../../domain/Template.js';
import {
  TemplateController,
  parseTemplateParameterFlag,
  type CreateTemplateUseCaseLike,
  type DeleteTemplateUseCaseLike,
  type ListTemplatesUseCaseLike,
  type ShowTemplateUseCaseLike,
} from './TemplateController.js';
import { TemplatePresenter } from './TemplatePresenter.js';
import type { CreateTemplateFromJourneyInput } from '../../application/use-cases/CreateTemplateFromJourneyUseCase.js';

describe('parseTemplateParameterFlag', () => {
  it('parses a bare <stepIndex>.<field>=<paramName> flag', () => {
    expect(parseTemplateParameterFlag('0.value=username')).toEqual({
      targetStepIndex: 0,
      targetField: 'value',
      name: 'username',
      required: false,
    });
  });

  it('parses the :required modifier', () => {
    expect(parseTemplateParameterFlag('1.url=targetUrl:required')).toEqual({
      targetStepIndex: 1,
      targetField: 'url',
      name: 'targetUrl',
      required: true,
    });
  });

  it('parses a :default=<value> modifier whose value contains colons (e.g. a URL)', () => {
    expect(parseTemplateParameterFlag('2.url=targetUrl:default=https://example.com')).toEqual({
      targetStepIndex: 2,
      targetField: 'url',
      name: 'targetUrl',
      required: false,
      defaultValue: 'https://example.com',
    });
  });

  it('parses :required and :default= together, in that order', () => {
    expect(parseTemplateParameterFlag('0.key=pressKey:required:default=Enter')).toEqual({
      targetStepIndex: 0,
      targetField: 'key',
      name: 'pressKey',
      required: true,
      defaultValue: 'Enter',
    });
  });

  it('parses :default= before :required', () => {
    expect(parseTemplateParameterFlag('0.key=pressKey:default=Enter:required')).toEqual({
      targetStepIndex: 0,
      targetField: 'key',
      name: 'pressKey',
      required: true,
      defaultValue: 'Enter',
    });
  });

  it('throws a plain Error when "=" is missing', () => {
    expect(() => parseTemplateParameterFlag('0.value')).toThrow(Error);
  });

  it('throws a plain Error when "<stepIndex>." is missing', () => {
    expect(() => parseTemplateParameterFlag('value=username')).toThrow(Error);
  });

  it('throws a plain Error when the step index is not a non-negative integer', () => {
    expect(() => parseTemplateParameterFlag('-1.value=username')).toThrow(Error);
    expect(() => parseTemplateParameterFlag('abc.value=username')).toThrow(Error);
  });

  it('throws a plain Error when the parameter name is empty', () => {
    expect(() => parseTemplateParameterFlag('0.value=')).toThrow(Error);
  });
});

function buildTemplate(): Template {
  return createTemplate({
    id: 'template-1',
    name: 'Login template',
    startUrl: 'https://example.com',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    steps: [createStep({ id: 's1', order: 0, action: createAction({ kind: 'goto', url: 'https://example.com' }) })],
    parameters: [],
  });
}

class FakeCreateTemplateUseCase implements CreateTemplateUseCaseLike {
  readonly calls: CreateTemplateFromJourneyInput[] = [];
  constructor(private readonly result: Template) {}
  async execute(input: CreateTemplateFromJourneyInput): Promise<Template> {
    this.calls.push(input);
    return this.result;
  }
}

class FakeListTemplatesUseCase implements ListTemplatesUseCaseLike {
  constructor(private readonly result: Template[]) {}
  async execute(): Promise<Template[]> {
    return this.result;
  }
}

class FakeShowTemplateUseCase implements ShowTemplateUseCaseLike {
  constructor(private readonly result: Template) {}
  async execute(): Promise<Template> {
    return this.result;
  }
}

class FakeDeleteTemplateUseCase implements DeleteTemplateUseCaseLike {
  readonly calls: string[] = [];
  async execute(id: string): Promise<void> {
    this.calls.push(id);
  }
}

describe('TemplateController.create', () => {
  it('parses each --param flag into a DTO before calling the use case', async () => {
    const template = buildTemplate();
    const createUseCase = new FakeCreateTemplateUseCase(template);
    const controller = new TemplateController(
      createUseCase,
      new FakeListTemplatesUseCase([]),
      new FakeShowTemplateUseCase(template),
      new FakeDeleteTemplateUseCase(),
      new TemplatePresenter(),
    );
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await controller.create({
      journeyId: 'journey-1',
      name: 'Login template',
      params: ['0.value=username:required', '1.url=startUrl:default=https://example.com'],
      quiet: true,
    });

    expect(createUseCase.calls).toEqual([
      {
        journeyId: 'journey-1',
        name: 'Login template',
        parameters: [
          { targetStepIndex: 0, targetField: 'value', name: 'username', required: true },
          {
            targetStepIndex: 1,
            targetField: 'url',
            name: 'startUrl',
            required: false,
            defaultValue: 'https://example.com',
          },
        ],
      },
    ]);
    logSpy.mockRestore();
  });
});
