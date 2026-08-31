import { describe, expect, it } from 'vitest';
import { DomainError } from './errors.js';
import { createPlaybookEntry } from './PlaybookEntry.js';

describe('createPlaybookEntry', () => {
  it('builds a journey-sourced entry from valid input', () => {
    const entry = createPlaybookEntry({
      id: 'entry-1',
      source: { type: 'journey', journeyId: 'journey-1' },
      continueOnFailure: false,
    });
    expect(entry).toEqual({
      id: 'entry-1',
      source: { type: 'journey', journeyId: 'journey-1' },
      continueOnFailure: false,
    });
  });

  it('builds a template-sourced entry with parameterBindings', () => {
    const entry = createPlaybookEntry({
      id: 'entry-1',
      source: { type: 'template', templateId: 'template-1', parameterBindings: { username: 'alice' } },
      continueOnFailure: true,
    });
    expect(entry.source).toEqual({
      type: 'template',
      templateId: 'template-1',
      parameterBindings: { username: 'alice' },
    });
  });

  it('accepts an optional profileOverride', () => {
    const entry = createPlaybookEntry({
      id: 'entry-1',
      source: { type: 'journey', journeyId: 'journey-1' },
      profileOverride: 'profile-1',
      continueOnFailure: false,
    });
    expect(entry.profileOverride).toBe('profile-1');
  });

  it('throws DomainError when id is empty', () => {
    expect(() =>
      createPlaybookEntry({ id: '', source: { type: 'journey', journeyId: 'journey-1' }, continueOnFailure: false }),
    ).toThrow(DomainError);
  });

  it('throws DomainError when a journey source has an empty journeyId', () => {
    expect(() =>
      createPlaybookEntry({ id: 'entry-1', source: { type: 'journey', journeyId: '' }, continueOnFailure: false }),
    ).toThrow(DomainError);
  });

  it('throws DomainError when a template source has an empty templateId', () => {
    expect(() =>
      createPlaybookEntry({
        id: 'entry-1',
        source: { type: 'template', templateId: '', parameterBindings: {} },
        continueOnFailure: false,
      }),
    ).toThrow(DomainError);
  });

  it('throws DomainError when a template source parameterBindings is not a string-keyed record of strings', () => {
    expect(() =>
      createPlaybookEntry({
        id: 'entry-1',
        source: {
          type: 'template',
          templateId: 'template-1',
          parameterBindings: { count: 1 } as unknown as Record<string, string>,
        },
        continueOnFailure: false,
      }),
    ).toThrow(DomainError);
  });

  it('throws DomainError for an unknown source type', () => {
    expect(() =>
      createPlaybookEntry({
        id: 'entry-1',
        source: { type: 'bogus' } as never,
        continueOnFailure: false,
      }),
    ).toThrow(DomainError);
  });

  it('throws DomainError when profileOverride is an empty string', () => {
    expect(() =>
      createPlaybookEntry({
        id: 'entry-1',
        source: { type: 'journey', journeyId: 'journey-1' },
        profileOverride: '',
        continueOnFailure: false,
      }),
    ).toThrow(DomainError);
  });

  it('throws DomainError when continueOnFailure is not a boolean', () => {
    expect(() =>
      createPlaybookEntry({
        id: 'entry-1',
        source: { type: 'journey', journeyId: 'journey-1' },
        continueOnFailure: 'yes' as unknown as boolean,
      }),
    ).toThrow(DomainError);
  });
});
