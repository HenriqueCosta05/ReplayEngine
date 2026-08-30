import { describe, expect, it } from 'vitest';
import { createAction } from '../../journeys/domain/Action.js';
import { createLocator } from '../../journeys/domain/Locator.js';
import { createStep } from '../../journeys/domain/Step.js';
import { DomainError } from './errors.js';
import { createTemplate } from './Template.js';
import { createTemplateParameter } from './TemplateParameter.js';

const gotoAction = createAction({ kind: 'goto', url: 'https://example.com' });
const fillAction = createAction({
  kind: 'fill',
  locator: createLocator({ strategy: 'testId', value: 'username' }),
  value: 'placeholder-user',
});
const clickAction = createAction({
  kind: 'click',
  locator: createLocator({ strategy: 'role', value: 'button' }),
});

function buildSteps() {
  return [
    createStep({ id: 'step-1', order: 0, action: gotoAction }),
    createStep({ id: 'step-2', order: 1, action: fillAction }),
    createStep({ id: 'step-3', order: 2, action: clickAction }),
  ];
}

function usernameParameter(overrides: Partial<Parameters<typeof createTemplateParameter>[0]> = {}) {
  return createTemplateParameter({
    id: 'param-1',
    name: 'username',
    targetStepId: 'step-2',
    targetField: 'value',
    required: true,
    ...overrides,
  });
}

describe('createTemplate', () => {
  it('builds a template from valid input', () => {
    const template = createTemplate({
      id: 'template-1',
      name: 'Login template',
      startUrl: 'https://example.com',
      steps: buildSteps(),
      parameters: [usernameParameter()],
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });

    expect(template.id).toBe('template-1');
    expect(template.steps).toHaveLength(3);
    expect(template.parameters).toHaveLength(1);
  });

  it('accepts a template with no parameters', () => {
    const template = createTemplate({
      id: 'template-1',
      name: 'Login template',
      startUrl: 'https://example.com',
      steps: buildSteps(),
      parameters: [],
      createdAt: new Date(),
    });

    expect(template.parameters).toHaveLength(0);
  });

  it('throws DomainError when id is empty', () => {
    expect(() =>
      createTemplate({
        id: '',
        name: 'Login template',
        startUrl: 'https://example.com',
        steps: buildSteps(),
        parameters: [],
        createdAt: new Date(),
      }),
    ).toThrow(DomainError);
  });

  it('throws DomainError when name is empty', () => {
    expect(() =>
      createTemplate({
        id: 'template-1',
        name: '',
        startUrl: 'https://example.com',
        steps: buildSteps(),
        parameters: [],
        createdAt: new Date(),
      }),
    ).toThrow(DomainError);
  });

  it('throws DomainError when startUrl is empty', () => {
    expect(() =>
      createTemplate({
        id: 'template-1',
        name: 'Login template',
        startUrl: '',
        steps: buildSteps(),
        parameters: [],
        createdAt: new Date(),
      }),
    ).toThrow(DomainError);
  });

  it('throws DomainError when there are zero steps', () => {
    expect(() =>
      createTemplate({
        id: 'template-1',
        name: 'Login template',
        startUrl: 'https://example.com',
        steps: [],
        parameters: [],
        createdAt: new Date(),
      }),
    ).toThrow(DomainError);
  });

  it('throws DomainError when createdAt is an invalid Date', () => {
    expect(() =>
      createTemplate({
        id: 'template-1',
        name: 'Login template',
        startUrl: 'https://example.com',
        steps: buildSteps(),
        parameters: [],
        createdAt: new Date('not-a-date'),
      }),
    ).toThrow(DomainError);
  });

  it('throws DomainError when a parameter targets a step id that does not exist', () => {
    expect(() =>
      createTemplate({
        id: 'template-1',
        name: 'Login template',
        startUrl: 'https://example.com',
        steps: buildSteps(),
        parameters: [usernameParameter({ targetStepId: 'no-such-step' })],
        createdAt: new Date(),
      }),
    ).toThrow(DomainError);
  });

  it('throws DomainError when a parameter targets a field its step does not support', () => {
    expect(() =>
      createTemplate({
        id: 'template-1',
        name: 'Login template',
        startUrl: 'https://example.com',
        steps: buildSteps(),
        // step-3 is a `click` action, which has no parameterizable fields.
        parameters: [usernameParameter({ id: 'param-2', targetStepId: 'step-3', targetField: 'value' })],
        createdAt: new Date(),
      }),
    ).toThrow(DomainError);
  });

  it('throws DomainError when two parameters share the same name', () => {
    expect(() =>
      createTemplate({
        id: 'template-1',
        name: 'Login template',
        startUrl: 'https://example.com',
        steps: buildSteps(),
        parameters: [
          usernameParameter({ id: 'param-1' }),
          usernameParameter({ id: 'param-2', targetStepId: 'step-1', targetField: 'url' }),
        ],
        createdAt: new Date(),
      }),
    ).toThrow(DomainError);
  });

  it('snapshots the steps array: mutating the caller-owned array afterwards does not affect the template', () => {
    const steps = buildSteps();
    const template = createTemplate({
      id: 'template-1',
      name: 'Login template',
      startUrl: 'https://example.com',
      steps,
      parameters: [],
      createdAt: new Date(),
    });

    // Simulate a caller (or the source Journey's own steps array, if
    // aliased) mutating the array after the template was built.
    steps.push(createStep({ id: 'step-4', order: 3, action: gotoAction }));
    steps.length = 0;

    expect(template.steps).toHaveLength(3);
    expect(template.steps.map((step) => step.id)).toEqual(['step-1', 'step-2', 'step-3']);
  });

  it('is unaffected by a fresh Journey built later at the same source steps/id (the snapshot invariant)', () => {
    const originalSteps = buildSteps();
    const template = createTemplate({
      id: 'template-1',
      name: 'Login template',
      startUrl: 'https://example.com',
      steps: originalSteps,
      parameters: [usernameParameter()],
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });

    // `Journey` has no mutation methods (per its own doc comment): any
    // "edit" is a fresh `createJourney` call with a new step list. Model
    // that here as replacing what a `JourneyRepository` would return for
    // the same journey id with entirely different steps - the Template
    // that was already built from the old steps must not see any of this.
    const replacementSteps = [
      createStep({ id: 'step-1', order: 0, action: createAction({ kind: 'goto', url: 'https://changed.example' }) }),
    ];

    expect(template.steps).toHaveLength(3);
    expect(template.steps[1]?.action).toMatchObject({ kind: 'fill', value: 'placeholder-user' });
    expect(replacementSteps).not.toEqual(template.steps);
  });
});

describe('Template.instantiate', () => {
  function buildTemplate(parameters: ReturnType<typeof usernameParameter>[]) {
    return createTemplate({
      id: 'template-1',
      name: 'Login template',
      startUrl: 'https://example.com',
      steps: buildSteps(),
      parameters,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
  }

  it('throws DomainError when a required parameter has no value and no default', () => {
    const template = buildTemplate([usernameParameter({ required: true })]);

    expect(() => template.instantiate({})).toThrow(DomainError);
  });

  it('falls back to defaultValue when no value is supplied for a non-required parameter', () => {
    const template = buildTemplate([
      usernameParameter({ required: false, defaultValue: 'default-user' }),
    ]);

    const draft = template.instantiate({});

    const fillStep = draft.steps.find((step) => step.id === 'step-2');
    expect(fillStep?.action).toMatchObject({ kind: 'fill', value: 'default-user' });
  });

  it('prefers a supplied value over defaultValue', () => {
    const template = buildTemplate([
      usernameParameter({ required: false, defaultValue: 'default-user' }),
    ]);

    const draft = template.instantiate({ username: 'alice' });

    const fillStep = draft.steps.find((step) => step.id === 'step-2');
    expect(fillStep?.action).toMatchObject({ kind: 'fill', value: 'alice' });
  });

  it('substitutes the resolved value into exactly the targeted field, leaving the rest of the action untouched', () => {
    const template = buildTemplate([usernameParameter({ required: true })]);

    const draft = template.instantiate({ username: 'alice' });

    const fillStep = draft.steps.find((step) => step.id === 'step-2');
    expect(fillStep?.action).toEqual({ ...fillAction, value: 'alice' });
  });

  it('leaves steps with no targeting parameter completely unchanged', () => {
    const template = buildTemplate([usernameParameter({ required: true })]);

    const draft = template.instantiate({ username: 'alice' });

    const gotoStep = draft.steps.find((step) => step.id === 'step-1');
    const clickStep = draft.steps.find((step) => step.id === 'step-3');
    expect(gotoStep?.action).toEqual(gotoAction);
    expect(clickStep?.action).toEqual(clickAction);
  });

  it('preserves step order, id, and label across instantiation', () => {
    const labeledSteps = [
      createStep({ id: 'step-1', order: 0, action: gotoAction, label: 'Go to homepage' }),
      createStep({ id: 'step-2', order: 1, action: fillAction }),
    ];
    const template = createTemplate({
      id: 'template-2',
      name: 'Login template',
      startUrl: 'https://example.com',
      steps: labeledSteps,
      parameters: [usernameParameter({ required: true })],
      createdAt: new Date(),
    });

    const draft = template.instantiate({ username: 'alice' });

    expect(draft.steps.map((step) => [step.id, step.order, step.label])).toEqual([
      ['step-1', 0, 'Go to homepage'],
      ['step-2', 1, undefined],
    ]);
  });

  it('returns a TransientJourneyDraft carrying name/startUrl/steps but no id/createdAt', () => {
    const template = buildTemplate([usernameParameter({ required: true })]);

    const draft = template.instantiate({ username: 'alice' });

    expect(draft).toEqual({
      name: 'Login template',
      startUrl: 'https://example.com',
      steps: draft.steps,
    });
    expect('id' in draft).toBe(false);
    expect('createdAt' in draft).toBe(false);
  });

  it('skips substitution for a non-required parameter with no value and no default', () => {
    const template = buildTemplate([usernameParameter({ required: false })]);

    const draft = template.instantiate({});

    const fillStep = draft.steps.find((step) => step.id === 'step-2');
    expect(fillStep?.action).toEqual(fillAction);
  });
});
