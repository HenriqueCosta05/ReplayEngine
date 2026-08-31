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
import { StorageStateAuthStateProvider } from '../profiles/adapters/auth/StorageStateAuthStateProvider.js';
import { ProfileController } from '../profiles/adapters/cli/ProfileController.js';
import { ProfilePresenter } from '../profiles/adapters/cli/ProfilePresenter.js';
import { RefreshProfileController } from '../profiles/adapters/cli/RefreshProfileController.js';
import { JsonFileProfileRepository } from '../profiles/adapters/persistence/JsonFileProfileRepository.js';
import { ListProfilesUseCase } from '../profiles/application/use-cases/ListProfilesUseCase.js';
import { RefreshProfileAuthUseCase } from '../profiles/application/use-cases/RefreshProfileAuthUseCase.js';
import { RegisterProfileUseCase } from '../profiles/application/use-cases/RegisterProfileUseCase.js';
import { ShowProfileUseCase } from '../profiles/application/use-cases/ShowProfileUseCase.js';
import { RunTemplateController } from '../templates/adapters/cli/RunTemplateController.js';
import { TemplateController } from '../templates/adapters/cli/TemplateController.js';
import { TemplatePresenter } from '../templates/adapters/cli/TemplatePresenter.js';
import { JsonFileTemplateRepository } from '../templates/adapters/persistence/JsonFileTemplateRepository.js';
import { CreateTemplateFromJourneyUseCase } from '../templates/application/use-cases/CreateTemplateFromJourneyUseCase.js';
import { DeleteTemplateUseCase } from '../templates/application/use-cases/DeleteTemplateUseCase.js';
import { ListTemplatesUseCase } from '../templates/application/use-cases/ListTemplatesUseCase.js';
import { RunTemplateUseCase } from '../templates/application/use-cases/RunTemplateUseCase.js';
import { ShowTemplateUseCase } from '../templates/application/use-cases/ShowTemplateUseCase.js';
import { PlaybookController } from '../playbooks/adapters/cli/PlaybookController.js';
import { PlaybookPresenter } from '../playbooks/adapters/cli/PlaybookPresenter.js';
import { PlaybookRunPresenter } from '../playbooks/adapters/cli/PlaybookRunPresenter.js';
import { RunPlaybookController } from '../playbooks/adapters/cli/RunPlaybookController.js';
import { JsonFilePlaybookRepository } from '../playbooks/adapters/persistence/JsonFilePlaybookRepository.js';
import { JsonFilePlaybookRunResultRepository } from '../playbooks/adapters/persistence/JsonFilePlaybookRunResultRepository.js';
import { AddEntryToPlaybookUseCase } from '../playbooks/application/use-cases/AddEntryToPlaybookUseCase.js';
import { CreatePlaybookUseCase } from '../playbooks/application/use-cases/CreatePlaybookUseCase.js';
import { ListPlaybookRunsUseCase } from '../playbooks/application/use-cases/ListPlaybookRunsUseCase.js';
import { ListPlaybooksUseCase } from '../playbooks/application/use-cases/ListPlaybooksUseCase.js';
import { RunPlaybookUseCase } from '../playbooks/application/use-cases/RunPlaybookUseCase.js';
import { ShowPlaybookRunUseCase } from '../playbooks/application/use-cases/ShowPlaybookRunUseCase.js';
import { ShowPlaybookUseCase } from '../playbooks/application/use-cases/ShowPlaybookUseCase.js';

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
  profileController: ProfileController;
  refreshProfileController: RefreshProfileController;
  templateController: TemplateController;
  runTemplateController: RunTemplateController;
  playbookController: PlaybookController;
  runPlaybookController: RunPlaybookController;
}

export function buildContainer(options: ContainerOptions = {}): Container {
  const dataRoot = options.home ?? resolveDataRoot();
  const journeysDirPath = path.join(dataRoot, 'journeys');
  const tracesDirPath = path.join(dataRoot, 'traces');
  const profilesDirPath = path.join(dataRoot, 'profiles');
  const templatesDirPath = path.join(dataRoot, 'templates');
  const playbooksDirPath = path.join(dataRoot, 'playbooks');
  const playbookRunsDirPath = path.join(dataRoot, 'playbook-runs');

  const clock = new SystemClock();
  const idGenerator = new CryptoIdGenerator();

  const journeyRepository = new JsonFileJourneyRepository(journeysDirPath);
  const journeyRecorder = new PlaywrightCodegenJourneyRecorder();
  const journeyRunner = new PlaywrightStepInterpreter(idGenerator, clock);

  const profileRepository = new JsonFileProfileRepository(profilesDirPath);
  // The one place `profiles` depends on `journeys`' application ports - see
  // `StorageStateAuthStateProvider`'s doc comment for why that is legitimate.
  const authStateProvider = new StorageStateAuthStateProvider(journeyRepository, journeyRunner);

  const recordJourneyUseCase = new RecordJourneyUseCase(
    journeyRecorder,
    journeyRepository,
    idGenerator,
    clock,
    profileRepository,
    authStateProvider,
  );
  const runJourneyUseCase = new RunJourneyUseCase(journeyRepository, journeyRunner, profileRepository, authStateProvider);
  const listJourneysUseCase = new ListJourneysUseCase(journeyRepository);
  const showJourneyUseCase = new ShowJourneyUseCase(journeyRepository);
  const deleteJourneyUseCase = new DeleteJourneyUseCase(journeyRepository);

  const registerProfileUseCase = new RegisterProfileUseCase(profileRepository, idGenerator, clock);
  const listProfilesUseCase = new ListProfilesUseCase(profileRepository);
  const showProfileUseCase = new ShowProfileUseCase(profileRepository);
  const refreshProfileAuthUseCase = new RefreshProfileAuthUseCase(profileRepository, authStateProvider, clock);

  const templateRepository = new JsonFileTemplateRepository(templatesDirPath);
  const createTemplateFromJourneyUseCase = new CreateTemplateFromJourneyUseCase(
    journeyRepository,
    templateRepository,
    idGenerator,
    clock,
  );
  const listTemplatesUseCase = new ListTemplatesUseCase(templateRepository);
  const showTemplateUseCase = new ShowTemplateUseCase(templateRepository);
  const deleteTemplateUseCase = new DeleteTemplateUseCase(templateRepository);
  const runTemplateUseCase = new RunTemplateUseCase(
    templateRepository,
    journeyRunner,
    idGenerator,
    clock,
    profileRepository,
    authStateProvider,
  );

  const playbookRepository = new JsonFilePlaybookRepository(playbooksDirPath);
  const playbookRunResultRepository = new JsonFilePlaybookRunResultRepository(playbookRunsDirPath);
  const createPlaybookUseCase = new CreatePlaybookUseCase(playbookRepository, idGenerator, clock);
  const addEntryToPlaybookUseCase = new AddEntryToPlaybookUseCase(
    playbookRepository,
    journeyRepository,
    templateRepository,
    profileRepository,
    idGenerator,
  );
  const listPlaybooksUseCase = new ListPlaybooksUseCase(playbookRepository);
  const showPlaybookUseCase = new ShowPlaybookUseCase(playbookRepository);
  const listPlaybookRunsUseCase = new ListPlaybookRunsUseCase(playbookRepository, playbookRunResultRepository);
  const showPlaybookRunUseCase = new ShowPlaybookRunUseCase(playbookRunResultRepository);
  const runPlaybookUseCase = new RunPlaybookUseCase(
    playbookRepository,
    journeyRepository,
    templateRepository,
    journeyRunner,
    profileRepository,
    authStateProvider,
    idGenerator,
    clock,
    playbookRunResultRepository,
  );

  const journeyPresenter = new JourneyPresenter();
  const journeyRunPresenter = new JourneyRunPresenter();
  const profilePresenter = new ProfilePresenter();
  const templatePresenter = new TemplatePresenter();
  const playbookPresenter = new PlaybookPresenter();
  const playbookRunPresenter = new PlaybookRunPresenter();

  return {
    recordJourneyController: new RecordJourneyController(recordJourneyUseCase, journeyPresenter),
    journeyController: new JourneyController(
      listJourneysUseCase,
      showJourneyUseCase,
      deleteJourneyUseCase,
      journeyPresenter,
    ),
    runJourneyController: new RunJourneyController(runJourneyUseCase, journeyRunPresenter, tracesDirPath),
    profileController: new ProfileController(
      registerProfileUseCase,
      listProfilesUseCase,
      showProfileUseCase,
      profilePresenter,
    ),
    refreshProfileController: new RefreshProfileController(refreshProfileAuthUseCase, profilePresenter),
    templateController: new TemplateController(
      createTemplateFromJourneyUseCase,
      listTemplatesUseCase,
      showTemplateUseCase,
      deleteTemplateUseCase,
      templatePresenter,
    ),
    runTemplateController: new RunTemplateController(runTemplateUseCase, journeyRunPresenter, tracesDirPath),
    playbookController: new PlaybookController(
      createPlaybookUseCase,
      addEntryToPlaybookUseCase,
      listPlaybooksUseCase,
      showPlaybookUseCase,
      listPlaybookRunsUseCase,
      showPlaybookRunUseCase,
      playbookPresenter,
      playbookRunPresenter,
    ),
    runPlaybookController: new RunPlaybookController(runPlaybookUseCase, playbookRunPresenter, tracesDirPath),
  };
}
