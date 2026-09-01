import { DomainError } from './errors.js';

/**
 * Where a `PlaybookEntry` gets its runnable steps from: a `Journey` (loaded
 * verbatim via `JourneyRepository`) or a `Template` (instantiated against
 * `parameterBindings` via `Template.instantiate`). This is a plain,
 * JSON-serialisable discriminated union - no `Date`/class instances inside
 * it - so it can be persisted as-is by the adapters/persistence snapshot.
 */
export type PlaybookEntrySource =
  | { readonly type: 'journey'; readonly journeyId: string }
  | { readonly type: 'template'; readonly templateId: string; readonly parameterBindings: Record<string, string> };

export interface CreatePlaybookEntryInput {
  id: string;
  source: PlaybookEntrySource;
  profileOverride?: string;
  continueOnFailure: boolean;
}

/**
 * One member of a `Playbook`'s ordered entry list: what to run
 * (`source`), which profile's auth to use instead of running
 * unauthenticated (`profileOverride`, resolved the same way `--profile`
 * is on `journey run`/`template run`), and whether a failure of this
 * specific entry should still let the rest of the playbook run
 * (`continueOnFailure`) - see `RunPlaybookUseCase` for how that flag is
 * actually applied.
 */
export interface PlaybookEntry {
  readonly id: string;
  readonly source: PlaybookEntrySource;
  readonly profileOverride?: string;
  readonly continueOnFailure: boolean;
}

function isPlainStringRecord(value: unknown): value is Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.values(value as Record<string, unknown>).every((entry) => typeof entry === 'string');
}

export function createPlaybookEntry(input: CreatePlaybookEntryInput): PlaybookEntry {
  if (input == null || typeof input.id !== 'string' || input.id.length === 0) {
    throw new DomainError('PlaybookEntry id must be a non-empty string.');
  }
  if (input.source == null || typeof input.source !== 'object') {
    throw new DomainError('PlaybookEntry source must be an object.');
  }

  if (input.source.type === 'journey') {
    if (typeof input.source.journeyId !== 'string' || input.source.journeyId.length === 0) {
      throw new DomainError('PlaybookEntry journey source must have a non-empty journeyId.');
    }
  } else if (input.source.type === 'template') {
    if (typeof input.source.templateId !== 'string' || input.source.templateId.length === 0) {
      throw new DomainError('PlaybookEntry template source must have a non-empty templateId.');
    }
    if (!isPlainStringRecord(input.source.parameterBindings)) {
      throw new DomainError(
        'PlaybookEntry template source parameterBindings must be a string-keyed record of strings.',
      );
    }
  } else {
    throw new DomainError(
      `PlaybookEntry source type must be "journey" or "template", got "${String(
        (input.source as { type?: unknown }).type,
      )}".`,
    );
  }

  if (
    input.profileOverride !== undefined &&
    (typeof input.profileOverride !== 'string' || input.profileOverride.length === 0)
  ) {
    throw new DomainError('PlaybookEntry profileOverride, when provided, must be a non-empty string.');
  }
  if (typeof input.continueOnFailure !== 'boolean') {
    throw new DomainError('PlaybookEntry continueOnFailure must be a boolean.');
  }

  return {
    id: input.id,
    source: input.source,
    ...(input.profileOverride !== undefined ? { profileOverride: input.profileOverride } : {}),
    continueOnFailure: input.continueOnFailure,
  };
}
