# QAMachine

Blackbox Playwright-powered CLI for recording user journeys on any website,
saving them as reusable **templates**, grouping them into **playbooks**, and
running them under different locally-registered user **profiles**. Record a
journey by driving `playwright codegen` against a live site; promote a
recorded journey into a parameterized template so the same flow can be
replayed with different input values; compose journeys and templates into a
playbook that runs a whole suite in one command with pass/fail/skip
reporting; and register profiles (anonymous, storage-state-based, or backed
by a login journey) so recordings and runs can carry an authenticated
session without re-logging-in every time.

See `docs/ARCHITECTURE.md` for the Clean Architecture layer boundaries and
the codegen/interpreter design decision.

## Requirements

- Node.js >= 18
- npm

## Install

```sh
npm install
```

## Build

Compiles TypeScript (`bin/**/*.ts`, `src/**/*.ts`) to `dist/`:

```sh
npm run build
```

## Test

Runs the fast, zero-I/O domain and application-layer test suite
(`src/**/*.test.ts`, `test/unit/**/*.test.ts`):

```sh
npm test
```

Runs the adapter test suite that touches a real filesystem/browser
(requires Playwright browsers to be installed; excluded from `npm test`
so the default suite stays fast):

```sh
npm run test:e2e-adapters
```

## Lint

Runs ESLint, including `eslint-plugin-boundaries` Clean Architecture
enforcement (`domain`/`application`/`adapters`/`infrastructure` import
rules):

```sh
npm run lint
```

## Dev

Runs the CLI entrypoint directly from TypeScript source via `tsx`, without
a build step:

```sh
npm run dev -- <command> [options]
```

## Status

All planned features are implemented and wired up: the `qamachine` CLI
exposes 22 subcommands across `record`/`journey`, `template`, `playbook`,
and `profile`. See `.superpowers/sdd/plan-qamachine-cli/` for the
implementation plan this was built from.

## Prerequisite: Playwright browsers

Every command that touches a real browser (`record`, `journey run`,
`template run`, `playbook run`, `profile refresh`) needs Playwright's
browser binaries installed once:

```sh
npx playwright install
```

## Commands

Run `qamachine <command> --help` for the full option list; see
`src/composition-root/cli.ts` for the exact command/option surface. One
realistic example per feature group:

### `record` / `journey`

Record a journey by driving `playwright codegen` against a live site, then
manage and replay what was recorded:

```sh
qamachine record https://example.com --name "Sign up flow"
qamachine journey list
qamachine journey run <journeyId> --keep-trace
```

### `template`

Promote a recorded journey into a parameterized template, then instantiate
and run it with different input values:

```sh
qamachine template create --journey-id <journeyId> --name "Sign up" --param "1.value=username:required"
qamachine template run <templateId> --param username=alice
```

### `playbook`

Compose journeys and templates into an ordered suite that runs as one
command with pass/fail/skip reporting:

```sh
qamachine playbook create --name "Smoke suite"
qamachine playbook add-entry <playbookId> --journey <journeyId>
qamachine playbook run <playbookId>
```

`playbook run` always exits `0`, even when one or more entries fail — its
`--json`/human output is the source of truth for pass/fail, unlike
`journey run`/`template run`, which exit `1` on a failed run.

### `profile`

Register a locally-stored auth identity (anonymous, an existing
`storageState.json`, or a login journey to replay) so recordings and runs
can carry an authenticated session:

```sh
qamachine profile add --name admin --auth-type storageState --storage-state-path ./admin-state.json
qamachine journey run <journeyId> --profile <profileId>
```
