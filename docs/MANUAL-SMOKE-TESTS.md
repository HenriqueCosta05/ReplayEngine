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
- No `ParseError`. A `ParseError` naming a source snippet means real codegen
  emitted a construct our subset does not cover — copy that snippet into a new
  fixture under `test/fixtures/codegen-output/` and extend
  `CodegenActionMapper` to handle it. Do **not** make the parser skip it.
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

## 3. `--load-storage` actually restores a logged-in session

**Why it is manual.** Requires real credentials on a real site.

**Steps.** Save a profile's `storageState.json`, then record a new journey
against the same site with that profile selected.

**Pass criteria.** The Inspector opens already authenticated — no login screen.
