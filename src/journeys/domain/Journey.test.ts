import { describe, expect, it } from 'vitest';
import { createAction } from './Action.js';
import { DomainError } from './errors.js';
import { createJourney } from './Journey.js';
import { createStep } from './Step.js';

const gotoAction = createAction({ kind: 'goto', url: 'https://example.com' });

function step(id: string, order: number) {
  return createStep({ id, order, action: gotoAction });
}

describe('createJourney', () => {
  it('builds a journey from valid input', () => {
    const journey = createJourney({
      id: 'journey-1',
      name: 'Login flow',
      startUrl: 'https://example.com',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      steps: [step('s1', 0), step('s2', 1)],
    });
    expect(journey.name).toBe('Login flow');
    expect(journey.steps).toHaveLength(2);
  });

  it('accepts an optional profileId', () => {
    const journey = createJourney({
      id: 'journey-1',
      name: 'Login flow',
      startUrl: 'https://example.com',
      profileId: 'profile-1',
      createdAt: new Date(),
      steps: [step('s1', 0)],
    });
    expect(journey.profileId).toBe('profile-1');
  });

  it('throws DomainError when there are zero steps', () => {
    expect(() =>
      createJourney({
        id: 'journey-1',
        name: 'Login flow',
        startUrl: 'https://example.com',
        createdAt: new Date(),
        steps: [],
      }),
    ).toThrow(DomainError);
  });

  it('throws DomainError when name is empty', () => {
    expect(() =>
      createJourney({
        id: 'journey-1',
        name: '',
        startUrl: 'https://example.com',
        createdAt: new Date(),
        steps: [step('s1', 0)],
      }),
    ).toThrow(DomainError);
  });

  it('throws DomainError when name is whitespace only', () => {
    expect(() =>
      createJourney({
        id: 'journey-1',
        name: '   ',
        startUrl: 'https://example.com',
        createdAt: new Date(),
        steps: [step('s1', 0)],
      }),
    ).toThrow(DomainError);
  });

  it('throws DomainError when startUrl is empty', () => {
    expect(() =>
      createJourney({
        id: 'journey-1',
        name: 'Login flow',
        startUrl: '',
        createdAt: new Date(),
        steps: [step('s1', 0)],
      }),
    ).toThrow(DomainError);
  });

  it('throws DomainError when step orders are not contiguous from 0', () => {
    expect(() =>
      createJourney({
        id: 'journey-1',
        name: 'Login flow',
        startUrl: 'https://example.com',
        createdAt: new Date(),
        steps: [step('s1', 1), step('s2', 2)],
      }),
    ).toThrow(DomainError);
  });

  it('throws DomainError when step orders have duplicates', () => {
    expect(() =>
      createJourney({
        id: 'journey-1',
        name: 'Login flow',
        startUrl: 'https://example.com',
        createdAt: new Date(),
        steps: [step('s1', 0), step('s2', 0)],
      }),
    ).toThrow(DomainError);
  });

  it('accepts steps supplied out of array order as long as order values are contiguous from 0', () => {
    const journey = createJourney({
      id: 'journey-1',
      name: 'Login flow',
      startUrl: 'https://example.com',
      createdAt: new Date(),
      steps: [step('s2', 1), step('s1', 0)],
    });
    expect(journey.steps).toHaveLength(2);
  });
});
