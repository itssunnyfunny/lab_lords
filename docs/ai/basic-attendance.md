# Basic attendance

Implementation date: 2026-09-11. Deployment is not implied by source presence.

`services/attendance.service.ts` owns attendance reads and commands. Thin,
authenticated branch routes serve the Attendance page and the Students row's
Attendance & QR drawer. Existing Renewals/Collections remain independent.

## Storage and transactions

Migration `20260911120000_basic_attendance` creates AttendanceMark,
AttendanceVisit, AttendanceCredential and AttendanceCommand. All start empty.
Student links are composite with branchId. Marks have unique branch/student/date
identity; a partial index enforces one nonvoid open visit per branch/student.
Visit timestamps are stored as UTC instants and dates as SQL DATE. An existing
visit retains the organization timezone that established its date. Invalid or
missing configured timezone falls back to Asia/Kolkata, for attendance only.

AuditLog reuses its existing actor/branch/details storage with optional paymentId
and a new optional composite student target. A check requires exactly the right
target for attendance versus existing payment actions. Attendance audit rows and
command receipts are immutable. Original visit/mark values, actor, reason and
timestamp survive corrections. This is not an event framework or backfill.

Every command authorizes, takes a branch/request advisory lock, binds the key to
normalized input and actor, locks selected students in sorted order, then
rechecks authorization/state. A serializable transaction commits attendance,
audit and retry result together, with bounded serialization retries. Mark and
visit versions reject stale edits. Reusing a key with changed input/actor fails.
Ordinary repeat check-ins return the existing open visit; an old checkout retry
returns its saved result and never targets a newer visit.

## Meaning and permissions

Daily Present means an explicit Present mark or a nonvoid visit; Absent is
explicit. Otherwise the day is Not marked. Manual Present does not imply an
open visit. A visit remains attributed to its local start date even overnight.
Checkout records the current instant; correcting a missed departure requires an
explicit past timestamp. No absence, midnight checkout or departure is invented.

Reads and normal marks/check-in/out require students. Mark changes/clears,
historical marks, visit corrections and voids additionally require manage_branch
and a reason. All writes require the existing branch writability checks.
Inactive students cannot start visits; existing visits can be closed and history
remains visible. No payment entitlement or advanced analytics is required.
Current seat/shift context requires seat_allocation. Responses exclude finances.

Valid visits conflict with Absent and clearing attendance. First correct/void the
visit or have a manager correct the Absent mark, with a reason, then perform the
intended action. Voiding a visit does not erase an independent manual Present.
Future/before-joining dates, impossible times, overlapping valid visits and stale
corrections are rejected. Adjacent visits may meet at the same instant.

Today's roster contains all active students joined by now plus recorded daily
facts (including subsequently inactive students). Each student appears once,
including unseated and MultiShift students. Historical dates contain recorded
facts only, including explicit clears/void evidence. Historical unmarked counts
and attendance percentages are not reconstructed. All dates use current
allocations only as labeled context. Daily counts follow the search, shift and
list filters, independent of status filter; the open count covers the branch.

Pages are at most 50 students or visits; ranges at most 93 days; bulk commands
at most 50 distinct selected students. The service admits at most 100 new visits
per student/date. History shows 50 audit changes per page independently of the
attendance date range. Selected-page actions never mean the whole branch.

## Exercise the feature

1. Open branch **Attendance**. Today is selected using the organization timezone.
   Search, filter, or select specific students. Mark Present/Absent and confirm
   the exact selected count and optional note. Inspect the server-confirmed
   counts. Manual Present has no invented times.
2. Check in, then check out. A later check-in starts another visit. **Open visits**
   retains overnight visits labeled **Since previous day**, including inactive
   students. Use history corrections to close a missed departure explicitly.
3. Open **History & QR**, or **Students → row menu → Attendance & QR**. Choose a
   range; inspect marks, visits, sources, notes and recorded-by information. As
   owner/manager, correct a date's mark, edit timestamps or void a visit, entering
   a reason. The change-history section retains before/after facts.
4. Generate the stable QR, download its PNG or print it. On Attendance, open the
   scanner, choose Check in or Check out, scan and confirm the displayed identity.
   The server result is shown by name. Choose **Scan next student** to rearm;
   repeated camera callbacks cannot toggle attendance. Camera failure leaves
   manual student search/check-in/out available. An uncertain mutation offers
   **Retry same action**, holding its original input/key until confirmed.

Scanner uses locally bundled `@zxing/browser` (software QR decoding), and QR
generation uses `qrcode`, with no hosted QR service. Official documentation
checked during implementation: [ZXing browser](https://github.com/zxing-js/browser)
and [node-qrcode](https://github.com/soldair/node-qrcode). Camera tracks are owned
by each scanner session and stopped even if permission resolves after closure.
Only Attendance's page permits camera=(self); microphone/geolocation remain
denied. The root AttendanceCameraBoundary loads a new document when navigation
enters or leaves Attendance, including browser history; client-side routing must
not retain another page's document-level camera policy. Scanning requires a
secure browser context and operator permission.
Possession of the code grants no read/write or login access. This is supervised
attendance, not proof of identity or comprehensive proxy prevention.

## Verification and release

See [verification record](basic-attendance-verification-2026-09-11.md) for actual
commands and results. See the [runbook](../production-runbook.md) for migration
ordering and rollback. No new environment, flag, service, cron or Preview
database requirement is introduced.
