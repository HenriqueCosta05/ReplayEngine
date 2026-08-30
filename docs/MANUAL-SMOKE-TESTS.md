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

## 3. `--load-storage` actually restores a logged-in session

**Why it is manual.** Requires real credentials on a real site.

**Steps.** Save a profile's `storageState.json`, then record a new journey
against the same site with that profile selected.

**Pass criteria.** The Inspector opens already authenticated — no login screen.
