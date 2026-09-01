import type { PlaybookEntrySource } from '../../domain/PlaybookEntry.js';

/**
 * The on-disk shape of a `PlaybookEntry`. `source` is reused verbatim from
 * `playbooks/domain/PlaybookEntry.ts` rather than re-declared here: it is
 * already a plain, JSON-serialisable discriminated union (strings and a
 * `Record<string,string>`, no `Date`/class instances), unlike e.g.
 * `Template`'s `Step`/`Action` snapshot fields which need their own
 * adapters-layer shape.
 */
export interface PlaybookEntrySnapshot {
  id: string;
  source: PlaybookEntrySource;
  profileOverride?: string;
  continueOnFailure: boolean;
}

/**
 * The on-disk shape of a `Playbook`: structurally identical to the domain
 * entity except that `createdAt` is an ISO-8601 string rather than a `Date`,
 * because JSON has no date type.
 */
export interface PlaybookSnapshot {
  id: string;
  name: string;
  createdAt: string;
  entries: PlaybookEntrySnapshot[];
}
