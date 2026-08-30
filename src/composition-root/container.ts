import path from 'node:path';

import { resolveDataRoot } from '../infrastructure/paths.js';
import { CryptoIdGenerator } from '../shared-kernel/adapters/CryptoIdGenerator.js';
import { SystemClock } from '../shared-kernel/adapters/SystemClock.js';
import { JourneyController } from '../journeys/adapters/cli/JourneyController.js';
import { JourneyPresenter } from '../journeys/adapters/cli/JourneyPresenter.js';
import { JourneyRunPresenter } from '../journeys/adapters/cli/JourneyRunPresenter.js';
import { RecordJourneyController } from '../journeys/adapters/cli/RecordJourneyController.js';
import { RunJourneyController } from '../journeys/adapters/cli/RunJourneyController.js';
import { PlaywrightStepInterpreter } from '../journeys/adapters/execution/PlaywrightStepInterpreter.js';
import { JsonFileJourneyRepository } from '../journeys/adapters/persistence/JsonFileJourneyRepository.js';
import { PlaywrightCodegenJourneyRecorder } from '../journeys/adapters/recording/PlaywrightCodegenJourneyRecorder.js';
import { DeleteJourneyUseCase } from '../journeys/application/use-cases/DeleteJourneyUseCase.js';
import { ListJourneysUseCase } from '../journeys/application/use-cases/ListJourneysUseCase.js';
import { RecordJourneyUseCase } from '../journeys/application/use-cases/RecordJourneyUseCase.js';
import { RunJourneyUseCase } from '../journeys/application/use-cases/RunJourneyUseCase.js';
import { ShowJourneyUseCase } from '../journeys/application/use-cases/ShowJourneyUseCase.js';

export interface ContainerOptions {
  /** Overrides `resolveDataRoot()` - this is the `--home` / `QAMACHINE_HOME` seam. */
  home?: string;
}

/**
 * Everything a CLI command needs, fully wired. `buildContainer` is the only
 * place in the codebase (besides `cli.ts`, which only calls it) that `new`s
 * a concrete adapter and hands it to a use case or controller - every other
 * layer depends on ports/interfaces only.
 */
export interface Container {
  recordJourneyController: RecordJourneyController;
  journeyController: JourneyController;
  runJourneyController: RunJourneyController;
}

export function buildContainer(options: ContainerOptions = {}): Container {
  const dataRoot = options.home ?? resolveDataRoot();
  const journeysDirPath = path.join(dataRoot, 'journeys');
  const tracesDirPath = path.join(dataRoot, 'traces');

  const clock = new SystemClock();
  const idGenerator = new CryptoIdGenerator();

  const journeyRepository = new JsonFileJourneyRepository(journeysDirPath);
  const journeyRecorder = new PlaywrightCodegenJourneyRecorder();
  const journeyRunner = new PlaywrightStepInterpreter(idGenerator, clock);

  const recordJourneyUseCase = new RecordJourneyUseCase(journeyRecorder, journeyRepository, idGenerator, clock);
  const runJourneyUseCase = new RunJourneyUseCase(journeyRepository, journeyRunner);
  const listJourneysUseCase = new ListJourneysUseCase(journeyRepository);
  const showJourneyUseCase = new ShowJourneyUseCase(journeyRepository);
  const deleteJourneyUseCase = new DeleteJourneyUseCase(journeyRepository);

  const journeyPresenter = new JourneyPresenter();
  const journeyRunPresenter = new JourneyRunPresenter();

  return {
    recordJourneyController: new RecordJourneyController(recordJourneyUseCase, journeyPresenter),
    journeyController: new JourneyController(
      listJourneysUseCase,
      showJourneyUseCase,
      deleteJourneyUseCase,
      journeyPresenter,
    ),
    runJourneyController: new RunJourneyController(runJourneyUseCase, journeyRunPresenter, tracesDirPath),
  };
}
