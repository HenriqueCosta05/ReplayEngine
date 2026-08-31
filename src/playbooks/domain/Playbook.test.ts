import { describe, expect, it } from 'vitest';
import { DomainError } from './errors.js';
import { createPlaybook } from './Playbook.js';
import { createPlaybookEntry } from './PlaybookEntry.js';

const createdAt = new Date('2026-01-01T00:00:00.000Z');

describe('createPlaybook', () => {
  it('builds a playbook with zero entries', () => {
    const playbook = createPlaybook({ id: 'playbook-1', name: 'Smoke suite', entries: [], createdAt });
    expect(playbook.entries).toEqual([]);
  });

  it('builds a playbook with entries, in order', () => {
    const entry1 = createPlaybookEntry({
      id: 'entry-1',
      source: { type: 'journey', journeyId: 'journey-1' },
      continueOnFailure: false,
    });
    const entry2 = createPlaybookEntry({
      id: 'entry-2',
      source: { type: 'journey', journeyId: 'journey-2' },
      continueOnFailure: true,
    });
    const playbook = createPlaybook({ id: 'playbook-1', name: 'Smoke suite', entries: [entry1, entry2], createdAt });
    expect(playbook.entries).toEqual([entry1, entry2]);
  });

  it('copies the entries array so mutating the caller-owned array does not reach the playbook', () => {
    const entries = [
      createPlaybookEntry({
        id: 'entry-1',
        source: { type: 'journey', journeyId: 'journey-1' },
        continueOnFailure: false,
      }),
    ];
    const playbook = createPlaybook({ id: 'playbook-1', name: 'Smoke suite', entries, createdAt });
    entries.push(
      createPlaybookEntry({
        id: 'entry-2',
        source: { type: 'journey', journeyId: 'journey-2' },
        continueOnFailure: false,
      }),
    );
    expect(playbook.entries).toHaveLength(1);
  });

  it('throws DomainError when id is empty', () => {
    expect(() => createPlaybook({ id: '', name: 'Smoke suite', entries: [], createdAt })).toThrow(DomainError);
  });

  it('throws DomainError when name is empty', () => {
    expect(() => createPlaybook({ id: 'playbook-1', name: '  ', entries: [], createdAt })).toThrow(DomainError);
  });

  it('throws DomainError when createdAt is an invalid Date', () => {
    expect(() =>
      createPlaybook({ id: 'playbook-1', name: 'Smoke suite', entries: [], createdAt: new Date('not-a-date') }),
    ).toThrow(DomainError);
  });

  it('throws DomainError when two entries share the same id', () => {
    const duplicateId = 'entry-1';
    const entries = [
      createPlaybookEntry({
        id: duplicateId,
        source: { type: 'journey', journeyId: 'journey-1' },
        continueOnFailure: false,
      }),
      createPlaybookEntry({
        id: duplicateId,
        source: { type: 'journey', journeyId: 'journey-2' },
        continueOnFailure: false,
      }),
    ];
    expect(() => createPlaybook({ id: 'playbook-1', name: 'Smoke suite', entries, createdAt })).toThrow(DomainError);
  });
});
