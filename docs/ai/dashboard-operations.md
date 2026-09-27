# Dashboard operations — local implementation, 27 September 2026

The selected full dashboard uses `DashboardService` and the branch-scoped
`/api/branches/[branchId]/dashboard` route family. This record describes the
server contract; visual acceptance remains with the owner. The public website
is unchanged.

## Definitions and authorization

| Source | Definition | Required read action |
| --- | --- | --- |
| Collected this month | Nonvoid receipt collections by actual `collectedAt`, plus non-ledger PAID fees with a recorded `paidAt`, in the organization timezone's current month | `view_payments` |
| Pending dues | Remaining original minus collected minus waived amounts on DUE fees through the local day; future fees excluded | `view_payments` |
| Overdue collections | Remaining DUE balances before local midnight seven days before today; preserves the existing more-than-seven-days overdue rule | `view_payments` |
| Active students | Complete branch count of ACTIVE students | `students` |
| Follow-ups pending / due | Existing RenewalFollowUp records without `completedAt`; due means a scheduled date on or before the local day | `view_payments` |
| Attendance | Unique students with explicit PRESENT marks or nonvoid visits on the local day; attendance is never inferred from seats | `students` |
| Attendance gaps | Active students with an enabled explicit weekday expectation, after its local `expectedBy`, without qualifying attendance; explicit ABSENT also remains a gap | `students` |
| Seat utilization | Active same-branch seat allocations divided by all physical seats times all active shifts; MultiShift components occupy separate shift slots | `seat_allocation` |
| Upcoming renewals | Explicit membership terms ending today through seven days ahead, for active students | `students` |
| Collections chart | Fees due in the selected local month, grouped by due day, showing their **current** collected and pending balances. The line is cumulative collected divided by cumulative billed minus waived for the exact same cohort | `analytics`, `view_payments`, `ADVANCED_ANALYTICS` |

The chart is a current settlement view of a due-date cohort, not reconstructed
historical cash flow. Its collected total can differ from cash collected this
month for older fees. Legacy PAID/WAIVED rows use their recorded status; ledger
rows use their actual collected/waived amounts. Percentage changes remain null
because reliable comparable historical coverage is not established. No missing
history becomes a zero or invented trend.

Every response source reports success, restricted, locked or error separately.
The aggregate runs in one RepeatableRead snapshot, so cards, charts and queues
see the same committed data. Constant savepoints isolate source SQL errors;
all queries for a failed source settle before rollback and the next source.
Forbidden sources are not queried or returned. Activity has its own error state.
The server authenticates at each route, resolves tenant scope in the service,
and rechecks role, relevant capability and branch writability inside every
mutation transaction. Foreign and nonexistent child IDs use the same not-found
response. Mutation routes enforce same-origin requests and JSON, and stop reading
after 12 KB of actual streamed body bytes, regardless of Content-Length.

## New operational data

`DashboardSettings` adopts a 35% advisory utilization threshold, configurable
from 1–100. It does not move students or alter allocations. Expectations and
membership terms begin absent; nothing is inferred or backfilled.

`AttendanceExpectation` records explicit weekdays (0 is Sunday), local deadline
and enabled state for one student. Setup requires `manage_branch` and `students`.
It does not create attendance marks, absence records or visits. It applies
prospectively using the current schedule; historical attendance is unchanged.

`MembershipTerm` records a label and agreed local start/end dates. Creation
requires `manage_branch` and `students`; reads require `students`. Same-student
overlaps are rejected in a serializable transaction. Terms never create fees,
change anniversary billing, change student status or alter SaaS access.

`OccupancySnapshot` records the first authorized observation of each shift on a
local day. The explicit CAPTURE_OCCUPANCY command requires `seat_allocation` and
a writable branch. Repeats are idempotent by branch/day/shift. Counts, shift
labels, timezone and observation timestamp are immutable. Current-day cells
use current state; earlier cells use only observed snapshots. Unknown days are
null. Coverage begins at the first recorded observation, and is not continuous
monitoring. Physical-seat previews are limited to 80; the capacity denominator
always comes from full-table scoped counts. Historical shift labels/IDs are
evidence, never an authorization input.

`DashboardTask` stores a manual title, due instant, OPEN/DONE status, creator and
optional current branch member assignee with management/task access. Members
without task access are not offered as assignees. Reads/writes use `manage_branch`;
writes also require writability. Completing a manual task does not complete
source work, settle a payment or change attendance. Source alerts resolve from
their original records. Task changes create immutable `DashboardEvent` records.

`RenewalFollowUp.completedAt` distinguishes completion of contact work from fee
settlement. The focused worklist can schedule, edit, complete and reopen existing
records, including records whose fee was later paid. Writes use the existing
`paymentsRecord` capability. Explicit saving through the original renewals
workflow reopens contact work and records a future event. Notes and provider
delivery remain separate; no delivery or payment is claimed by completion.

Recent activity combines actual collection timestamps, student creation times,
immutable attendance audit events, allocation start dates and prospective
dashboard events. Allocation items mean an allocation began on its stored start
date; this bounded feed is not a complete audit log. No past events are invented.

## Personal notifications

Notifications are derived from authorized overdue, scheduled follow-up,
attendance-gap, membership-term and due-task conditions. Stable condition keys
deduplicate repeated renders. Changed amounts/counts, due-day context or recorded
source changes can produce a new key. User/branch/key-scoped read, snooze and
dismiss state persists in `DashboardNotificationState`; snooze is bounded to
30 days. Personal state changes recheck the source permission and branch
writability. The API retains unresolved conditions with their acknowledgement
flags, so the task/source worklists still expose them. No browser push, provider
send, charge or external action is performed.

Opening the notification center refreshes its current source conditions.
Acknowledgement controls are disabled while that refresh is pending or failed.
If a condition changes after the list was displayed, the server still rejects
its obsolete key. The UI then refreshes the list and requires another explicit
action; it never automatically acknowledges the replacement condition.

## Migration and rollout

`20260927120000_dashboard_operations` adds seven empty tables and nullable
`RenewalFollowUp.completedAt`. It has no backfill, seed, environment changes,
cron, provider integration or existing-row financial mutation. Student links
are composite-scoped to branch; checks constrain thresholds, weekdays,
deadlines, term ordering, occupancy counts and task statuses. Event/snapshot
UPDATE and DELETE are rejected by immutable-evidence triggers.

Apply the additive migration before the corresponding application release,
using the existing production runbook only after separate release authority.
Compare existing table counts and all original fee/receipt/audit inventory
before/after; the seven new tables must initially be empty and completedAt must
be null on retained follow-ups. Actual local counts and commands belong in the
connected verification report. No Production counts were measured here.

Application rollback can retain the additive schema and all new evidence while
returning to the prior collection-compatible application. Do not drop history,
reset fees or revert to pre-collection writers. No down migration is supplied.

## Destinations, search and exports

The branch shell exposes Follow-ups, Tasks, Exports & Reports and source setup.
It waits for the initial Clerk client identity before mounting interactive
branch content. The existing identity-keyed preferences reset remains intact;
forms cannot open in the unresolved identity and then lose input on hydration.
This readiness guard does not replace server authorization or affect public pages.
Follow-ups edits the canonical renewal contact record; the Tasks page separates
manual management tasks from unresolved source work. Members with operational
permissions can review their authorized source work without gaining manual-task
management permission. `tasks?view=activity` opens the bounded recorded-activity
feed. `dashboard-settings?section=expectations`, `section=terms` and
`section=utilization` open the corresponding setup/review tab; student query
parameters focus an existing record. Read-only members can inspect permitted
records while mutation controls remain disabled or absent.

`payments?action=collect` opens a chooser backed by the canonical outstanding
fee query. Selection opens the existing collection dialog and preserves its
confirmation, balance, idempotency, receipt and recovery behavior. It does not
collect on navigation. `renewals?filter=OVERDUE` initializes the actual overdue
filter, and attendance student links initialize the roster search. Attendance
links use document navigation to preserve the camera permission-policy boundary.

Global branch search continues to use the existing server-scoped search service,
with permission-filtered Follow-ups, Tasks and report destinations added. Ctrl-K
or Command-K focuses the search control. Organization and branch menus are built
from the signed-in user's authorized directory; neither a menu nor a search hit
grants destination access. Notifications persist acknowledgement only and link
back to their source work. Call links open the device dialer; contact notes and
completion never claim a provider delivery.

`GET /api/branches/:branchId/reports` previews or exports authorized student,
fee and attendance records. The service checks `students` or `view_payments`
before reading and scopes every query by organization and branch. Filters are
validated, the inclusive period is limited to 93 days, and exports exceeding
10,000 matching rows are rejected with a request to narrow the period. The
browser previews the first 50 rows and downloads the complete bounded result.
Fee reports expose original amount, collected, waived and remaining separately;
legacy non-ledger PAID/WAIVED rows use their recorded full-settlement status,
while ledger-backed rows use the stored collected and waived amounts. This
projection does not create a receipt or invent a collection timestamp.
Fee reports are not a cash collection-date ledger. Local-day boundaries use the
organization timezone; attendance uses its existing stored calendar date.

CSV headers follow the independent document-language preference. Cells with
spreadsheet formula prefixes, including prefixes after leading whitespace or
control characters, are quoted as literal text; embedded quotes and newlines are
escaped. Reports omit phone numbers and freeform notes, use private no-store
responses and do not require a paid analytics entitlement for otherwise
authorized basic records. The new destinations add no external provider calls,
environment keys, public marketing copy or database writes beyond the explicitly
documented operational commands.
