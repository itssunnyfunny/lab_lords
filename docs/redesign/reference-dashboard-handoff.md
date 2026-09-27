# Selected dashboard — local review handoff

Work started from clean commit `d190002` on 27 September 2026. Local branch:
`codex/reference-dashboard`. This implements the owner's selected original
dashboard. Visual acceptance remains with the owner; no release is authorized.

## Review the result

- [Original versus rendered desktop](reference-dashboard-evidence/original-versus-rendered.png)
- [Full comparison gallery and eight component comparisons](reference-dashboard-evidence/review.html)
- [Rendered desktop](reference-dashboard-evidence/desktop.png)
- [390px Hindi](reference-dashboard-evidence/mobile-390/hi-top.png), [lower content](reference-dashboard-evidence/mobile-390/hi-lower.png)
- [320px English](reference-dashboard-evidence/mobile-320/en-top.png), [lower content](reference-dashboard-evidence/mobile-320/en-lower.png)
- [834px Hinglish](reference-dashboard-evidence/tablet-834/hinglish-top.png)
- [Measured regions](reference-dashboard-evidence/comparison-regions.json)

The original is 1491 × 1055. Both comparison sides use native width, device
scale 1 and settled fonts. The separately labelled synthetic preview has a
21px ribbon; comparison crops remove only that ribbon. Main panel measurements
are: Action Center y214/height190.64; metrics y415.64/height106; chart
x247/y532.64/width555.88; seating x812.88/width366.38; activity x1189.25/width279.75;
worklists y868.67. The original corresponding worklists begin at y865.

Inter and self-hosted Caveat are verified loaded; Georgia supplies the serif
hierarchy. Hindi uses the existing Noto Sans Devanagari font. The generic library
image is explicitly labelled an illustration. [Artwork and font provenance](reference-dashboard-assets.md).

## Real local application and isolated visual preview

The authenticated application runs at `http://localhost:3117/branch/dashboard-shanti`
against the verified disposable PostgreSQL fixture. It uses the real Next.js
production build, real development authentication, normal tenant checks and
Prisma services. Billing, messaging, AI and import providers are held. The
independent visual preview runs at
`http://127.0.0.1:4187/branch/pilot?mode=after&lang=en` and uses synthetic adapters.
It is only a deterministic design/interaction fixture.

Final captures of the real authenticated production build and persisted fixture:
[desktop](reference-dashboard-evidence/connected/desktop.png),
[390px top](reference-dashboard-evidence/connected/mobile-390.png),
[middle](reference-dashboard-evidence/connected/mobile-390-middle.png),
[bottom](reference-dashboard-evidence/connected/mobile-390-bottom.png),
[320px top](reference-dashboard-evidence/connected/mobile-320.png),
[middle](reference-dashboard-evidence/connected/mobile-320-middle.png),
[bottom](reference-dashboard-evidence/connected/mobile-320-bottom.png), and
[tablet](reference-dashboard-evidence/connected/tablet.png).

Restart the already verified disposable local application, if needed, then
open its authenticated review window in another terminal:

```text
pnpm exec node tests/dashboard-connected/start-local.mjs
pnpm exec node tests/dashboard-connected/open-preview.mjs
```

The helper opens an ordinary Chromium window with the ignored synthetic owner
session. Development sessions expire; see the development-only refresh helper
and exact verified-target restart instructions in
[connected verification README](../../tests/dashboard-connected/README.md).
No token is embedded in a URL or committed. The start helper validates the exact
Docker container ID, image, loopback binding and fixture database from ignored
local configuration, and supplies the verified target privately. It refuses
unknown or non-loopback databases. Do not substitute `.env.test` or a shared URL.

## Features, sources and actions

The canonical [source definitions and authorization mapping](../ai/dashboard-operations.md)
describe every aggregate, period, permission, default and history limit.
The replacement composition is `ReferenceDashboard`, `ReferenceCollections`,
`ReferenceSeating` and `ReferenceWorklists`, using one permission-shaped
RepeatableRead overview. Obsolete dashboard composition and four competing CSS
files were removed after checking their consumers. Shared payment, receipt,
attendance and localization workflows remain canonical.

All paths below are relative to `/branch/:branchId`.

| Visible control | Actual behavior / destination |
| --- | --- |
| Organization / branch menus | Authorized workspace directory; switch organization or branch context |
| Search, Ctrl/Command-K, mobile search | Scoped students/payments/seats and permitted navigation; results link to real records |
| Notifications | Derived conditions; persisted user/branch read, 24-hour snooze and dismiss; link to unresolved source work |
| Language / account | Existing app-language preferences and existing account menu; document/public language boundaries preserved |
| Header refresh / source retry | New scoped aggregate request; stale responses cancelled or ignored; visible dashboard refreshes every 60 seconds |
| Add student | `/students?action=add`, canonical student form |
| Record payment | `/payments?action=collect`, scoped fee/student chooser followed by the canonical collection dialog |
| Review dues / overdue category | `/renewals?filter=OVERDUE`, actual overdue worklist filter |
| Due follow-ups / queue / review row | `/follow-ups?filter=DUE` or student search; schedule, note, complete and reopen the existing contact record |
| Attendance gaps | `/dashboard-settings?section=expectations&filter=gaps`; actual expected students and roster navigation |
| Utilization | `/dashboard-settings?section=utilization`; advisory threshold and existing seat/allocation review |
| Upcoming renewals / row review | `/dashboard-settings?section=terms`, optionally focused student; explicit membership periods, append renewal term |
| View all tasks | `/tasks`; scoped manual tasks, owner/assignee, due dates, OPEN/DONE and authorized source work |
| Chart month selector | Bounded selected-month aggregate request; chart, cumulative cohort rate, summary and accessible daily-value table |
| Today / This week / Seat map | Real tab panels, keyboard roving focus, cell/seat details and source navigation |
| Recent activity / View all | Actual source destination; `/tasks?view=activity` for the bounded recorded-event feed |
| Mark attendance | Full document navigation to `/attendance`, preserving camera-policy and canonical supervised attendance flow |
| Assign seat / Manage shifts | `/allocations` / `/shifts`, canonical authorized workflows |
| Generate report / Exports & Reports | `/reports`; filtered preview and bounded authorized CSV export with formula-injection protection |
| Sidebar entries | Existing students, attendance, seats, shifts, allocations, payments, renewals, overdue, analytics, AI reports, settings, import and staff destinations plus the new operational routes |

New APIs are `/api/branches/:branchId/dashboard` and its tasks,
follow-ups, settings, expectations, terms and notifications routes, plus
`/api/branches/:branchId/reports`. Server-side permissions, tenant ownership,
entitlements and mutation writability are rechecked. Derived task completion
never settles debt, marks attendance or claims delivery.

Main changed files and groups:

- `components/dashboard/Reference*.tsx`, `styles/reference-dashboard.css`, the
  branch page and application shell implement the selected composition.
- `components/dashboard-features/` and the new branch pages implement Tasks,
  Follow-ups, Exports & Reports, setup and the activity view. Activity is read
  from the dashboard aggregate rather than a separate activity endpoint.
- `services/dashboard.service.ts`, `services/branchReport.service.ts`,
  `lib/dashboardContracts.ts`, `lib/dashboardHttp.ts` and the corresponding
  branch API handlers implement authorized reads and mutations.
- `prisma/schema.prisma`, the additive migration and relationship catalog
  describe the new operational records; `services/renewals.service.ts` retains
  the canonical contact record.
- `lib/i18n/referenceDashboard.ts`, `lib/i18n/dashboardFeatures.ts`, the owned
  artwork/font assets, scoped unit/browser tests and `tests/dashboard-connected/`
  supply localization, visuals and repeatable verification.
- Canonical security, domain, current-state and production-runbook documents
  describe the new boundaries. The local commit diff lists every changed file,
  including removal of the seven obsolete composition components and four styles.

## Schema, deployment and history

Migration `20260927120000_dashboard_operations` adds seven empty tables:
DashboardSettings, AttendanceExpectation, MembershipTerm, OccupancySnapshot,
DashboardTask, DashboardNotificationState and DashboardEvent. It adds nullable
RenewalFollowUp.completedAt. There is no production backfill, seed change,
dependency version change or persistent environment configuration change.

The utilization threshold defaults to 35%. Attendance expectations and membership
terms start unconfigured. Occupancy records the first authorized daily observation;
unknown history stays unknown. Immutable events begin when the feature is used.
Synthetic past data is confined to test fixtures. Terms do not alter anniversary
billing, student status, SaaS access or existing receipts.

Apply the additive migration before any future authorized application release.
Preserve additive tables/history on application rollback; no destructive down
migration is supplied. Keep collection-compatible writers. The production runbook
and [operations document](../ai/dashboard-operations.md) describe required
pre/post inventory and trust boundaries. No production inventory was measured.

## Validation record

Commands below use the installed pnpm shim in PowerShell:
`& "$env:APPDATA/npm/pnpm.cmd"`. Node entrypoints avoid missing local tool shims.
Database commands use privately supplied, exact verified disposable targets.

| Exact command | Result |
| --- | --- |
| `pnpm exec node node_modules/vitest/vitest.mjs run --config tests/reference-dashboard/vitest.config.ts` | PASS: 28 files, 156 tests, 12.97s, including the initial-identity readiness regression; no database/global truncating setup or provider access |
| `pnpm exec node node_modules/vitest/vitest.mjs run --config tests/reference-dashboard/vitest.config.ts tests/unit/lib/localization.test.ts` | PASS: 5 tests, 5.65s after adding the final notification recovery translations |
| `pnpm exec playwright test --config tests/application-design-pilot/reference.playwright.config.ts` | Final typography run: 20 passed, 3 desktop-only geometry skips, 1 interrupted mobile320 case, 6.9m. The earlier complete run passed 21 with the same 3 skips in 3.9m. Four viewports, three languages, populated/empty/calm/unconfigured/sparse/locked/restricted/source-error and stale branch response cases |
| `pnpm exec node node_modules/@playwright/test/cli.js test --config tests/application-design-pilot/reference.playwright.config.ts --project mobile-320 --grep 'full composition' --repeat-each 3 --output test-results/reference-dashboard-mobile-stability` | PASS: 3/3, 15.7s with unchanged application and assertions; an initial isolated retry also passed 1/1 |
| `pnpm exec playwright test --config tests/application-design-pilot/reference.playwright.config.ts --project desktop-native --grep "full composition\|native reference geometry"` | PASS: 2 tests, 28.3s after final typography/freshness/calendar fixes; keyboard tabs, geometry, zero scoped Axe violations and reduced motion |
| `pnpm exec node node_modules/@playwright/test/cli.js test --config tests/application-design-pilot/reference-regression.playwright.config.ts` | PASS: 5 tests, 14.1s; historical refresh, immediate restriction/lock/error precedence, timezone-stable calendar labels |
| `pnpm exec node node_modules/@playwright/test/cli.js test --config tests/application-design-pilot/reference-regression.playwright.config.ts --grep 'notification'` | PASS: 2 tests, 8.6s after the notification fix; changed-key refresh, rejected stale key, explicit retry and failed-read mutation blocking |
| `pnpm exec node node_modules/@playwright/test/cli.js test --config tests/application-design-pilot/playwright.config.ts pilot.spec.ts --project desktop-1440` | PASS: 10 passed, 1 compact-only skip; receipt uncertainty recovery, localization/form identity, nested portals, keyboard, contrast and 200% viewport |
| `pnpm exec node node_modules/@playwright/test/cli.js test --config tests/application-design-pilot/playwright.config.ts pilot.spec.ts --project mobile-390 --project mobile-320 --grep 'compact shell'` | PASS: 2 tests, 17.1s; navigation, search focus, Escape and restored focus |
| `pnpm exec node node_modules/@playwright/test/cli.js test --config playwright.config.ts tests/browser/public-localization.spec.ts --project chromium --output test-results/public-localization-dashboard-regression` | PASS: 12 tests, 1.3m against built localhost:3117; 39 localized HTML/metadata routes, no-JS pages, 320/390/1440px and keyboard/Axe |
| `pnpm exec node tests/dashboard-connected/build.mjs` | PASS: production compile, TypeScript, 74/74 generated pages and two Workflow manifest entries |
| `pnpm exec node tests/dashboard-connected/start-local.mjs test` | PASS: all 9 connected browser scenarios, 2.7m against the final production build; real authentication, 12 destinations, persisted forms, fresh notifications, filtered CSV, restricted/read-only access, payment replay and immutable receipt/void recovery |
| `pnpm lint` | PASS: zero errors; two pre-existing/generated unused-disable warnings |
| `node tests/application-design-pilot/reference-capture.mjs` | PASS: native full dashboard and eight crops, settled fonts, no page errors |
| `node tests/application-design-pilot/reference-compare.mjs <original-PNG-path>` | PASS: same-scale whole-page and eight component comparisons |

Verified-local integration, exact migration counts and connected browser results
are recorded in the [build/migration record](reference-dashboard-build-validation.md)
and [connected verification report](reference-dashboard-connected-validation.md).

Earlier validation failures were not hidden: sandbox network/Workflow dependency
read restrictions required the identical commands with approved escalation;
one missing typed translation key was fixed before the successful build; an
amber contrast failure was corrected; obsolete compact-shell selectors were
corrected; a Vite navigation interrupted by an in-flight fixture edit passed
on isolated retry. The last full responsive run encountered an independently
confirmed 187-second network suspension: Vite disconnected, requests reported
`ERR_NETWORK_IO_SUSPENDED`, and the harness reloaded, resetting the tab. The
unchanged affected case subsequently passed once and then three consecutive
times. The failed full invocation remains recorded rather than relabelled as
an entirely clean run. No runtime workaround or weakened assertion was used.

Connected verification also found and repaired two actual workflow defects:
interactive branch forms could mount before initial client authentication
finished, and a changed follow-up could leave the notification dialog with an
obsolete condition key. The branch shell now waits for identity readiness;
the notification center refreshes on opening, blocks acknowledgement during
failed/pending reads, and refreshes rejected stale conditions for explicit review.
Identity isolation and server rejection of obsolete keys remain intact.

## Intentional factual and accessibility differences

- Real capacity is seat × active shift slots. Physical seats and explicit
  attendance are separate figures, so the image's contradictory denominators
  and counters are corrected.
- The chart labels its actual fee cohort and has distinct money/percentage
  axes, accessible data and a waiver-aware denominator. Current settlement is
  not presented as historical cash flow. Future dues are excluded from pending
  work through today; overdue work preserves the existing seven-day rule.
- Comparisons do not invent growth where trustworthy history is missing.
  Unknown occupancy and unconfigured schedules/terms remain visibly distinct
  from zero. Plan-locked and permission-restricted sources expose no private data.
- “Review seats” opens an advisory workflow. It does not claim automatic
  optimization. “Review” contact/term actions open recorded work without
  claiming a call, message, payment or renewal already happened.
- New generic illustration/botanical assets reproduce the reference's artwork
  roles without implying a photograph of a real branch. Generated text mistakes
  are corrected. Focus targets and mobile stacking adapt the original layout.

## Local commit history

- `c71e9e3` — Add scoped dashboard operations and prospective history.
- `64e111e` — Implement selected dashboard and complete branch workflows.
- The following verification commit contains the connected runner, relation
  inventory, screenshots and this handoff. Run `git log --oneline d190002..HEAD`
  for its exact hash and the complete local sequence.

Home, Features, Pricing, FAQ, public translated URLs and metadata remain
unchanged; their browser regressions passed. No marketing copy change is needed
for this local application implementation. No push, PR, merge, deployment,
shared database operation, paid signup or live customer message was performed.
