# Plan: QAMachine — Blackbox Playwright Journey/Playbook CLI

## Context

Greenfield CLI in an empty repo. Full architecture already approved by the user — see the Context/Key-Architectural-Decision sections below, which are the same design approved via ExitPlanMode (source: `C:\Users\Henri\.claude\plans\clean-code-based-on-the-radiant-riddle.md`). This file breaks that approved design into ordered, bite-sized implementation tasks for subagent-driven-development. Tasks are sequential — later tasks depend on earlier ones (journeys before templates/playbooks/profiles), so dispatch in numeric order, never in parallel.

Confirmed user decisions: TypeScript; project-local `./.qamachine` data directory; Chromium + Firefox + WebKit all supported in v1; trace files opt-in only via `--keep-trace`.

## Global Constraints

**Clean Architecture (binding, from the `clean-architecture` skill):**
- Dependency Rule: source imports point inward only. `domain/` never imports `application/`, `adapters/`, `infrastructure/`, or any package (`playwright`, `@playwright/test`, `commander`, `acorn`, `picocolors`, `node:*` fs/child_process). `application/` never imports `adapters/` or `infrastructure/`, and never imports `playwright`/`@playwright/test`/`commander` — only its own `ports/` interfaces and `domain/`. `adapters/` implements ports and may import `domain/` + `application/ports` + external libraries; it must not contain business rules. `infrastructure/composition-root` is the only place concrete adapters are `new`'d and wired to use cases.
- No god services: one use case = one application action. No generic `*Service` classes.
- Entities/value objects guard their own invariants at construction (throw a domain error immediately, never let an invalid object be built then checked later).
- Feature-oriented folders (`journeys/`, `templates/`, `playbooks/`, `profiles/`), each with its own `domain/`, `application/{ports,use-cases}`, `adapters/{...}` — not generic `controllers/`, `services/`, `models/` buckets at the top level.

**Tech stack (fixed for all tasks):** TypeScript (strict), ESM (`"type": "module"`), Node ≥18. `commander` for CLI. `playwright` (raw package, not the test runner) for browser automation + tracing. `@playwright/test`'s `expect` imported as a **library only** (never its test runner/fixtures) for retrying assertions in the step interpreter. `acorn` + `acorn-walk` for parsing codegen output. `picocolors` for CLI color. `crypto.randomUUID()` for IDs — no `uuid` dependency. Vitest for tests. Package manager: npm.

**Data layout:** `./.qamachine/<collection>/<id>.json` — one file per entity (journeys, templates, playbooks, playbook-runs, profiles). `./.qamachine/profiles/<profileId>/storageState.json` for Playwright auth state. `./.qamachine/traces/<runId>/<entryId>.zip` only when `--keep-trace` is passed.

**Commit discipline:** one commit per task (implementer commits at the end of its task), Conventional-Commits-style subject lines (`feat(journeys): add domain entities`, etc.) are fine but not mandatory — clarity over ceremony.

**Testing discipline (binding, from `clean-architecture` + `test-driven-development`):** domain and application-layer tests must run with zero I/O — no real filesystem, browser, or subprocess; use hand-written in-memory fakes for every port. Adapter-layer tests may touch real filesystem/temp dirs/fixture HTML but must be excluded from the default `npm test` run and live under a separate `npm run test:e2e-adapters` script — the default `npm test` must stay fast (a few seconds) and runnable with zero installed browsers.

**Known ruling on the codegen spike (already decided — do not re-litigate):** subagents cannot drive an interactive `playwright codegen` browser session (it requires a human clicking in a real window). Task 0 and Task 3 therefore use **hand-authored fixture files** written to match Playwright's documented, stable codegen output shape (`import { test, expect } from '@playwright/test'; test('test', async ({ page }) => { await page.goto(...); await page.getByRole('button', { name: 'X' }).click(); await expect(page.getByText('Y')).toBeVisible(); ... });`) rather than a live-captured spike. This is flagged in the ledger as a known limitation: the parser's fixture suite should be re-validated against a real `playwright codegen` run by a human before this ships.

---

## Task 0: Project scaffolding

Set up the buildable, testable, lintable TypeScript project skeleton with Clean-Architecture boundaries enforced by tooling. No business logic in this task.

Steps:
1. `package.json`: name `qamachine`, `"type": "module"`, `"bin": {"qamachine": "./dist/main.js"}`, `engines.node >= 18`. Scripts: `build` (`tsc -p tsconfig.json`), `dev` (`tsx bin/qamachine.ts`), `test` (`vitest run --dir src --dir test/unit`), `test:e2e-adapters` (`vitest run --dir test/e2e-adapters`), `lint` (`eslint .`).
2. Runtime deps: `playwright`, `@playwright/test`, `commander`, `acorn`, `acorn-walk`, `picocolors`. Dev deps: `typescript`, `vitest`, `@types/node`, `tsx`, `eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `eslint-plugin-boundaries`. Run `npm install`.
3. `tsconfig.json`: `strict: true`, `target: ES2022`, `module: NodeNext`, `moduleResolution: NodeNext`, `outDir: dist`, `rootDir: .`, include `bin/**/*.ts` and `src/**/*.ts`.
4. `vitest.config.ts`: default test glob covers `src/**/*.test.ts` and `test/unit/**/*.test.ts`; a separate config or `--dir` flag (as wired into the `test:e2e-adapters` script above) covers `test/e2e-adapters/**/*.test.ts` only when explicitly invoked.
5. `.eslintrc.cjs` (or flat `eslint.config.js`) using `eslint-plugin-boundaries` with element types `domain`, `application`, `adapters`, `infrastructure` mapped from each feature folder's subpaths (e.g. `src/*/domain/**` → `domain`, `src/*/application/**` → `application`, `src/*/adapters/**` → `adapters`, `src/infrastructure/**` and `src/composition-root/**` → `infrastructure`), with rules: `domain` cannot import `application`/`adapters`/`infrastructure`; `application` cannot import `adapters`/`infrastructure`. Also add a `no-restricted-imports` rule scoped to `src/**/domain/**` and `src/**/application/**` banning `playwright`, `@playwright/test`, `commander`, `acorn`, `acorn-walk`, `node:child_process`, `node:fs`. Write one deliberately-violating scratch file, run `npx eslint .`, confirm it's flagged, then delete the scratch file — this proves enforcement is live (record the proof in your report).
6. Create the full folder skeleton (empty dirs won't survive git, so add a `.gitkeep` or a one-line `index.ts` placeholder only where TypeScript's `rootDir` needs *something* — do not add speculative code):
   ```
   bin/
   src/journeys/{domain,application/{ports,use-cases},adapters/{cli,recording,execution,persistence}}
   src/templates/{domain,application/{ports,use-cases},adapters/{cli,persistence}}
   src/playbooks/{domain,application/{ports,use-cases},adapters/{cli,persistence}}
   src/profiles/{domain,application/{ports,use-cases},adapters/{cli,auth,persistence}}
   src/shared-kernel/{domain,application/ports,adapters}
   src/infrastructure/
   src/composition-root/
   test/{fixtures/{codegen-output,pages},unit,e2e-adapters}
   ```
7. `docs/ARCHITECTURE.md`: a short (under 150 lines) write-up of the layer boundaries and the codegen/interpreter decision from Global Constraints above, for future readers — not a copy of this whole plan.
8. `README.md`: update with install/build/test/dev commands and a one-paragraph description of the 4 features (record, template, playbook, profile).

Verification: `npm run build` succeeds with zero TS errors. `npm test` runs (even with zero tests, `vitest run` should exit 0 — if it errors on "no test files", add a single trivial passing smoke test under `test/unit/smoke.test.ts` asserting `1 + 1 === 2`, to be deleted once Task 1 adds real tests). `npx eslint .` runs clean. Commit.

---

## Task 1: Journeys domain + shared-kernel

Implement `src/shared-kernel/domain/EntityId.ts` (a branded-string or thin wrapper type, plus a `isValidEntityId` guard if useful — keep minimal) and the full `journeys` domain layer. Pure TypeScript, zero imports outside `domain/` and Node's type-only built-ins (no `node:fs`, no `node:crypto` at runtime inside domain — IDs and timestamps are *passed in* to constructors, generated by ports in the application layer, never generated inside domain objects).

Files (`src/journeys/domain/`):
- `Locator.ts` — value object `{strategy: 'role'|'testId'|'text'|'label'|'placeholder'|'altText'|'title'|'css', value: string, options?: {name?: string, exact?: boolean, nth?: number}}`. Factory function `createLocator(input)` throws `DomainError` if `value` is empty or `strategy` isn't one of the known 8.
- `Action.ts` — discriminated union on a `kind` field: `GotoAction{kind:'goto', url}`, `ClickAction{kind:'click', locator}`, `FillAction{kind:'fill', locator, value}`, `CheckAction{kind:'check', locator}`, `UncheckAction{kind:'uncheck', locator}`, `PressAction{kind:'press', locator, key}`, `SelectOptionAction{kind:'selectOption', locator, value}`, `HoverAction{kind:'hover', locator}`, `AssertVisibleAction{kind:'assertVisible', locator}`, `AssertTextAction{kind:'assertText', locator, expected}`, `AssertValueAction{kind:'assertValue', locator, expected}`. One `createAction(input)` factory that validates every variant's required fields are present/non-empty and returns the typed union member (throw `DomainError` otherwise). Export a `PARAMETERIZABLE_FIELDS: Record<Action['kind'], readonly string[]>` map (e.g. `fill` → `['value']`, `goto` → `['url']`, `press` → `['key']`, `selectOption` → `['value']`, others → `[]`) — this is what `Step.supportsParameterField` and later `Template` consult.
- `Step.ts` — `Step { id: string, order: number, action: Action, label?: string }`, factory `createStep(input)`, method `supportsParameterField(field: string): boolean` reading `PARAMETERIZABLE_FIELDS`.
- `Journey.ts` — `Journey { id: string, name: string, startUrl: string, profileId?: string, createdAt: Date, steps: readonly Step[] }`. Factory `createJourney(input)` throws if `steps.length === 0`, if `name` is empty, or if `steps` orders aren't a contiguous 0..n-1 (or 1..n — pick one convention and be consistent) unique sequence. No mutation methods — any "edit" is a new `createJourney` call by the caller.
- `StepResult.ts` — `StepResult { stepId: string, status: 'passed'|'failed'|'skipped', durationMs: number, errorMessage?: string, screenshotPath?: string }`, factory validates `errorMessage` is present when `status === 'failed'`.
- `JourneyRunResult.ts` — `JourneyRunResult { id: string, journeyId?: string, profileId?: string, startedAt: Date, finishedAt: Date, stepResults: readonly StepResult[], tracePath?: string, error?: string }` with a `status` **derived getter** (implement as a class with a getter, or a plain object plus an exported `getJourneyRunStatus(result)` pure function — pick the class-with-getter approach for consistency with "never independently settable") computing `'failed'` iff any `stepResults[i].status === 'failed'`, else `'passed'`.
- `errors.ts` — `export class DomainError extends Error {}` shared by every factory's validation throw.

Tests (`src/journeys/domain/*.test.ts`, colocated, Vitest): for every factory, one test proving valid input succeeds and at least one test per invariant proving invalid input throws `DomainError`. For `JourneyRunResult`, prove the derived status flips to `'failed'` the moment any step result is `'failed'`, and there is no way to construct a `'passed'` result containing a failed step.

Verification: `npm test` — all new tests pass, zero I/O. `npm run build` clean. `npx eslint .` clean (domain files must trigger zero boundary/no-restricted-imports violations). Commit.

---

## Task 2: Journeys application layer

Implement the ports and use cases for the `journeys` feature, against **hand-written in-memory fakes** in tests — no real filesystem, browser, or subprocess anywhere in this task.

Files (`src/journeys/application/ports/`):
- `JourneyRecorderPort.ts` — `interface JourneyRecorderPort { record(opts: RecordOptions): Promise<RecordedJourneyDraft> }` where `RecordOptions` carries `{startUrl, browser: 'chromium'|'firefox'|'webkit', storageStatePath?: string, viewport?, device?, colorScheme?, timezone?, lang?, geolocation?}` and `RecordedJourneyDraft` carries `{startUrl, steps: Array<{action: Action, label?: string}>}` (pre-`Step.id`/`order` — the use case assigns those).
- `JourneyRunnerPort.ts` — `interface JourneyRunnerPort { run(journey: Journey, opts: RunOptions): Promise<JourneyRunResult> }` where `RunOptions` carries `{browser, storageStatePath?, keepTrace: boolean, tracePath?: string}`.
- `JourneyRepository.ts` — `interface JourneyRepository { save(journey: Journey): Promise<void>; findById(id: string): Promise<Journey|null>; findAll(): Promise<Journey[]>; delete(id: string): Promise<void> }`.

Shared kernel ports (`src/shared-kernel/application/ports/`, used across all features from here on — create now, reused later): `ClockPort.ts` (`now(): Date`), `IdGeneratorPort.ts` (`generate(): string`).

Use cases (`src/journeys/application/use-cases/`), each a single exported class or function taking its ports via constructor/param injection:
- `RecordJourneyUseCase.ts` — input `{startUrl, name, browser, storageStatePath?, ...emulation}`; calls `JourneyRecorderPort.record`, assigns `Step.id`/`order` via `IdGeneratorPort`, builds a `Journey` via `createJourney` with `id`/`createdAt` from `IdGeneratorPort`/`ClockPort`, saves via `JourneyRepository`, returns the saved `Journey`.
- `RunJourneyUseCase.ts` — input `{journeyId, browser, storageStatePath?, keepTrace}`; loads via `JourneyRepository.findById` (throw a use-case-level `NotFoundError` if missing — define this error type in `src/shared-kernel/application/errors.ts`, reused by every feature's use cases), calls `JourneyRunnerPort.run`, returns `JourneyRunResult` (not persisted — plain journey runs are stdout-only per the plan; playbook runs persist their own aggregate in Task 7).
- `ListJourneysUseCase.ts`, `ShowJourneyUseCase.ts`, `DeleteJourneyUseCase.ts` — thin repository pass-throughs, `ShowJourneyUseCase`/`DeleteJourneyUseCase` throw `NotFoundError` when absent.

Test fakes (`test/unit/fakes/` — shared location, reused by later tasks): `FakeClock.ts`, `FakeIdGenerator.ts` (sequential `id-1`, `id-2`, ... for deterministic assertions), `FakeJourneyRepository.ts` (in-memory `Map`), `FakeJourneyRecorderPort.ts`, `FakeJourneyRunnerPort.ts`.

Tests: one file per use case under `src/journeys/application/use-cases/*.test.ts` (or `test/unit/journeys/`, your call — be consistent with Task 1's colocation choice), covering the happy path and the `NotFoundError` path for `RunJourneyUseCase`/`ShowJourneyUseCase`/`DeleteJourneyUseCase`.

Verification: `npm test` green, no I/O anywhere in these tests (grep your own test files for `fs`, `child_process`, `playwright` imports — there should be none). `npm run build` clean, `npx eslint .` clean (confirm application-layer files trip zero boundary rules). Commit.

---

## Task 3: Journeys adapters (persistence, codegen parser, recorder, interpreter)

The highest-risk task. Implements every concrete adapter for the `journeys` feature's ports.

Files:
- `src/infrastructure/JsonFileStore.ts` — a small generic helper (not itself a port; a low-level infra utility other repositories will reuse in later tasks): `class JsonFileStore<T> { constructor(dirPath: string) }` with `save(id: string, data: T): Promise<void>` (atomic: write to `<id>.json.tmp` then `fs.rename` to `<id>.json`, creating `dirPath` recursively if missing), `findById(id): Promise<T|null>`, `findAll(): Promise<T[]>`, `delete(id): Promise<void>`.
- `src/infrastructure/paths.ts` — `resolveDataRoot(): string` returning `process.env.QAMACHINE_HOME ?? path.resolve(process.cwd(), '.qamachine')` (the `--home` CLI flag override is wired in Task 4's composition root, not here).
- `src/journeys/adapters/persistence/JsonFileJourneyRepository.ts implements JourneyRepository` — wraps `JsonFileStore<JourneySnapshot>` where `JourneySnapshot` is the plain-JSON-serializable shape of `Journey` (dates as ISO strings); converts to/from the domain `Journey` via `createJourney` on read (so a corrupted file fails loudly, not silently).
- `src/journeys/adapters/recording/CodegenScriptParser.ts` — pure function `parseCodegenScript(source: string): RecordedActionIR[]` using `acorn.parse(source, {ecmaVersion: 2022, sourceType: 'module'})` + `acorn-walk` to find the `test(...)` call's async arrow function body, walking its statements for `await`-expression `CallExpression`s matching the `page.getByX(...).method(...)` / `page.goto(...)` / `expect(page.getByX(...)).toBeY()` shapes. `RecordedActionIR` is an intermediate representation: `{methodChain: string[], args: unknown[]}` or similar — keep it a thin structural echo of the parsed call, not yet the domain `Action`.
- `src/journeys/adapters/recording/CodegenActionMapper.ts` — pure function `mapToActions(ir: RecordedActionIR[]): Array<{action: Action, label?: string}>`, a translation table from `getByRole('button', {name:'X'}).click()` → `createAction({kind:'click', locator: createLocator({strategy:'role', value:'button', options:{name:'X'}})})`, `getByTestId('y').fill('z')` → `fill`, `page.goto(url)` → `goto`, `expect(locator).toBeVisible()` → `assertVisible`, `expect(locator).toHaveText(t)` → `assertText`, `expect(locator).toHaveValue(v)` → `assertValue`, and a `.locator('css-selector')` fallback → `strategy: 'css'`. Unrecognized call shapes throw a clear `ParseError` naming the unrecognized source snippet (never silently drop a step).
- **Fixtures** (`test/fixtures/codegen-output/*.spec.ts`): hand-author 3-4 realistic files matching real Playwright codegen `--target=playwright-test` output (per the Global Constraints ruling on the spike) covering: a goto+click+fill+assertVisible flow, a checkbox/select flow, an assertText/assertValue flow, and one file exercising the `css` fallback locator. Golden-file tests (`CodegenScriptParser.test.ts`, `CodegenActionMapper.test.ts` under `test/e2e-adapters/` — these are pure-function tests with no browser/fs beyond reading the fixture file, but keep them alongside the other codegen fixture consumers for discoverability) assert the parsed/mapped output matches expected `Action[]` exactly.
- `src/journeys/adapters/recording/PlaywrightCodegenJourneyRecorder.ts implements JourneyRecorderPort` — spawns `playwright codegen <startUrl> --target=playwright-test --browser=<browser> -o <tempfile> [--load-storage=<storageStatePath>] [emulation flags from RecordOptions]` via `node:child_process` `spawn` (Windows note from the approved architecture: pass `shell: true` or resolve the `.cmd`/`npx` shim explicitly — verify empirically on this machine and note which was needed in your report), waits for process exit, reads the temp file, calls `parseCodegenScript` + `mapToActions`, deletes the temp file, returns `RecordedJourneyDraft`. Unit-test only the subprocess argument construction and cleanup with `child_process.spawn` faked/mocked (do not attempt to automate the real interactive Inspector session — note in your report that this adapter needs a documented manual smoke test, which you should write as `docs/MANUAL-SMOKE-TESTS.md` item #1).
- `src/journeys/adapters/execution/LocatorResolver.ts` — pure function `resolveLocator(page: Page, locator: Locator): PlaywrightLocator` mapping each `strategy` to the matching Playwright `page.getByRole/getByTestId/getByText/getByLabel/getByPlaceholder/getByAltText/getByTitle/locator(css)` call, applying `options.name`/`exact`/`nth` where supported.
- `src/journeys/adapters/execution/PlaywrightStepInterpreter.ts implements JourneyRunnerPort` — `run(journey, opts)`: launches the requested browser engine (`chromium`/`firefox`/`webkit` from the `playwright` package), creates a context (`storageState: opts.storageStatePath` if given), optionally starts `context.tracing.start(...)` when `opts.keepTrace`, opens a page, iterates `journey.steps` in order executing each `Action` via an **exhaustive switch on `action.kind`** (TypeScript must error if a new `Action` variant is added and left unhandled — verify this by temporarily adding a bogus case and confirming a compile error, then remove it), using library `expect` from `@playwright/test` for the three `assert*` kinds, catching any per-step error into a `failed` `StepResult` and continuing to the next step (a journey run reports all step outcomes, it doesn't abort on first failure — confirm this matches the approved architecture's intent for full diagnostic output), stops tracing and saves to `opts.tracePath` if requested, closes the context/browser, returns `JourneyRunResult`.
- Adapter tests (`test/e2e-adapters/`): 2-3 static HTML fixture pages under `test/fixtures/pages/` (a form with a button, text input, checkbox, and a paragraph to assert against) served via Node's built-in `http` module on a random free port from the test file itself (no extra dependency), driven by `PlaywrightStepInterpreter` with a real headless browser for **all three engines** (parametrize the test over `['chromium','firefox','webkit']`), covering every `Action` kind at least once and confirming a deliberately-failing assertion produces a `failed` `StepResult` with a populated `errorMessage`.

Verification: `npm test` (unit layer) still green and still zero-I/O. `npm run test:e2e-adapters` green — requires `npx playwright install chromium firefox webkit` to have been run first; if browsers aren't installed in this environment, run that install command as part of this task and note the outcome in your report (if install is impossible in this sandbox, say so explicitly rather than silently skipping — this is a real blocker to flag, not a warning to bury). `npm run build` clean, `npx eslint .` clean. Commit.

---

## Task 4: Journeys CLI + composition root v1

First end-to-end walking skeleton: a real `qamachine record`/`qamachine journey ...` command a human can run against a live site.

Files:
- `src/shared-kernel/adapters/SystemClock.ts implements ClockPort`, `src/shared-kernel/adapters/CryptoIdGenerator.ts implements IdGeneratorPort` (`crypto.randomUUID()`).
- `src/journeys/adapters/cli/JourneyPresenter.ts` — formats a `Journey` / `Journey[]` for human output (table via simple string padding, no extra table-library dependency) and supports a `toJson(journey)` path.
- `src/journeys/adapters/cli/JourneyRunPresenter.ts` — formats a `JourneyRunResult`: per-step pass/fail lines (colored via `picocolors`), a summary line, JSON mode.
- `src/journeys/adapters/cli/RecordJourneyController.ts`, `JourneyController.ts` (list/show/delete), `RunJourneyController.ts` — each a thin class/function: parse the `commander` command's parsed options into the use case's input DTO, call the use case, hand the result to the presenter. No branching business logic here — if you find yourself validating something beyond "did the use case throw," that validation belongs in the domain or application layer instead.
- `src/composition-root/container.ts` — manual wiring: constructs `SystemClock`, `CryptoIdGenerator`, `JsonFileJourneyRepository` (rooted at `resolveDataRoot()`), `PlaywrightCodegenJourneyRecorder`, `PlaywrightStepInterpreter`, then every journeys use case with those injected, then every controller with its use case(s) + presenter injected. Export a `buildContainer(options: {home?: string})` function (the `--home`/`QAMACHINE_HOME` override point).
- `src/composition-root/cli.ts` — builds the `commander` program: global options `--home <path>`, `--json`, `--quiet`, `--verbose`; `record <url>` command with `--name`, `--profile` (accepted but not yet wired — profiles land in Task 5; pass `undefined` for now, do not stub fake profile logic), `--browser`, `--viewport`, `--device`, `--color-scheme`, `--timezone`, `--lang`, `--geolocation`; `journey list|show <id>|delete <id>|run <id> [--profile] [--keep-trace] [--browser]` — each `.action()` pulls the relevant controller from `buildContainer(...)` and awaits it, setting `process.exitCode = 1` on any thrown error (print the error message via the presenter's error path, never a raw stack trace to the end user; `--verbose` may add the stack).
- `bin/qamachine.ts` — `#!/usr/bin/env node` shebang, imports and runs `src/composition-root/cli.ts`'s program.

Tests: `RecordJourneyController`/`JourneyController`/`RunJourneyController` unit tests with a faked use case, asserting CLI-option-DTO mapping and presenter invocation — no real `commander` parsing needed for these, just call the controller method directly with a constructed DTO.

Verification: `npm run build`, then `node dist/main.js journey list` runs cleanly against an empty `.qamachine/` (prints an empty list, exit 0). Manual smoke test (add as item #2 in `docs/MANUAL-SMOKE-TESTS.md`): `node dist/main.js record https://example.com --name smoke-test`, close the Inspector, `node dist/main.js journey list` shows it, `node dist/main.js journey run <id>` replays it headless and reports pass. Run this manually yourself if a display is available in this environment; if not, state clearly in your report that this smoke test needs to be run by a human and is documented for that purpose. `npm test` still green, `npx eslint .` clean. Commit.

---

## Task 5: Profiles feature

Files, mirroring the journeys feature's layering exactly:
- `src/profiles/domain/AuthStrategy.ts` — VO union `{type:'none'} | {type:'storageState', filePath: string} | {type:'loginJourney', journeyId: string, storageStatePath: string}`, factory validates non-empty paths/ids per variant.
- `src/profiles/domain/UserProfile.ts` — `{id, name, authStrategy, createdAt, authLastRefreshedAt?: Date}`, factory validates non-empty `name`.
- `src/profiles/application/ports/ProfileRepository.ts` — `save/findById/findByName/findAll`.
- `src/profiles/application/ports/AuthStateProviderPort.ts` — `resolve(profile: UserProfile): Promise<{storageStatePath: string|null}>` (returns `null` for `type:'none'`, the strategy's own path for `type:'storageState'`, and for `type:'loginJourney'` returns the `storageStatePath` field directly — refreshing it is a separate explicit action, not implicit on every resolve), `refresh(profile: UserProfile): Promise<void>` (only meaningful for `loginJourney`: runs the login journey via `JourneyRunnerPort` — this port depends on `JourneyRunnerPort` from the journeys feature, a legitimate same-layer cross-feature dependency on an interface — and writes the resulting context's storage state; needs the interpreter to expose a way to capture `context.storageState()` after a run, which may require a small addition to `JourneyRunnerPort`'s return type or a second method — use your judgment on the cleanest interface shape and note the choice in your report if it changes an already-implemented signature).
- `src/profiles/application/use-cases/RegisterProfileUseCase.ts` (rejects duplicate names via `ProfileRepository.findByName`), `ListProfilesUseCase.ts`, `ShowProfileUseCase.ts`, `RefreshProfileAuthUseCase.ts`.
- `src/profiles/adapters/persistence/JsonFileProfileRepository.ts` (reuses `JsonFileStore`), `src/profiles/adapters/auth/StorageStateAuthStateProvider.ts implements AuthStateProviderPort`.
- `src/profiles/adapters/cli/ProfileController.ts` (add/list/show), `RefreshProfileController.ts`, `ProfilePresenter.ts`.
- Wire `profile add|list|show|refresh` commands into `src/composition-root/cli.ts` and the new repository/use cases into `container.ts`.
- **Wire profiles into journeys**: update `RecordJourneyUseCase`/`RunJourneyUseCase` (or their controllers — your call on the cleanest seam, but the use case is more likely correct since it's the orchestration layer) to accept a `profileId?`, resolve it via `AuthStateProviderPort.resolve`, and pass the resulting `storageStatePath` into the recorder/runner options. Update `RecordJourneyController`/`RunJourneyController` to actually pass through the `--profile` flag now (it was accepted-but-inert in Task 4).

Tests: domain factory tests; use-case tests against fakes (`FakeProfileRepository`, `FakeAuthStateProviderPort`), including the duplicate-name rejection and the `RunJourneyUseCase` now resolving a profile's storage state before running.

Verification: `npm test` green (still zero I/O at this layer). `npm run build`, `npx eslint .` clean. Manual smoke test #3 in `docs/MANUAL-SMOKE-TESTS.md`: register a `loginJourney` profile against a real login page, `refresh`, then `journey run <id> --profile <name>` and confirm the session is authenticated — document as a human follow-up if this environment can't drive a real login page. Commit.

---

## Task 6: Templates feature

Files:
- `src/templates/domain/TemplateParameter.ts` — `{id, name, description?, targetStepId, targetField, defaultValue?, required}`, factory validates `name` matches a safe CLI-identifier pattern (e.g. `/^[a-zA-Z_][a-zA-Z0-9_]*$/`).
- `src/templates/domain/Template.ts` — `{id, name, steps: readonly Step[], parameters: readonly TemplateParameter[], createdAt}`. Factory `createTemplate(input)` validates every `parameter.targetStepId` exists in `steps` and every `targetField` is one `Step.supportsParameterField` at that step actually accepts, and parameter names are unique. Method `instantiate(values: Record<string,string>): Journey` — for each parameter, resolve `values[param.name] ?? param.defaultValue`, throwing `DomainError` if still undefined and `required`; produce a new `steps` array with the resolved value substituted into the targeted field of the targeted step's `action`, then return `createJourney({..., id: undefined-equivalent transient marker or caller-supplied id, steps: resolvedSteps})` — since `Journey` currently requires an `id`/`createdAt` at construction (Task 1), either (a) make those fields optional on `Journey`'s input with `instantiate` producing a marker like `id: ''`/omitted that the calling use case must replace before persisting, or (b) have `RunTemplateUseCase`/`InstantiateTemplateUseCase` supply a fresh `id`/`createdAt` via the shared-kernel ports right after calling `instantiate`. Prefer (b) — it keeps `Journey`'s invariants from Task 1 completely unchanged; `instantiate` returns a `TransientJourneyDraft` shape (steps + startUrl + name, no `id`/`createdAt`) and the use case turns that into a real `Journey`. Note in your report which shape you chose since it affects Task 7's playbook orchestrator.
- `src/templates/application/ports/TemplateRepository.ts`.
- `src/templates/application/use-cases/CreateTemplateFromJourneyUseCase.ts` (loads the source `Journey` via `JourneyRepository` — cross-feature port reuse, same pattern as profiles/journeys in Task 5 — snapshots its `steps`, builds `TemplateParameter[]` from the input DTO, saves via `createTemplate`), `InstantiateTemplateUseCase.ts`, `RunTemplateUseCase.ts` (instantiate then delegate to the same `JourneyRunnerPort` used by `RunJourneyUseCase`, resolving profile auth the same way), `ListTemplatesUseCase.ts`, `ShowTemplateUseCase.ts`, `DeleteTemplateUseCase.ts`.
- `src/templates/adapters/persistence/JsonFileTemplateRepository.ts`.
- `src/templates/adapters/cli/TemplateController.ts`, `RunTemplateController.ts`, `TemplatePresenter.ts`. Wire `template create|list|show|delete|run` into the CLI/container, with `--param <stepIndex>.<field>=<paramName>[:required][:default=<v>]` parsing living in the controller (pure string-parsing into a DTO — no business validation here, that's `createTemplate`'s job) and `--param name=value` (repeatable) for `template run`.

Tests: `Template.instantiate` — required-param-missing throws, default-value fallback works, exact field substitution confirmed on the resulting steps, source `Journey` mutation-after-template-creation does NOT affect an already-created `Template` (the snapshot invariant). Use-case tests against fakes.

Verification: `npm test` green, `npm run build`, `npx eslint .` clean. Commit.

---

## Task 7: Playbooks feature

Files:
- `src/playbooks/domain/PlaybookEntry.ts` — `{id, source: {type:'journey', journeyId: string} | {type:'template', templateId: string, parameterBindings: Record<string,string>}, profileOverride?: string, continueOnFailure: boolean}`.
- `src/playbooks/domain/Playbook.ts` — `{id, name, entries: readonly PlaybookEntry[], createdAt}`.
- `src/playbooks/domain/PlaybookRunResult.ts` — `{id, playbookId, startedAt, finishedAt, entryResults: readonly (JourneyRunResult & {entryId: string, status: 'passed'|'failed'|'skipped'})[]}` with `overallStatus` as a derived getter (`'passed'` iff every `entryResults[i].status === 'passed'`).
- `src/playbooks/application/ports/PlaybookRepository.ts`, `PlaybookRunResultRepository.ts` (`save/findById/findAllByPlaybookId`).
- `src/playbooks/application/use-cases/CreatePlaybookUseCase.ts`, `AddEntryToPlaybookUseCase.ts` (validates the referenced journey/template/profile exist via their repositories, and for template-sourced entries validates every `required` `TemplateParameter` has a binding — reuse `Template`'s own parameter list, don't re-invent the required-check), `RunPlaybookUseCase.ts` — **the orchestrator**: for each entry in order, resolve a runnable `Journey` (direct `JourneyRepository.findById`, or `Template.instantiate` + fresh id/createdAt per Task 6's chosen shape), resolve the effective profile (`entry.profileOverride ?? undefined`) via `AuthStateProviderPort`, run via `JourneyRunnerPort`, record a `passed`/`failed` entry result; once any entry fails, mark all **remaining** entries `skipped` unless that failed entry's `continueOnFailure` was true (in which case proceed to the next entry normally) — implement this as a single pass with a `haltRemaining` flag, and unit-test both the stop-on-first-failure and continue-on-failure paths explicitly since this is the task's highest-value logic; aggregate into `PlaybookRunResult`, persist via `PlaybookRunResultRepository`. `ListPlaybooksUseCase.ts`, `ShowPlaybookUseCase.ts`, `ListPlaybookRunsUseCase.ts`, `ShowPlaybookRunUseCase.ts`.
- `src/playbooks/adapters/persistence/JsonFilePlaybookRepository.ts`, `JsonFilePlaybookRunResultRepository.ts`.
- `src/playbooks/adapters/cli/PlaybookController.ts`, `RunPlaybookController.ts`, `PlaybookRunPresenter.ts` (per-entry table + overall summary, JSON mode). Wire `playbook create|add-entry|list|show|run|runs|show-run` into CLI/container, with `--stop-on-first-failure` as a **global override** for the run (when passed, treat every entry as if `continueOnFailure: false` regardless of its stored value — confirm this interacts sensibly with per-entry `continueOnFailure` and document the precedence you chose in a one-line code comment at the point it's applied, since this is exactly the kind of non-obvious interaction Clean Code says deserves a WHY comment).

Tests: `RunPlaybookUseCase` against fakes covering: all-pass, one-fail-with-stop (remainder skipped), one-fail-with-continueOnFailure (remainder still run), template-sourced entry resolution, profile-override resolution. `PlaybookRunResult.overallStatus` derivation tests mirroring Task 1's `JourneyRunResult` pattern.

Verification: `npm test` green, `npm run build`, `npx eslint .` clean. Manual smoke test #4 in `docs/MANUAL-SMOKE-TESTS.md`: create a playbook with 2+ entries (mixed journey + template, one forced to fail), run with and without `--stop-on-first-failure`, confirm output matches expected pass/fail/skipped. Commit.

---

## Task 8: Polish and enforcement

- `--json` mode: confirm every presenter added since Task 4 has a working `--json` path (add any missed), producing machine-parseable output with no ANSI color codes.
- Exit codes: `process.exitCode = 1` on any use-case error across every controller (audit all of them — this is likely already done per-controller in earlier tasks; this pass is about consistency, not new logic), `0` on success including "playbook ran with failing entries but the command itself didn't error" (a playbook run's own pass/fail is data in the output, not a CLI-level failure) vs. genuine CLI errors (bad args, not-found ids) which should exit non-zero.
- `--help` text: confirm `commander`'s auto-generated help reads sensibly for every command (add `.description()`/`.option()` descriptions anywhere still using bare flag names with no explanation).
- `npx eslint .` full-repo pass with zero violations, including the deliberate-violation proof from Task 0 re-run once at the end to confirm the boundaries rule still catches a real inward violation (add one, confirm the error, remove it — same drill as Task 0, now against the full codebase).
- Packaging sanity: `npm pack --dry-run` produces a reasonable file list (no `.qamachine/` test artifacts, no `node_modules`, `dist/` present after a build).
- `docs/MANUAL-SMOKE-TESTS.md` final pass: confirm all 4 items from Tasks 3/4/5/7 are present and each states clearly whether it was actually run in this environment or is a documented human follow-up.

Verification: `npm run build && npm test` green. `npm run test:e2e-adapters` green (or documented as blocked with a clear reason). `npx eslint .` clean. Commit.
