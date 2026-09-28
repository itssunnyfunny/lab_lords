# Selected application rollout — bounded local closeout

This packet reviews the current local migration on `codex/shared-students-pattern`.
The selected dashboard, approved Students cards/table, and public site were not
redesigned. New closeout code and captures are in `15094ff`; the [migration
ledger](page-family-migration.md) remains the route and approval record. Images
here are local presentation evidence, not connected authorization or release
evidence. Historical images below were reused without regeneration.

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

Three genuine composition omissions were fixed: cold loading and root-error
boundaries now select the authenticated theme and localize owned error copy;
organization selection plus account/organization navigation now use the
approved botanical mark; and the selected AppShell's opened Clerk account
popover/profile uses semantic light tokens. The dashboard avatar classes and
excluded/public Clerk skin are unchanged. The provider-owned popover/profile
cannot be rendered in this no-Clerk fixture; its source-level token/selection
test passed, but a live visual check remains open.

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
[Hindi cold loading](application-closeout-evidence/selected-route-loading-hi-mobile-390.png),
[Hindi root error](application-closeout-evidence/selected-route-error-hi-mobile-390.png),
and [dashboard restricted source](reference-dashboard-evidence/mobile-390/restricted.png).
The new organization/account/settings/boundary captures use actual application
components and loaded fonts with a synthetic adapter; their top ribbon labels
that isolation.

## Evidence mapped to required checks

| Family | Reused valid evidence and final affected checks | Still blocked or unproven on current tree |
| --- | --- | --- |
| Dashboard | Frozen full/crop comparison; current 14 browser regressions cover refresh, source restriction/error, dates and notifications; dashboard contracts/source units in 169/169 reference suite. | Current connected freshness, finance and permissions. |
| Students | Approved three-language desktop/cards, nested fee/edit and read-only/restricted packet; historical three authenticated workflow checks and roster/fee units. Feature code unchanged; new boundary/theme and account-shell checks cover changed shared dependencies. | Current authenticated route/DB replay; opened Clerk account UI. |
| Staff | Historical 15 fixture cases cover three languages, narrow cards, menus/focus, invite/role/access/read-only/error; 31 service/API and two pagination unit cases; two historical connected checks. | Current authenticated invite/access persistence and opened Clerk UI. |
| Tasks | Historical 20 fixture cases cover create/edit identity, assignment, due/state/activity, source links, filters, three languages, focus and access states; 26 dashboard source/route units. | Actual-route persistence, assignee authorization and history. |
| A · Queues | Two desktop/390px fixture cases cover due worklists and navigation; renewal/overdue/fee-source units are in the current 169/169 reference suite. | Actual tenant/consent scope and partial/waived reminder operation. |
| B · Payments | Two fixture cases cover records/cards; fee arithmetic, payment status and billing-cycle units in current safe suites; historical dashboard retry/void evidence. | Current receipt, correction, idempotency and provider-held recovery. |
| C · Seats/Shifts | Two fixture cases cover maps, allocations and shifts; current seat-view and ten newly run seat-pagination units distinguish loaded from exact totals. | Actual overlap/capacity/tenant authorization. |
| D · Attendance | Two fixture cases cover list/cards; current attendance/QR/camera lifecycle units in the 169/169 suite. | Real camera/device and actual command retry/evidence. |
| E · Settings | Four historical dashboard-settings cases cover threshold, expectations, terms and language; six new real-component desktop/mobile cases cover account PATCH/discard/languages, branch writable/read-only, organization billing summary/dialog and terminal APPLIED/DECLINED processing. SettingsWorkspace and two organization-access units run safely. | Provider callback, pending recovery, actual tenant write scope. |
| F · Reporting | Two fixture cases cover branch/org/report layouts; branch-report contracts/service units in current 169/169 suite cover scoped data, arithmetic and output. | Actual authorized export/download and advisory provider response. |
| G · Guided | Historical 15 fixture cases cover onboarding/invite/import at 1440/390/320 and three languages; botanical onboarding correction `d2bf1a2` remains; current boundary tests cover cold states. | Actual invite token, staged import and recovery. |
| H · Workspace | Historical entry/overview packet; current desktop/390 suite covers organization selection, navigation, failure/retry and empty directory, plus a clean 320 entry check and botanical capture. | Actual foreign organization isolation/account switching. |

Historical connected evidence was captured against a then-verified disposable
fixture, before the current port block. It is retained for context, not claimed
as current connected verification. No test count substitutes for the unmet
server-side and provider checks above.

## Final local validation and limits

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

Connected verification is **BLOCKED**, not passed: current Windows TCP
exclusions include `55371–55470`, which contains the fixture's configured
`55447`. No unverified substitute or shared/production data was used. The
[separate repair proposal](local-fixture-port-repair-proposal.md) specifies how
to restore a fresh independently verified local fixture without weakening the
existing identity guard. Owner review remains open for this closeout and every
family except the approved Students presentation; nothing here is a release.

## Local migration commit sequence

Chronological `git log --reverse --oneline c71e9e3^..15094ff` on this branch:

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
```
