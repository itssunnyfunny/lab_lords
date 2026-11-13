# Visual consistency audit after remote sync - 7-10 November 2026

Sidebar follow-up, 10 November 2026: the owner rejected this run's shared sidebar
appearance. Its consistency checks used the wrong visual reference and did not
establish owner acceptance. The earlier Standard/Pro design has been restored
across the application; see the [correction and fresh verification](sidebar-restoration-2026-11-10.md).
Screenshots and results below remain historical evidence of the earlier run.

Status: complete on 10 November 2026. All 17 identified findings are fixed
(the 13 retained corrections and four additional findings in this rerun).
The run began on 7 November and resumed on 10 November after an interruption.

## Remote update and preserved work

The current branch, `codex/complete-owner-setup-import`, was fast-forwarded from
`ca9938bcd414899ae5b1c13e9f8b884da8860308` to fetched `origin/main`
`50f2fa9b3b8ca06348c27a0e5c03f5ccbcba77b1` (17 commits). Its original remote
tracking branch was already current; main contained the newer unified Account
and sidebar work. No branch switch, project commit, push, PR or deployment was
performed.

The previous visual corrections were backed up and restored. Five stash-apply
conflicts were resolved in BasicWorkspace, BranchWorkspaceShell, the design
system, current-state document and public-claims record. The resolution retains
the remote shared SidebarFrame, fixed Account footer, canonical Account Billing
links and centralized Preferences language controls alongside the prior fixes.
All edits remain unstaged. Recovery artifacts are under
`test-results/remote-sync-2026-11-07/`; the exact recovery stash is
`26ea8eb377b7c3784f64a0834fd503a7fb92965e`. The pre-existing `debug.log` is excluded
from the backup/stash and is checked by SHA-256 without reading its contents.

## Scope

This is a fresh local audit of the updated code, using the real application
components with synthetic identity and in-memory API fixtures. Chrome covers
1440px desktop, 834px tablet and 390px/320px mobile. The route sweep covers 33
routes at all four widths, including the new Profile, Preferences and Account
Billing destinations. Interactive suites exercise English, Hindi and Hinglish,
loading/error/denied states, focus, dialogs, pending writes, draft retention,
Back/Forward and canonical workspace return context.

The earlier [13-finding report](visual-consistency-2026-11-07.md) remains the
record of the first pass. Its implementation is retained and rechecked in this
run; its older results are not counted as fresh verification. Public/auth route
theme exclusions are checked, but this is not an exhaustive public marketing
page audit or a live production/provider test.

## Findings

| ID | Priority | Finding and correction | Files |
| --- | --- | --- | --- |
| R01 | P2 | Account still used native in-app leave prompts. It now composes the shared themed ConfirmDialog. Cancel retains the draft and current location; Continue resumes the captured link or history action once. Requests are owner/path scoped, pending saves block navigation, and close/reload keeps native browser protection. The existing discard prompt also has explicit overlay theming. | [PersonalSettings](../../components/account/PersonalSettings.tsx) |
| R02 | P3 | Account inherited the branch header's extra mobile height despite having one row. Its scoped header now has a 64px minimum and grows when translated content wraps. | [AppShell](../../components/layout/AppShell.tsx), [Account styles](../../styles/account-navigation.css) |

The full screenshot review also found R03 and R04, which page-overflow checks did not detect.

| ID | Priority | Finding and correction | Files |
| --- | --- | --- | --- |
| R03 | P2 | Between 641px and 1350px, automatic grid placement put the dashboard title below the artwork in the narrow first column, leaving a large blank area. Explicit responsive grid positions keep the title and actions in the wider column, with wrapping actions in their own row. No data or actions change. | [Dashboard styles](../../styles/reference-dashboard.css), [responsive regression](../../tests/visual-consistency/dashboard-responsive.spec.ts) |
| R04 | P2 | At 320px, Organization and Branch labels competed for one narrow row. Within the shared mobile workspace header, the fields now stack, the static organization name can wrap, and the native branch control keeps its 44px target. Account and Basic header ownership is unchanged. | [Shared workspace header styles](../../styles/reference-dashboard.css), [responsive regression](../../tests/visual-consistency/dashboard-responsive.spec.ts) |

The mobile-header regression checks dashboard, Students, import and organization
pages at 320px/390px in all three languages (24 combinations). The organization
read uses an explicit synthetic branch fixture. All 66 mobile route captures are
refreshed after the correction.

The intermediate-width regression checks 641, 834, 1024, 1280 and 1350px in English, Hindi and
Hinglish (15 combinations). Dashboard sweep captures are refreshed at all four
standard widths after the fix; the desktop comparison removes all three appended
responsive rules to verify the unchanged 1440px rendering.

The first GPU-rendered desktop comparison showed differences confined to two
decorative leaf images. Waiting for image decoding alone did not remove the
raster variation. The comparison now waits for stable captures, uses software
rendering, and asserts the responsive rules are inactive at 1440px. Two
consecutive calibration runs produced byte-identical images. The final run after
all three CSS corrections differs at one pixel by one channel value, with zero
pixels beyond the existing one-value tolerance. No mask or wider tolerance was
introduced. Earlier comparison artifacts are retained.

Retained first-pass corrections: exact fees/setup/student-detail theme boundaries;
shared access-state controls; primary admission action; 44px import choices;
complete localized seat messages; shared Basic confirmations; readable mobile
Basic selects; 44px mobile dashboard controls and matrix scrolling; readable Basic
overlays; cancellation-safe history navigation; reference-counted nested-dialog
inert locks; truthful generic denied-access wording; and row-menu keyboard focus.
See V01-V08 and L01-L05 in the linked earlier report for individual owners.

The new Account regression cases cover all three plans, shared navigation,
independent sidebar collapse state, Preferences persistence and language scope,
last-field clearance above Save, pending/failed saves and draft-safe link/history
navigation. Shared-family tests now simulate a Preferences save notification to
check reactive localization while a form is open. Actual language controls are
operated separately in Account; removed header/dialog controls were not restored.

Smoke-test failures were obsolete test assumptions (Account entry URL, radio
controls and generic localized error wording). The assertions were corrected to
the observed current contract. All eight final desktop/320px Account smoke cases
passed before the complete rerun. The initial full run then exposed a selector
matching both the workspace and the new SidebarFrame. It was narrowed to the
workspace container; the initial evidence is retained and the full suite was
restarted on the corrected test. No application change was needed for that failure. In the restarted run, one
desktop Account case timed out after a 9.4-minute browser stall while scrolling
a visible link. The other 83 cases passed, and that exact case then passed three
consecutive isolated rechecks without code changes. The evidence retains the
timeout; it is not represented as a completely clean single suite run.

## Fresh validation

Browser commands use process-only `VISUAL_AUDIT_RUN_ROOT` set to
`test-results/visual-remote-sync-2026-11-07`. Shared tests additionally set
`PLAYWRIGHT_REVIEW_EVIDENCE_DIR` to that directory's `shared-evidence` child.
The [harness README](../../tests/visual-consistency/README.md) gives the exact
PowerShell setup. Historical screenshots are preserved. Browser, unit and build
runs are sequential to avoid machine contention.

| Check | Exact command | Result |
| --- | --- | --- |
| Full four-width visual/interaction suite | `pnpm exec node node_modules/@playwright/test/cli.js test --config tests/visual-consistency/playwright.config.ts` | 83 passed, four intentional width skips, one desktop Account timeout. The exact timed-out case passed all three rechecks below: 84 unique cases verified. |
| Desktop Account stability recheck | `pnpm exec node node_modules/@playwright/test/cli.js test --config tests/visual-consistency/playwright.config.ts account.spec.ts --project desktop-1440 --grep 'Basic Standard' --repeat-each 3` | Three consecutive passes, without application changes. |
| Shared-family regressions | `pnpm exec node node_modules/@playwright/test/cli.js test --config tests/visual-consistency/shared-regression.config.ts` | 65 passed; five intentional desktop skips for mobile card cases; no failures. |
| Intermediate dashboard layout | `pnpm exec node node_modules/@playwright/test/cli.js test --config tests/visual-consistency/playwright.config.ts dashboard-responsive.spec.ts --project tablet-834` | One passed, checking five widths in three languages. This ran before the separate mobile-header case was added. |
| Final mobile-header layout | `pnpm exec node node_modules/@playwright/test/cli.js test --config tests/visual-consistency/playwright.config.ts dashboard-responsive.spec.ts --project mobile-390 --project mobile-320 --grep 'workspace header'` | Two passed, covering four page families in three languages at both mobile widths. |
| Route/layout/contrast sweep | `pnpm exec node tests/visual-consistency/sweep.mjs` | 132 final captures: 33 routes at four widths; zero capture failures, runtime errors or horizontal page overflow. All 33 color-contrast scans at 390px found zero violations. |
| Desktop rendering | `pnpm exec node tests/visual-consistency/desktop-comparison.mjs` | Passed at 1440x1024 against 50f2fa9: one pixel differs by one channel value; zero pixels beyond the existing tolerance. All three responsive corrections are verified inactive at this width. |
| Final isolated unit suite | `pnpm exec node node_modules/vitest/vitest.mjs run --config tests/account-navigation/vitest.config.ts --maxWorkers 1 --testTimeout 15000` | Passed on 10 November: 72 files, 791 tests, 104.49 seconds. |
| Full lint | `pnpm lint` | Passed: zero errors; two existing unused-disable warnings in generated `app/.well-known/workflow/v1/flow/route.js` and `coverage/block-navigation.js`. |
| Scoped presentation guard | `pnpm exec node tests/shared-system/check-presentation.mjs HEAD` | Passed against the fetched baseline; no new literal palette or duplicated surface owner violation. |
| Guarded production build | `pnpm exec node tests/visual-consistency/build-local.mjs` (invokes `pnpm build`) | Passed on 10 November: compilation, TypeScript, 76/76 static-page generation and both import workflow manifest checks. The helper removed its disposable database. |
| Patch/document hygiene | `git diff --check`; local Markdown path validation | Passed: no whitespace errors; 160 local Markdown links resolve; no unresolved conflicts or staged changes; pre-existing debug.log fingerprint matches. |

These runs verify **152 unique applicable browser cases**. Repeated smoke checks
are not added to that total. Nine width-specific skips were observed in the full
suites; the focused responsive commands select only their applicable projects.
The single full-suite timeout remains visible in the evidence rather than being
reported as an uninterrupted all-green run.

For isolated evidence, the Account recheck uses the run-root child
`account-stability-recheck`, the intermediate-width test uses `responsive`, and
the final mobile-header test uses `mobile-header-final`. The sweep was refreshed
with `AUDIT_ROUTES=dashboard` after R03, then all route names and
`AUDIT_WIDTHS=390,320` after R04. The interruption left 11 final 320px captures;
they were completed on 10 November with:

```powershell
$env:AUDIT_WIDTHS = '320'
$env:AUDIT_ROUTES = 'org-settings,billing,onboarding,invite,import,basic-overview,basic-students,basic-seats,basic-fees,basic-setup,basic-student-detail'
pnpm exec node tests/visual-consistency/sweep.mjs
```

File timestamps and the final inventory confirm that all 66 mobile captures
include the final CSS. The desktop comparison was repeated after completion.
Manual screenshot review covers the desktop and narrow-mobile page overviews,
selected tablet layouts and the Account/confirmation states; automated geometry
and contrast assertions supplement that review.

Evidence under `test-results/visual-remote-sync-2026-11-07/`:

- `focused/results.json`, `shared/results.json`, and `account-stability-recheck/focused/results.json`.
- `responsive/focused/results.json` and `mobile-header-final/focused/results.json`.
- `sweep/inventory.json`, `sweep/summary.json`, all route PNGs, and `review-sheets/`.
- `dashboard-834-before.png` and `workspace-header-320-before.png` preserve the additional findings.
- `desktop/comparison.json`, `desktop/before.png` and `desktop/after.png`.
- `unit.log`, `lint.log`, `build.log`, and `source-manifest.json`.

Earlier failed/interrupted checks and GPU comparison diagnostics are retained
in separate subdirectories. The original 7 November audit's build log was copied
to its own evidence directory before the new build could replace the shared log.


The broader unit allowlist found one outdated exclusion for a student-detail
URL. Its expectation now includes the actual detail route and excludes a deeper
unsupported history path. The first run's 789 passing checks and one failed
expectation are preserved; final results use the full rerun after that correction.

## Files and implementation boundaries

The new application edits in this pass are PersonalSettings, AppShell and
`styles/account-navigation.css`, plus the responsive dashboard grid and mobile workspace-header corrections. Conflict resolutions retain the merged Basic
workspace, access shell and documentation. The prior correction files remain:

- Import entry, Seats and AddStudentDialog under `app/branch/[branchId]/`.
- BasicDialog, BasicWorkspace and useBasicNavigationGuard.
- BranchAccessProvider, BranchWorkspaceShell, BranchTopSearch, WorkspaceSwitcher
  and UserPreferencesApplier.
- ConfirmDialog, Dialog and RowActionsMenu.
- applicationDesignPilot, workspaceNavigationGuard, the operations translation
  catalogue, Basic styles and dashboard styles.
- Scoped shared-system unit configuration and theme, route-boundary, shell and
  navigation unit assertions.

Browser changes comprise `tests/visual-consistency/account.spec.ts`, the
new intermediate-width dashboard and mobile workspace-header regressions, four-width fixture harness/configuration/sweep/comparison, the Preferences refresh
helper and four existing shared-family specs. The design-system source map,
current state, migration ledger and public-claims record link this new evidence.

No new package version, schema, migration, seed or saved environment change is
required. No service, API authorization, tenancy rule, billing arithmetic,
provider operation or stored record is changed by the visual corrections.
Home, Features, Pricing and FAQ retain their approved wording: these repairs add
no capability, plan inclusion, price or availability claim.

## Limits and release status

Fixtures cannot prove real Clerk forms, live database behavior, payment/provider
callbacks or production operation. Profile/security uses a synthetic Clerk
surface. Billing is tested for rendering/navigation/context, not live charges.
The legacy `/org/.../billing` sweep entry renders the retained billing component
in the fixture; the real route redirects to Account Billing. That capture is not
proof of the production redirect. `/account` similarly renders Profile directly
in the fixture instead of exercising its production entry redirect.
The safe unit allowlist uses mocked I/O and excludes the root integration setup,
which can truncate a database. The production build uses a newly created,
identity-verified, loopback-only disposable database in read-only mode with
business providers disabled; its helper removes only that container.

Safari and Firefox are not covered. The sweep's color-contrast scans run at
390px; other widths have layout captures and selected interactive accessibility
checks. Expected unavailable synthetic WhatsApp responses do not establish a
production outage. Desktop comparison isolates the appended mobile and intermediate-width CSS against
the fetched baseline using current markup; it does not replace an owner-approved
historical image.

Owner visual acceptance and release remain separate from local verification.
No production data was accessed. Recovery artifacts and the stash are retained;
no unrelated files are removed.
