import { createPlaybookRunResult, type PlaybookEntryResult, type PlaybookRunResult } from '../../domain/PlaybookRunResult.js';
import type { PlaybookEntry } from '../../domain/PlaybookEntry.js';
import type { PlaybookRepository } from '../ports/PlaybookRepository.js';
import type { PlaybookRunResultRepository } from '../ports/PlaybookRunResultRepository.js';
import { NotFoundError } from '../../../shared-kernel/application/errors.js';
import type { ClockPort } from '../../../shared-kernel/application/ports/ClockPort.js';
import type { IdGeneratorPort } from '../../../shared-kernel/application/ports/IdGeneratorPort.js';
import { createJourney, type Journey } from '../../../journeys/domain/Journey.js';
import type { JourneyRepository } from '../../../journeys/application/ports/JourneyRepository.js';
import type { JourneyRunnerPort, SupportedBrowser } from '../../../journeys/application/ports/JourneyRunnerPort.js';
import type { TemplateRepository } from '../../../templates/application/ports/TemplateRepository.js';
import type { AuthStateProviderPort } from '../../../profiles/application/ports/AuthStateProviderPort.js';
import type { ProfileRepository } from '../../../profiles/application/ports/ProfileRepository.js';

export interface RunPlaybookInput {
  playbookId: string;
  browser: SupportedBrowser;
  keepTrace: boolean;
  /** Builds the trace file path for one entry; only called when `keepTrace` is true. */
  tracePathFor?: (entryId: string) => string;
  /**
   * `--stop-on-first-failure`, forwarded from the CLI. See the WHY comment
   * at its point of use below for the precedence this establishes over each
   * entry's own stored `continueOnFailure`.
   */
  stopOnFirstFailure?: boolean;
}

/**
 * Runs every entry of a `Playbook` in order, as a single suite (project
 * requirement 3 - re-run a group of journeys/templates together to catch
 * unexpected breakage), and persists the aggregated `PlaybookRunResult`.
 * This is the orchestrator that ties journeys, templates and profiles
 * together: for each entry it resolves a runnable `Journey` (direct
 * `JourneyRepository.findById` for a journey source, or `Template.
 * instantiate` + a freshly-minted id/createdAt for a template source - the
 * same reconciliation `RunTemplateUseCase` already does, per Task 6's
 * "option (b)" ruling), resolves the effective profile's auth via
 * `AuthStateProviderPort.resolve` (never `.refresh()` - a playbook run only
 * ever reads whatever auth state already exists, it does not (re)drive a
 * login journey itself), and runs it via `JourneyRunnerPort` - the same
 * port `RunJourneyUseCase`/`RunTemplateUseCase` use.
 *
 * Stop-on-first-failure vs. continue-on-failure is implemented as a single
 * pass with a `haltRemaining` flag: once any entry fails, every remaining
 * entry is recorded `'skipped'` without being run, unless that failed
 * entry's own (possibly globally-overridden - see below) `continueOnFailure`
 * was `true`, in which case the loop proceeds to the next entry normally.
 */
export class RunPlaybookUseCase {
  constructor(
    private readonly playbookRepository: PlaybookRepository,
    private readonly journeyRepository: JourneyRepository,
    private readonly templateRepository: TemplateRepository,
    private readonly runner: JourneyRunnerPort,
    private readonly profileRepository: ProfileRepository,
    private readonly authStateProvider: AuthStateProviderPort,
    private readonly idGenerator: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly runResultRepository: PlaybookRunResultRepository,
  ) {}

  async execute(input: RunPlaybookInput): Promise<PlaybookRunResult> {
    const playbook = await this.playbookRepository.findById(input.playbookId);
    if (playbook == null) {
      throw new NotFoundError(`Playbook with id "${input.playbookId}" was not found.`);
    }

    const startedAt = this.clock.now();
    const entryResults: PlaybookEntryResult[] = [];
    let haltRemaining = false;

    for (const entry of playbook.entries) {
      if (haltRemaining) {
        entryResults.push({ entryId: entry.id, status: 'skipped', stepResults: [] });
        continue;
      }

      // WHY: journey/template resolution (`resolveJourney`) and profile
      // resolution (`resolveStorageStatePath`) both throw `NotFoundError`
      // for a bad id. Left uncaught, that would abort the whole `execute()`
      // call and discard every result already collected from prior entries
      // in this loop - contradicting the very 'failed'/'skipped' resilience
      // vocabulary this use case exists to produce. An unresolvable entry is
      // just another kind of entry failure, so it is caught here and folded
      // into the same failed-entry / halt-or-continue path a failed *run*
      // already goes through below, rather than being allowed to skip it.
      let journey: Journey;
      let storageStatePath: string | undefined;
      try {
        journey = await this.resolveJourney(entry);
        storageStatePath = await this.resolveStorageStatePath(entry.profileOverride);
      } catch (error) {
        entryResults.push({
          entryId: entry.id,
          status: 'failed',
          stepResults: [],
          error: error instanceof Error ? error.message : String(error),
        });

        if (!this.effectiveContinueOnFailure(entry, input)) {
          haltRemaining = true;
        }
        continue;
      }

      const tracePath =
        input.keepTrace && input.tracePathFor !== undefined ? input.tracePathFor(entry.id) : undefined;

      const runResult = await this.runner.run(journey, {
        browser: input.browser,
        storageStatePath,
        profileId: entry.profileOverride,
        keepTrace: input.keepTrace,
        tracePath,
      });

      const status = runResult.status === 'passed' ? 'passed' : 'failed';

      entryResults.push({
        entryId: entry.id,
        status,
        runId: runResult.id,
        journeyId: runResult.journeyId,
        profileId: runResult.profileId,
        startedAt: runResult.startedAt,
        finishedAt: runResult.finishedAt,
        stepResults: runResult.stepResults,
        tracePath: runResult.tracePath,
        error: runResult.error,
      });

      if (status === 'failed' && !this.effectiveContinueOnFailure(entry, input)) {
        haltRemaining = true;
      }
    }

    const finishedAt = this.clock.now();
    const result = createPlaybookRunResult({
      id: this.idGenerator.generate(),
      playbookId: playbook.id,
      startedAt,
      finishedAt,
      entryResults,
    });

    await this.runResultRepository.save(result);

    return result;
  }

  /**
   * WHY: --stop-on-first-failure is a GLOBAL override - when the CLI passes
   * it, every entry is treated as continueOnFailure:false regardless of
   * what is actually stored on that entry, because a caller who explicitly
   * asks the whole run to halt on first failure means that to win over any
   * individual entry's saved preference. Without the flag, the failed
   * entry's own stored value decides. Shared by both failure paths (a
   * resolution failure and a failed run) so they halt/continue identically.
   */
  private effectiveContinueOnFailure(entry: PlaybookEntry, input: RunPlaybookInput): boolean {
    return input.stopOnFirstFailure === true ? false : entry.continueOnFailure;
  }

  private async resolveJourney(entry: PlaybookEntry): Promise<Journey> {
    if (entry.source.type === 'journey') {
      const journey = await this.journeyRepository.findById(entry.source.journeyId);
      if (journey == null) {
        throw new NotFoundError(`Journey with id "${entry.source.journeyId}" was not found.`);
      }
      return journey;
    }

    const template = await this.templateRepository.findById(entry.source.templateId);
    if (template == null) {
      throw new NotFoundError(`Template with id "${entry.source.templateId}" was not found.`);
    }

    const draft = template.instantiate(entry.source.parameterBindings);

    return createJourney({
      id: this.idGenerator.generate(),
      name: draft.name,
      startUrl: draft.startUrl,
      createdAt: this.clock.now(),
      steps: draft.steps,
    });
  }

  private async resolveStorageStatePath(profileId: string | undefined): Promise<string | undefined> {
    if (profileId === undefined) {
      return undefined;
    }

    const profile = await this.profileRepository.findById(profileId);
    if (profile == null) {
      throw new NotFoundError(`Profile with id "${profileId}" was not found.`);
    }

    const { storageStatePath } = await this.authStateProvider.resolve(profile);
    return storageStatePath ?? undefined;
  }
}
