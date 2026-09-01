import { JsonFileStore } from '../../../infrastructure/JsonFileStore.js';
import { createStepResult, type StepResult } from '../../../journeys/domain/StepResult.js';
import { createPlaybookRunResult, type PlaybookEntryResult, type PlaybookRunResult } from '../../domain/PlaybookRunResult.js';
import type { PlaybookRunResultRepository } from '../../application/ports/PlaybookRunResultRepository.js';
import type { PlaybookEntryResultSnapshot, PlaybookRunResultSnapshot } from './PlaybookRunResultSnapshot.js';

function toStepResultSnapshot(stepResult: StepResult): StepResult {
  return {
    stepId: stepResult.stepId,
    status: stepResult.status,
    durationMs: stepResult.durationMs,
    ...(stepResult.errorMessage !== undefined ? { errorMessage: stepResult.errorMessage } : {}),
    ...(stepResult.screenshotPath !== undefined ? { screenshotPath: stepResult.screenshotPath } : {}),
  };
}

function toStepResult(snapshot: StepResult): StepResult {
  // Re-run the domain factory rather than casting: a file that was
  // hand-edited into an invalid status or a missing errorMessage on a
  // failed step must fail loudly here, not surface as a broken result
  // later.
  return createStepResult({
    stepId: snapshot.stepId,
    status: snapshot.status,
    durationMs: snapshot.durationMs,
    ...(snapshot.errorMessage !== undefined ? { errorMessage: snapshot.errorMessage } : {}),
    ...(snapshot.screenshotPath !== undefined ? { screenshotPath: snapshot.screenshotPath } : {}),
  });
}

function toEntryResultSnapshot(entryResult: PlaybookEntryResult): PlaybookEntryResultSnapshot {
  return {
    entryId: entryResult.entryId,
    status: entryResult.status,
    ...(entryResult.runId !== undefined ? { runId: entryResult.runId } : {}),
    ...(entryResult.journeyId !== undefined ? { journeyId: entryResult.journeyId } : {}),
    ...(entryResult.profileId !== undefined ? { profileId: entryResult.profileId } : {}),
    ...(entryResult.startedAt !== undefined ? { startedAt: entryResult.startedAt.toISOString() } : {}),
    ...(entryResult.finishedAt !== undefined ? { finishedAt: entryResult.finishedAt.toISOString() } : {}),
    stepResults: entryResult.stepResults.map(toStepResultSnapshot),
    ...(entryResult.tracePath !== undefined ? { tracePath: entryResult.tracePath } : {}),
    ...(entryResult.error !== undefined ? { error: entryResult.error } : {}),
  };
}

function toEntryResult(snapshot: PlaybookEntryResultSnapshot): PlaybookEntryResult {
  return {
    entryId: snapshot.entryId,
    status: snapshot.status,
    ...(snapshot.runId !== undefined ? { runId: snapshot.runId } : {}),
    ...(snapshot.journeyId !== undefined ? { journeyId: snapshot.journeyId } : {}),
    ...(snapshot.profileId !== undefined ? { profileId: snapshot.profileId } : {}),
    ...(snapshot.startedAt !== undefined ? { startedAt: new Date(snapshot.startedAt) } : {}),
    ...(snapshot.finishedAt !== undefined ? { finishedAt: new Date(snapshot.finishedAt) } : {}),
    stepResults: (snapshot.stepResults ?? []).map(toStepResult),
    ...(snapshot.tracePath !== undefined ? { tracePath: snapshot.tracePath } : {}),
    ...(snapshot.error !== undefined ? { error: snapshot.error } : {}),
  };
}

function toSnapshot(result: PlaybookRunResult): PlaybookRunResultSnapshot {
  return {
    id: result.id,
    playbookId: result.playbookId,
    startedAt: result.startedAt.toISOString(),
    finishedAt: result.finishedAt.toISOString(),
    entryResults: result.entryResults.map(toEntryResultSnapshot),
  };
}

function toDomain(snapshot: PlaybookRunResultSnapshot): PlaybookRunResult {
  // `new Date('nonsense')` is an Invalid Date, which `createPlaybookRunResult`
  // rejects - so a corrupt timestamp is caught by the domain rather than
  // silently becoming NaN.
  return createPlaybookRunResult({
    id: snapshot.id,
    playbookId: snapshot.playbookId,
    startedAt: new Date(snapshot.startedAt),
    finishedAt: new Date(snapshot.finishedAt),
    entryResults: (snapshot.entryResults ?? []).map(toEntryResult),
  });
}

/**
 * File-backed `PlaybookRunResultRepository`: one
 * `<dataRoot>/playbook-runs/<id>.json` per run, via the generic
 * `JsonFileStore` - same pattern as `JsonFilePlaybookRepository`. No
 * `delete` method, matching the port. `findAllByPlaybookId` has no index to
 * consult, so it loads every record and filters in memory - the same
 * tradeoff `JsonFileProfileRepository.findByName` makes, appropriate at
 * this collection's expected size (a handful of runs per playbook, not
 * thousands).
 */
export class JsonFilePlaybookRunResultRepository implements PlaybookRunResultRepository {
  private readonly store: JsonFileStore<PlaybookRunResultSnapshot>;

  constructor(playbookRunsDirPath: string) {
    this.store = new JsonFileStore<PlaybookRunResultSnapshot>(playbookRunsDirPath);
  }

  async save(result: PlaybookRunResult): Promise<void> {
    await this.store.save(result.id, toSnapshot(result));
  }

  async findById(id: string): Promise<PlaybookRunResult | null> {
    const snapshot = await this.store.findById(id);
    return snapshot === null ? null : toDomain(snapshot);
  }

  async findAllByPlaybookId(playbookId: string): Promise<PlaybookRunResult[]> {
    const snapshots = await this.store.findAll();
    return snapshots.filter((snapshot) => snapshot.playbookId === playbookId).map(toDomain);
  }
}
