import type { Playbook } from '../../domain/Playbook.js';
import type { PlaybookEntrySource } from '../../domain/PlaybookEntry.js';
import type { PlaybookRunResult } from '../../domain/PlaybookRunResult.js';
import type { CreatePlaybookInput } from '../../application/use-cases/CreatePlaybookUseCase.js';
import type { AddEntryToPlaybookInput } from '../../application/use-cases/AddEntryToPlaybookUseCase.js';
import type { PlaybookPresenter } from './PlaybookPresenter.js';
import type { PlaybookRunPresenter } from './PlaybookRunPresenter.js';

/** Structural (not nominal) views of the five non-run use cases - see journeys' `RecordJourneyUseCaseLike` for why. */
export interface CreatePlaybookUseCaseLike {
  execute(input: CreatePlaybookInput): Promise<Playbook>;
}
export interface AddEntryToPlaybookUseCaseLike {
  execute(input: AddEntryToPlaybookInput): Promise<Playbook>;
}
export interface ListPlaybooksUseCaseLike {
  execute(): Promise<Playbook[]>;
}
export interface ShowPlaybookUseCaseLike {
  execute(id: string): Promise<Playbook>;
}
export interface ListPlaybookRunsUseCaseLike {
  execute(playbookId: string): Promise<PlaybookRunResult[]>;
}
export interface ShowPlaybookRunUseCaseLike {
  execute(id: string): Promise<PlaybookRunResult>;
}

export interface PlaybookCommandOptions {
  json?: boolean;
  quiet?: boolean;
}

export interface CreatePlaybookCommandOptions extends PlaybookCommandOptions {
  name: string;
}

export interface AddEntryToPlaybookCommandOptions extends PlaybookCommandOptions {
  journey?: string;
  template?: string;
  /** Raw `--param name=value` flag values, one per occurrence; only meaningful with `--template`. */
  params?: readonly string[];
  profile?: string;
  continueOnFailure?: boolean;
}

/**
 * Parses one `--param name=value` flag value for `playbook add-entry`. Pure
 * string parsing - same grammar as `template run`'s `--param`, see
 * `parseTemplateRunParamFlag`.
 */
export function parsePlaybookEntryParamFlag(raw: string): [name: string, value: string] {
  const equalsIndex = raw.indexOf('=');
  if (equalsIndex === -1) {
    throw new Error(`--param "${raw}" must look like <name>=<value>.`);
  }

  const name = raw.slice(0, equalsIndex);
  const value = raw.slice(equalsIndex + 1);
  if (name.length === 0) {
    throw new Error(`--param "${raw}" is missing a parameter name before "=".`);
  }

  return [name, value];
}

/**
 * Builds the `PlaybookEntrySource` discriminated union from whichever of
 * `--journey`/`--template` the CLI options carry. Exactly one of the two
 * must be given - this is controller-level input validation, not business
 * logic (the use case validates that the referenced journey/template
 * actually exists), so a plain thrown `Error` is used here, same as
 * `parseTemplateParameterFlag`'s validation.
 */
export function buildPlaybookEntrySource(options: AddEntryToPlaybookCommandOptions): PlaybookEntrySource {
  if (options.journey !== undefined && options.template !== undefined) {
    throw new Error('playbook add-entry accepts exactly one of --journey or --template, not both.');
  }
  if (options.journey !== undefined) {
    return { type: 'journey', journeyId: options.journey };
  }
  if (options.template !== undefined) {
    return {
      type: 'template',
      templateId: options.template,
      parameterBindings: Object.fromEntries((options.params ?? []).map(parsePlaybookEntryParamFlag)),
    };
  }
  throw new Error('playbook add-entry requires exactly one of --journey or --template.');
}

/**
 * Thin controller for `qamachine playbook create|add-entry|list|show|runs|
 * show-run`. One method per subcommand, per the `TemplateController`
 * precedent. `run`/`show-run`'s single-run presentation lives on
 * `PlaybookRunPresenter`; `run` itself is `RunPlaybookController` (a
 * separate class, mirroring `RunTemplateController`), but `runs`/`show-run`
 * are read-only listing commands and belong here alongside the rest of this
 * feature's CRUD-ish surface.
 */
export class PlaybookController {
  constructor(
    private readonly createUseCase: CreatePlaybookUseCaseLike,
    private readonly addEntryUseCase: AddEntryToPlaybookUseCaseLike,
    private readonly listUseCase: ListPlaybooksUseCaseLike,
    private readonly showUseCase: ShowPlaybookUseCaseLike,
    private readonly listRunsUseCase: ListPlaybookRunsUseCaseLike,
    private readonly showRunUseCase: ShowPlaybookRunUseCaseLike,
    private readonly presenter: PlaybookPresenter,
    private readonly runPresenter: PlaybookRunPresenter,
  ) {}

  async create(options: CreatePlaybookCommandOptions): Promise<void> {
    const playbook = await this.createUseCase.execute({ name: options.name });

    if (options.quiet === true) {
      return;
    }

    console.log(options.json === true ? this.presenter.toJson(playbook) : this.presenter.present(playbook));
  }

  async addEntry(playbookId: string, options: AddEntryToPlaybookCommandOptions): Promise<void> {
    const source = buildPlaybookEntrySource(options);

    const playbook = await this.addEntryUseCase.execute({
      playbookId,
      source,
      ...(options.profile !== undefined ? { profileOverride: options.profile } : {}),
      continueOnFailure: options.continueOnFailure === true,
    });

    if (options.quiet === true) {
      return;
    }

    console.log(options.json === true ? this.presenter.toJson(playbook) : this.presenter.present(playbook));
  }

  async list(options: PlaybookCommandOptions): Promise<void> {
    const playbooks = await this.listUseCase.execute();

    if (options.quiet === true) {
      return;
    }

    console.log(options.json === true ? this.presenter.toJson(playbooks) : this.presenter.presentList(playbooks));
  }

  async show(id: string, options: PlaybookCommandOptions): Promise<void> {
    const playbook = await this.showUseCase.execute(id);

    if (options.quiet === true) {
      return;
    }

    console.log(options.json === true ? this.presenter.toJson(playbook) : this.presenter.present(playbook));
  }

  async runs(playbookId: string, options: PlaybookCommandOptions): Promise<void> {
    const results = await this.listRunsUseCase.execute(playbookId);

    if (options.quiet === true) {
      return;
    }

    console.log(
      options.json === true ? this.runPresenter.toJson(results) : this.runPresenter.presentList(results),
    );
  }

  async showRun(runId: string, options: PlaybookCommandOptions): Promise<void> {
    const result = await this.showRunUseCase.execute(runId);

    if (options.quiet === true) {
      return;
    }

    console.log(options.json === true ? this.runPresenter.toJson(result) : this.runPresenter.present(result));
  }
}
