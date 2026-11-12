# Visual consistency audit and fixes — 7 November 2026

Status: all 13 identified findings fixed; local verification complete.

Final checks verified 133 unique browser cases (nine intentional width skips),
181 unit tests, lint and the guarded production build. One shared browser check
interrupted by a development reload passed on the stable-code recheck.

## Scope and method

Reviewed the actual application components in an isolated local browser with
synthetic records and identity. The dedicated harness uses the real workspace
switcher and language controls, excludes the obsolete organization prototype,
and blocks external browser requests. It covers desktop (1440px), tablet (834px),
and mobile (390px and 320px), including English, Hindi and Hinglish, loading,
errors, dialogs, keyboard use, pending operations and recovery. This is local
browser verification, not a production audit or live-provider authorization test.

The original audit evidence is in `test-results/visual-audit-2026-11-06/`.
Fresh test evidence and route inventories are linked below. The frozen desktop
dashboard and intentional Basic/full/public presentation boundaries are retained.

## Findings and changes

| ID | Priority | Inconsistency | Correction and owner |
| --- | --- | --- | --- |
| V01 | P2 | Fees, setup and student-detail cold boundaries fell back to the dark root theme. | Added the exact current routes to [applicationDesignPilot](../../lib/applicationDesignPilot.ts); public/auth and unrelated nested paths remain excluded. |
| V02 | P2 | Initial workspace access errors rendered unstyled Retry controls on a dark canvas. | [BranchWorkspaceShell](../../components/layout/BranchWorkspaceShell.tsx) now uses the selected canvas, busy/loading state, shared primary Retry and styled billing links. Refresh and presentation-change dialogs use explicit overlay theming. Forms stay withheld until access resolves. |
| V03 | P2 | Admission's submit action looked secondary beside Cancel. | [AddStudentDialog](../../app/branch/[branchId]/students/AddStudentDialog.tsx) explicitly selects the existing primary button variant. Submission, validation and allocation commands are unchanged. |
| V04 | P2 | Upload file / Paste table choices were only 32px high. | [Import entry](../../app/branch/[branchId]/onboarding/import/page.tsx) now gives both choices a 44px minimum target. |
| V05 | P2 | Seats mixed English summary fragments and status labels into Hindi; long translated details could truncate. | [Seats](../../app/branch/[branchId]/seats/page.tsx) uses complete catalogue messages, localized numbers, translated card/detail/status fallbacks and wrapping summary details. Stored student/shift names and loaded-versus-branch-wide totals retain their meanings. |
| V06 | P3 | Basic used native confirm boxes for in-app draft closure, navigation and recovery. | [BasicWorkspace](../../components/basic/BasicWorkspace.tsx) reuses [ConfirmDialog](../../components/ui/ConfirmDialog.tsx). Cancel preserves the draft and location; confirm resumes only the requested action. Pending commands remain blocked, recovery identity is rechecked, and browser close/reload retains native beforeunload protection. |
| V07 | P3 | Basic's mobile seat-assignment select text was 12px. | [Basic stylesheet](../../styles/basic-product.css) uses 16px for those native mobile controls. |
| V08 | P2 | Mobile dashboard tabs, matrix cells, row actions and links missed the 44px touch rule. | [Dashboard stylesheet](../../styles/reference-dashboard.css) adds mobile-only minimum targets and a keyboard-accessible horizontal matrix scroll area within the existing named tabpanel. Desktop geometry is unchanged. |
| L01 | P2 | The new Basic confirmation initially inherited low-contrast legacy description/button tokens. | Basic shared dialogs explicitly opt into the existing application overlay theme while retaining their Basic card styling. Browser contrast assertions cover the confirmation. |
| L02 | P1 | Back/Forward cancellation could let the router render a destination and discard the current form before restoration. | The [existing root preferences boundary](../../components/settings/UserPreferencesApplier.tsx) installs the [history dispatcher](../../lib/workspaceNavigationGuard.ts) in the layout phase. The [Basic guard](../../components/basic/useBasicNavigationGuard.ts) restores the current entry before opening the dialog. Back and Forward both retain edited fields on cancellation and resume once on confirmation. |
| L03 | P1 | Closing a nested confirmation and its parent together could leave the page inert. | [Dialog](../../components/ui/Dialog.tsx) reference-counts inert locks, preserving pre-existing inertness and restoring background interaction regardless of cleanup order. Browser checks close both dialogs and reopen the original workflow. |
| L04 | P2 | Denied branch access used the transient-error wording and incorrectly claimed the draft was retained. | [BranchAccessProvider](../../components/layout/BranchAccessProvider.tsx) exposes a denied state for the existing 401/403/404 and branch-mismatch cases. The shell shows the same generic No access state; the existing private-record/draft clearing and server checks are preserved. Transient refresh failures still retain mounted drafts behind Retry. |
| L05 | P2 | Row menus could keep keyboard focus on the trigger during reduced-motion entry rendering. | [RowActionsMenu](../../components/ui/RowActionsMenu.tsx) starts its positioned portal transparent instead of hidden and focuses after the positioning render. Enter/ArrowDown select the first enabled item, ArrowUp selects the last, and Escape restores the trigger. Existing Staff, Student and Task regressions exercise the shared correction. |

The requested fixes authorize implementation. Owner visual acceptance, merge and
production release remain separate and have not been claimed.

## Validation

All browser suites target the local synthetic application. The focused suite,
sweep and desktop comparison also block non-loopback requests. The safe unit
suite installs an explicit no-external-I/O guard and does not use the repository's
DB-truncating integration setup. Run the unit suite/build without parallel browser
workers on this machine to avoid resource-related import timeouts.

| Check | Exact command | Final result |
| --- | --- | --- |
| Four-width visual/interaction suite | `pnpm exec node node_modules/@playwright/test/cli.js test --config tests/visual-consistency/playwright.config.ts` | Passed: 68 tests, four intentional width skips; no unexpected failures. |
| Shared-family regressions | `pnpm exec node node_modules/@playwright/test/cli.js test --config tests/visual-consistency/shared-regression.config.ts` | 64 passed, five intentional skips; one Staff contrast scan interrupted by a development-server reload. The stable-code recheck below passes that scan and all affected menu flows: 65 unique shared checks verified. |
| Stable shared recheck | `pnpm exec node node_modules/@playwright/test/cli.js test --config tests/visual-consistency/shared-regression.config.ts --grep 'Staff uses\|Staff access retains\|name and menu work\|Task edit cancels' --output test-results/visual-shared-recheck-2026-11-07` | Passed: seven tests, one intentional desktop skip. |
| Route/layout/contrast sweep | `pnpm exec node tests/visual-consistency/sweep.mjs` | 120 captures across 30 routes and four widths; zero capture/runtime failures or page-level horizontal overflow. The 30 color-contrast scans at 390px found zero violations. Other widths have layout captures, not contrast-scan claims. |
| Desktop CSS comparison | `pnpm exec node tests/visual-consistency/desktop-comparison.mjs` | Passed at 1440×1024: zero differing pixels in the final run. Same current markup with pre-fix versus appended mobile-only dashboard CSS; not a replacement for the historical approved golden. |
| Safe affected unit suite | `pnpm exec node node_modules/vitest/vitest.mjs run --config tests/shared-system/vitest.config.ts --maxWorkers 1 --testTimeout 15000` | Passed: 29 files, 181 tests; final serial run completed in 66.58 seconds. |
| Lint | `pnpm lint` | Passed: zero errors; two unused-disable warnings in generated `app/.well-known/workflow/v1/flow/route.js` and `coverage/block-navigation.js`. Generated outputs were not edited to hide warnings. |
| Final edited-file lint | `pnpm exec eslint components/ui/RowActionsMenu.tsx components/layout/BranchAccessProvider.tsx components/layout/BranchWorkspaceShell.tsx tests/visual-consistency` | Passed with no errors or warnings. |
| Guarded production build | `pnpm exec node tests/visual-consistency/build-local.mjs` (invokes `pnpm build`) | Passed: production compilation, TypeScript, 74/74 static pages and the manifest check for both import workflows. The helper removed its disposable database. |
| Patch/document hygiene | `git diff --check`; local Markdown path validation | Passed; 143 local links checked with no missing targets. |

Shared tests use the process-only `PLAYWRIGHT_REVIEW_EVIDENCE_DIR` override in the
[harness README](../../tests/visual-consistency/README.md), preserving historical
review screenshots. Intentional skips are width-specific checks exercised in
their applicable mobile projects.

Added/updated tests cover route matching/loading gates, navigation continuation
and listener ordering, translated seats, primary/touch controls, nested dialogs,
Back/Forward cancellation, draft/recovery identity, pending-write blocking,
transient versus denied access, and row-menu keyboard entry/restoration. Existing
shared-family tests cover Staff, Tasks, Students, Payments, Seats/Shifts, dashboard
refresh/source changes and excluded route themes.

Development runs found and corrected L01–L05 above. The build also caught an
incorrect Playwright config placement for reduced motion; it now uses the typed
`contextOptions` field. Earlier resource-contended unit runs were not counted as
passing; the final isolated command/result is listed above.

Evidence locations:

- Focused browser results and screenshots: `test-results/visual-consistency-2026-11-07/`.
- Route sweep and computed layout/contrast inventory: `test-results/visual-consistency-sweep-2026-11-07/`.
- Desktop comparison: `test-results/visual-desktop-comparison-2026-11-07/comparison.json`.
- Existing shared-family regressions: `test-results/visual-shared-regression-2026-11-07/full-suite-results.json`.
- Stable shared recheck: `test-results/visual-shared-recheck-2026-11-07/results.json`.
- Guarded build log: `test-results/visual-consistency-2026-11-07/build.log`.
- Reproducible checks: [visual consistency tests](../../tests/visual-consistency/visual-consistency.spec.ts), [harness configuration](../../tests/visual-consistency/vite.config.ts), [route sweep](../../tests/visual-consistency/sweep.mjs).

The existing connected-build fixture container was unavailable. The dedicated
[build helper](../../tests/visual-consistency/build-local.mjs) instead creates a
new empty disposable database from the already-installed Postgres image, proves
its identity and loopback binding, and invokes the existing read-only,
provider-disabled build wrapper. It removes only its own container afterward.
No saved environment configuration, schema, migration or seed is modified.

## Changed files

- Screens: import entry, Seats and AddStudentDialog under `app/branch/[branchId]/`.
- Basic: `BasicDialog.tsx`, `BasicWorkspace.tsx` and `useBasicNavigationGuard.ts`.
- Workspace: `BranchAccessProvider.tsx`, `BranchWorkspaceShell.tsx`,
  `BranchTopSearch.tsx`, `WorkspaceSwitcher.tsx` and `UserPreferencesApplier.tsx`.
- Shared UI: `ConfirmDialog.tsx`, `Dialog.tsx` and `RowActionsMenu.tsx`.
- Shared support: `lib/applicationDesignPilot.ts`, `lib/workspaceNavigationGuard.ts`,
  `lib/i18n/operations.ts`, `styles/basic-product.css` and `styles/reference-dashboard.css`.
- Tests: the dedicated `tests/visual-consistency/` harness, safe shared-system
  config, route/theme/shell unit assertions and workspace-navigation unit tests.
- Documentation: this report, application design system, current state,
  page-family migration ledger and public claims scope note.

## Boundaries and remaining limits

No services, API authorization, tenancy rules, billing arithmetic, payment
provider calls, stored records, dependency versions or public feature claims are
changed. Draft/recovery storage remains scoped to the existing owner and branch.
The screenshot/API fixture cannot prove real Clerk, provider, database or
production behavior. Safari and Firefox are not covered by the Chrome runs.
Synthetic unavailable WhatsApp settings responses are fixture coverage limits,
not evidence of a production outage. No production data was accessed.

Home, Features, Pricing and FAQ wording was reviewed against the presentation
scope; their existing simple claims require no change. No commit, branch change,
push, PR or deployment is part of this work. The pre-existing `debug.log` is left
untouched.
