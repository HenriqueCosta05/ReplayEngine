import type { Template } from '../../domain/Template.js';
import type {
  CreateTemplateFromJourneyInput,
  CreateTemplateFromJourneyParameterInput,
} from '../../application/use-cases/CreateTemplateFromJourneyUseCase.js';
import type { TemplatePresenter } from './TemplatePresenter.js';

/** Structural (not nominal) views of the four use cases - see journeys' `RecordJourneyUseCaseLike` for why. */
export interface CreateTemplateUseCaseLike {
  execute(input: CreateTemplateFromJourneyInput): Promise<Template>;
}
export interface ListTemplatesUseCaseLike {
  execute(): Promise<Template[]>;
}
export interface ShowTemplateUseCaseLike {
  execute(id: string): Promise<Template>;
}
export interface DeleteTemplateUseCaseLike {
  execute(id: string): Promise<void>;
}

export interface TemplateCommandOptions {
  json?: boolean;
  quiet?: boolean;
}

export interface CreateTemplateCommandOptions extends TemplateCommandOptions {
  journeyId: string;
  name: string;
  /** Raw `--param <stepIndex>.<field>=<paramName>[:required][:default=<v>]` flag values, one per occurrence. */
  params?: readonly string[];
}

const PARAM_REQUIRED_MARKER = /:required(?=:|$)/;
const PARAM_DEFAULT_MARKER = ':default=';

/**
 * Parses one `--param` flag's raw value into the DTO shape
 * `CreateTemplateFromJourneyUseCase` expects. This is pure string-to-DTO
 * parsing only, per the brief: it does not check whether `targetStepIndex`
 * is actually in range, whether `targetField` is actually parameterizable
 * on that step, or whether `name` collides with another parameter -
 * `createTemplate` (reached through the use case) is the sole authority on
 * all of that.
 *
 * Grammar: `<stepIndex>.<field>=<paramName>[:required][:default=<value>]`.
 * `:required` and `:default=<value>` may appear in either order; everything
 * after `:default=` (including any further `:`) is taken verbatim as the
 * default value, so a default containing a colon (e.g. a URL like
 * `https://example.com`) parses correctly.
 */
export function parseTemplateParameterFlag(raw: string): CreateTemplateFromJourneyParameterInput {
  const equalsIndex = raw.indexOf('=');
  if (equalsIndex === -1) {
    throw new Error(
      `--param "${raw}" must look like <stepIndex>.<field>=<paramName>[:required][:default=<value>].`,
    );
  }

  const target = raw.slice(0, equalsIndex);
  let tail = raw.slice(equalsIndex + 1);

  const dotIndex = target.indexOf('.');
  if (dotIndex === -1) {
    throw new Error(`--param "${raw}" is missing "<stepIndex>.<field>" before "=".`);
  }

  const targetStepIndex = Number(target.slice(0, dotIndex));
  const targetField = target.slice(dotIndex + 1);
  if (!Number.isInteger(targetStepIndex) || targetStepIndex < 0) {
    throw new Error(`--param "${raw}" has an invalid step index; must be a non-negative integer.`);
  }
  if (targetField.length === 0) {
    throw new Error(`--param "${raw}" is missing a target field name.`);
  }

  const requiredMatch = PARAM_REQUIRED_MARKER.exec(tail);
  const required = requiredMatch !== null;
  if (requiredMatch !== null) {
    tail = tail.slice(0, requiredMatch.index) + tail.slice(requiredMatch.index + requiredMatch[0].length);
  }

  let defaultValue: string | undefined;
  const defaultIndex = tail.indexOf(PARAM_DEFAULT_MARKER);
  if (defaultIndex !== -1) {
    defaultValue = tail.slice(defaultIndex + PARAM_DEFAULT_MARKER.length);
    tail = tail.slice(0, defaultIndex);
  }

  if (tail.length === 0) {
    throw new Error(`--param "${raw}" is missing a parameter name.`);
  }

  return {
    targetStepIndex,
    targetField,
    name: tail,
    required,
    ...(defaultValue !== undefined ? { defaultValue } : {}),
  };
}

/**
 * Thin controller for `qamachine template create|list|show|delete`. One
 * class per command family, per the `JourneyController`/`ProfileController`
 * precedent.
 */
export class TemplateController {
  constructor(
    private readonly createUseCase: CreateTemplateUseCaseLike,
    private readonly listUseCase: ListTemplatesUseCaseLike,
    private readonly showUseCase: ShowTemplateUseCaseLike,
    private readonly deleteUseCase: DeleteTemplateUseCaseLike,
    private readonly presenter: TemplatePresenter,
  ) {}

  async create(options: CreateTemplateCommandOptions): Promise<void> {
    const template = await this.createUseCase.execute({
      journeyId: options.journeyId,
      name: options.name,
      parameters: (options.params ?? []).map(parseTemplateParameterFlag),
    });

    if (options.quiet === true) {
      return;
    }

    console.log(options.json === true ? this.presenter.toJson(template) : this.presenter.present(template));
  }

  async list(options: TemplateCommandOptions): Promise<void> {
    const templates = await this.listUseCase.execute();

    if (options.quiet === true) {
      return;
    }

    console.log(options.json === true ? this.presenter.toJson(templates) : this.presenter.presentList(templates));
  }

  async show(id: string, options: TemplateCommandOptions): Promise<void> {
    const template = await this.showUseCase.execute(id);

    if (options.quiet === true) {
      return;
    }

    console.log(options.json === true ? this.presenter.toJson(template) : this.presenter.present(template));
  }

  async delete(id: string, options: TemplateCommandOptions): Promise<void> {
    await this.deleteUseCase.execute(id);

    if (options.quiet === true) {
      return;
    }

    console.log(options.json === true ? JSON.stringify({ deleted: id }) : `Deleted template ${id}.`);
  }
}
