# Shared presentation and Students review

Owner review is pending. The selected implemented dashboard at `3d58864` is
the baseline; this work stays on local branch `codex/shared-students-pattern`.
No later page family has been migrated.

## Review the result

The dashboard is captured at 1491 × 1055, scale 1, with loaded fonts, the same
fixed September fixture and the synthetic ribbon removed. Before/after pairs
put the frozen baseline on the left. Both extraction and final comparisons
measure decoded pixels without updating the baseline. All nine comparisons have
zero differing pixels and identical dimensions. The tablet application bar also
retains useful branch/organization selectors: its icon-only search no longer
reserves the desktop search width. The native 1491px dashboard is unchanged.

- [Whole dashboard comparison](shared-system-evidence/compare-after-dashboard.png)
- Crops: [header/artwork](shared-system-evidence/compare-after-header.png), [five priorities](shared-system-evidence/compare-after-actions.png), [six figures](shared-system-evidence/compare-after-metrics.png), [collections](shared-system-evidence/compare-after-collections.png), [seating](shared-system-evidence/compare-after-seating.png), [activity](shared-system-evidence/compare-after-activity.png), [quick actions](shared-system-evidence/compare-after-quick.png), [worklists](shared-system-evidence/compare-after-worklists.png).
- [Extraction pixel results](shared-system-evidence/comparison-extracted.json) and [final pixel results](shared-system-evidence/comparison-after.json).
- [Frozen Students desktop before](shared-system-evidence/before/students-en-1491.png) and [shared Students desktop after](shared-system-evidence/after/students-en-1491.png).

The following authenticated screenshots exercise the actual Next route against
the independently reverified disposable PostgreSQL fixture. They use synthetic
people and existing development sessions, with external business providers held.
They are separate from the component-harness evidence above.

| Language | Desktop 1491px | Mobile 390px | Mobile records |
| --- | --- | --- | --- |
| English | [Desktop](shared-system-evidence/connected/students-en-1491.png) | [Mobile](shared-system-evidence/connected/students-en-390.png) | [Cards](shared-system-evidence/connected/students-en-390-records.png) |
| Hindi | [Desktop](shared-system-evidence/connected/students-hi-1491.png) | [Mobile](shared-system-evidence/connected/students-hi-390.png) | [Cards](shared-system-evidence/connected/students-hi-390-records.png) |
| Hinglish | [Desktop](shared-system-evidence/connected/students-hinglish-1491.png) | [Mobile](shared-system-evidence/connected/students-hinglish-390.png) | [Cards](shared-system-evidence/connected/students-hinglish-390-records.png) |

- Actual overlays: [edit](shared-system-evidence/connected/students-edit.png), [fees](shared-system-evidence/connected/students-fees.png), [nested collection](shared-system-evidence/connected/students-nested-fees.png), [attendance history](shared-system-evidence/connected/students-attendance.png).
- Actual access states: [readonly](shared-system-evidence/connected/students-readonly.png), [restricted staff](shared-system-evidence/connected/students-restricted.png).
- Harness narrow Hindi [320px cards](shared-system-evidence/after/students-hi-320-records.png) and Hinglish [320px cards](shared-system-evidence/after/students-hinglish-320-records.png).
- Harness exceptional states: [loading](shared-system-evidence/after/students-state-loading.png), [empty](shared-system-evidence/after/students-state-empty.png), [failed read](shared-system-evidence/after/students-state-error.png).
- Real-component gallery: [desktop](shared-system-evidence/after/gallery-en-1491.png), [Hindi narrow](shared-system-evidence/after/gallery-hi-320-records.png), [comfortable density](shared-system-evidence/after/gallery-comfortable.png), [invalid field](shared-system-evidence/after/gallery-invalid.png), [nested dialog](shared-system-evidence/after/gallery-nested.png).

## What changed and where to reuse it

Recurring light-theme tokens now live in the existing `styles/tokens.css`.
Existing `AppPanel` and `AppButton` own explicit compact variants;
`appActionClassName` styles real navigation links. `styles/shared-ui.css` owns
their presentation and the record layout. Dashboard chart/matrix geometry,
artwork, five priorities, six figures and feature logic stay specialized.

Students supplies its existing authorized reads and commands to
`RecordListPage`, `RecordListSurface`, `RecordListState` and compact `DataTable`.
Its header, grouped filters, pagination, mobile cards and existing overlays share
that presentation. Result transitions preserve mounted workflows. Request
sequences ignore superseded roster/support responses; branch/account identity
changes clear branch-local UI. Language controls have stable accessible labels.
Supporting-read failure hides unavailable figures and disables export until
retry; it does not discard an already-open financial workflow.

The gallery imports those exact production components inside the existing local
harness. It adds no production route. [Usage and owner/source map](../ai/application-design-system.md)
is the durable reuse guide; `AGENTS.md` points agents there.

## Workflow coverage and boundaries

| Route/control | Evidence |
| --- | --- |
| Students search, active/inactive, shift and table/grid controls | Real component browser checks; newest query wins; clear/retry preserves context |
| Edit and return | Actual authenticated API/DB edit persists; allocation relations remain; failed-edit input and language are retained |
| Admission validation and bulk consent | Harness uses actual dialogs; invalid fields retain values; consent list stays limited to the loaded filtered roster |
| Deactivate and attendance | Harness verifies canonical KEEP command; actual connected attendance history loads through its existing API |
| Export / supporting-read failure | Actual authorized CSV downloads; unavailable supporting data cannot become zero financial values in the displayed roster or download |
| Fee details / nested collection | Actual existing dialogs, inert parent, Escape/focus recovery; financial aggregates unchanged; existing uncertain-command/receipt harness regression passes |
| Branch/account/access | Old drafts/records clear; actual readonly actions remain disabled, staff fees denied and foreign API reads denied |
| Selected dashboard operations | Existing month/source/notification browser regressions retained, plus exact pixel/crop comparison |
| Shared/public consumers | Seat allocation, collection, account and public route smoke checks; public localization units; no public source/copy changes |

Harness mocks demonstrate client behavior; they do not establish provider or
database correctness. Connected tests use normal authentication and server
authorization. No new external message, checkout, provider charge or sign-in
ticket was issued. This is local verification, not independent customer testing.

## Exact validation

All commands use the installed pnpm launcher
(`& "$env:APPDATA\npm\pnpm.cmd"` in PowerShell). No broad repository
database-connected Vitest invocation was used.

| Exact command | Result |
| --- | --- |
| `pnpm exec node node_modules/vitest/vitest.mjs run --config tests/shared-system/vitest.config.ts` | PASS: 12 files, 52 tests; explicit allowlist and throwing DB/network guard |
| `pnpm exec node node_modules/@playwright/test/cli.js test --config tests/shared-system/playwright.config.ts` | PASS: 94 passed, 10 skipped, 5.1m; 104 discovered before the additional supporting-failure test |
| `pnpm exec node node_modules/@playwright/test/cli.js test --config tests/shared-system/playwright.config.ts shared-system.spec.ts` | PASS: 36 passed, 2.6m, after supporting-read gating; all four viewports |
| `pnpm exec node node_modules/@playwright/test/cli.js test --config tests/shared-system/playwright.config.ts --grep 'list retry\|failed supporting'` | PASS: 8 passed, 1.1m, after final unknown-count/unified-retry refinement |
| `pnpm lint` | PASS: 0 errors; 2 inherited generated-file unused-disable warnings (`app/.well-known/workflow/v1/flow/route.js`, `coverage/block-navigation.js`) |
| `pnpm exec node node_modules/eslint/bin/eslint.js 'app/branch/[branchId]/students/page.tsx' tests/application-design-pilot/shared-system.spec.ts` | PASS: final changed-file lint, 0 errors/warnings |
| `pnpm exec node tests/dashboard-connected/start-local.mjs build` | PASS: final production build, TypeScript, 74 static pages, manifest verification (2 import workflows); exact read-only local target |
| `pnpm exec node tests/dashboard-connected/start-local.mjs students-test` | PASS: 3 connected tests, 1.1m; actual edits/DB, allocation context, fees/nested focus, attendance, CSV, three languages, readonly/staff/foreign access, public/account routes |
| `pnpm exec node tests/dashboard-connected/start-local.mjs counts` | PASS: reverified exact target; 8 students, 16 seats, 3 shifts, 5 fees, ₹4,300 billed, ₹1,900 collected, 19 live/3 voided synthetic receipts preserved |
| `pnpm exec node tests/application-design-pilot/system-capture.mjs after` | PASS: final dashboard/crops, Students/languages/overlays/states/gallery; no page errors; only affected loading/error images refreshed after final state refinement |
| `pnpm exec node tests/application-design-pilot/system-compare.mjs after` | PASS: full dashboard and 8 crops, identical dimensions and 0 differing decoded pixels |
| `pnpm exec node tests/shared-system/check-presentation.mjs 3d58864` | PASS: changed-file palette/shared-owner guard, including staged new sources |
| `git diff --check` and `git diff --cached --check` | PASS before implementation commit; repeated for final evidence |

The ten existing conditional skips are one desktop-only compact-shell case and
three desktop-specific keyboard/accessibility/200% cases on each smaller project.
They are not unavailable authentication/database skips. New Students/gallery
cases run at every width, including serious/critical Axe checks and nested focus.
After later state refinements, affected checks were rerun instead of repeating
unrelated dashboard/provider suites.

Failures found during development were repaired: tablet selector compression;
unstable language control accessible names; assertions using a translated dialog's
old name; a fixture returning attendance-list data for attendance history; and a
Next Link unit assertion depending on attribute order. Connected editing exposed
the original synthetic fixture's null phone against the existing required-phone
form: the test supplies a valid synthetic phone and restores null through scoped
SQL in the verified disposable database. The production validation rule was not
changed. [Connected result metadata](shared-system-evidence/connected/verification.json)
records the final checks; all asserted values are true.

## Local commits and launch

- `95a589a` — Extract selected dashboard presentation without visual drift.
- `6e423ae` — Apply shared record presentation to Students and gallery.
- The final verification/evidence commit is reported in the completion response;
  `git log --oneline 3d58864..HEAD` lists this task's exact complete local log.

For interactive review, start the existing harness:
`pnpm exec node tests/application-design-pilot/server.mjs`, then open
`http://127.0.0.1:4187/branch/pilot/gallery?mode=after&lang=en` or
`/branch/pilot/students?mode=after&lang=hi`. Use `en`, `hi` or `hinglish` in that
isolated harness. For the actual application, run
`pnpm exec node tests/dashboard-connected/start-local.mjs` then the existing
`pnpm exec node tests/dashboard-connected/open-preview.mjs` with the already-saved
synthetic development session. The launcher refuses any changed target identity.
Both verification servers are stopped after the final checks; the local result
remains available through these launch commands.

## Scope, rollback and next batch

No API/service/schema/migration/dependency/provider integration or saved
environment change is introduced. The existing dashboard-operations migration
and release prerequisites remain intact; no migration/reset/seed was run here.
The verified fixture is loopback PostgreSQL 16 in the exact task container, with
53 existing migrations and 80 tables. The build additionally proves read-only
transactions. Connected scalar-edit cleanup restores only its known synthetic
student and preference; no fee/receipt history is removed.

No push, PR, merge, deployment or production/shared database operation occurred.
Rollback is reverting these local presentation commits; no new database rollback
is required. Retain the earlier dashboard migration/release notes for a future
release. Public wording needs no change because this is authenticated
presentation, with no new product capability or public claim.

Review the Students header/filter density, record/card scanning and detail
overlays once. [The remaining route-family plan](page-family-migration.md) proposes
Staff and Tasks as the next record-family batch, after that focused review.
Financial evidence, provider billing and specialized maps retain separate review
boundaries. No later batch begins automatically, and no design acceptance is
claimed by the agent.
