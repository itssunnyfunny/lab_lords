# Remaining application families

The selected dashboard remains the visual baseline. On 2026-09-27 the owner
explicitly approved the refined Students presentation shown in the comparison
as the pattern for Batch 2: Staff first, then Tasks. Keep that implementation;
this authorizes presentation migration only, not backend features or release.
Stop after Batch 2. Each batch needs scoped workflow,
authorization, three-language, keyboard, narrow-screen and affected-consumer
checks; it must not change the public theme or request identities.

`b` denotes the real branch ID and `o` the organization ID. Entries list every
current application page; grouped paths share one review boundary. These are
proposed migration batches, not new product or architectural approvals.

## Presentation approval and release ledger

These columns describe this local migration revision, not historical production
availability of each feature. Test success is not owner approval or deployment.

| Family | Local verification evidence | Owner presentation approval | Production release |
| --- | --- | --- | --- |
| Students | `36d0d0d` implementation; `b102af3` [local evidence](student-card-refinement.md) | **Approved 2026-09-27** in this chat: refined comparison retained as the next batch's visual pattern | Local migration not released; no release operation authorized |
| Staff | Batch 2 in progress | Reuse approved Students hierarchy; completed family review pending | Not released |
| Tasks | Starts after Staff verification | Reuse approved hierarchy; completed family review pending | Not released |

| Route / family | Pattern / batch | Bespoke work retained | Risk | Required checks | Status | Commit |
| --- | --- | --- | --- | --- | --- | --- |
| `/branch/b` | Selected dashboard | Chart, seating matrix, artwork, five priorities/six figures | High source/access | Pixel/crops, source freshness, notifications, sparse history, finance/access | Preserved | `95a589a` |
| `/branch/b/students` | Record list/detail / 1 | Admission, status resolution, consent, fee/attendance overlays | High mutation/recovery | Scalar merge, filter context, readonly/staff, nested dialogs, fees, three languages | Refined; locally verified; presentation approved in ledger | `6e423ae`, `36d0d0d`, `b102af3`; [review](student-card-refinement.md) |
| `/branch/b/staff` | Record list/detail / 2 | Invites, permission overrides, role controls | High authorization | Invite/permission/server scope, disabled actions, confirmation focus | Planned | — |
| `/branch/b/tasks` | Record list/detail / 2 | Assignment, task state, evidence/activity tab | Medium | Reload persistence, assignee scope, source-state boundaries | Planned | — |
| `/branch/b/follow-ups`, `/branch/b/renewals`, `/branch/b/overdue` | Work queue / 3 | Due cohorts, promises, completion, reminders and uncertainty | High finance/provider | Partial/waived/legacy balances, contact consent, no automatic provider action | Planned | — |
| `/branch/b/payments` | Record list/detail with financial evidence / 4 | Canonical collection, immutable receipts, void/correction recovery | High accounting | Same-request retry, partial/waiver arithmetic, owner-only correction, document language | Planned | — |
| `/branch/b/seats`, `/branch/b/allocations`, `/branch/b/shifts` | Specialized operations / 5 | Seat map, multi-shift capacity, overlap, allocation and fee links | High domain | Scope/capacity/overlap, deep links, loaded vs exact counts, touch/keyboard | Planned | — |
| `/branch/b/attendance` | Specialized operations / 6 | Calendar, QR camera, session/visit commands | High command recovery | Confirmed evidence, stable retry, camera cleanup, document navigation | Planned | — |
| `/account` | Grouped personal settings / 7 | Profile, interface/document language, preferences | Medium identity | Cross-account preference events, draft retention, language purposes | Planned | — |
| `/branch/b/settings`, `/branch/b/dashboard-settings` | Grouped operational settings / 7 | Branch configuration, advisory utilization, expectations, independent terms | High scope/billing | Writable access, terms vs dues, configuration permissions, field errors | Planned | — |
| `/org/o/settings`, `/org/o/billing/processing/changeId` | Grouped billing/settings plus pending-state workflow / 8 | Provider-authoritative plan changes, checkout and durable processing | Highest provider/access | Provider mode, callbacks, idempotency/order/replay, pending recovery | Planned separately | — |
| `/branch/b/reports`, `/branch/b/analytics`, `/branch/b/ai/reports`, `/org/o/analytics` | Reporting / 9 | Authorized cohorts, CSV/PDF filters, AI advisory output | High privacy/meaning | Row limits/scope, formula escaping where supported, document language, financial denominators | Planned | — |
| `/onboarding`, `/invite/token`, `/branch/b/onboarding/import`, `/branch/b/onboarding/import/sessionId` | Guided workflow / 10 | Identity linking, invitations, staged imports and durable recovery | High tenant/AI/data | Token ownership, staged validation, import resumability, no automatic AI authorization | Planned | — |
| `/org`, `/org/o`, `/app` | Workspace selection/overview / 11 | Organization/branch discovery, owner/staff routing | High access | No foreign enumeration, correct landing routes, account identity switching | Planned | — |
| `/sign-in/…`, `/sign-up/…` | Authentication entry / separate review | Clerk-hosted flow | High provider | Redirect/context, provider-owned languages, no auth bypass | Unchanged | — |
| `/branch/b/ai/messages` | Legacy generation surface | Planned retirement; independent communication language semantics | High provider | No change in this migration; preserve stored drafts and data | Excluded | — |
| Public `/`, `/features`, `/pricing`, `/faq`, other marketing/policy routes and `/hi` / `/hinglish` equivalents | Public system | Approved copy, URL language, public fonts/layout | Independent | Public localization and route/theme smoke checks | Excluded; unchanged | — |

Do not force operational maps or guided workflows into the record template.
Adopt existing controls and semantic tokens first; review a distinct interaction
pattern before building it. No later batch is implemented by this document.
