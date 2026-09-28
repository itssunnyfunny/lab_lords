# Selected application rollout — bounded local closeout

This packet reviews the current local migration on `codex/shared-students-pattern`.
The selected dashboard, approved Students cards/table, and public site were not
redesigned. The bounded presentation closeout is in `15094ff` and `43fe867`,
and the connected verification/theme correction is in `0cd0bcc`;
the [migration ledger](page-family-migration.md) remains the route and approval
record. Historical presentation images below were reused without regeneration.
The new masked Clerk captures come from the actual development-authenticated
application; connected route/database evidence is recorded separately below.

## Route and surface audit

The actual `app/**/page.tsx` inventory has 29 application paths: 28 selected
routes in the ledger plus the intentionally excluded legacy
`/branch/[branchId]/ai/messages`. The 28 comprise one dashboard, Students,
Staff, Tasks, three A queues, Payments, three C operations, Attendance, five E
settings/billing paths, four F reports, four G guided paths, and three H entry
paths (`/app` is a redirect). Sign-in/sign-up and public/localized routes are
separate exclusions. The existing branch theme gate already covered its full
selected set, including nested AI reports and import sessions. Organization,
account and guided shells opt in explicitly. Dialogs, drawers and row menus
portal to the body and inherit the selected tokens through the existing
`html:has(...)` rule; the collection overlay retains its explicit scope.

Three genuine composition omissions were fixed at bounded closeout: cold loading and root-error
boundaries now select the authenticated theme and localize owned error copy;
organization selection plus account/organization navigation now use the
approved botanical mark; and the selected AppShell's opened Clerk account
popover/profile uses semantic light tokens. The dashboard avatar classes and
excluded/public Clerk skin are unchanged. The subsequent real Clerk check found
that global dark utility colors still won the cascade in the opened light
popover/profile. The scoped base-layer correction restores readable semantic
colors on desktop and mobile, including the compact profile header. The
provider-rendered visual check now passes on the actual authenticated build.

## Representative desktop and mobile views

| Baseline and record family | Operations and entry family |
| --- | --- |
| [Dashboard desktop](reference-dashboard-evidence/desktop.png) · [390px](reference-dashboard-evidence/mobile-390/en-top.png) · [original comparison](reference-dashboard-evidence/original-versus-rendered.png) | [Follow-ups desktop](application-rollout-evidence/work-queues/follow-ups-desktop-results-1440.png) · [390px](application-rollout-evidence/work-queues/follow-ups-mobile-results-390.png) |
| [Students desktop](student-card-evidence/after/desktop-table.png) · [390px](student-card-evidence/after/roster-en-390.png) | [Payments desktop](application-rollout-evidence/payments/payments-desktop-1440.png) · [390px](application-rollout-evidence/payments/payments-results-mobile-390.png) |
| [Staff desktop](batch-two-evidence/staff/en-desktop-1440.png) · [390px](batch-two-evidence/staff/en-records-mobile-390.png) | [Seats](application-rollout-evidence/seats-shifts/seats-mobile-390.png) · [allocations](application-rollout-evidence/seats-shifts/allocations-mobile-390.png) · [shifts](application-rollout-evidence/seats-shifts/shifts-mobile-390.png) |
| [Tasks desktop](batch-two-evidence/tasks/en-desktop-1440.png) · [390px](batch-two-evidence/tasks/en-records-mobile-390.png) | [Attendance desktop](application-rollout-evidence/attendance/attendance-desktop-1440.png) · [390px](application-rollout-evidence/attendance/attendance-card-mobile-390.png) |
| [Account desktop](application-closeout-evidence/account-desktop-1440.png) · [branch settings 390px](application-closeout-evidence/branch-settings-mobile-390.png) | [Reports 390px](application-rollout-evidence/reporting/reports-mobile-390.png) · [AI reports 390px](application-rollout-evidence/reporting/ai-reports-mobile-390.png) |
| [Organization selection desktop](application-closeout-evidence/org-selection-desktop-1440.png) · [overview 390px](application-rollout-evidence/workspace/org-overview-branch-mobile-390.png) | [Onboarding desktop](application-rollout-evidence/guided/onboarding-entry-desktop-1440.png) · [import review 390px](application-rollout-evidence/guided/import-review-mobile-390.png) |

Important overlays and exceptions: [Students edit in Hindi](student-card-evidence/after/edit-hi-390.png),
[Staff access](batch-two-evidence/staff/access-hi-mobile-390.png),
[Tasks editor](batch-two-evidence/tasks/editor-hi-mobile-390.png),
[account discard](application-closeout-evidence/account-discard-mobile-390.png),
[billing confirmation dialog](application-closeout-evidence/billing-confirmation-mobile-390.png),
[billing processing](application-closeout-evidence/billing-processing-mobile-390.png),
[actual collection correction desktop](application-closeout-evidence/connected-correction-desktop-1491.png),
[actual collection correction 390px](application-closeout-evidence/connected-correction-mobile-390.png),
[Hindi cold loading](application-closeout-evidence/selected-route-loading-hi-mobile-390.png),
[Hindi root error](application-closeout-evidence/selected-route-error-hi-mobile-390.png),
and [dashboard restricted source](reference-dashboard-evidence/mobile-390/restricted.png).
The new organization/account/settings/boundary captures use actual application
components and loaded fonts with a synthetic adapter; their top ribbon labels
that isolation.
The new correction close-ups use the authenticated application and mask the
synthetic student identity.

Actual Clerk provider close-ups, with account identity masked:
[desktop menu](application-closeout-evidence/provider-actual/account-menu-desktop-1491.png),
[desktop profile](application-closeout-evidence/provider-actual/account-profile-desktop-1491.png),
[390px menu](application-closeout-evidence/provider-actual/account-menu-mobile-390.png),
and [390px profile](application-closeout-evidence/provider-actual/account-profile-mobile-390.png).

## Evidence mapped to required checks

| Family | Reused presentation and safe-unit evidence | Current actual-route evidence and remaining limit |
| --- | --- | --- |
| Dashboard | Frozen full/crop comparison; 14 browser regressions cover refresh, source restriction/error, dates and notifications; dashboard contracts/source units in the 169-test reference suite. | Real API/PostgreSQL cohort, capacity, chart periods, notification/action persistence and restricted source checks passed. |
| Students | Approved three-language desktop/cards, nested fee/edit and read-only/restricted packet; roster/fee units. Feature code unchanged. | Real edit persistence, allocation/financial preservation, nested fee overlay, three languages and readonly/staff/foreign scope passed. |
| Staff | Fifteen fixture cases cover three languages, narrow cards, menus/focus, invite/role/access/read-only/error; service/API and pagination units. | Real access-command persistence/restoration, permission and branch boundaries passed. External invitation delivery was held. |
| Tasks | Twenty fixture cases cover create/edit identity, assignment, due/state/activity, source links, filters, languages, focus and access; dashboard source/route units. | Real assignment, due/state persistence, prospective activity, source-only/readonly/foreign boundaries passed. |
| A · Queues | Desktop/390px fixture worklists; renewal/overdue/fee-source units. | Real follow-up save/reload and ₹500 partial remaining balance passed. Waived/legacy arithmetic remains safe-unit evidence; no message was sent. |
| B · Payments | Fixture records/cards; fee arithmetic, payment status and billing-cycle units. | Real same-key collection retry, immutable receipt, owner correction dialog/void and restored balance passed. Live payment provider/callback remained held. |
| C · Seats/Shifts | Fixture maps/allocations/shifts; seat-view and pagination units distinguish loaded/exact totals. | Real seat and student allocation conflicts rejected without changing capacity or finances; occupancy API/matrix passed. |
| D · Attendance | Fixture list/cards; attendance/QR/camera lifecycle units. | Real check-in/out/void exact-key replay, conflict response, one visit and durable command/audit passed. Physical camera remains unverified. |
| E · Settings | Dashboard setup and real-component account/branch/organization/billing-processing fixture cases; settings/access units. | Real account language preferences persisted/restored; setup settings saved; owner/read-only settings access and workspace account menu/profile passed. Provider callback and billing pending recovery remain held. |
| F · Reporting | Branch/org/report fixture layouts; scoped report contracts/service units. | Real owner JSON/CSV, Hindi document headings, fee totals, analytics and staff fee denial/student-report allowance passed. AI advisory provider was held. |
| G · Guided | Fifteen onboarding/invite/import fixture cases across widths/languages; cold boundary checks. | Real onboarding first-step validation made no workspace/import writes. Invite-token and staged import provider/recovery flows remain outside this isolated run. |
| H · Workspace | Entry/overview packet; desktop/390/320 component cases. | Real owner/staff directory, `/app` redirect, org-to-branch navigation, foreign-org equivalence and selected account theme passed. |

Historical connected evidence was captured against an earlier verified
disposable fixture and remains context. The new guarded suite checks the current
actual Next build, normal development authentication, server authorization and
independently identified PostgreSQL fixture. Counts alone do not stand in for
the family-specific checks or held provider/device limits above.

## Prior bounded presentation validation (retained)

| Exact command | Result |
| --- | --- |
| `node node_modules/vitest/vitest.mjs run --config tests/shared-system/vitest.config.ts --testTimeout=20000` | **PASS**, 25 files, 142 tests; explicit DB/network guard. Includes new boundary/brand and seat-pagination/organization-access checks. |
| `node node_modules/vitest/vitest.mjs run --config tests/reference-dashboard/vitest.config.ts --testTimeout=20000` | **PASS**, 28 files, 169 tests; guarded dashboard, billing, attendance and report contracts. |
| `node node_modules/@playwright/test/cli.js test tests/application-design-pilot/route-boundaries.spec.ts tests/application-design-pilot/workspace-entry-family.spec.ts tests/application-design-pilot/reference-regression.spec.ts --config tests/shared-system/playwright.config.ts --project=desktop-1440 --project=mobile-390` | **PASS**, 24 cases, two intentional mobile skips; actual components in isolated fixture. |
| `node node_modules/@playwright/test/cli.js test tests/application-design-pilot/workspace-entry-family.spec.ts --config tests/shared-system/playwright.config.ts --project=mobile-320 --grep "real organization selection"` | **PASS**, one 320px case. |
| `pnpm exec node node_modules/@playwright/test/cli.js test --config tests/shared-system/playwright.config.ts settings-family.spec.ts --project=desktop-1440 --project=mobile-390 --grep "real "` | **PASS**, six new account/branch/organization/billing-processing fixture cases with an independently started local Vite server. |
| `node tests/shared-system/check-presentation.mjs 3d58864` | **PASS**, changed-file palette/owner guard. |
| `node node_modules/eslint/bin/eslint.js .` | **PASS**, zero errors, two existing unused-disable warnings in generated workflow route and coverage output. |
| `node test-results/batch-two-offline-build.mjs` | **PASS**, optimized Next build, TypeScript, 74 static pages and two import workflow manifests with providers held and unreachable loopback DB. Compile evidence only. |
| `git diff --cached --check` | **PASS** before the implementation commit. |

At that bounded closeout, connected verification was **BLOCKED**: the then-current
Windows TCP exclusion contained the old fixture's port `55447`. The later
[authorized repair](local-fixture-port-repair-proposal.md) created a separate
verified target. The current outcome follows; the historical fixture results
above are retained as presentation evidence rather than reclassified.

## Current guarded connected handoff

The new `lab-lords-dashboard-test-20260928` container (ID prefix
`14c435177e23`, image `postgres:16-alpine`) has one
`127.0.0.1:59117 → 5432/tcp` binding and database
`lab_lords_dashboard_closeout_browser_test`. Independent Docker and host-side
PostgreSQL checks established the exact image, binding, empty starting schema,
database identity and synthetic schedule marker before application tests.
Only the checked-in 53 migrations and one transactional synthetic seed ran on
this new target. The old port-55447 fixture remained stopped and untouched;
the unchanged identity guard rejected fallback. No saved application
environment file, customer data, provider operation or production/shared
database was involved.

| Exact command | Current outcome |
| --- | --- |
| `node tests/dashboard-connected/start-local.mjs build` | **PASS** on the final changed application tree: TypeScript, 74 static pages, two import-workflow manifests; read-only guarded database and held business providers. Builds were sequential while resolving the provider visual defect. |
| `node tests/dashboard-connected/start-local.mjs test` | **PASS**, 23/23 actual authenticated Next-route and PostgreSQL cases, one worker, no intercepted application success responses. Includes the provider desktop/mobile visual check. The later correction-dialog case was added after this full run, with no application-code change. |
| `node tests/dashboard-connected/start-local.mjs test rollout-recovery.spec.ts` | **PASS**, initial 3/3 focused seat, attendance replay/void and remaining-balance checks; then **4/4** after adding the real collection-correction dialog case. |
| `node tests/dashboard-connected/start-local.mjs test rollout-closeout.spec.ts` | **PASS**, 3/3 focused account/workspace, reporting and guided-validation checks before the final full run. |
| `node tests/dashboard-connected/start-local.mjs test account-provider.spec.ts` | **PASS**, 1/1 actual Clerk-rendered menu/profile desktop/mobile after the base-layer fix; the final full run also passed the mobile compact-header assertion. |
| `node node_modules/vitest/vitest.mjs run --config tests/shared-system/vitest.config.ts --testTimeout=20000` | **PASS**, 25 files/142 tests; safe DB/network guard. |
| `node node_modules/vitest/vitest.mjs run --config tests/reference-dashboard/vitest.config.ts --testTimeout=20000` | **PASS**, 28 files/169 tests; guarded domain/presentation contracts. |
| `node tests/shared-system/check-presentation.mjs 43fe867` | **PASS**, changed-file semantic palette/owner guard after the final CSS edit. |
| `pnpm lint` | **PASS**, zero errors; two pre-existing unused-disable warnings in generated workflow/coverage files. |
| `node tests/dashboard-connected/start-local.mjs counts` and `git diff --check` | **PASS**, guarded read-only post-counts and whitespace validation. |

The prepared suite was run first. Early attempts failed on stale test
assumptions about a raw PostgreSQL timestamp timezone, duplicate desktop/mobile
text matches, and the already-approved `/account` theme gate; those assertions
were corrected. The first real Clerk capture then demonstrated a genuine
contrast defect: root-provider dark utility colors won over the selected light
workspace palette. A route-scoped base-layer CSS fix corrected the menu,
profile and mobile compact header without changing public authentication or
dashboard composition. Final affected checks above passed. The existing
correction API was already covered by the prepared suite's void/replay case;
the subsequent focused case also opened the migrated correction dialog,
confirmed its required reason and no-refund wording, voided only a newly
created synthetic receipt through the UI and verified the original balance.
The existing auto-focused onboarding field can consume an immediate first pointer click via
its blur render; this predates the presentation rollout, so the connected
validation test settles focus before pressing Continue. It remains a separate
observed UX issue, not silently treated as a rollout fix.

| Disposable fixture measure | Before tests | After all connected runs |
| --- | ---: | ---: |
| Public tables / completed migrations | 80 / 53 | 80 / 53 |
| Users / organizations / branches | 3 / 3 / 4 | 3 / 3 / 4 |
| Students / seats / shifts / fee rows | 8 / 16 / 3 / 5 | 8 / 16 / 3 / 5 |
| Live / voided immutable receipts | 19 / 0 | 19 / 4 |
| Tasks / membership terms / prospective events | 1 / 3 / 1 | 7 / 6 / 36 |
| Occupancy snapshots / unresolved follow-ups / expectations | 18 / 2 / 6 | 21 / 2 / 6 |
| Active / voided visits; attendance commands / audits | 0 / 0; 0 / 0 | 0 / 3; 9 / 9 |
| Billed / collected / waived / pending | ₹4,300 / ₹1,900 / ₹0 / ₹2,400 | ₹4,300 / ₹1,900 / ₹0 / ₹2,400 |
| Live receipt amount | ₹1,900 | ₹1,900 |

The expected deltas are test-created history across the prepared runs and their
focused reruns: six tasks, three independent terms, 35 prospective events,
three occupancy snapshots, four voided receipts and three voided attendance
visits with nine commands/audits. No active visit, allocation or financial total
changed. Tests restored only their known mutable synthetic access, student,
task and language fields; immutable receipt, command and audit evidence was
retained. A known synthetic follow-up note was updated through the real form.
The original fixture was re-inspected after testing and remained exited on
its original loopback binding. The new fixture was also stopped after the
checks; the existing guard can restart that exact preserved container.

Physical camera capture and external payment, messaging, AI and import
providers remained held or unavailable; no live callback, charge, message or
provider-backed import claim follows from these checks. Owner review remains
open for this closeout and every family except the approved Students card
presentation. Nothing here is a production release.

## Local migration commit sequence

Chronological implementation and verification commits through `f709292` on
this branch:

```text
c71e9e3 Add scoped dashboard operations and prospective history
64e111e Implement selected dashboard and complete branch workflows
3d58864 Verify selected dashboard and repair workflow refresh
95a589a Extract selected dashboard presentation without visual drift
6e423ae Apply shared record presentation to Students and gallery
0c7b80c Verify shared Students workflow and save review evidence
36d0d0d Refine Students cards and edit presentation
b102af3 Save focused Students refinement review evidence
6410b23 Record owner approval of Students presentation for Batch 2
82bf318 Migrate Staff to the approved record presentation
ea1c578 Migrate Tasks to the approved record-list presentation
179890b Record Batch 2 local evidence and review status
21e1834 Apply selected record styling to settings family
f7f70d1 Migrate follow-up renewal and overdue work queues
e38a090 Migrate seats allocations and shifts presentation
b12befc Migrate payments records and collection overlays
c4a3e00 Migrate attendance roster and confirmation presentation
c39b252 Migrate reporting presentation across branch and organization
6dd008c Migrate guided workflow presentation
8b69d4a Migrate workspace entry and overview presentation
0973c71 Align sidebar regression checks with migrated routes
1a77403 Record completed application family rollout and local evidence
d2bf1a2 Use selected botanical logo in onboarding
15094ff Close selected application route and shell presentation gaps
43fe867 Record bounded application rollout closeout evidence
0cd0bcc Verify connected rollout and correct Clerk workspace contrast
f709292 Record guarded connected closeout and visual evidence
```

The focused correction check and updated packet are the final local commit at
`HEAD`; `git log --reverse
--oneline c71e9e3^..HEAD` includes its exact ID and the full sequence.
