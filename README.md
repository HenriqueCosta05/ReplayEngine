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

This repository is under active scaffolding. See
`.superpowers/sdd/plan-qamachine-cli/` for the implementation plan; the
`qamachine` command itself is not yet wired up (that lands in Task 4).
