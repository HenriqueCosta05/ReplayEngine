# Manual smoke tests

Checks that cannot be automated, because they need a human driving a real
browser window. Run them before a release, and whenever the Playwright
dependency is upgraded to a new minor version.

Every item states what to do, what "pass" looks like, and what to change if it
fails — a smoke test nobody knows how to act on is just a chore.

---

## 1. `PlaywrightCodegenJourneyRecorder` against a live codegen session

**Why it is manual.** `playwright codegen` opens the interactive Inspector and
records what a person clicks. There is no non-interactive mode, so neither the
recorder adapter nor the shape of the script it parses can be verified by the
automated suite. The parser/mapper fixtures in
`test/fixtures/codegen-output/*.spec.ts` are **hand-authored** to match
Playwright's documented `--target=playwright-test` output — this test is what
confirms that assumption still holds against the real generator.

**Steps**

1. `npm run build`
2. Record a journey against a page with a form, a checkbox and a `<select>`:
   ```
   node dist/bin/qamachine.js journey record --url https://<some-form-page> --name "smoke"
   ```
   (Until the CLI lands in Task 4, drive the adapter directly:
   `node -e "import('./dist/src/journeys/adapters/recording/PlaywrightCodegenJourneyRecorder.js').then(async m => console.dir(await new m.PlaywrightCodegenJourneyRecorder().record({startUrl:'https://<some-form-page>', browser:'chromium'}), {depth:null}))"`)
3. In the Inspector window: navigate, click a button, fill a text field, tick a
   checkbox, pick a `<select>` option, and add one assertion from the
   Inspector's assertion toolbar (visibility, text, and value each in turn).
4. Close the browser window to end the session.

**Pass criteria**

- The command returns a draft containing one step per interaction, in order.
- No `ParseError`. Every `ParseError` names the offending source line; which
  fix applies depends on *why* that line was rejected:
  - **An unsupported construct** (`dblclick()`, a popup/`waitForEvent` block, a
    regex locator, `not.toBeVisible()`). Real codegen emitted something outside
    our subset. Copy the snippet into a new fixture under
    `test/fixtures/codegen-output/` and extend `CodegenActionMapper` to handle
    it. Do **not** make the parser skip it.
  - **A domain rule rejecting the values** — the message will be a domain one
    (`Action of kind "fill" requires a non-empty "value" field: <line>`) and
    the error's `cause` will be a `DomainError`. The mapper is behaving
    correctly here; the question is whether the *domain rule* is right. The
    known instance is `fill('')`, which codegen emits when you clear a text
    field: it is currently rejected by Task 1's non-empty-`value` rule and
    covered by `test/fixtures/codegen-output/cleared-field-flow.spec.ts`. If
    this blocks a real recording, that is a domain-rule conversation (should
    `fill` accept an empty value, or should the recorder model "clear field" as
    its own action kind?) — not something to patch around in the adapter.
- The temp script (`%TEMP%/qamachine-codegen-*.spec.ts` /
  `$TMPDIR/qamachine-codegen-*.spec.ts`) is gone afterwards.

**If the generated script's shape has drifted**, update all four fixture files
together and re-run `npm run test:e2e-adapters` — the fixtures are the only
description of that contract we have.

---

## 2. Emulation flags reach the recorded session

**Why it is manual.** Same reason as item 1; additionally the effect
(viewport size, dark mode, locale) is only observable by looking at the window.

**Steps.** Record with `--viewport 800x600`, `--color-scheme dark`,
`--lang pt-BR` and `--timezone America/Sao_Paulo`.

**Pass criteria.** The Inspector's browser window is 800x600, renders the page
in its dark theme, and `navigator.language` / `Intl.DateTimeFormat()` in the
page console report `pt-BR` and `America/Sao_Paulo`. A silently-ignored flag is
the failure mode to watch for here: `buildCodegenArgs` is unit-tested, but only
this check proves the flag names still match the installed Playwright CLI.

---

## 3. End-to-end CLI walking skeleton (`record` → `journey list` → `journey run`)

**Why it is manual (in part).** `record` opens `playwright codegen`'s
interactive Inspector, same as items 1-2 - it needs a human clicking in a
real browser window. This environment (a headless Windows agent sandbox, no
attached display) cannot drive that window, so the `record` half of this item
was **not run** here and needs a human. The `journey list` / `journey show` /
`journey run` / `journey delete` half **was run** in this environment, using a
hand-seeded `.qamachine/journeys/<id>.json` file in place of a real
recording (a valid substitute here since those commands never call the
recorder - only `record` does), against the real `https://example.com` over
the network with a real, headless Chromium instance.

**Steps**

1. `npm run build`
2. `node dist/bin/qamachine.js record https://example.com --name smoke-test`
3. In the Inspector window that opens: interact with the page a little, then
   close the browser window to end the session.
4. `node dist/bin/qamachine.js journey list` - the journey from step 2 should
   appear.
5. `node dist/bin/qamachine.js journey run <id>` (the id printed in step 4) -
   should replay headless and report `PASSED`.

**Pass criteria.** Step 4 shows the recorded journey in the table. Step 5
prints one colored `PASS`/`FAIL` line per step and a summary line, and exits
`0` on an all-passing run / `1` on any failing step.

**What was actually verified in this environment (steps 4-5 only, journey
hand-seeded instead of step 2-3's real recording):**

```
$ node dist/bin/qamachine.js journey list
ID             NAME        START URL            STEPS  CREATED AT
smoke-journey  smoke-test  https://example.com  2      2026-01-01T00:00:00.000Z

$ node dist/bin/qamachine.js journey run smoke-journey
  PASS  step 1 (s1) 2975ms
  PASS  step 2 (s2) 97ms
PASSED — 2 passed, 0 failed, 0 skipped (2 steps, 3662ms)
$ echo $?
0
```

A deliberately-failing assertion step was also run to confirm the failure
path: `FAIL` printed in red for the failing step, a red `FAILED` summary
line, and exit code `1`. `--keep-trace` was confirmed to actually write a
`.zip` file under `<home>/traces/`, and `--json` output on both `journey
list` and `journey run` was confirmed to be valid, well-formed JSON
(including the derived `status` field on the run result, which is not an
own-enumerable property of the domain object and needs explicit handling in
`JourneyRunPresenter.toJson` to appear at all).

**Still needs a human:** steps 2-3 (the actual `playwright codegen` Inspector
session) - re-run this item's steps 1-5 in full end-to-end, unmodified, the
next time a human is available with a real Playwright dependency bump or
before a release.

---

## 4. A `loginJourney` profile actually authenticates a run

**Why it is manual.** Requires real credentials on a real login page: a
human must record a journey that logs in, register a profile against it,
and visually confirm the replayed session is authenticated (no login
screen). This environment (a headless Windows agent sandbox with no
attached display and no test account on a real site) **cannot drive a real
login page**, so this item was **not run** here and needs a human before
release. What *was* verified in this environment, with fakes/a local static
fixture standing in for a real login page (see
`src/profiles/adapters/auth/StorageStateAuthStateProvider.test.ts` and the
`captureStorageStatePath` case in
`test/e2e-adapters/PlaywrightStepInterpreter.test.ts`): the plumbing that
`profile refresh` depends on — running a journey with
`captureStorageStatePath` set does write a real, well-formed
`storageState.json` (`cookies`/`origins` arrays) to disk, and
`RefreshProfileAuthUseCase` only advances `authLastRefreshedAt` when that
run actually passes.

**Steps**

1. `npm run build`
2. Record a journey against a real login page that ends up authenticated
   (fill credentials, submit, land on a page only visible when logged in):
   ```
   node dist/bin/qamachine.js record https://<some-login-page> --name login
   ```
3. Register a profile whose strategy is that journey:
   ```
   node dist/bin/qamachine.js profile add --name admin --auth-type loginJourney \
     --login-journey-id <journey-id-from-step-2> \
     --login-storage-state-path ./admin-state.json
   ```
4. Refresh it (this actually runs the login journey and captures the state):
   ```
   node dist/bin/qamachine.js profile refresh <profile-id-from-step-3>
   ```
5. Record or run a **different** journey against the same site with
   `--profile <profile-id>`:
   ```
   node dist/bin/qamachine.js record https://<same-site>/account --name check-auth --profile <profile-id>
   node dist/bin/qamachine.js journey run <check-auth-journey-id> --profile <profile-id>
   ```

**Pass criteria.** Step 4 exits `0` and `./admin-state.json` contains a
non-empty `cookies` or `origins` array. Step 5's Inspector/replay lands on
the authenticated page directly — no login screen, no redirect to a login
route.

---

## 5. A mixed playbook (journey + template entries, one forced to fail)

**Why it is manual.** Same underlying reason as items 1-3: driving entries
through a real, headless-but-real browser against a real page is what
proves the `playbook run` orchestration (journey resolution, template
instantiation, per-entry profile resolution, stop-on-first-failure vs.
continue-on-failure, trace capture) actually wires together end-to-end —
`RunPlaybookUseCase`'s own tests cover the orchestration logic against
fakes, but not that the CLI plumbing (`RunPlaybookController`,
`PlaybookRunPresenter`, `container.ts`'s wiring) reaches a real browser.

**Steps**

1. `npm run build`
2. Record two journeys against a real page: one that always passes (e.g.
   navigate + an assertion that is true), and one that always fails (e.g.
   navigate + an assertion on text that is never present):
   ```
   node dist/bin/qamachine.js record https://example.com --name will-pass
   node dist/bin/qamachine.js record https://example.com --name will-fail
   ```
3. Save the passing journey as a template with at least one parameter:
   ```
   node dist/bin/qamachine.js template create --journey-id <will-pass-id> --name pass-template \
     --param 0.value=greeting:default=hello
   ```
4. Create a playbook and add three entries: the failing journey, the
   passing journey, and the template — in that order, so the failing entry
   is first and its own `continueOnFailure` decides whether the rest run:
   ```
   node dist/bin/qamachine.js playbook create --name mixed-suite
   node dist/bin/qamachine.js playbook add-entry <playbook-id> --journey <will-fail-id> --continue-on-failure
   node dist/bin/qamachine.js playbook add-entry <playbook-id> --journey <will-pass-id>
   node dist/bin/qamachine.js playbook add-entry <playbook-id> --template <pass-template-id> --param greeting=hi
   ```
5. Run it without `--stop-on-first-failure`:
   ```
   node dist/bin/qamachine.js playbook run <playbook-id>
   ```
6. Run it again with `--stop-on-first-failure`:
   ```
   node dist/bin/qamachine.js playbook run <playbook-id> --stop-on-first-failure
   ```
7. `node dist/bin/qamachine.js playbook runs <playbook-id>` and
   `node dist/bin/qamachine.js playbook show-run <run-id>` for one of the
   two runs above.

**Pass criteria.**

- Step 5: prints one `FAIL`/`PASS`/`PASS` line (in entry order) and an
  overall `FAILED` summary, because the first entry's own
  `continueOnFailure: true` lets the run proceed past it. Exits `0`: a
  playbook run's own pass/fail is data in the output, not a CLI-level
  failure (unlike `journey run`/`template run`, which do exit non-zero on a
  failed run) — `overallStatus` in the printed/`--json` output is `'failed'`
  since not every entry passed, but the process exit code stays `0`.
- Step 6: prints `FAIL`/`SKIP`/`SKIP` — `--stop-on-first-failure` overrides
  the first entry's stored `continueOnFailure` and halts the run, so
  entries 2-3 are recorded `'skipped'` without being run. Exits `0` for the
  same reason as step 5.
- Step 7: `playbook runs` lists both runs in a table with their
  `overallStatus`; `playbook show-run` reprints the same per-entry detail
  as step 5/6's live output for the chosen run id.
- `--keep-trace` on either run writes one `.zip` file per non-skipped entry
  under `<home>/traces/`, named `<playbookId>-<entryId>-<uuid>.zip`.
