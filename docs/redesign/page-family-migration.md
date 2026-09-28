# Application page-family migration

The selected dashboard remains the visual baseline. On 2026-09-27 the owner
approved the refined Students comparison as the pattern for Staff and Tasks.
Families A–H subsequently apply the shared presentation owners to the remaining
authenticated application pages. This is a local implementation ledger, not
additional owner presentation approval or production release. Each family needs
scoped workflow, authorization, three-language, keyboard, narrow-screen and
affected-consumer checks; the public theme and request identities stay intact.

`b` denotes the real branch ID and `o` the organization ID. Grouped paths share
one review boundary. Lettered families identify this rollout, not new product or
architectural approval.

## Presentation approval and release ledger

These columns describe this local migration revision, not historical production
availability of each feature. Test success is not owner approval or deployment.

| Family | Local verification evidence | Owner presentation approval | Production release |
| --- | --- | --- | --- |
| Students | `36d0d0d` implementation; `b102af3` [local evidence](student-card-refinement.md) | **Approved 2026-09-27** in this chat: refined comparison retained as the next batch's visual pattern | Local migration not released; no release operation authorized |
| Staff | `82bf318` implementation and [local connected evidence](batch-two-review.md): 15 fixture browser checks, two actual-route checks and scoped service/permission tests passed | Reused approved Students hierarchy; completed Staff presentation review pending | Local migration not released |
| Tasks | `ea1c578` implementation and [local fixture/build evidence](batch-two-review.md): 20 browser checks, 26 scoped contracts/service/route tests and offline production build passed. The earlier connected target was blocked by Windows port reservation; current connected evidence is tracked in the handoff below. | Reused approved Students hierarchy; completed Tasks presentation review pending | Local migration not released |
| A · Work queues | `f7f70d1` local implementation; [fixture packet](application-rollout-evidence/work-queues) covers follow-ups, renewals and overdue queues. | Pending family review | Not released by this rollout |
| B · Payments | `b12befc` local implementation; [fixture packet](application-rollout-evidence/payments) covers desktop/mobile list and result layouts. | Pending family review | Not released by this rollout |
| C · Seats/Shifts | `e38a090` local implementation; [fixture packet](application-rollout-evidence/seats-shifts) covers seats, allocations and shifts. | Pending family review | Not released by this rollout |
| D · Attendance | `c4a3e00` local implementation; [fixture packet](application-rollout-evidence/attendance) covers attendance list and card layouts. | Pending family review | Not released by this rollout |
| E · Settings | `21e1834` local implementation; [fixture packet](application-rollout-evidence/settings) samples dashboard setup and membership settings. Scoped verification remains distinct from release checks. | Pending family review; Students approval does not transfer | Not released by this rollout |
| F · Reporting | `c39b252` local implementation; [fixture packet](application-rollout-evidence/reporting) covers branch reports, analytics, AI reports and organization analytics. | Pending family review | Not released by this rollout |
| G · Guided | `6dd008c` local implementation; [fixture packet](application-rollout-evidence/guided), 15/15 scoped browser checks across desktop/390/320. | Pending family review | Not released by this rollout |
| H · Workspace | `8b69d4a` local implementation; [fixture packet](application-rollout-evidence/workspace), 8/8 applicable scoped browser checks with four viewport-independent skips. `/app` remains its existing redirect. | Pending family review | Not released by this rollout |
| Bounded closeout | `15094ff` fixes selected cold boundaries, authenticated botanical marks and opened account appearance; [one compact review packet](application-closeout-review.md) maps route inventory, family evidence, exceptions and current checks. | **Pending owner review**; Students approval remains separate | Not released |
| Connected handoff | `0cd0bcc` corrects scoped Clerk contrast and adds guarded connected checks on a new independently identified disposable loopback fixture; 23/23 actual-route/database cases pass on the final local build. | **Pending owner review**; no new presentation approval inferred from tests | Not released |

Fixture packets record local presentation only; no connected/database or
deployment claim follows from screenshots. The exact scoped checks below are
separate from owner review and production release.

| Route / family | Pattern / batch | Bespoke work retained | Risk | Required checks | Status | Commit |
| --- | --- | --- | --- | --- | --- | --- |
| `/branch/b` | Selected dashboard | Chart, seating matrix, artwork, five priorities/six figures | High source/access | Pixel/crops, source freshness, notifications, sparse history, finance/access | Preserved | `95a589a` |
| `/branch/b/students` | Record list/detail / 1 | Admission, status resolution, consent, fee/attendance overlays | High mutation/recovery | Scalar merge, filter context, readonly/staff, nested dialogs, fees, three languages | Refined; locally verified; presentation approved in ledger | `6e423ae`, `36d0d0d`, `b102af3`; [review](student-card-refinement.md) |
| `/branch/b/staff` | Record list/detail / 2 | Invites, permission overrides, role controls | High authorization | Invite/permission/server scope, disabled actions, confirmation focus | Migrated and locally connected-verified; owner presentation review pending | `82bf318`; [review](batch-two-review.md) |
| `/branch/b/tasks` | Record list/detail / 2 | Assignment, task state, evidence/activity tab | Medium | Reload persistence, assignee scope, source-state boundaries | Migrated; prior fixture port block superseded by current connected handoff below; owner presentation review pending | `ea1c578`; [review](batch-two-review.md) |
| `/branch/b/follow-ups`, `/branch/b/renewals`, `/branch/b/overdue` | Work queue / A | Due cohorts, promises, completion, reminders and uncertainty | High finance/provider | Partial/waived/legacy balances, contact consent, no automatic provider action | Local presentation migrated; review pending | `f7f70d1` |
| `/branch/b/payments` | Record list/detail with financial evidence / B | Canonical collection, immutable receipts, void/correction recovery | High accounting | Same-request retry, partial/waiver arithmetic, owner-only correction, document language | Local presentation migrated; review pending | `b12befc` |
| `/branch/b/seats`, `/branch/b/allocations`, `/branch/b/shifts` | Specialized operations / C | Seat map, multi-shift capacity, overlap, allocation and fee links | High domain | Scope/capacity/overlap, deep links, loaded vs exact counts, touch/keyboard | Local presentation migrated; review pending | `e38a090` |
| `/branch/b/attendance` | Specialized operations / D | Calendar, QR camera, session/visit commands | High command recovery | Confirmed evidence, stable retry, camera cleanup, document navigation | Local presentation migrated; review pending | `c4a3e00` |
| `/account` | Grouped personal settings / E | Profile, interface/document language, preferences | Medium identity | Cross-account preference events, draft retention, language purposes | Local presentation migrated; review pending | `21e1834` |
| `/branch/b/settings`, `/branch/b/dashboard-settings` | Grouped operational settings / E | Branch configuration, advisory utilization, expectations, independent terms | High scope/billing | Writable access, terms vs dues, configuration permissions, field errors | Local presentation migrated; review pending | `21e1834` |
| `/org/o/settings`, `/org/o/billing/processing/changeId` | Grouped billing/settings plus pending-state workflow / E | Provider-authoritative plan changes, checkout and durable processing | Highest provider/access | Provider mode, callbacks, idempotency/order/replay, pending recovery | Local presentation migrated; review pending | `21e1834` |
| `/branch/b/reports`, `/branch/b/analytics`, `/branch/b/ai/reports`, `/org/o/analytics` | Reporting / F | Authorized cohorts, CSV/PDF filters, AI advisory output | High privacy/meaning | Row limits/scope, formula escaping where supported, document language, financial denominators | Local presentation migrated; review pending | `c39b252` |
| `/onboarding`, `/invite/token`, `/branch/b/onboarding/import`, `/branch/b/onboarding/import/sessionId` | Guided workflow / G | Identity linking, invitations, staged imports and durable recovery | High tenant/AI/data | Token ownership, staged validation, import resumability, no automatic AI authorization | Local presentation migrated; review pending | `6dd008c` |
| `/org`, `/org/o`, `/app` | Workspace selection/overview / H | Organization/branch discovery, owner/staff routing; `/app` remains a routing redirect | High access | No foreign enumeration, correct landing routes, account identity switching | Local presentation migrated; review pending | `8b69d4a` |
| `/sign-in/…`, `/sign-up/…` | Authentication entry / separate review | Clerk-hosted flow | High provider | Redirect/context, provider-owned languages, no auth bypass | Unchanged | — |
| `/branch/b/ai/messages` | Legacy generation surface | Planned retirement; independent communication language semantics | High provider | No change in this migration; preserve stored drafts and data | Excluded | — |
| Public `/`, `/features`, `/pricing`, `/faq`, other marketing/policy routes and `/hi` / `/hinglish` equivalents | Public system | Approved copy, URL language, public fonts/layout | Independent | Public localization and route/theme smoke checks | Excluded; unchanged | — |

Operational maps and guided workflows retain their own interaction patterns while
reusing existing controls and semantic tokens. Review their distinct workflows
and family checks before owner presentation acceptance or release.

## Local validation for this rollout

The scoped browser command was `pnpm exec node node_modules/@playwright/test/cli.js test tests/application-design-pilot/<file> --config tests/shared-system/playwright.config.ts --project=desktop-1440 --project=mobile-390`, with `--project=mobile-320` added for Guided and Workspace. Results: `settings-family.spec.ts` 4/4, `work-queues-family.spec.ts` 2/2, `seats-shifts-family.spec.ts` 2/2, `payments-family.spec.ts` 2/2, `attendance-family.spec.ts` 2/2, `reporting-family.spec.ts` 2/2, `guided-family.spec.ts` 15/15, and `workspace-entry-family.spec.ts` 8/8 applicable with four intentional desktop-only-case skips. The first six families also passed their relevant scoped unit/service checks during each commit, as recorded in the local handoff; the final combined safe unit suite checks shared integration alongside those runs.

Final combined checks: `pnpm exec node node_modules/vitest/vitest.mjs run --config tests/shared-system/vitest.config.ts --testTimeout=20000` passed 20 files and 121 tests; sidebar assertions were updated in `0973c71` after Payments became selected. `pnpm exec node node_modules/@playwright/test/cli.js test tests/application-design-pilot/reference-regression.spec.ts --config tests/shared-system/playwright.config.ts --project=desktop-1440 --project=mobile-390` passed 14/14 dashboard regression checks. `pnpm exec node tests/shared-system/check-presentation.mjs 3d58864` passed. `pnpm exec node test-results/batch-two-offline-build.mjs` passed the production compile and verified two import-workflow manifests against an unreachable local database URL with external providers held.

At the initial rollout snapshot, the guarded connected fixture was **blocked** because Windows reserved its configured loopback port 55447. The exact target was checked once; no alternate database, migration, seed, or shared/production access was attempted in that run. The subsequent, separately authorized fixture repair and connected checks are recorded in the current handoff below. The public site and legacy AI Messages surface remain excluded and unchanged.

## Bounded closeout — 2026-09-28

The current `app/**/page.tsx` inventory has 29 application paths: the 28
selected routes grouped above and the excluded legacy AI Messages route.
Sign-in/sign-up and public/localized routes are outside that inventory. The
branch theme gate already matched every selected branch route, including the
nested import session and AI report. The entry, account and organization shells
opt in explicitly. The actual shared loading and root-error boundaries were the
missing cold-state theme consumers; `15094ff` added a route-exact selector for
those states without activating sign-in/up, public or AI Messages routes. It
also aligned selected organization/account marks and the opened account menu
with the approved theme while retaining the dashboard avatar and public skin.
Dialogs, drawers and menus keep their existing portal/focus owners. The live
Clerk popover/profile was not rendered by the isolated no-Clerk fixture, so its
new token skin was a provider visual review item at that checkpoint.

The [closeout packet](application-closeout-review.md) maps each family's
workflow, language, keyboard, narrow-screen, access and affected-consumer
evidence to its required checks; it distinguishes old valid evidence, current
fixture/unit results and connected checks then still blocked. In particular, Family
E now has six new cases mounting the actual account, branch settings,
organization settings and nested billing-processing components. Ten seat
pagination and two organization-access unit cases fill previously unmapped
safe checks. Historical screenshot packets were not regenerated. Onboarding's
selected botanical mark correction is `d2bf1a2`; this closeout adds its cold
boundary treatment.

Final changed-tree commands and results: `node node_modules/vitest/vitest.mjs
run --config tests/shared-system/vitest.config.ts --testTimeout=20000` passed 25
files/142 tests; the analogous `tests/reference-dashboard/vitest.config.ts`
command passed 28 files/169 tests. The affected desktop/390px browser command
for `route-boundaries.spec.ts`, `workspace-entry-family.spec.ts` and
`reference-regression.spec.ts` passed 24 with two intentional mobile skips; a
separate 320px workspace-entry case passed. Six new real-component Settings
desktop/mobile cases passed. The presentation guard passed; full ESLint had
zero errors and two pre-existing generated/coverage warnings; the offline
production build passed TypeScript, 74 static pages and both import-workflow
manifests with providers held and an unreachable local DB address. Exact
commands appear in the packet.

**Connected verification was BLOCKED at this bounded closeout.** The then-current Windows TCP exclusion
`55371–55470` contains the guarded fixture's port `55447`. The separate
[fixture-port repair proposal](local-fixture-port-repair-proposal.md) requires a
new disposable loopback container and independent identity proof before the
existing connected runner may be used. No fallback target, schema operation,
production/shared access or provider action occurred. Local verification is
not owner presentation approval or a production release. The following current
handoff supersedes only that local fixture blockage; it does not revise the
bounded closeout's historical evidence or approval status.

## Current guarded connected handoff — 2026-09-28

The Windows port reservation was resolved under the owner's narrow local
test-environment authorization. A **new disposable** `postgres:16-alpine`
container (`lab-lords-dashboard-test-20260928`, ID prefix `14c435177e23`) is
bound only to `127.0.0.1:59117`, a port independently checked as available and
outside the then-applicable IPv4/IPv6 exclusions. Independent Docker and host
PostgreSQL checks established its exact container/image/binding and database
identity (`lab_lords_dashboard_closeout_browser_test`), an initially empty
public schema, then 53 checked-in migrations and the transactional synthetic
dashboard fixture. The fixture's prospective-event marker and financial
baseline were checked before application tests: 8 students, 16 seats, 5 monthly
fees, 19 live receipts, ₹4,300 billed, ₹1,900 collected and ₹2,400 pending.
The original port-55447 fixture remains untouched. The ignored runtime metadata
points only to the verified new target; the existing `start-local.mjs` target
guard remains fail-closed. No saved application environment, application schema,
provider configuration or production/shared target changed.

The prepared actual-route suite ran first against the current built application
with normal Clerk development authentication and held business providers. Its
first run exposed three stale test expectations, not a demonstrated application
regression: PostgreSQL's raw timestamp display timezone, a desktop row selector
also matching a hidden mobile card, and the already-approved `/account` theme
activation. The subsequent prepared run reached 15/16 and revealed one further
duplicate desktop/mobile note selector. These test assertions were corrected;
the final expanded guarded run passed **23/23** on the final built tree.

Focused actual-route/database checks already passed 3/3 for seat/allocation
conflicts, attendance check-in/out/void idempotency and durable audit, and a
₹500 follow-up remaining balance. A separate focused set passed 3/3 for account
language persistence, workspace navigation and branch isolation, settings
read-only behavior, authorized branch CSV with staff denial, and onboarding
validation without an unintended write. The real Clerk-rendered account menu
and profile were inspected on desktop/mobile; one selected-theme contrast defect
was corrected in scoped CSS, and the targeted provider visual check passed 1/1.
The mobile compact-header correction also passed in the final 23-case run.
These are connected application checks; prior
isolated screenshot fixtures remain presentation evidence only.

The final guarded commands `node tests/dashboard-connected/start-local.mjs
build` and `node tests/dashboard-connected/start-local.mjs test` passed (74
static pages/two workflow manifests; 23/23 real-route cases). Both affected safe
Vitest suites passed 142/142 and 169/169; the changed-file presentation guard
passed; `pnpm lint` had zero errors and two pre-existing generated/coverage
warnings. Post-test financial totals stayed ₹4,300 billed, ₹1,900 collected,
₹0 waived and ₹2,400 pending with 19 live receipts totaling ₹1,900. Deliberate
test-created immutable history is counted in the [compact closeout
packet](application-closeout-review.md). The focused verification and theme
fix is local commit `0cd0bcc`; the evidence/documentation commit is identified
by the final handoff log. Live camera
hardware and held external payment, messaging, AI and import providers remain
outside this isolated verification. Current connected evidence does not confer
owner presentation approval or production release; the refined Students card
approval above remains the only new owner presentation approval in this ledger.
