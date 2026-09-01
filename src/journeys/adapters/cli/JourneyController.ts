import type { Journey } from '../../domain/Journey.js';
import type { JourneyPresenter } from './JourneyPresenter.js';

/** Structural views of the three read-side use cases - see `RecordJourneyUseCaseLike` for why. */
export interface ListJourneysUseCaseLike {
  execute(): Promise<Journey[]>;
}
export interface ShowJourneyUseCaseLike {
  execute(id: string): Promise<Journey>;
}
export interface DeleteJourneyUseCaseLike {
  execute(id: string): Promise<void>;
}

export interface JourneyCommandOptions {
  json?: boolean;
  quiet?: boolean;
}

/**
 * Thin controller for `qamachine journey list|show|delete`. One class per
 * the brief's "one controller class per command family" rule, since these
 * three commands share the same read/delete-by-id shape and the same
 * presenter - splitting them into three classes would be ceremony, not
 * clarity.
 */
export class JourneyController {
  constructor(
    private readonly listUseCase: ListJourneysUseCaseLike,
    private readonly showUseCase: ShowJourneyUseCaseLike,
    private readonly deleteUseCase: DeleteJourneyUseCaseLike,
    private readonly presenter: JourneyPresenter,
  ) {}

  async list(options: JourneyCommandOptions): Promise<void> {
    const journeys = await this.listUseCase.execute();

    if (options.quiet === true) {
      return;
    }

    console.log(options.json === true ? this.presenter.toJson(journeys) : this.presenter.presentList(journeys));
  }

  async show(id: string, options: JourneyCommandOptions): Promise<void> {
    const journey = await this.showUseCase.execute(id);

    if (options.quiet === true) {
      return;
    }

    console.log(options.json === true ? this.presenter.toJson(journey) : this.presenter.present(journey));
  }

  async delete(id: string, options: JourneyCommandOptions): Promise<void> {
    await this.deleteUseCase.execute(id);

    if (options.quiet === true) {
      return;
    }

    console.log(options.json === true ? JSON.stringify({ deleted: id }) : `Deleted journey ${id}.`);
  }
}
