import { JsonFileStore } from '../../../infrastructure/JsonFileStore.js';
import { createAction, type CreateActionInput } from '../../domain/Action.js';
import { createJourney, type Journey } from '../../domain/Journey.js';
import { createStep, type Step } from '../../domain/Step.js';
import type { JourneyRepository } from '../../application/ports/JourneyRepository.js';
import type { JourneySnapshot, StepSnapshot } from './JourneySnapshot.js';

function toSnapshot(journey: Journey): JourneySnapshot {
  return {
    id: journey.id,
    name: journey.name,
    startUrl: journey.startUrl,
    ...(journey.profileId !== undefined ? { profileId: journey.profileId } : {}),
    createdAt: journey.createdAt.toISOString(),
    steps: journey.steps.map((step) => ({
      id: step.id,
      order: step.order,
      action: step.action,
      ...(step.label !== undefined ? { label: step.label } : {}),
    })),
  };
}

function toStep(snapshot: StepSnapshot): Step {
  return createStep({
    id: snapshot.id,
    order: snapshot.order,
    // Re-run the domain factory rather than casting: a file that was
    // hand-edited into an unknown action kind or a locator with an empty
    // value must fail loudly here, not surface as a broken Journey later.
    action: createAction(snapshot.action as unknown as CreateActionInput),
    ...(snapshot.label !== undefined ? { label: snapshot.label } : {}),
  });
}

function toDomain(snapshot: JourneySnapshot): Journey {
  // `new Date('nonsense')` is an Invalid Date, which `createJourney` rejects -
  // so a corrupt timestamp is caught by the domain rather than silently
  // becoming NaN.
  return createJourney({
    id: snapshot.id,
    name: snapshot.name,
    startUrl: snapshot.startUrl,
    ...(snapshot.profileId !== undefined ? { profileId: snapshot.profileId } : {}),
    createdAt: new Date(snapshot.createdAt),
    steps: (snapshot.steps ?? []).map(toStep),
  });
}

/**
 * File-backed `JourneyRepository`: one `<dataRoot>/journeys/<id>.json` per
 * journey, via the generic `JsonFileStore`. This adapter owns exactly one
 * responsibility - translating between the domain `Journey` and its
 * plain-JSON snapshot - and reconstructs reads through `createJourney` /
 * `createStep` / `createAction` so a corrupted or hand-edited file raises a
 * `DomainError` instead of yielding an invalid aggregate.
 */
export class JsonFileJourneyRepository implements JourneyRepository {
  private readonly store: JsonFileStore<JourneySnapshot>;

  constructor(journeysDirPath: string) {
    this.store = new JsonFileStore<JourneySnapshot>(journeysDirPath);
  }

  async save(journey: Journey): Promise<void> {
    await this.store.save(journey.id, toSnapshot(journey));
  }

  async findById(id: string): Promise<Journey | null> {
    const snapshot = await this.store.findById(id);
    return snapshot === null ? null : toDomain(snapshot);
  }

  async findAll(): Promise<Journey[]> {
    const snapshots = await this.store.findAll();
    return snapshots.map(toDomain);
  }

  async delete(id: string): Promise<void> {
    await this.store.delete(id);
  }
}
