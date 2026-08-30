import type { Journey } from '../../domain/Journey.js';
import type { RecordJourneyInput } from '../../application/use-cases/RecordJourneyUseCase.js';
import type { JourneyPresenter } from './JourneyPresenter.js';

/**
 * Structural (not nominal) view of `RecordJourneyUseCase`: only the
 * `execute` method the controller actually calls. Declaring the dependency
 * this narrowly - rather than the concrete class - is what lets tests inject
 * a plain fake object instead of a real, fully-wired use case.
 */
export interface RecordJourneyUseCaseLike {
  execute(input: RecordJourneyInput): Promise<Journey>;
}

/**
 * CLI-facing shape of `record <url>`'s options, already coerced into typed
 * values by `commander` (viewport/geolocation parsed from their `WxH` /
 * `lat,long` flag syntax, `browser`/`colorScheme` validated against their
 * choice lists) - this controller's only job is renaming/selecting fields
 * into the use case's `RecordJourneyInput` DTO.
 */
export interface RecordCommandOptions {
  name: string;
  browser: RecordJourneyInput['browser'];
  /** Accepted but not yet wired to storage-state resolution - profiles land in Task 5. */
  profile?: string;
  viewport?: RecordJourneyInput['viewport'];
  device?: string;
  colorScheme?: RecordJourneyInput['colorScheme'];
  timezone?: string;
  lang?: string;
  geolocation?: RecordJourneyInput['geolocation'];
  json?: boolean;
  quiet?: boolean;
}

/**
 * Thin controller for `qamachine record <url>`: maps parsed CLI options into
 * `RecordJourneyInput`, calls `RecordJourneyUseCase`, and hands the result to
 * `JourneyPresenter`. No validation beyond "did the use case throw" - that
 * belongs in the domain/application layers.
 */
export class RecordJourneyController {
  constructor(
    private readonly useCase: RecordJourneyUseCaseLike,
    private readonly presenter: JourneyPresenter,
  ) {}

  async execute(url: string, options: RecordCommandOptions): Promise<void> {
    const journey = await this.useCase.execute({
      startUrl: url,
      name: options.name,
      browser: options.browser,
      viewport: options.viewport,
      device: options.device,
      colorScheme: options.colorScheme,
      timezone: options.timezone,
      lang: options.lang,
      geolocation: options.geolocation,
    });

    if (options.quiet === true) {
      return;
    }

    console.log(options.json === true ? this.presenter.toJson(journey) : this.presenter.present(journey));
  }
}
