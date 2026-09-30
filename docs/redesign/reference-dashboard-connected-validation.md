# Dashboard connected verification — 27 September 2026

This records local verification of the selected dashboard implementation. It is
not design acceptance, deployment evidence, or permission to operate a shared
database. Final visual review remains with the owner.

The final authenticated production-build browser run passed all **9 / 9 cases
in 2.7 minutes**, with no retries or skipped cases. This run includes the final
notification freshness and application authentication-readiness repairs. The
held local application remains available at `http://localhost:3117` for review.

## Isolated database and providers

A new PostgreSQL 16 container, `lab-lords-dashboard-test-20260927`, was created
for this work with its port bound only to `127.0.0.1:55447`. Before migrations,
the newly created databases were independently queried and had zero public
tables. The exact connected database names were verified, independently of the
repository's substring guard.

- Integration target: `lab_lords_dashboard_final_test`.
- Final connected review target: `lab_lords_dashboard_review_browser_test`.
- Both received the complete maintained 53-migration chain using
  `scripts/bootstrap-isolated-database.mjs` and an exact explicit confirmation.
- Bootstrap verification passed required billing identity, validated constraints,
  and absence of application/customer/provider rows before the synthetic seed.
- The browser fixture was inserted transactionally and refuses nonempty targets.
  No existing shared, Preview or Production database was read or changed.
- Durability settings (`fsync`, `synchronous_commit`, `full_page_writes`) were
  disabled only within this newly created disposable test container to reduce
  local test-reset overhead. These are not application deployment settings.

The build wrapper enforces read-only database transactions. The local runtime
uses the writable disposable browser target, holds Razorpay writes, WhatsApp,
AI and imports, and clears inherited provider credentials. Existing real Clerk
development authentication is retained. Short-lived sign-in tickets were used
only for already-existing, verified synthetic development identities; no user
signup, OTP, email, message, provider subscription or charge occurred. Auth
states/tickets remain ignored local files and are not evidence artifacts.

## Fixture and preserved arithmetic

The fixture has 8 active students, 16 physical seats, 3 shifts, 48 seat-shift
slots, 6 allocations on 2 physical seats, 6 explicit expectations and 5 manual
Present marks. Five anniversary-coherent fee rows total ₹4,300, with 19
immutable synthetic receipts totaling ₹1,900 and ₹2,400 remaining. Two scheduled
follow-ups and three independent upcoming membership terms are recorded.
Synthetic prior receipt/occupancy history exists only in this isolated fixture.

Actual form/action verification leaves completed tasks, prospective audit events,
future membership terms and voided verification receipts in the disposable
database. These are intentional evidence of persisted actions. Contact actions
do not settle dues, terms do not change fees or student status, and receipt
reversal restores the balance without changing the immutable receipt snapshot.

## Completed PostgreSQL verification

Commands below used the explicitly confirmed integration target. No database
reset suite ran concurrently in the final passing executions.

```text
pnpm exec node node_modules/vitest/vitest.mjs run tests/integration/services/dashboard.test.ts tests/integration/services/fee-collection.test.ts tests/integration/services/attendance.test.ts tests/integration/services/renewals.test.ts tests/integration/services/payment.test.ts
```

Passed 5 files / 95 tests in 120.30 seconds. This comprised the unchanged 87
fee-collection, attendance, renewal and payment tests plus the initial 8
dashboard cases.

```text
pnpm exec node node_modules/vitest/vitest.mjs run tests/integration/services/dashboard.test.ts
```

The final expanded dashboard suite passed 10 / 10 tests in 23.62 seconds. It
covers fee cohort versus cash dates; legacy PAID/WAIVED and partial void math;
timezone/deadline boundaries; configured versus unknown expectations; task and
follow-up persistence; independent nonoverlapping terms; prospective immutable
occupancy; stable personal reminders; tenant-safe foreign/missing responses;
restricted/read-only access; and actual PostgreSQL recovery from `SELECT 1 / 0`
inside the chart source savepoint while other sources continue within one
RepeatableRead overview transaction.

Early overlapping integration runners were invalid because both reset the same
disposable target. Those failures are superseded by the sole-runner passing
executions above, not treated as passing evidence. Early sandbox browser network
denials and development HMR/manifest failures similarly motivated verification
against the completed production build on localhost.

## Reproduction and visual evidence

See [`tests/dashboard-connected/README.md`](../../tests/dashboard-connected/README.md)
for the guarded bootstrap, seed, actual development authentication, build/server
and Playwright commands. `capture.mjs` captures the real authenticated app at
1491×1055, 390px, 320px and 768px widths, with fonts and dashboard sources loaded.
The optional informational trial reminder is dismissed through its normal
session-only control; no entitlement or security banner logic is altered.

The final capture command passed in 9.67 seconds:

```text
pnpm exec node tests/dashboard-connected/start-local.mjs capture
```

All dashboard artwork was verified loaded (`complete` and `naturalWidth > 0`),
including lazy artwork scrolled into view, before capture. The final selected
images are saved review evidence. The earlier raw copies under ignored
`test-results/dashboard-connected-review/` were removed by a later Playwright
output cleanup and were not recovered; the selected linked images below remain
present in this checkout:

- [Desktop, 1491×1055](reference-dashboard-evidence/connected/desktop.png).
- 390px mobile: [top](reference-dashboard-evidence/connected/mobile-390.png),
  [middle](reference-dashboard-evidence/connected/mobile-390-middle.png),
  [bottom](reference-dashboard-evidence/connected/mobile-390-bottom.png).
- 320px mobile: [top](reference-dashboard-evidence/connected/mobile-320.png),
  [middle](reference-dashboard-evidence/connected/mobile-320-middle.png),
  [bottom](reference-dashboard-evidence/connected/mobile-320-bottom.png).
- 768px tablet: [top](reference-dashboard-evidence/connected/tablet.png),
  [middle](reference-dashboard-evidence/connected/tablet-middle.png),
  [bottom](reference-dashboard-evidence/connected/tablet-bottom.png).

These show the actual application after the tested mutations, including truthful
activity history. Screenshot comparison and owner acceptance are separate from
the functional test results.

For this checkout, `pnpm exec node tests/dashboard-connected/start-local.mjs`
restarts only the exact verified disposable container/application. Private local
configuration is under ignored `.clerk/`; it includes no password. The helper
refuses a changed container ID, image, port binding or database identity. The
`test`, `capture` and `counts` subcommands reuse those same checks. It never
loads an unverified `.env.test` database or changes persistent app environment.

The final aggregate-count command passed in 1.33 seconds:

```text
pnpm exec node tests/dashboard-connected/start-local.mjs counts
```

It enforces a read-only transaction and prints only aggregate counts. The final
target retained 80 public tables, 53 applied migrations, 3 synthetic users,
3 organizations, 4 branches, 8 students, 16 seats, 3 shifts and 5 fees. It had
19 live receipts and 3 voided verification receipts, 10 tasks, 5 membership
terms, 32 prospective events, 21 occupancy snapshots, 2 unresolved follow-ups
and 6 attendance expectations. The original balance was restored: **₹4,300
billed, ₹1,900 collected and ₹2,400 pending**. The two additional terms are
future terms outside the initial upcoming-renewal window.

For an interactive owner review after starting the guarded local server:

```text
pnpm exec node tests/dashboard-connected/open-preview.mjs
```

This uses the ignored real development-owner session; no auth state or ticket
is copied into the evidence folder.

## Connected coverage checklist

The Playwright suite uses real Clerk development sessions, normal middleware,
actual Next route handlers and PostgreSQL persistence. It contains nine cases:

1. Dashboard aggregate and complete fee/capacity/attendance agreement; empty and
   unconfigured branch sources.
2. Persisted task completion, follow-up completion/reopening and personal
   notification read/snooze state; no fee settlement from contact work.
3. Foreign/missing branch and child equivalence, read-only mutation rejection,
   branch-scoped search and report authorization.
4. Twelve actual page destinations, three persisted interface languages, no
   uncaught page errors, and desktop/mobile/tablet rendering.
5. Live chart period changes, all seating tabs, seat details, top-search result
   navigation and branch switching.
6. A second real restricted staff session: no payment/follow-up data, no task
   writes, no financial report and no restricted notification counters.
7. Actual task and follow-up forms, reload persistence, notification bulk
   acknowledgement, filtered CSV content and download.
8. Advisory threshold, attendance expectations and independent membership term
   forms; read-only task control.
9. Actual collection API retry idempotency, one immutable receipt, owner void
   recovery and restoration of the original dashboard balance.

Routes opened in case 4 are the branch dashboard, Follow-ups, Tasks, Exports &
Reports, Dashboard setup, Students, Seats, Attendance, Shifts, Payments,
Renewals & dues and Allocations. The final run command is:

```text
pnpm exec node tests/dashboard-connected/start-local.mjs test
```

Final result: **9 passed (2.7m), exit 0**. Individual case times were 12.4s,
22.2s, 26.2s, 31.6s, 11.1s, 15.3s, 15.0s, 8.3s and 17.6s respectively. The
final production build had passed compilation, TypeScript, all 74 static pages
and both Workflow manifest checks before this run; see the separate
[build validation](reference-dashboard-build-validation.md).

Intermediate built-app run: five completed cases passed; the chart case's first
exact implicit-label locator timed out, and the run was stopped during later
form verification to bound selector failures. A focused four-case rerun passed
collection retry/void recovery and exposed three remaining UI synchronization
or implicit-label assertions. A separate read-only reproduction confirmed
historical chart requests returned the selected month and setup tabs retained
their selected section. Final tests wait for source/save completion and use
the actual accessible control names. These intermediate runs are not represented
as a complete passing suite.

The next complete built-app run passed seven cases. The two remaining cases
were narrowed without force-clicking or dropping assertions. Corrections waited
for real development-auth identity after full navigation, selected the visible
responsive student row, waited for dialog entrance/save completion and checked
the actual PATCH response. Background authentication traffic made `networkidle`
an unsuitable readiness signal. Separate fixture tracing also recorded
`ERR_NETWORK_IO_SUSPENDED` and a 187-second browser stall; unchanged focused
checks recovered after the local browser environment resumed.

The connected form sequence exposed an actual notification freshness defect:
after updating a follow-up, the header still held the prior condition key and
bulk acknowledgement correctly received a stale-key refusal. The completed UI
repair refreshes when opening notifications and blocks acknowledgements until
that refresh completes. It preserves the backend refusal rather than treating
a changed unseen condition as already read. Final case 7 passed the complete
save-follow-up → open alerts → acknowledge → filtered CSV sequence, including
an unread count of zero after acknowledging the refreshed conditions.

The application also now waits for Clerk identity readiness before rendering
branch forms. This prevents an early form from being lost when the existing
identity-keyed preferences provider resets during initial authentication
hydration. The identity reset and server authorization boundaries remain intact;
public pages are unchanged. Final navigation and form checks passed with this
repair. Temporary DOM/navigation diagnostics were removed from the test code.

The two intermediate browser commands were:

```text
pnpm exec node node_modules/@playwright/test/cli.js test --config tests/dashboard-connected/playwright.config.ts
pnpm exec node node_modules/@playwright/test/cli.js test --config tests/dashboard-connected/playwright.config.ts --grep "real chart periods|real task and follow-up|actual setup controls|actual collection retries"
```
