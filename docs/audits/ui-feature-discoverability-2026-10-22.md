# UI feature reachability and navigation audit — 22 October 2026

## Result and scope

The redesign has not removed most operational workflows. It has removed some
entry points and dashboard signals, buried several existing tools, and retained
several broken source-to-destination contracts. There are **20 findings below:
18 UI/navigation/discoverability findings and two existing server capabilities
with no customer control found**. These are not 20 deleted backend features.

Reviewed source at `60760aa` against the documented pre-pilot baseline
`a3c6ed1337907e936a3ae2d77537ccb2e33415f0`, the selected dashboard, migration
ledger, current page owners, relevant client/API/service contracts, permission
policy and public claims. The page inventory contains **29 authenticated/guided
entry points: 20 branch, five organization and four other pages**. A page-by-page
map is below and a [machine-readable inventory](evidence-ui-features-2026-10-22/route-inventory.json)
is saved beside this report.

Browser observations use real application components in the existing isolated
synthetic harness at 1440 × 1024 and 390 × 844. This is component evidence, not a
check of the deployed site, real Clerk menu, customer data, database persistence,
provider availability or every role/language combination. Its fixed September
fixture date does not represent the audit date. No Production data was accessed.

## 1. Missing or weakened entry points

| ID | Finding and affected features | Evidence and current access path | Suggested repair |
| --- | --- | --- | --- |
| N01 · Fix first | **Application account settings have no visible application-owned entry from the redesigned mobile/tablet branch shell.** Profile, timezone, locale, date format, density and the central document-language preference become difficult to reach. | [AppShell](../../components/layout/AppShell.tsx#L141) selects the separated switcher; its account button is `hidden … lg:flex` at line 164. [BranchWorkspaceControls](https://github.com/itssunnyfunny/lab_lords/blob/60760aa74be27b23deaa31460ff1e4b8c582816a/components/layout/WorkspaceSwitcher.tsx#L186) has only organization/branch selects, whereas the old combined control includes `/account`. Browser: zero account links at both widths; one account-summary button visible at desktop and zero at 390px. Clerk's provider profile modal is separate from `/account`. | Add an explicit Account settings destination in the compact shell/navigation and preserve it when the workspace directory fails. Keep identity/profile ownership separate from the provider modal. |
| N02 · Product decision | **Standalone AI Messages is omitted from the redesigned sidebar although its page and generation/copy controls remain implemented.** | [BranchSidebar](../../components/layout/BranchSidebar.tsx#L93) defines both AI entries, but the selected Reports group uses only `intelligenceItems[0]` at line 118. The [page](../../app/branch/[branchId]/ai/messages/page.tsx) and [search action](../../lib/topSearch.ts#L198) remain. Direct navigation also switches to the legacy shell. | Resolve the documented retirement plan explicitly: retain a discoverable supported entry while available, or complete an approved retirement with replacement guidance. Do not assume exclusion from the design rollout already retired the feature. |
| N03 · Discoverability | **Dashboard setup has no sidebar destination.** Attendance expectations, membership terms and the low-utilization threshold are split away from Branch Settings. | [Setup's three sections](../../components/dashboard-features/DashboardSettingsContent.tsx#L18) exist. The [sidebar Settings item](../../components/layout/BranchSidebar.tsx#L101) highlights for this route but actually links to `/settings`. Access currently comes through dashboard cards or the [Tasks footer](../../components/dashboard-features/TasksContent.tsx#L70). Students-only viewers do not get that manager-task footer. | Add a clearly named Dashboard setup entry or explicit links from Branch Settings and the relevant Attendance/Students pages. Distinguish membership dates from fee dues. |
| N04 · Discoverability | **The owner's direct Back to organization link is omitted on selected routes.** Organization analytics, billing, sender setup and branch management are less obvious to find. | [Sidebar footer](../../components/layout/BranchSidebar.tsx#L191) is restricted to `!designPilot`. The [replacement organization select](https://github.com/itssunnyfunny/lab_lords/blob/60760aa74be27b23deaa31460ff1e4b8c582816a/components/layout/WorkspaceSwitcher.tsx#L199) adds a second `Organization overview` option for the already selected organization; choosing the current organization itself does not fire a change. Browser confirms both options. | Add an explicit owner-only Organization overview link. Keep switching organizations separate from opening the current organization's overview. Staff must retain only authorized destinations. |
| N05 · Restore coverage | **Four previous notification kinds disappeared:** active students without seats, full shifts, near-full shifts and active staff invitations. | The pre-pilot notification component called [buildBranchNotifications](../../lib/branchNotifications.ts#L190). The new [notification service](../../services/dashboard.service.ts#L398) produces only overdue, follow-up, attendance, renewal and task candidates. The legacy helper remaining on disk does not make its alerts reachable from the current bell. | Add the missing operational alerts to the current service with their original independent permission gates and accurate source links. Existing snooze/read/dismiss behavior must remain personal. |
| N06 · Dashboard scope | **Several previous dashboard entry points/previews have no equivalent first-class replacement:** recent-enrollments list; the exact-payment overdue review/selection panel; Import records and Draft follow-ups quick actions. | `git diff --name-status --no-renames a3c6ed1 HEAD -- components/dashboard` shows removal of `RecentStudents.tsx`, `OverdueTable.tsx` and `QuickActions.tsx`. [Current quick actions](../../components/dashboard/ReferenceWorklists.tsx#L42) contain six different shortcuts. Browser confirms them. The roster, overdue page, import page and AI Messages still exist. | Restore useful shortcuts and explain where previews moved. Review any dashboard composition change against its approved design; this finding does not authorize replacing that design. |

## 2. Broken or inconsistent wiring

| ID | Reproduction / user impact | Source evidence | Suggested repair |
| --- | --- | --- | --- |
| N07 · Fix first | Search for **Add Student** and choose the action: it opens the roster without opening admission. The dashboard's identically named action opens admission correctly. This predates the redesign. | [Search action](../../lib/topSearch.ts#L133) uses `path: "students"`; [dashboard action](../../components/dashboard/ReferenceDashboard.tsx#L95) uses `students?action=add`; the [roster](../../app/branch/[branchId]/students/page.tsx#L396) consumes that action. The actual search builder's destinations are recorded in browser observations. | Point the search action to the same authorized admission workflow. Check its writable-state explanation as well as its URL. |
| N08 · Discoverability | **Search cannot discover all actions that the sidebar permits.** Students-only users can open exports and source tasks but their search catalogue suppresses both. Attendance, renewals, import and Dashboard setup also lack dedicated action definitions. | [Search catalogue](../../lib/topSearch.ts#L129) requires `view_payments` for Reports and `manage_branch` for Tasks. [Reports guard](../../app/branch/[branchId]/reports/page.tsx#L7) permits payments **or** students; [Tasks guard](../../app/branch/[branchId]/tasks/page.tsx#L10) permits source-work viewers. The search service cannot restore actions already filtered out by the catalogue. | Align action discovery with each destination's view capability; retain separate mutation checks. Add missing useful destination/action definitions. Never grant broader server access to solve this UI mismatch. |
| N09 · Fix first | Organization Attention queue says **Review overdue payments**, but opens the ordinary current-month DUE view. Older overdue records can remain out of view. This predates the redesign. | [Organization link](../../app/org/[orgId]/page.tsx#L455) sends `/payments?status=overdue`. [Payments](../../app/branch/[branchId]/payments/page.tsx#L108) recognizes `DUE`, `PAID`, `WAIVED`; it does not implement `overdue` and otherwise defaults to the current month. | Use the actual overdue worklist or a supported overdue filter. Verify the destination includes older periods and partial remaining balances. |
| N10 · Navigation | The contextual **Back to billing settings** link on a processing page does not target the billing section. This predates the redesign. | [resolveContextualParent](../../lib/contextualNavigation.ts#L38) uses `settings?section=billing`. [Organization Settings](../../app/org/[orgId]/settings/page.tsx#L170) does not read `section`; its real section is `id="billing"`. Other billing recovery links correctly use `#billing`. | Use the same supported billing anchor/return-path owner as the other billing flows. Preserve the exact organization and processing-operation identity. |
| N11 · Navigation | Recent activity looks like a link to the displayed event, but most entries open a generic page. A named payment/student/allocation can be lost among many rows. | [Dashboard activity generation](../../services/dashboard.service.ts#L238) uses `/payments`, `/students`, `/attendance`, `/allocations` or generic event pages without the corresponding record IDs. [ActivityContent](../../components/dashboard-features/ActivityContent.tsx#L23) renders those links. | Carry safe record IDs into the existing supported target/focus contracts. Do not put names or private notes into URLs. Keep the bounded activity-feed description; it is not a complete audit log. |
| N12 · Fix first | **Attendance gaps has no complete gap worklist.** The dashboard can report more students than View students can show; its setup screen renders only the first eight, with no gap pager or full-gap link. | [Gap source](../../services/dashboard.service.ts#L191) calculates the full count but uses `take: 8`. [Setup](../../components/dashboard-features/DashboardSettingsContent.tsx#L41) maps only `gapsStudents`. Its incoming `filter=gaps` is not consumed. The bell's Attendance gaps link opens ordinary Attendance, which has no expectations-gap filter. | Add a complete authorized gap destination/pagination, or explicitly label a preview and link to a full result. Ordinary unmarked attendance is not equivalent to an agreed expectation gap. |
| N13 · Fix first | **WhatsApp can disappear after an initial API failure instead of showing an error/retry.** This can look like a removed feature. The branch case predates the redesign. | [Branch panel](../../components/whatsapp/BranchWhatsAppPanel.tsx#L604) catches a load error, reports availability false and sets a notice, then line 620 returns null when no response is present. [Organization panel](../../components/whatsapp/OrganizationWhatsAppPanel.tsx#L407) similarly returns null at line 447 if its initial config request failed. Settings removes its WhatsApp section link when availability is false. | Distinguish permission/rollout-disabled from loading and unavailable. Render an authorized error/retry state after failure. Preserve flags, entitlements and provider boundaries. |
| N14 · Fix first | **Follow-ups advertises Search by name or phone, but its backend search checks names only.** A valid phone lookup returns no matching follow-up. | [Input label](../../components/dashboard-features/FollowUpsContent.tsx#L36); [service search](../../services/dashboard.service.ts#L299) filters `student.name` only. This is a real source/destination mismatch, not a missing phone display. | Support the stated phone lookup inside the authorized query, or narrow the label if name-only is the intended contract. |
| N15 · Fix first | **Follow-ups notification links do not apply a new filter when the page is already mounted.** Open pending Follow-ups, click the bell's Follow-ups due link: URL changes to `filter=DUE`, but the screen stays on Follow-ups pending. | Reproduced at both widths in [browser observations](evidence-ui-features-2026-10-22/browser-observations.json). [Follow-ups](../../components/dashboard-features/FollowUpsContent.tsx#L21) reads query values only in initial state. [Renewals](../../components/renewals/RenewalsContent.tsx#L31) has the same mount-only pattern for its query-derived filters/search; that second case is source-confirmed only. Payments and Dashboard setup already have query synchronization and are not included in this finding. | Apply supported query changes to the mounted destination without losing pending edits. Reset pagination when the query changes; verify notification clicks and back/forward navigation. |
| N16 · Discoverability | The existing **choose-a-student collection picker** has no direct button on the ordinary Payments page. Its header says Payment history and offers generation/month navigation; users must use a due-row action or return to the dashboard to start general collection. | [Payments header](../../app/branch/[branchId]/payments/page.tsx#L427); [picker mounting](../../app/branch/[branchId]/payments/page.tsx#L598) requires `action=collect`; dashboard already supplies that query. This is an entry-point gap, not removal of collection. | Add a capability-aware Record payment button on Payments using the existing picker. Keep Generate missing dues distinct from recording money received. |
| N17 · Navigation | Seats' **Back to Workspace** error action sends staff to an owner organization chooser, which may then send them into onboarding. | [Seats error](../../app/branch/[branchId]/seats/page.tsx#L655) pushes `/org`; [organization chooser](../../app/org/page.tsx#L36) loads owned organizations and redirects an empty result to `/onboarding`. Staff-only branches belong in the workspace directory rather than that owner-only list. | Route recovery through the existing permission-aware workspace entry or the current branch dashboard; retain a meaningful retry where possible. |
| N18 · Discoverability | **Creating another organization has no normal entry from the authenticated organization chooser or workspace controls.** The setup capability exists, but users must find onboarding through another surface or know the URL. | [/org](../../app/org/page.tsx#L67) only renders existing organizations; [workspace controls](../../components/layout/WorkspaceSwitcher.tsx#L46) offer existing workspaces/account. [Onboarding](../../app/onboarding/page.tsx#L539) explicitly supports Set up another organization after a saved setup receipt. | Add an explicit new-workspace/setup entry if this supported multi-organization flow should be self-service. Preserve onboarding replay identity and one-trial-per-owner semantics. |

## 3. Implemented server capabilities with no UI caller found

These endpoints existed at the pre-pilot baseline too. Their absence is not
evidence that the redesign deleted an earlier control. Wiring them later requires
review of the full service contract rather than a generic CRUD button.

| ID | Capability | Evidence | Required UI boundary |
| --- | --- | --- | --- |
| G01 | Schedule branch removal from billing and undo that scheduled removal | [POST/DELETE billing-removal](../../app/api/branches/[branchId]/billing-removal/route.ts#L10), [service](../../services/branch.service.ts#L875). No caller for this route found in application/client components. Current activation gate does expose reactivation and pending-activation recovery. | Owner-only review, exact branch/organization, effective date, stable request identity, existing pending-operation/provider checkout handling and undo safety. Scheduling removal is not deletion of branch history. |
| G02 | Delete a saved import recipe | [DELETE recipe](../../app/api/branches/[branchId]/import-recipes/[recipeId]/route.ts#L8), [service](../../importing/services/import-recipe.service.ts#L381). The wizard exposes recipe saving and matching reuse; no delete control/client wrapper was found. | Organization-scoped recipe management with an intentional delete action; do not reset or delete historical import sessions/runs. |

## 4. Features still present that can look missing

This is the recovery map for existing controls. Visibility still depends on the
appropriate role, plan, entitlement, writable branch and any rollout gates.

| Feature group | Existing controls / current place to find them |
| --- | --- |
| Student admission and fees at admission | Students → Add student. Existing admission, joining date, fee and related setup controls remain in the feature's dialogs. |
| Student edit, activation/deactivation | Students → row/card **Actions** → Edit Details / Deactivate / Activate. The name button on the compact card opens edit for an authorized writer, or fees for a payment viewer; it is not a general student-detail page. |
| Student fee details | Students → Actions → View Fees. Due/paid/waived amounts and collection history remain. |
| Receipts and corrections | Student fee drawer, or Payments → Collections & receipts → View receipt. Receipt download/print/share/copy remain in `FeeReceipt`; owner-only Correct / void is in collection history. These are nested workflows, not separate sidebar pages. |
| Payment transition audit | Payments → row History action → PaymentAuditLog. This is distinct from receipt/collection history and the bounded dashboard activity feed. |
| Student exports and roster filters | Students toolbar → Export, search, shift/bundle selection, active/inactive tabs and pagination. Mobile uses cards; hiding the desktop view toggle does not remove row commands. |
| Individual / bulk WhatsApp consent | Students → Actions → WhatsApp consent; roster header → Bulk WhatsApp consent. The bulk workflow is limited to the loaded roster selection. |
| Daily attendance | Attendance → date, name/phone, status, current-shift filters; individual or explicitly selected Present/Absent; manual Check in / Check out. |
| QR, visit history and corrections | Attendance → History & QR, or Students → Actions → Attendance & QR. QR generation/display, recorded visits, missed checkout correction, voiding and mark change history remain under their existing permissions. |
| Camera-assisted attendance | Attendance → Open QR scanner. Camera/device permission and supervised confirmation remain separate from student identity or fees. |
| Open visits | Attendance → Open visits. This is a separate operational view across dates, not the current-day roster alone. |
| Physical seats and maps | Seats & Maps → choose shift/bundle and availability scope; inspect a seat, assign from the seat map, use the existing seat-creation/numbering controls. |
| Single shifts and bundles | Shifts contains primary shifts and MultiShift bundles, prices/times, edit controls and assisted removal/reallocation. Bundles are inside Shifts, not separate sidebar entries. |
| Allocation management and history | Allocations → active/history views, change/end actions and allocation dialogs. Students also exposes Allocate Seat / Change Seat. History is not lost when the current allocation ends. |
| Member fee collection | Dashboard → Record payment; Payments → due-row Collect fee; Students → View Fees → Collect fee; Renewals & dues → recorded-due Collect fee. Full/partial collections, method/reference and stable retry remain. |
| Monthly dues and waivers | Payments → DUE / PAID / WAIVED tabs, month controls, Generate missing dues and permitted row waiver action. Generating a due does not record a collection. |
| Fee reminders and follow-up scheduling | Renewals & dues → Update follow-up / Reminder options. Expected future fees and recorded dues remain separate. The standalone Follow-ups queue edits/completes scheduled work; its empty state directs users to Renewals & dues to schedule one. |
| Manual tasks and activity | Tasks → Add/Edit task, assignment, due date and status for permitted managers; other authorized users see source work. Recent activity is linked from Tasks and the dashboard, using `tasks?view=activity`. |
| Attendance expectations / membership terms | Dashboard setup → Attendance expectations / Membership terms. Membership Renew term creates a new agreed period; it does not shift fee dates or deactivate the student. These are the features buried by N03. |
| CSV operational reports | Exports & Reports → Fee ledger / Student admissions / Attendance marks, date/status/name filters and Download CSV. Visits and unmarked students are deliberately not in the attendance-mark export. |
| Analytics and AI reports | Branch Analytics, organization Global Analytics and AI Reports have distinct source/plan/permission gates. AI report print/regeneration controls remain on its page. |
| Import assistant and recovery | Import Assistant → upload/paste/template and import history → session wizard. Column mapping, decisions, row correction, payment mapping/preview, import/retry/resume/cancel, result/error downloads and recipe save/reuse remain in the guided steps. |
| Staff controls | Staff & Permissions → member role/access controls, invite/copy/revoke, overrides and removal. Invitations still use their separate acceptance route. |
| Branch messaging operations | Branch Settings → WhatsApp → sender assignment, delivery/automation controls, stages/tone/language/budget, message history, daily-report subscription/preview/history, typed service notices and incidents. They are grouped deep in settings and independently gated; N13 concerns silent failure, not legitimate rollout exclusions. |
| Organization messaging operations | Organization → System Settings → WhatsApp → Meta connection/senders, registration, managed templates, synchronization/disconnect, sender safety, incidents and organization daily reports. |
| Subscription, invoices and branch lifecycle | Organization → System Settings → Billing → plans, payment methods, invoices, pending changes, cancellation/undo and processing recovery. Organization dashboard → Create branch. Archived/pending branches expose their existing activation gate. G01 is the missing branch-removal control, not absence of the entire lifecycle. |
| Personal language/preferences | Account Settings → Preferences; the shell's compact language control changes **interface language only**. Receipt/report document language and reminder communication language are independent. N01 hides the central account entry on compact branch layouts. |

Browser checks confirmed the same seven Student Actions at both widths:
Attendance & QR, View Fees, Edit Details, Deactivate, WhatsApp consent,
Allocate Seat and Change Seat. These should not be reported as deleted features.
Successful collection also still emits `fee-collection-changed`; both the
roster and collection history listen for it. The no-op local `onSaved` callback
in the fee drawer is therefore not, by itself, evidence of stale financials.

## 5. Complete page entry-point map

`b` = authorized branch ID, `o` = authorized organization ID. An entry path here
does not imply authorization for every user or successful provider operation.

| Page | Existing discovery / audit classification |
| --- | --- |
| `/app` | Permission-aware workspace redirect; useful recovery owner, not a workspace directory screen. |
| `/account` | Desktop account-summary action / combined workspace control elsewhere; compact branch gap N01. |
| `/onboarding` | Initial workspace setup and explicit another-organization path; discovery gap N18. |
| `/invite/[token]` | Shared invitation link; intentionally not a sidebar destination. |
| `/org` | Existing-organization chooser; not a universal staff workspace return, N17. |
| `/org/o` | Organization overview via workspace control; weak return entry N04. |
| `/org/o/analytics` | Organization sidebar → Global Analytics; plan gate retained. |
| `/org/o/settings` | Organization sidebar → System Settings; billing/messaging are sections. |
| `/org/o/billing/processing/[changeId]` | Billing action/recovery destination; contextual return gap N10. |
| `/branch/b` | Branch switcher / Dashboard navigation. |
| `/branch/b/students` | Daily work → Students; seven row/card actions preserved. |
| `/branch/b/attendance` | Daily work → Attendance; QR and visits are nested views. |
| `/branch/b/follow-ups` | Daily work → Follow-ups; phone/query wiring N14–N15. |
| `/branch/b/tasks` | Daily work → Tasks; activity is `?view=activity`. |
| `/branch/b/seats` | Seats and shifts → Seats & Maps; error-return gap N17. |
| `/branch/b/shifts` | Seats and shifts → Shifts; single and bundled shifts. |
| `/branch/b/allocations` | Seats and shifts → Allocations; current/history and change/end. |
| `/branch/b/payments` | Fees → Payments; ordinary entry hides general picker shortcut N16. |
| `/branch/b/renewals` | Fees → Renewals & dues; this is fee dates/dues, not membership-term setup. |
| `/branch/b/overdue` | Fees → Overdue; use this supported queue for N09. |
| `/branch/b/analytics` | Reports → Analytics; plan/permission gates. |
| `/branch/b/ai/reports` | Reports → AI Reports; complete AI report permission/entitlement gates. |
| `/branch/b/ai/messages` | Search/direct URL; excluded from selected navigation/theme, N02. |
| `/branch/b/reports` | Reports → Exports & Reports; search eligibility mismatch N08. |
| `/branch/b/settings` | Setup and access → Branch Settings, or WhatsApp for a qualified restricted operator. |
| `/branch/b/dashboard-settings` | Dashboard cards / manager Tasks footer; missing sidebar/setup cross-links N03. |
| `/branch/b/staff` | Setup and access → Staff & Permissions; plan/permission gates. |
| `/branch/b/onboarding/import` | Setup and access → Import Assistant; lower in scrollable mobile navigation. |
| `/branch/b/onboarding/import/[sessionId]` | Import history → existing guided session; intentionally a nested destination. |

The mobile navigation is scrollable. Setup/import/staff are below its initial
viewport, but are present; see the [scrolled mobile capture](evidence-ui-features-2026-10-22/navigation-390-bottom.png).
That is different from the actually omitted Account / AI Messages / Dashboard
setup destinations.

## 6. Navigation proposal and repair order

Keep the current shared presentation and feature owners. Make the existing
features understandable through these explicit destinations:

- **Workspace:** current organization overview, switch branch/organization,
  Account settings, and the supported create-workspace entry. Keep the account
  entry available on every width and during directory-load failure.
- **Daily work:** Dashboard, Students, Attendance, Follow-ups and Tasks, with
  Recent activity clearly identified as a bounded feed.
- **Seats and shifts:** Seats & Maps, Shifts & bundles, Allocations & history.
- **Fees:** Payments & receipts, Upcoming fees & dues, Overdue. Put Record payment
  on Payments itself and keep dues generation a separate action.
- **Reports:** Analytics, AI Reports and Exports; resolve AI Messages support or
  retirement explicitly instead of silently dropping the link.
- **Setup:** Branch Settings, Dashboard setup, Import Assistant and
  Staff & Permissions. Give independently enabled WhatsApp operations a clear
  settings destination/status rather than hiding a failed load.

Repair sequence:

1. Restore compact Account access; repair overdue/add-student/billing/error
   destinations and same-page notification filters; fix phone-search and the
   incomplete attendance-gap destination; expose WhatsApp failure/retry.
2. Restore notification coverage and useful feature entry points. Align search,
   sidebar, dashboard links and destination capabilities; add focused tests of
   the actual click-through behavior rather than only checking link labels.
3. Complete the two missing API-backed controls with feature-specific review.
   Resolve membership-term correction separately: only create/renew is currently
   implemented, so editing/deleting a historical term cannot be restored by
   merely adding a button. An owner must settle that behavior before expansion.
4. Review compact navigation in English, Hindi and Hinglish across owner,
   students-only, allocations-only, finance-only, read-only and plan-locked
   states, then perform connected verification on an independently proven
   disposable target. Production release remains a separate step.

Authorization, tenant scope, plan locks, writable-state checks, financial
arithmetic, provider-authoritative billing, stable retries, immutable receipts,
consent and advisory-only AI remain required. Expected fees are not recorded
collections; attendance gaps are not automatic absences; terms do not change
fee dates. None should be relaxed to make a feature appear in navigation.

## 7. Verification, changes and limitations

Commands executed from the repository root:

```text
git status --short
git log -15 --oneline
git diff --stat 3d58864 HEAD -- app components lib
git diff --name-status --no-renames a3c6ed1 HEAD -- components/dashboard
pnpm exec node node_modules/vitest/vitest.mjs run --config tests/reference-dashboard/vitest.config.ts tests/unit/components/BranchSidebar.test.tsx tests/unit/components/WorkspaceSwitcher.test.tsx tests/unit/lib/topSearch.test.ts tests/unit/services/branch-search.test.ts tests/unit/components/DashboardSettingsContent.test.tsx tests/unit/components/reference-dashboard.test.tsx tests/unit/lib/application-design-pilot.test.ts tests/unit/lib/branch-capabilities.test.ts
pnpm exec node docs/audits/evidence-ui-features-2026-10-22/run-browser-audit.mjs
node --check docs/audits/evidence-ui-features-2026-10-22/browser-audit.mjs
node --check docs/audits/evidence-ui-features-2026-10-22/run-browser-audit.mjs
pnpm exec node docs/audits/evidence-ui-features-2026-10-22/validate-evidence.mjs
git diff --check
```

- **Unit result:** eight files / 73 tests passed. The first attempt failed before
  collecting tests because Windows denied a Vite temporary-cache rename. The
  successful run used process-local `TEMP`/`TMP` under
  `test-results/ui-feature-audit/tmp`, without repository environment changes.
  The inspected config blocks external fetch and unexpected database operations;
  it does not load the truncating integration setup.
- **Browser result:** final saved diagnostic completed successfully at both
  widths with no page errors or horizontal document overflow. The same-route
  Follow-ups filter mismatch was reproduced through the actual bell/link. This
  diagnostic records current defects; exit zero does not mean those defects are
  fixed. [Raw observations](evidence-ui-features-2026-10-22/browser-observations.json),
  [desktop](evidence-ui-features-2026-10-22/navigation-1440.png),
  [mobile header](evidence-ui-features-2026-10-22/header-390.png),
  [mobile navigation](evidence-ui-features-2026-10-22/navigation-390.png),
  [mobile lower navigation](evidence-ui-features-2026-10-22/navigation-390-bottom.png).
- Browser startup initially could not find its sandbox-local executable. It used
  the already installed user Playwright cache afterward. Cross-sandbox loopback
  was denied/timed out; the final authorized run started the synthetic server
  and browser together, and blocked all non-loopback browser requests. No browser
  download or dependency change was needed. The runner stops its own server.
- Existing green tests do not establish feature parity: BranchSidebar tests
  explicitly expect AI Messages and Back to organization to be absent from
  selected navigation. Broader authorization/provider behavior was not re-tested.
- **Artifact validation:** 53 local links/line references, 29 page source paths,
  the 20-finding count, both JSON evidence files and new text-file whitespace
  checks pass. Both browser scripts pass `node --check`; `git diff --check`
  passes for tracked changes. The explicit validator also covers the new,
  untracked audit text, which ordinary `git diff --check` does not inspect.
- Changes are this report and its evidence files only. No application behavior,
  regression test suite, schema, migration, seed, dependency, provider or
  persistent environment configuration changed. Runtime lint/build were omitted
  because the deliverable is documentation/evidence and the implementation is
  unchanged. Local file links, route inventory, JSON and `git diff --check` are
  validated separately.
- No Home/Features/Pricing/FAQ edits are needed for an audit-only change.
  [Public claims](../product/public-claims.md) already distinguish implemented,
  gated and retirement-planned capabilities. No new public availability promise
  is made here. The canonical design/migration documents remain unchanged because
  no migration, behavior change, owner approval or release occurred.
- The pre-existing untracked September audit/evidence and migration directory
  were preserved. No commit, push, branch change or PR was performed.

Future restoration should update the migration ledger with fresh local evidence
and keep owner presentation review distinct from connected verification and
release. This inventory is comprehensive for the 29 page entry points inspected;
it is not a claim that every hidden state in a deployed account has been observed.
