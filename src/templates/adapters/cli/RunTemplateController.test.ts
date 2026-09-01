import { describe, expect, it } from 'vitest';
import { parseTemplateRunParamFlag } from './RunTemplateController.js';

describe('parseTemplateRunParamFlag', () => {
  it('parses a <name>=<value> flag', () => {
    expect(parseTemplateRunParamFlag('username=alice')).toEqual(['username', 'alice']);
  });

  it('allows "=" inside the value', () => {
    expect(parseTemplateRunParamFlag('query=a=b')).toEqual(['query', 'a=b']);
  });

  it('allows an empty value', () => {
    expect(parseTemplateRunParamFlag('username=')).toEqual(['username', '']);
  });

  it('throws a plain Error when "=" is missing', () => {
    expect(() => parseTemplateRunParamFlag('username')).toThrow(Error);
  });

  it('throws a plain Error when the name before "=" is empty', () => {
    expect(() => parseTemplateRunParamFlag('=alice')).toThrow(Error);
  });
});
