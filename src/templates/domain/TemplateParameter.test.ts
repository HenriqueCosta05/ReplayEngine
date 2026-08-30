import { describe, expect, it } from 'vitest';
import { DomainError } from './errors.js';
import { createTemplateParameter } from './TemplateParameter.js';

function baseInput(overrides: Partial<Parameters<typeof createTemplateParameter>[0]> = {}) {
  return {
    id: 'param-1',
    name: 'username',
    targetStepId: 'step-1',
    targetField: 'value',
    required: true,
    ...overrides,
  };
}

describe('createTemplateParameter', () => {
  it('builds a parameter from valid input', () => {
    const parameter = createTemplateParameter(baseInput());
    expect(parameter.name).toBe('username');
    expect(parameter.required).toBe(true);
  });

  it('accepts an optional description and defaultValue', () => {
    const parameter = createTemplateParameter(
      baseInput({ description: 'The login username', defaultValue: 'guest', required: false }),
    );
    expect(parameter.description).toBe('The login username');
    expect(parameter.defaultValue).toBe('guest');
  });

  it('throws DomainError when id is empty', () => {
    expect(() => createTemplateParameter(baseInput({ id: '' }))).toThrow(DomainError);
  });

  it.each(['1name', 'user-name', 'user name', 'user.name', ''])(
    'throws DomainError when name "%s" does not match the safe identifier pattern',
    (name) => {
      expect(() => createTemplateParameter(baseInput({ name }))).toThrow(DomainError);
    },
  );

  it.each(['username', '_username', 'Username2', 'a'])('accepts a valid identifier name "%s"', (name) => {
    expect(() => createTemplateParameter(baseInput({ name }))).not.toThrow();
  });

  it('throws DomainError when description is an empty string', () => {
    expect(() => createTemplateParameter(baseInput({ description: '' }))).toThrow(DomainError);
  });

  it('throws DomainError when targetStepId is empty', () => {
    expect(() => createTemplateParameter(baseInput({ targetStepId: '' }))).toThrow(DomainError);
  });

  it('throws DomainError when targetField is empty', () => {
    expect(() => createTemplateParameter(baseInput({ targetField: '' }))).toThrow(DomainError);
  });

  it('throws DomainError when required is not a boolean', () => {
    expect(() =>
      createTemplateParameter(baseInput({ required: undefined as unknown as boolean })),
    ).toThrow(DomainError);
  });
});
