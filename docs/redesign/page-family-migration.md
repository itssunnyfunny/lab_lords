# Application page-family migration

## Comprehensive refinement — 10 November 2026

The owner's attached brief authorizes the application-wide presentation changes
and supersedes the previous frozen dashboard/artwork and serif-action constraints.
All existing page families retain their shared owners and feature-owned behavior.
The [refinement worklist](ui-refinement-2026-11-10.md) tracks implementation and
fresh verification. The 33-page baseline contains 66 captures at 1440/390px.
Final local verification passed: 791 safe unit tests, 235 executed browser cases,
132 route captures, TypeScript, lint (two existing generated warnings) and the
guarded production build. The [full report](../audits/ui-refinement-2026-11-10.md)
records exact evidence and limitations. Final owner acceptance is pending review;
no release or deployment is performed.
The prior restoration and remote-sync evidence below remains historical.

Sidebar reference correction, 10 November 2026: the owner rejected the shared
outlined-row sidebar used in the remote-sync audit and selected the earlier
Standard/Pro sidebar for every application navigation surface. The shared frame
now restores that presentation across all plans, organization, entry and Account;
the optional leaf footer is omitted to protect the fixed Account action. Local
implementation and checks are recorded in the [restoration report](../audits/sidebar-restoration-2026-11-10.md).
The owner's choice of reference is explicit; final review of the restored
rendering and Production release remain separate.

Remote-sync follow-up, 7 November 2026: the current branch incorporates main
50f2fa9 and preserves the unified Account/sidebar design alongside the earlier
visual corrections. Four additional issues were corrected: native Account in-app
leave prompts, excessive Account mobile header space and misplaced dashboard
header content at intermediate widths, and overlapping mobile workspace labels. The
[fresh audit](../audits/visual-consistency-remote-sync-2026-11-07.md) records the
full local rerun. Owner visual acceptance and release remain separate.

Visual consistency follow-up, 7 November 2026: the requested corrections cover
exact route boundaries, access states, primary actions, import touch targets,
seat localization and Basic confirmations. The dashboard changes are mobile-only;
the desktop baseline is retained. Shared dialog cleanup and cancelled history
navigation, denied-state wording and row-menu keyboard focus were corrected after
live browser checks. [Fixes and validation](../audits/visual-consistency-2026-11-07.md)
record local evidence separately from pending owner visual acceptance and release.

Import recovery clarification, 6 November 2026: existing family G controls now
explain payment conflicts, separate saving from progression, collapse completed
seating work and retain recovery location on refresh. The same 40-row local
register was checked; hashes confirmed the 23 saved students, their allocations,
10 payments and all original draft facts were unchanged. [Evidence and checks](import-decision-correction.md)
remain separate from pending owner acceptance and release.

Import decision follow-up, 5 November 2026: readiness, saved-draft outcomes,
payment choices and explicit configuration corrections extend the existing
family G panels and dialogs. [Walkthrough and validation](import-decision-correction.md)
separate local evidence from owner approval and release. No unrelated family is
redesigned.

Complete owner setup and shared import, 5 November 2026: the family reuses shared
forms, panels, dialogs, localization and the visual seat picker. Basic, Standard
and Pro enter the same import shell; surrounding non-import navigation remains
plan-specific. Earlier useful setup review and assignment summaries return
alongside immutable plans and recovery. [Local evidence](owner-setup-import.md)
tracks implementation checks separately from owner visual approval and release;
neither approval nor release is claimed.

Guided import completion, 3 November 2026: family G reuses AppPanel, AppButton,
Dialog, shared form/status tokens and the compact allocation picker. New marked
sessions use student task cards, focused corrections, one plan-based fee review
and actual saved outcomes. RowsStep, PreviewStep and ResultStep remain owners of
the compatibility wizard. Recorded-only payment fields and validated equivalent
shift preparation are preserved. Current-month fee policy is an explicitly
requested product change, separate from presentation migration. See the
[implementation record](import-guidance.md) and
[full-workspace visual review](import-workspace-review.md). Local implementation,
owner visual acceptance and Production release are tracked separately; local
tests do not confer owner approval or release.


Guided onboarding, 2 November 2026: family G now uses business/location language,
one editable session with explicit fees, optional combined access, real trial
tier selection and a review/import finish. Existing AppButton, Dialog,
SeatNumberingBuilder, entry/form tokens, locale boundary and account-scoped
recovery owners remain. Basic renders only the existing authorized import
screens inside its own shell; unrelated premium screens stay gated. Local
checks, screenshots and limitations belong in the
[onboarding implementation record](onboarding-experience.md). The requested
product-policy change is implemented locally; visual owner acceptance and a
production release remain separate and are not inferred from tests.

Homepage pricing follow-up, 31 October 2026: the local Home page reuses the
existing public `LandingPricing` summary cards, catalogue and `PlanCTA` owners.
The actual pricing section now owns `/#pricing`; the footer keeps its normal
Pricing link. The shared grid now fits available width for narrow/zoomed layouts.
Hindi/Hinglish capability-label gaps and stale translated plan-ID
test expectations are corrected. Local evidence is tracked in the
[three-plan audit follow-up](../audits/three-plan-system-audit-2026-10-31.md).
The user requested these local changes; separate final visual approval and
production release are not recorded by passing tests or refreshed snapshots.

Audit follow-up, 25–26 October 2026: local seat/admission recovery, membership
management/history and owner billing-history browsing reuse the existing shared
Dialog, compact actions, panels and locale boundary. The selected desktop/mobile
layout remains; terminal term changes return keyboard focus to History when
their invoking action disappears. Native geometry is checked against the exact
merged-main layout, with owner review and release still recorded separately.
[Closeout evidence](../audits/audit-closeout-2026-10-25.md)
tracks implementation, final browser checks and migration handoff separately
from owner review and release. No new owner approval or release is recorded.

Owner correction, 23 October 2026: this local UI pass removes retired AI Messages,
organization switching/additional-organization shortcuts, duplicate sidebar
account links and old account access-link cards. Read-only System Info remains.
Account has a direct workspace return on both screen sizes and no redundant
outer sidebar. Mobile carries the desktop menu styling and branding. It keeps branch switching,
puts the owner organization return in a final Workspace section, anchors sidebar
artwork at the bottom, and updates cold/auth-readiness loading and cookie consent
to the shared presentation. Owner visual acceptance and release remain pending;
verification belongs to the [restoration review](navigation-restoration-review.md).

Brand correction, 24 October 2026: the branch wordmark now reads Lab Lords,
matching the landing pages and organization logo without the obsolete `.in`
suffix. The shared branch menu applies this on desktop and mobile; selected
styling stays intact. Verification is recorded in the restoration review.

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

The 2026-10-22 dedicated Billing page extends family E. Local billing workflow,
three-language and narrow-screen evidence is recorded in the
[billing verification report](../audits/billing-recovery-2026-10-22.md).
Owner presentation review and production release remain separate and pending.
The final local Billing pass distinguishes the billed plan from complimentary
feature access, exposes confirmed cancellation for eligible authenticated trial
mandates without changing trial dates, and localizes the shared summary and
payment-method panels. The saved browser report records 33 passing cases across
desktop, 390px and 320px widths, including English, Hindi and Hinglish coverage.

These columns describe this local migration revision, not historical production
availability of each feature. Test success is not owner approval or deployment.

| Family | Local verification evidence | Owner presentation approval | Production release |
| --- | --- | --- | --- |
| Basic workspace | [Organization-connected preview](organization-branch-preview-review.md): organization → branch → student/seat/fee → central mock Billing; sample state only | Narrowed Basic design approved 2026-10-28; organization journey awaits review | Not integrated, merged or deployed |
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
| Connected handoff | `0cd0bcc` corrects scoped Clerk contrast and adds guarded connected checks on a new independently identified disposable loopback fixture; 23/23 full actual-route/database cases pass, followed by 4/4 focused recovery cases including the migrated correction dialog. | **Pending owner review**; no new presentation approval inferred from tests | Not released |
| Feature restoration and owner corrections · 2026-10-22–24 | [Restoration review](navigation-restoration-review.md) maps the 20 discoverability/wiring findings and owner corrections to current controls, desktop/mobile evidence and final verification. Retired AI Messages redirects to Follow-ups; the one-organization menu, direct Account return and Lab Lords branding preserve the selected design. | Implementation requested by owner; review windows open; completed presentation acceptance remains separate | No release operation performed |

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
| `/branch/b/ai/messages` | Retired page / owner correction 2026-10-23 | Legacy bookmark redirects to the same branch's Follow-ups; stored data and APIs remain intact | Navigation | No sidebar, search or dashboard entry; no automatic provider action | Current UI removal implemented; owner review pending | [Restoration evidence](navigation-restoration-review.md) |
| Public `/`, `/features`, `/pricing`, `/faq`, other marketing/policy routes and `/hi` / `/hinglish` equivalents | Public system | Approved copy, URL language, public fonts/layout | Independent | Public localization and route/theme smoke checks | Excluded; unchanged | — |

Operational maps and guided workflows retain their own interaction patterns while
reusing existing controls and semantic tokens. Review their distinct workflows
and family checks before owner presentation acceptance or release.

## Local validation for this rollout

The scoped browser command was `pnpm exec node node_modules/@playwright/test/cli.js test tests/application-design-pilot/<file> --config tests/shared-system/playwright.config.ts --project=desktop-1440 --project=mobile-390`, with `--project=mobile-320` added for Guided and Workspace. Results: `settings-family.spec.ts` 4/4, `work-queues-family.spec.ts` 2/2, `seats-shifts-family.spec.ts` 2/2, `payments-family.spec.ts` 2/2, `attendance-family.spec.ts` 2/2, `reporting-family.spec.ts` 2/2, `guided-family.spec.ts` 15/15, and `workspace-entry-family.spec.ts` 8/8 applicable with four intentional desktop-only-case skips. The first six families also passed their relevant scoped unit/service checks during each commit, as recorded in the local handoff; the final combined safe unit suite checks shared integration alongside those runs.

Final combined checks: `pnpm exec node node_modules/vitest/vitest.mjs run --config tests/shared-system/vitest.config.ts --testTimeout=20000` passed 20 files and 121 tests; sidebar assertions were updated in `0973c71` after Payments became selected. `pnpm exec node node_modules/@playwright/test/cli.js test tests/application-design-pilot/reference-regression.spec.ts --config tests/shared-system/playwright.config.ts --project=desktop-1440 --project=mobile-390` passed 14/14 dashboard regression checks. `pnpm exec node tests/shared-system/check-presentation.mjs 3d58864` passed. `pnpm exec node test-results/batch-two-offline-build.mjs` passed the production compile and verified two import-workflow manifests against an unreachable local database URL with external providers held.

At the initial rollout snapshot, the guarded connected fixture was **blocked** because Windows reserved its configured loopback port 55447. The exact target was checked once; no alternate database, migration, seed, or shared/production access was attempted in that run. The subsequent, separately authorized fixture repair and connected checks are recorded in the current handoff below. The public site and legacy AI Messages surface remain excluded and unchanged.

## Bounded closeout — 2026-09-28

The 28 September `app/**/page.tsx` inventory had 29 application paths: the 28
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

Focused actual-route/database checks passed 3/3 for seat/allocation
conflicts, attendance check-in/out/void idempotency and durable audit, and a
₹500 follow-up remaining balance. After the full run, one focused case opened
the migrated collection correction dialog, voided only its new synthetic
receipt and restored the balance; the expanded recovery file passed 4/4.
A separate focused set passed 3/3 for account
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
static pages/two workflow manifests; 23/23 real-route cases). The later
`node tests/dashboard-connected/start-local.mjs test rollout-recovery.spec.ts`
passed 4/4, with no application-code change after the full run. Both affected safe
Vitest suites passed 142/142 and 169/169; the changed-file presentation guard
passed; `pnpm lint` had zero errors and two pre-existing generated/coverage
warnings. Post-test financial totals stayed ₹4,300 billed, ₹1,900 collected,
₹0 waived and ₹2,400 pending with 19 live receipts totaling ₹1,900. Deliberate
test-created immutable history is counted in the [compact closeout
packet](application-closeout-review.md). The focused verification and theme
fix is local commit `0cd0bcc`; the initial evidence/documentation commit is
`f709292`. The final correction-check commit is at `HEAD` in the handoff log.
Live camera
hardware and held external payment, messaging, AI and import providers remain
outside this isolated verification. Current connected evidence does not confer
owner presentation approval or production release; the refined Students card
approval above remains the only new owner presentation approval in this ledger.

### Billing catalogue v2 — 2026-10-23

Dedicated Billing, onboarding and public plan cards use three explicit tiers with existing shared controls/design tokens. Existing core Basic screens remain; no minimalist redesign is claimed. Local verification is recorded in the three-plan audit; owner review, merge and production release remain separate and pending.

## Billing PR integration — 28 October 2026

PR #284 combines the restored organization navigation and branch billing controls
with its dedicated Billing page. Complete invoice/subscription history now opens
from Billing and retains three-plan names. Desktop/mobile fixture verification is
recorded in [the integration report](../audits/billing-pr-main-sync-2026-10-28.md).
This is local merge verification; owner visual approval and release remain
separate. The unfinished Basic prototype stays outside this PR update.

### Organization-connected Basic preview — 2026-10-28

The owner approved the narrowed Basic design and requested the shared
organization journey. The preview now scopes records and effective access by
synthetic branch, provides consistent switching and central mock Billing,
and preserves the Basic/full-workspace presentation boundary. Local browser
and unit evidence, screenshots and precise implementation limits are in the
[review report](organization-branch-preview-review.md). Real subscriptions remain
organization-wide; [separate implementation is required](../billing/branch-plan-compatibility.md).
No owner approval of this new extension or production release is inferred.

### Basic workspace — narrowed prototype, 2026-10-28

The latest owner direction limits Basic to Overview, Students, Seats and Fees.
tests/application-design-pilot/basic-prototype owns dedicated screens/forms and
scoped bp styles, without mounting the full workspace components. Native dialogs
and the hero palette are a prototype-specific exception to shared presentation
owners, not a new production UI framework. Owner review must precede domain
integration. See [current evidence](basic-prototype-review.md).

### Earlier Basic workspace direction — superseded, 2026-10-28

The explicit hero-matching request adds a Basic-only presentation boundary over
families A–H's existing shared controls and workflows. `styles/basic-workspace.css`
scopes the hero palette, typography and geometry to the simple workspace,
including portals. Its literal palette values and static Billing illustrations
are deliberate copies of the selected public reference, not a shared palette
replacement. The full workspace/public hero keep their original owners. See the
review packet for reference comparisons, test evidence and remaining limits;
local verification does not confer owner approval or production release.

### Basic preview / main reconciliation — 2026-10-29

The isolated Basic worktree now includes merged PR #284 and the prior restored
navigation/audit changes. Basic keeps its approved design; Account's separate
layout and return behavior follow main. Standard/Pro use the merged components,
with their restored dashboard cards supplied by synthetic branch records.
Local evidence: 63 unit/component checks, 22 full journey checks and 2 added
card checks passed on desktop/mobile; production build passed. See the
[review report](organization-branch-preview-review.md) for static checks and
remaining limits. This is not production integration or new owner approval.

### Approved Basic connected integration — 2026-10-29

Design approval: the owner approved the independent cream/forest Basic direction
and requested real integration. Local implementation: independent Basic screens,
forms and scoped portals now use authenticated services and persistent records;
shared organization/Account/Billing and the Standard/Pro interface remain.
The preview's default is one organization plan; future mixed branches are separate.

Verification and fresh connected screenshots are recorded in the
[Basic integration review](basic-integration-review.md). Historical October 28
screenshots are reference material only. Final owner visual review, PR submission,
merge and deployment are separate; none is implied by local test results.

### Basic PR #287 review follow-up — 2026-10-29

The approved Basic design is retained. Lifecycle and uncertain-admission review
use scoped shared dialogs; receipt dates share the PDF's India-calendar owner.
Fresh status/receipt evidence and final validation are tracked in the
[review-fix report](basic-pr-287-review-fixes.md). This is implementation verification,
not final owner approval, merge or release.

### Unified Account navigation - local, 2026-11-06

Families E/H and Basic share a fixed bottom Account entry, collapsible frame and mobile Drawer. Account integrates profile/security, personal preferences and owner-only organization billing with branch context. Organization/branch settings retain their configuration scope. See [implementation and validation evidence](unified-account-review.md). Local verification does not imply final owner visual review, merge, deployment or production provider verification.

The 7 November Account follow-up retains selected billing organization/branch through operations and workspace returns, with ordinary and historical-owner regression cases. Browser verification also corrected Preferences bottom clearance while the save bar is visible, on desktop and mobile. Details and remaining release boundaries are in the [Account review](unified-account-review.md).

Additional entry-origin checks on 7 November preserve Organization Settings returns from branch billing and valid legacy branch return hints without `branchId`; explicit selector changes still reset old context. The shared owned-directory resolver and three browser cases are recorded in the same Account review.

### Continued record and workflow completion — local, 2026-11-12

Owner scope: finish the 10 November design across Basic records, seat tiles,
guided and legacy import interiors, financial records, Billing, Analytics and
secondary operations/setup. Shared sidebar/daily navigation and feature rules
remain. Implementation and local evidence are tracked in the
[completion record](design-completion-2026-11-12.md) and
[full audit report](../audits/design-completion-2026-11-12.md). Local checks pass: 279 browser cases, 791 safe unit tests, 66 import/calendar checks, 176 capture comparisons, lint, TypeScript and isolated build. All families remain pending
final owner visual acceptance; no commit, merge or deployment is implied.

### Final four-area refinement — local, 2026-11-12

Owner scope: finish the four remaining presentation gaps, preserving the completed
navigation and feature workflows. This is a focused UI pass, with no new audit,
CI, test suite, deployment preparation or unrelated refactoring.

- **Import:** `GuidedImportWorkspace.tsx` and `GuidedSetupReview.tsx` start once in
  unresolved records, retain deliberate editor-return filters/selections, keep
  source order accessible, compact ready records into tablet columns and bring
  matching decisions ahead of collapsed inventory. Status icons and text identify
  attention versus readiness. The first unresolved action appears at about
  y=496px at both 390px and 320px, inside the initial viewport.
- **Analytics:** `app/branch/[branchId]/analytics/page.tsx` and
  `components/snapshot/{KpiRow,MainChart,SideStats}.tsx` compose compact metrics,
  a responsive trend and adjacent branch summary. Phone period/metric selectors
  reuse AppSelect. Calculations, aggregation, source values and fetching remain.
- **Dates:** `lib/feeReceiptDates.ts`, `lib/feeReceiptPdf.ts`,
  `components/dashboard-features/ReportsContent.tsx`, the branch Payments page,
  `components/payments/{CollectFeeDialog,CollectionHistory,FeeReceipt,PaymentAuditLog}.tsx`
  and `components/basic/{BasicFees,BasicWorkspace}.tsx` share named-month financial
  display dates. Calendar strings keep their calendar day; timestamps keep their
  intended timezone and omit displayed seconds. Stored precision, CSV content,
  payment amounts and unrelated Basic date preferences are unchanged.
- **Wording:** the branch Overdue and Settings pages,
  `components/billing/{BillingPaymentMethodsOverview,OrganizationBillingContent}.tsx`,
  `components/whatsapp/ApprovedPaymentReminderReview.tsx` and
  `lib/i18n/operations.ts` use plain English, Hindi and Hinglish. Displayed-row
  scope, consent/budget limits, queued-versus-sent meaning, current subscription
  ownership, available payment methods and test-payment notices remain explicit.

Shared style edits are limited to the Import/Analytics owners and financial date
cells in `styles/shared-ui.css`. The design-system, current-state and public-claims
notes are updated; Home, Features, Pricing and FAQ need no feature-claim changes.
No schema, migration, dependency, saved environment or service/API changes are
required. Permissions, tenancy, seat-conflict decisions, correction/payment/final
review/recovery commands and provider behavior are intentionally unchanged.

Local verification (commands from the repository root):

- `pnpm exec tsx test-results/final-ui-2026-11-12/check-ui.ts` — passed at
  1440, 834, 390 and 320px, including English/Hindi/Hinglish Import, Analytics
  and Overdue. Initial unresolved action, All students/source order, editor
  return, collapsed inventory, dates and horizontal overflow checked.
- `pnpm exec tsx test-results/final-ui-2026-11-12/check-financial.ts` — passed at
  all four widths: financial Analytics selections, branch summary, Basic/full
  receipts across a browser timezone boundary, reminder preview/queue and
  provider-managed method eligibility. Values and requests are synthetic.
- `pnpm exec tsx test-results/final-ui-2026-11-12/check-language.ts` — passed:
  Hindi/Hinglish Billing, receipts and reminder review at 390 and 320px.
- `pnpm exec playwright test --config tests/visual-consistency/completion.config.ts completion-import.spec.ts completion-receipts.spec.ts completion-financial.spec.ts`
  — 27 passed; one mobile Billing assertion read menu options before rendering.
  The existing assertion now waits for the first option. Recheck:
  `pnpm exec playwright test --config tests/visual-consistency/completion.config.ts completion-financial.spec.ts --project=mobile-390 --grep 'billing purpose'`
  — 1 passed. All 28 distinct existing cases pass across these runs. Existing
  receipt-date and Import action-label expectations were updated, without adding
  a test suite or changing feature contracts.
- `pnpm exec vitest run --config tests/visual-consistency/completion-units.config.ts tests/unit/lib/feeReceiptDates.test.ts tests/unit/lib/localization.test.ts`
  — 2 files / 11 checks passed. The existing calendar test covers four browser
  timezones, named-month output, minute precision and date-only day preservation;
  localization checks retain all named parameters and immutable receipt facts.
- `pnpm exec tsc --noEmit --incremental false` — passed. The final build also
  completed TypeScript validation after the final responsive-selector changes.
- `pnpm lint` — passed, zero errors; two existing unused-disable warnings in
  generated `app/.well-known/workflow/v1/flow/route.js` and
  `coverage/block-navigation.js` remain.
- `pnpm exec node tests/visual-consistency/build-local.mjs` — passed `pnpm build`
  and the two-import-workflow manifest check. The wrapper verified a newly created
  disposable local database, disabled provider operations and removed that
  container afterward. It did not use a shared database or alter saved settings.
- `git diff --check` — passed.

Local visual evidence is in `test-results/final-ui-2026-11-12/views`. These checks
use real components with isolated local fixtures; they do not verify live auth,
provider payments or message delivery. Owner visual acceptance remains pending;
no commit, branch change, push, release or deployment was performed.

Gallery refresh requested after completion: the existing review now leads with
48 matched final-refinement comparisons and 92 verification views, while keeping
535 earlier views under a separate filter. Before captures were rendered from the
saved pre-refinement source using the same fixtures and fixed browser clock.
All 140 latest views passed at desktop/mobile viewer widths, along with image
hashes, report/filters, historical links and offline opening. The full report and
ZIP were refreshed together. Evidence: `test-results/final-ui-2026-11-12/` and
`test-results/design-completion-2026-11-12/review/evidence/final-refinement/`.

### Final responsive closeout — local, 2026-11-12

The owner accepted the overall direction and requested only two remaining fixes.
`ReportsContent.tsx` uses one filter column below 380px, retaining two columns at
390px and the existing wider grid. `AppShell.tsx` reserves the Account identity
width and lets its return action shrink/wrap separately. Date values, report
content/CSV, return destinations and access are unchanged; no schema, environment,
service or test-suite changes are required. No public-copy change is needed.

Existing-preview checks passed at 320, 390, 834 and 1440px, including all three
Account languages and the shared Account home/preferences/profile header. The
320px date inputs remain 16px text in 262px controls; the Hinglish return action
retains a distinct 44px target with an 8px gap from the Account title. Screenshots:
`test-results/responsive-closeout-2026-11-12/reports-filters-320.png` and
`test-results/responsive-closeout-2026-11-12/account-header-hinglish-320.png`.
`pnpm exec eslint components/dashboard-features/ReportsContent.tsx components/layout/AppShell.tsx`
passed; `pnpm exec node tests/visual-consistency/build-local.mjs` passed the isolated
build, TypeScript and Workflow manifest check; `git diff --check` passed. This
closes local UI refinement; it does not change release status.

The subsequent gallery refresh opens on 13 responsive-closeout views: 3 matched
before/after comparisons and 10 width/language checks. All 675 earlier views stay
available as historical evidence. The gallery's 39 viewport checks, all 844
referenced image hashes, offline use and actual ZIP download passed.

### Overall verification and focused commits — local, 2026-11-12

After UI closeout, the owner requested overall tests and smaller commits before
PR publication. The [PR verification record](ui-refinement-pr-readiness-2026-11-12.md)
records that separate pass. It includes the two maintained responsive regression
checks, separation of Playwright specs from root Vitest discovery, and corrections
to assertions for the accepted receipt and checkout/reminder wording. Domain
writers and provider contracts are unchanged. The accepted design direction,
local verification, PR publication and release remain distinct decisions.
