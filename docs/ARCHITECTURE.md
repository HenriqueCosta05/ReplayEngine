# Architecture

QAMachine follows Clean Architecture, organized as feature-oriented vertical
slices rather than a single technical-layer tree. Each feature
(`journeys`, `templates`, `playbooks`, `profiles`) owns its own
`domain/`, `application/{ports,use-cases}`, and `adapters/{...}` folders
under `src/<feature>/`. There are no generic top-level `controllers/`,
`services/`, or `models/` buckets.

## Layers and the dependency rule

Source imports point inward only:

- **`domain/`** — entities and value objects. Pure TypeScript, zero
  dependencies on other layers or on any package (`playwright`, `commander`,
  `acorn`, `node:fs`, `node:child_process`, etc). Factories validate their
  own invariants at construction and throw a `DomainError` immediately
  rather than allowing an invalid object to exist. No imports from
  `application/`, `adapters/`, or `infrastructure/`.
- **`application/`** — one use case per application action (no god
  `*Service` classes), orchestrating domain objects through `ports/`
  interfaces it defines. It may import its own `ports/` and `domain/`
  only — never `adapters/`, `infrastructure/`, or libraries like
  `playwright`/`@playwright/test`/`commander`.
- **`adapters/`** — concrete implementations of `application/ports`
  interfaces (CLI controllers/presenters, persistence, browser
  automation, recording/parsing). May import `domain/`, `application/ports`,
  and external libraries. Must not contain business rules.
- **`infrastructure/` and `composition-root/`** — cross-feature low-level
  utilities (e.g. a generic JSON file store, data-root path resolution)
  and the only place concrete adapters are constructed (`new`'d) and wired
  to use cases and controllers. Nothing else in the codebase performs
  wiring.
- **`shared-kernel/`** — the small set of ports/adapters genuinely shared
  across every feature (`ClockPort`, `IdGeneratorPort`, and their concrete
  adapters). It follows the same `domain/`/`application/`/`adapters/`
  layering as any feature.

Cross-feature dependencies are allowed at the `application/ports` and
`adapters` level (e.g. `profiles` depends on `journeys`' `JourneyRunnerPort`
to replay a login journey), never by reaching into another feature's
`domain/` internals directly beyond its exported types.

## Enforcement

The dependency rule above is not just convention — it is enforced by
`eslint-plugin-boundaries` (see `.eslintrc.cjs`):

- `domain` may not import `application`, `adapters`, or `infrastructure`.
- `application` may not import `adapters` or `infrastructure`.
- A `no-restricted-imports` override scoped to `src/**/domain/**` and
  `src/**/application/**` additionally bans importing `playwright`,
  `@playwright/test`, `commander`, `acorn`, `acorn-walk`,
  `node:child_process`, and `node:fs` directly in those layers, even
  where the boundaries rule alone wouldn't catch it (e.g. importing a
  library rather than another element type).

Because the project uses `moduleResolution: NodeNext` (relative imports
are written as `./Foo.js` even though the source file is `Foo.ts`), the
boundaries plugin is configured with `eslint-import-resolver-typescript`
(`settings['import/resolver'].typescript`) — the default Node resolver
cannot map a `.js`-suffixed specifier back to its `.ts` source file, which
would otherwise let real violations go undetected once code uses that
import style. This was verified empirically while wiring up Task 0: a
deliberately inward-pointing import from `domain/` to `application/` is
correctly flagged as `boundaries/element-types` error, and a
domain-layer `node:child_process` import is correctly flagged as
`no-restricted-imports`.

## Codegen / interpreter decision

Journey recording and playback are split into two independent concerns
that never share code:

- **Recording** (`journeys/adapters/recording/`) shells out to
  `playwright codegen` and parses its generated `@playwright/test` script
  output (via `acorn`/`acorn-walk`) into the domain's own `Action`
  representation. `playwright codegen` requires an interactive browser
  session a human drives — it cannot be automated in an agent
  environment. Because of that, the parser/mapper's test fixtures
  (`test/fixtures/codegen-output/*.spec.ts`) are **hand-authored** to
  match Playwright's documented, stable codegen output shape rather than
  captured from a live session. This is a known limitation: the fixture
  suite should be re-validated against a real `playwright codegen` run by
  a human before this ships, and that follow-up is tracked in
  `docs/MANUAL-SMOKE-TESTS.md`.
- **Interpretation** (`journeys/adapters/execution/`) drives the raw
  `playwright` package directly (not the `@playwright/test` runner) to
  replay a `Journey`'s `Action` sequence against a real browser, using
  `@playwright/test`'s `expect` imported as a library only, for retrying
  assertions.

Both adapters implement application-layer ports (`JourneyRecorderPort`,
`JourneyRunnerPort`) so the use cases orchestrating them never know
whether a journey came from a live recording, a hand-authored fixture, or
a template instantiation.

### How the codegen subprocess is launched

The recorder starts codegen as `node <playwright/cli.js> codegen …` with
`shell: false`, rather than `npx playwright codegen …`. This supersedes the
earlier "`shell: true` or an explicit `.cmd` shim" note, which was measured
on this Windows 11 / Node 26 machine and found to be wrong in one half and
unsafe in the other:

| Attempt | Result |
| --- | --- |
| `spawn('npx', args)` | `ENOENT` — there is no extension-less `npx` on Windows |
| `spawn('npx.cmd', args)` | `EINVAL` thrown synchronously — since the CVE-2024-27980 fix Node refuses to launch `.cmd`/`.bat` without a shell, so explicit shim resolution no longer works at all |
| `spawn('npx', args, {shell: true})` | works, but emits `DEP0190` — with a shell the arguments are concatenated, not escaped, so a recorded start URL containing `&`, `|` or `"` would be interpreted by `cmd.exe` |

Resolving the CLI entry point through `playwright/package.json`'s `bin` field
and running it with `process.execPath` avoids all three: it needs no shell on
any platform, cannot be command-injected through a URL, and pins recording to
the exact Playwright version in `node_modules` rather than whatever `npx`
would resolve.

## Data layout

Every entity is persisted as one JSON file per record under
`./.qamachine/<collection>/<id>.json` (journeys, templates, playbooks,
playbook-runs, profiles), via a small generic `JsonFileStore<T>`
infrastructure helper reused by every feature's repository adapter.
Playwright auth state lives at
`./.qamachine/profiles/<profileId>/storageState.json`. Trace files are
opt-in only (`--keep-trace`), written to
`./.qamachine/traces/<runId>/<entryId>.zip`.
