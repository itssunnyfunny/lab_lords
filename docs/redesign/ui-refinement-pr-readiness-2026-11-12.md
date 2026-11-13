# UI refinement PR verification — 12 November 2026

This record covers the accepted application UI refinement and its final 320px
Reports and Account-header corrections. The branch started from `50f2fa9`, which
matched freshly fetched `origin/main` before the local commits were created.

## PR #294 Import follow-up — 13 November 2026

Two introduced client workflow regressions are corrected on top of `815caceb`.
The original 12 November whole-suite results below remain evidence for that
earlier head; this follow-up uses the affected Import suites and a fresh build.

- `GuidedImportWorkspace.tsx` marks the header review action as replaced only
  when the setup-only step navigation exists. `styles/shared-ui.css` hides only
  that marked action on phones. `GUIDED_CURRENT_MONTH_V1` and `GUIDED_SETUP_V2`
  can both reach final review and explicit confirmation at all four widths.
- Permitted final-review, section and saved-progress transitions close the
  editor after `canNavigate()` succeeds. Review errors then reach the existing
  page alert; unchanged and saved editors both support refresh/retry. Dirty
  drafts still block navigation and remain in the editor.
- The existing completion Import fixture now supports both guided versions,
  failed plan requests and revision conflicts. Mounted regression tests cover
  error visibility at 1280/1440px, section transitions, recovery and the existing
  confirmation boundary. API error localization and service contracts are unchanged.

The pre-fix mounted run reproduced the missing 320px action, both hidden review
errors and the stale editor after a section round trip: 4 failed, 3 passed,
3 intentional width skips. After the code fix, the four-width guided/legacy run
passed 25 cases; two new assertions were corrected to expect the existing safe,
localized API messages rather than raw fixture errors. Their targeted rerun and
the extended saved-progress case all passed: 3/3. Across these runs, all 27
distinct guided/legacy cases pass, with 9 nonapplicable inline-editor skips.

| Follow-up check | Command | Result |
| --- | --- | --- |
| Guided and legacy browser coverage | `pnpm exec playwright test --config tests/visual-consistency/completion.config.ts completion-import.spec.ts completion-legacy.spec.ts` | 25 passed, 2 message-expectation failures, 9 intentional skips; resolved by the retry below |
| Review failure, refresh and result recovery | `pnpm exec playwright test --config tests/visual-consistency/completion.config.ts completion-import.spec.ts --project=desktop-1440 --grep 'inline editor .*exposes\|guided final review recovers'` | 3 passed |
| Broader guided-family browsers | `pnpm exec playwright test --config tests/visual-consistency/families.config.ts guided-family.spec.ts` | 10 passed |
| Pure Import/calendar regression suite | `pnpm exec vitest run --config tests/visual-consistency/completion-units.config.ts --maxWorkers 1` | 11 files / 66 tests passed |
| Lint | `pnpm lint` | Exit 0; no errors, two existing generated-file warnings |
| Production compilation | `pnpm exec node tests/visual-consistency/build-local.mjs` | Exit 0; TypeScript, 76 generated pages and both import Workflow manifests passed |
| Patch and documentation checks | `git diff --check`; relative-link validation | Passed; 112 links checked across the three updated documents |

All 37 distinct affected browser cases pass, with 9 intentional width skips.
Lint and the production build also pass. The unchanged lint warnings concern
generated Workflow and coverage files, not this correction.

The unit runner's first sandboxed attempt hit a Windows temporary-file rename
restriction before any test executed; the same guarded command passed outside
that sandbox. The first build attempt stopped before compilation because Docker
was not running; the guarded build was retried after starting the local engine.
Browser and unit fixtures block external database/provider access.
Evidence is retained under `test-results/pr-294-import-regressions-2026-11-13/`.
No schema, migration, dependency, saved environment or public-copy change is
required, and the owner's visual approval remains intact.

## Change boundaries

- Shared navigation restores the earlier Standard/Pro sidebar appearance, with
  grouped destinations, daily mobile links and the existing Account return paths.
- Shared interaction fixes retain unsaved drafts through confirmations and
  history navigation, release nested-dialog inertness correctly and restore
  keyboard focus in row menus.
- Records, seats, guided/legacy import, financial presentation, analytics and
  Settings use their existing feature owners and the accepted responsive styles.
- Reports date fields use individual rows below 380px. The shared Account title,
  menu and translated return action retain distinct space at 320px.

No API/service, schema, migration, dependency version or saved environment change
is included. Authorization, provider truth, import execution, payment arithmetic,
raw CSV output and return destinations remain with their existing owners.
Home, Features, Pricing and FAQ need no new feature claims.

## Local verification

The complete post-correction coverage run passed all 382 files / 3,260 tests.
The production build also passed, including TypeScript, all 76 generated pages
and the two-import-workflow manifest check. Post-build lint passed with zero
errors and the two existing generated-file warnings listed below.

| Check | Command | Result |
| --- | --- | --- |
| Initial complete unit/integration run | `pnpm exec node test-results/pr-ready-2026-11-12/run-full-tests.mjs` | 382 files / 3,260 tests; 3,252 passed, 8 failed; corrections and retries described below |
| Complete post-correction suite with coverage | `pnpm exec node test-results/pr-ready-2026-11-12/run-full-tests.mjs --coverage` | Exit 0; 382 files / 3,260 tests passed; 1,008.07 seconds |
| Receipt, checkout and reminder assertions | `pnpm exec vitest run --config test-results/pr-ready-2026-11-12/whatsapp-ui.config.ts --maxWorkers 1 --reporter=default --reporter=json --outputFile=test-results/pr-ready-2026-11-12/ui-retry.json` | 3 files / 15 tests passed |
| Reset-hook retry | `pnpm exec node test-results/pr-ready-2026-11-12/run-full-tests.mjs --retry tests/integration/services/whatsapp-delivery.test.ts` | 1 file / 13 tests passed |
| Dedicated Workflow transform | `pnpm test:workflow --configLoader runner` | 1 file / 1 test passed |
| Responsive browser checks | `pnpm exec playwright test --config tests/visual-consistency/playwright.config.ts` | Initially 148 passed, 2 failed, 22 intentional width-specific skips |
| Reports browser retry | `pnpm exec playwright test --config tests/visual-consistency/playwright.config.ts --grep 'report preview formats'` | 4 passed at 1440, 834, 390 and 320px; resolves both failures above |
| Page-family browser checks | `pnpm exec playwright test --config tests/visual-consistency/families.config.ts` | 97 passed, 7 intentional width-specific skips |
| Onboarding browser checks | `pnpm exec playwright test --config tests/visual-consistency/completion-onboarding.config.ts` | 36 passed |
| Final post-build lint | `pnpm lint` | Exit 0; zero errors, two existing generated-file warnings |
| Production build | `pnpm exec node tests/visual-consistency/build-local.mjs` | Exit 0; `pnpm build`, TypeScript, 76/76 generated pages and both import Workflow manifests passed |
| Patch whitespace | `git diff --check` | Passed |
| Documentation links | Local relative-link validation across the documentation commit | 13 files / 197 links checked; no broken targets |

Across the browser suite and its targeted retry, 283 distinct project/test cases
pass and 29 are intentionally skipped for nonapplicable widths. No browser
failure remains unresolved. Browser runs use fresh `VISUAL_AUDIT_RUN_ROOT`
directories under `test-results/pr-ready-2026-11-12/`, with separate shared review
evidence paths, so earlier gallery captures are retained.

The disposable-database wrapper invokes `pnpm test` or `pnpm test:coverage` with
`--pool=threads --testTimeout=30000 --hookTimeout=60000`, default/JSON reporters
and dated output paths. These local Windows timeout flags do not change repository
or CI defaults. Coverage retains the existing 70% line and function thresholds
for `services/**/*.ts` and `utils/**/*.ts`.

Coverage is 75.61% statements, 69.10% branches, 88.10% functions and 78.23% lines.
Both configured thresholds pass. This measures the configured services/utilities
scope, not every presentation component.

Lint reports unused-disable warnings in generated
`app/.well-known/workflow/v1/flow/route.js` and `coverage/block-navigation.js`.
Neither generated file is a commit input. No lint error remains.

Database tests use a new exact-ID-checked `postgres:16-alpine` container for each
run, with one loopback-only dynamically allocated port and a verified tmpfs data
directory. The existing 58 migrations, billing identity and validated constraints
are checked before execution. The runner supplies an explicit test URL and exact
reset confirmation in process memory. It does not load `.env.test`, copy a
retained fixture, use a shared/Preview/Production database or call a live business
provider. Each runner removes only the container it created.

The initial disk-backed attempt was stopped after observing
`DataFileImmediateSync` waits during table resets; it is not a passing run.
The browser regression update initially expected the mobile 16px input font at
desktop/tablet widths. The assertion now checks the 16px requirement on mobile
and retains the established compact desktop/tablet control size.
The first full suite completed 382 files / 3,260 tests: 3,252 passed and 8 failed.
Seven failures were stale UI assertions for named-month receipt dates and the
approved checkout/reminder wording. Those assertions were updated while retaining
calendar, language, masking, consent and cost-disclaimer checks; all 15 tests in
the three affected files passed the focused rerun. The remaining failure was a
60-second reset-hook timeout. All 13 tests in that integration file passed in a
fresh disposable database with unchanged assertions and timeout settings.

The root Vitest configuration excludes `tests/visual-consistency/**`, whose specs
belong to the separately executed Playwright suite. New browser assertions cover
the final date-field geometry, selected filter values sent to CSV export, and
the shared Account header in English, Hindi and Hinglish.

The latest verification-only edits are in `vitest.config.ts`,
`tests/visual-consistency/account.spec.ts`,
`tests/visual-consistency/completion-financial.spec.ts` and the existing
`BasicReceipt`, `BillingPaymentMethodsOverview` and `whatsapp-collections-ui`
unit tests. The accepted application changes are grouped into shared interaction,
controls, navigation, import, seats, records/settings, finance and analytics
commits, with separate test-harness, regression and documentation commits.

Browser tests render real components against synthetic local fixtures. They do
not establish live authentication, provider payment or message-delivery behavior.
The build uses its own new loopback-only database in read-only mode, existing
development authentication configuration in memory and disabled business-provider
operations. Reverting these UI commits requires no data rollback. No schema
migration, dependency update or saved environment change is required.

## Review evidence and delivery

The local gallery is `test-results/design-completion-2026-11-12/review/index.html`.
Its newest section contains 3 matched views of the two responsive fixes and 10
additional width/language checks. All 675 previous views remain historical:
688 total views, 844 referenced image assets. The offline gallery and ZIP download
were verified. These screenshots remain current because the PR preparation
corrections changed verification code only.

Run logs, structured results, the explicit commit plan and the prepared PR text
are retained under `test-results/pr-ready-2026-11-12/`. Screenshots, traces, ZIPs,
environment/authentication files and unrelated local logs are not commit inputs.
The accepted work is organized into 13 focused local commits. The existing branch
is retained; no push, PR publication, deployment or production release is performed.
The unrelated untracked `debug.log` is left untouched.
