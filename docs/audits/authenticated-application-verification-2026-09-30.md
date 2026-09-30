# Lab Lords authenticated application verification — 30 September 2026

This record continues the [per-finding tracker](remediation-tracker-2026-09-29.md)
and [connected PostgreSQL record](connected-verification-2026-09-30.md).
Starting branch was `codex/audit-remediation-2026-09-29` at
`b6cd8bb4d7abdd8cf567a4dc36032d3b01f387c6`, with only the earlier
untracked audit report and its evidence in the working tree. No Production,
Preview or shared database, billing, Meta delivery, Gemini generation,
customer email/SMS, deployment, push or PR is part of these checks.

## Target and authentication preflight

`pnpm exec node tests/dashboard-connected/start-local.mjs counts` exited 0
after its guard reverified pinned container
`14c435177e235c254e58b7b62bfd20eae9818d66f3ebf0720144688db48556d4`
(`postgres:16-alpine`), sole host binding `127.0.0.1:59117`, and exact
synthetic database `lab_lords_dashboard_closeout_browser_test`. Before browser
mutations it had 81 public tables, 54 applied migrations, 3 users,
3 organizations, 4 branches, 8 students, 16 seats, 3 shifts, 5 fees,
19 live and 4 voided collection receipts, and ₹4,300/₹1,900/₹0/₹2,400
billed/collected/waived/pending. Explicitly scoped `prisma migrate status`
exited 0 and reported all 54 migrations applied; none was reapplied.
Read-only fixture inspection matched the saved owner and staff Clerk subjects
to local User rows; the owner controls the fixture organization, and staff
has one STAFF membership with explicit `VIEW_PAYMENTS=false`.

The local app uses `pk_test_`/`sk_test_` Clerk development keys, and the
publishable instance matches the saved state issuer. The earlier owner/staff
session JWTs expired on 28 September. With the user's narrow authorization,
the maintained `tests/dashboard-connected/refresh-auth.mjs` checked each
existing account with Clerk, enforced its synthetic-email allowlist, issued a
short-lived development sign-in ticket, completed the real Clerk client
session and saved new states only at ignored
`.clerk/audit-owner-auth-20260930.json` and
`.clerk/audit-staff-auth-20260930.json`. Both commands exited 0; the old
states were preserved. This is **helper-created real Clerk authentication**
through normal middleware, not a sign-in or MFA UI test. No password, code,
cookie, token or key value was written to this record.

`pnpm exec node tests/dashboard-connected/start-local.mjs` started the built
local Next app at `http://localhost:3117` after the same exact database guard.
It retained normal Clerk authentication, tenant checks, permissions and
entitlements; Razorpay, Meta, Gemini and imports were held. Port 3117 had no
listener before the start. The first JavaScript-enabled, real-application
smoke used the maintained Playwright test with
`--grep 'actual onboarding validates its first step without creating a workspace or import'`
and unique output `.clerk/audit-browser-runs/20260930-baseline-auth`.
It exited 0 (desktop 1/1, no skips), reached the protected onboarding page,
made no onboarding POST, and found unchanged database counts on the guarded
read-only post-check. The full command used
`tests/dashboard-connected/playwright.config.ts`, the new ignored owner state,
explicit loopback `TEST_DATABASE_URL` and exact
`TEST_DATABASE_RESET_CONFIRM`; it did not invoke integration reset.

## Evidence preservation

Before the new run, `test-results/dashboard-connected-review/`,
`test-results/dashboard-connected/`, `test-results/dashboard-build.log` and
`test-results/batch-two-offline-build.mjs` were absent after the earlier
Playwright output cleanup. Their prior raw contents were not recovered.
Selected linked screenshots under
`docs/redesign/reference-dashboard-evidence/connected/` and the earlier
untracked audit `build.log` were present. This correction is recorded in
`docs/redesign/reference-dashboard-connected-validation.md` and the prior
connected record. New acceptance output uses a fresh run ID under ignored
`.clerk/audit-browser-runs/`; the guarded audit runner refuses an existing
output directory and does not commit authentication state or traces.

## PS-01 external boundary

No existing local application environment file or process had a
`NEXT_PUBLIC_GA_MEASUREMENT_ID` assignment, and read-only browser-tab
inventory found no already-authorized Google Analytics owner session. The
actual property web-stream settings and provider receipt remain open.

A separate exact-fixture server process forced only the synthetic
`G-0000000000` ID, and a fresh browser context installed deny-by-default
network interception before its first navigation. Only the exact Google tag
and configuration reads and required Clerk development origin could egress;
Google measurement attempts were captured and aborted before egress. Fresh
desktop `20260930-ga-d6c18` and mobile `20260930-ga-m5e27` each exited 0,
1/1 passed, no skips. Each observed five tag-script HTTP 200 responses and
12 generated Google collect attempts across public unknown, rejected and
accepted consent and full-document public→private→public transitions.
Raw, percent-encoded and double-decoded synthetic invite markers were absent
from the captured Google URL, request body and Referer fields. No collect
request reached Google and no real invitation token was used. The ignored
private runs retain full captured traffic; committed evidence contains only
sanitized counts. Full-document navigation does not prove client-side SPA
history measurement, and the synthetic ID cannot establish actual GA
Enhanced Measurement settings or provider receipt. The real property
boundary stays open. The server was then restarted with the GA ID blank.

## Authenticated operations journeys

The audit runner's first operations invocation (`20260930-ops-desktop-a1`)
failed before a spec body or database mutation: Playwright re-imported its
configuration after creating its output directory, so a duplicate directory
check in that configuration rejected the worker. The check now runs only in
`start-local.mjs`, before Playwright launches. The failed output was retained;
the guarded post-check found the fixture unchanged.

Fresh desktop run `20260930-ops-desktop-a2` exited 0 with 2/2 passing and no
skips. OPS-04 inserted only two same-name synthetic students, one seat, one
two-component bundle and six ended allocation components (three distinct
assignment periods), then used the real authenticated allocation API and
page. The table and grid each showed three separate history groups; the
selected component stayed highlighted through reload and a 390px viewport.
Its scoped before/during/after counts were students 8/10/8, seats 16/17/16,
bundles 0/1/0, components 0/2/0 and allocations 6/12/6; membership terms
and payments remained 6 and 5. The synthetic rows were removed by exact IDs
in `finally`. Screenshots and scoped count JSON are preserved under the
unique ignored run directory.

OPS-09 used the real restricted staff Clerk session, with `students=true`,
`manage_branch=false` and `view_payments=false`. Its renewal notification
linked to the terms section while already on dashboard settings, the terms
tab became active, management controls stayed disabled, and a direct term
POST returned 403 with six terms before and after. The fresh mobile run
`20260930-ops-mobile-a1` exited 0 with OPS-09 1/1 passing and one intentional
OPS-04 project skip; OPS-04's desktop case itself checked the 390px layout.
No provider was called.

The expanded operations desktop `20260930-ops-desktop-a5` exited 0 with
5/5 applicable cases passing and one intentional mobile-only skip. A real
allocation-only staff context (`students=false`, `seat_allocation=true`)
received only active same-branch ID/name selector entries, while the student
directory stayed 403; the allocation dialog suppressed fee linking, excluded
an inactive-component bundle and showed the all-component seat conflict for
the valid bundle. A separate restricted staff deactivation dialog defaulted
to KEEP, offered permitted cash collection, omitted WAIVED, and a forged
WAIVED PATCH returned 403 without changing student, fee or resolution-event
state. Its unique synthetic students, bundle, shift, seat and allocation and
temporary permission overrides were restored.

OPS-08 seeded exactly 505 unique students, 504 expectations and 502 terms,
reached the final terms, independent student selector and expectations pages
through the real setup UI, checked a distant focused student through the
real API and a 390px final-page layout, then deleted only its generated IDs.
Scoped students were 8/513/8, expectations 6/510/6 and terms 6/508/6
before/during/after; other scoped counts and `Branch.lastDataChange` were
restored. The first two expanded desktop attempts (`a3`, `a4`) each reached
the distant pages and cleaned up but failed on test-only text/role locators;
their outputs remain separate, and `a5` is the passing replacement.

Mobile run `20260930-ops-mobile-a2` exited 0 with 2/2 applicable cases
passing and four intentional desktop-only skips. OPS-09 passed again; OPS-06
edited an imported, null-phone synthetic student's name through the real
mobile form, reloaded and preserved `phone=null`. Its scoped row and branch
timestamp were restored. OPS-03's partial-failure dialog/reload still has
only the prior real PostgreSQL service proof; no new browser case is claimed.

## Authenticated finance journeys

Guarded runs `20260930-finance-desktop-01` and
`20260930-finance-mobile-01` each exited 0 with 3/3 passing, no skips. The
staff case used the separate real development-authenticated staff context. It
temporarily granted finance and then persisted `VIEW_PAYMENTS=false` while
retaining analytics permission: the actual branch snapshot and dashboard
returned operational data but omitted finance, payment trends and payment
records were denied, and previously visible revenue cleared from the page
before its delayed genuine snapshot response arrived. The payment permission
and temporary analytics override were restored in `finally`.

The owner case checked actual rendered monthly billable/collected amounts,
the collected daily trend and the retained ledger-backed partial receipt
(₹700 collected, ₹0 waived, ₹500 remaining). It was read-only. This browser
case does **not** establish the waiver chart arithmetic: the earlier
PostgreSQL service suite supplies that layer's evidence.

For MONEY-04, each run created 52 unique synthetic students and corresponding
due rows solely to exercise the 50-row cursor. Chromium paused completed
localhost payment responses at the response stage, then released stale tab,
month and load-more responses after the current view changed; the page kept
the active rows/counts. A completed refresh response was interrupted, the
actual error appeared, and retry recovered. No API success was replaced by a
mock. The 52 rows were removed by exact IDs in `finally`. The guarded
post-count after each project matched the preflight fixture exactly: 81
tables, 54 migrations, 3 users, 3 organizations, 4 branches, 8 students, 5
fees, 19 live/4 voided receipts, and ₹4,300/₹1,900/₹0/₹2,400
billed/collected/waived/pending. Raw JSON results are in each unique ignored
run directory.

After LEAD-01 retained two more synthetic workspaces, MONEY-01 gained a
same-staff branch transition to the second existing owner branch, where that
staff user has no membership. Final guarded finance runs
`20260930-finance-desktop-03` and `20260930-finance-mobile-03` each exited 0,
3/3 passed, no skips: the foreign branch page showed no access or stale
finance; the access and analytics snapshot APIs returned 404; returning to
the allowed branch restored operational analytics without finance. Its
temporary overrides and MONEY-04 rows were again fully restored. Current
post-counts were 5 organizations/6 branches/8 students/20 seats/9 shifts,
with fee and receipt totals unchanged. The superseded mobile `-02` run had a
setup-stage authenticated profile request timeout before MONEY-01 assertions;
the other two cases passed. Its ignored raw runner artifact may include auth
headers and must not be published or staged. The request helper now bounds
and sanitizes transport failures, and the final `-03` console logs were
redirected to unique ignored private files; only status/count summaries were
reported.

## Authenticated onboarding replay

After the finance runs, the guarded local server was restarted with the
exact-database `DASHBOARD_AUDIT_ONBOARDING_CONFIRM` opt-in. It enabled only
the local synthetic onboarding path; billing/provider writes, import,
messaging and AI remained held. Fresh desktop run
`20260930-lead-c61f4` and mobile run `20260930-lead-m3d92` each exited 0
with 1/1 passing and no skips. The first real onboarding POST returned 201
and its receipt/result were read from the local PostgreSQL fixture before
the browser response was aborted. Reload made no duplicate POST. A separate
real staff Clerk context inherited only the owner's non-secret pending
command, did not submit it automatically, and received 409 on an explicit
stale owner-header request. The owner retried the exact key and body, received
the original organization/branch IDs, and left the lifetime trial unchanged.

Exact guarded fixture counts before, after desktop and after mobile were:
organizations 3/4/5, branches 4/5/6, seats 16/18/20 and shifts 3/6/9.
Onboarding receipts rose 0/1/2; owner trial grants stayed 1 and billing
changes/provider actions stayed 0. Billed/collected/pending rupees stayed
₹4,300/₹1,900/₹2,400. The two synthetic organizations, branches and
receipts remain as durable replay evidence; receipt foreign keys prevent a
casual deletion. The onboarding form also updated only the synthetic owner's
phone to its test value. Each unique ignored output holds `results.json`;
the recovery-command backup was removed after full replay assertions passed.
This authenticates through a helper-created Clerk development session, not
the sign-in/MFA UI.

## Authenticated messaging boundary

The guarded server was restarted with
`DASHBOARD_AUDIT_MESSAGING_CONFIRM=lab_lords_dashboard_closeout_browser_test`.
Only the exact pinned loopback fixture could enable local TEST-mode messaging
panels; Meta credentials, message/template/onboarding provider writes,
webhook ingestion, planners, reconciliation and live canaries stayed held.
Fresh desktop `20260930-im-d7c42` and mobile `20260930-im-m8a31` each exited
0 with 2/2 passing and no skips.

IM-02 used independent real owner/staff Clerk contexts. The owner temporarily
granted only `manage_whatsapp` to the existing STAFF user through the actual
staff API, then restored the prior override. With reports still denied, that
staff user's branch page loaded the service-notice and incident endpoints and
panels; the direct report-subscription GET returned 404, and the browser did
not load a report panel. Owner-only branch settings stayed unavailable. The
owner organization page kept its operations/report panels visible when a
genuine report-subscription GET returned 200 to the server and its browser
response was then interrupted. An actual history GET showed an empty state,
an interrupted real 200 history response showed unavailable, and reload
recovered empty. No app API response was replaced with fake success.

Each test recorded identical before/after scoped counts: zero senders,
subscriptions, report snapshots, messages, notices, incidents and drafts;
one staff permission override. No message or provider request was sent.
The zero-source conditions of these original IM-02/03 runs still limit their
proof: nonempty notice/incident content and nonempty submitted report
history lack an authenticated browser case. Their prior
unit and real PostgreSQL service evidence remains the applicable proof. No
provider history was fabricated.

For IM-01, fresh mobile run `20260930-im-pause-m2` exited 0 with 3/3 passing
and no skips, including the two earlier IM-02/03 cases. The new case inserted
one explicitly synthetic TEST-mode sender, consent and owner-scoped ACTIVE
branch report subscription as a local prerequisite. The authenticated owner
used the real mobile `Pause reports` control; its actual local POST returned
200, changed only that subscription to PAUSED and created one scoped audit
event. The button disappeared, a reissue control appeared, and reload kept
the paused state. The scoped branch delivery settings row was unchanged;
there were no report or other messages to cancel. The test deleted
the exact synthetic sender, consent, subscription and audit event IDs in
`finally`. Its scoped before/after counts both show zero senders, consents,
subscriptions, audit events, snapshots, messages, notices, incidents and
drafts, with one unchanged staff override. Browser provider attempts were
zero. This verifies the pause UI and route, not real phone confirmation or
Meta delivery. The earlier `20260930-im-pause-m1` exited 1: its same two
existing cases passed, but the new case stopped on a missing raw-SQL
`updatedAt` fixture value before inserting a sender or calling Pause. Its
`finally` record also shows identical scoped before/after counts and zero
provider attempts. That private failed-run output remains historical; the
inserts were corrected before `m2`.

The final mobile sender-safety extension, `20260930-im-safety-m4`, exited 0
with 3/3 passing and no skips. While the same synthetic TEST sender existed,
the authenticated owner organization page loaded its actual sender-safety
GET (200). A genuine report-subscription GET reached the server (200) before
its browser response was interrupted; the sender-safety and incidents panels
remained visible while the report-recipient panel was absent. The local
safety GET showed the sender as ACTIVE, with no pause or unknown/critical
outcome, and created no safety-state row. The same run then completed the
real branch report-only pause POST (200) and reload checks. Its exact-ID
cleanup restored the scoped counts to zero senders, consents,
subscriptions, safety states, audit events, snapshots, messages, notices,
incidents and drafts, with the staff override still one. The browser blocked
one unrelated read-only `checkout.razorpay.com/v1/checkout.js` script request
mounted by organization settings. It recorded zero Meta/Gemini attempts,
provider-write attempts and unexpected business endpoints; nothing reached
those external providers. This extends IM-02 to authenticated sender-safety
content under a failed report read, but does not prove real Meta health,
provider delivery or nonempty notice/incident content. The preceding
`20260930-im-safety-m3` exited 1 after its safety GET and interrupted report
GET both returned 200: an overly broad assertion counted the blocked
Razorpay script as a messaging provider attempt before reaching Pause.
Its exact synthetic cleanup returned every scoped count to baseline, with
zero safety states. The private failed-run output is retained separately.

For IM-04, fresh `20260930-im04-d1` desktop and `20260930-im04-m1` mobile
each exited 0 with 1/1 passing and no skips. In each run, the authenticated
owner saw one locally seeded overdue student, payment and current-source
cached draft through the real GET and page. Copy wrote the exact reviewed
text to the browser clipboard. A real PostgreSQL fee amount change made that
same stored draft outdated: the next GET omitted its message, the page
disabled Copy, double-click did not replace the clipboard sentinel, and
reload kept the stale text hidden. No generation POST or provider request
occurred, and no Gemini response or externally sent message was involved.
Exact-ID cleanup restored the branch AI setting and metadata. Each scoped
before/after record shows 8 students, 5 payments, zero drafts, reports and
generation leases, 17 audit logs and 36 dashboard events; branch metadata
matched its pre-run values. This verifies authenticated review/copy and stale
copy blocking of cached text. Live Gemini generation remains outside this
boundary and is covered only by the earlier fake-provider service tests.
Each fresh ignored run directory holds its Playwright `results.json`, scoped
before/after counts, and, for IM-04, current/outdated page screenshots.

## Partial allocation failure and Hindi navigation

The final expanded operations desktop run `20260930-ops-desktop-a8` exited 0
with 7/7 applicable cases passing and one intentional mobile-only skip.
The fresh mobile `20260930-ops-mobile-a3` exited 0 with 2/2 applicable cases
passing and six intentional desktop-only skips. The new OPS-03 case used a
unique student and seats. A real staff seat move committed one allocation
PATCH; the test revoked only `STUDENTS` permission before continuing the
optional fee PATCH, so the real server returned 403. The UI retained the
committed move and offered fee-only retry. After permission restoration, a
second fee PATCH succeeded with **no second allocation PATCH**; reload showed
the active replacement. The 8/9/8 scoped student, 16/18/16 seat and 6/8/6
allocation counts, staff override and branch timestamp were restored. This
does not test the separately recorded lost *first* allocation response.

In a Hindi preference, the same restricted staff account followed a real
renewal notification from expectations to terms on the same route; the terms
tab activated and management remained disabled. The synthetic user's
interface language was restored `en→hi→en`, and term count stayed six.
Desktop attempts `a6` and `a7` already established the real move/fee sequence
but failed only at a final reload DOM locator tied to the ended allocation
group; both cleaned the fixture. The final `a8` assertion used the visible
unique student/new-seat row. Those earlier outputs are retained separately.

The final guarded admission desktop run `20260930-ops-desktop-a11` exited 0
with 7/7 applicable cases passing and the expected mobile-only skip. Its
owner Add Student form selected a complete Morning/Afternoon bundle; the
real SeatPicker requested the seat map with that bundle's `multiShiftId`,
received 200 and disabled a seat occupied only in Afternoon. The dialog was
canceled, so no student was created. Scoped branch counts returned to eight
students, 16 seats, three shifts, zero multi-shifts/components, six
allocations, six expectations, six terms and five fees; the foreign branch
student count and staff `STUDENTS` override were also restored. Earlier `a9`
encountered transient Chromium localhost name resolution and `a10` hit a
pointer/layout race on the expanding admission checkbox before the picker;
their private outputs and cleanup evidence were preserved. The final test
used accessible keyboard activation while retaining a checked-state
assertion and the original bundle availability assertions.

## Final validation and fixture state

Every new connected spec used `pnpm exec node
tests/dashboard-connected/start-local.mjs audit-test <spec> <project>` with its
listed fresh run ID, the exact local `TEST_DATABASE_URL` and matching
`TEST_DATABASE_RESET_CONFIRM`, and the two ignored Clerk development storage
states. The [runner instructions](../../tests/dashboard-connected/README.md)
name the required server opt-ins. Run artifacts remain under ignored
`.clerk/audit-browser-runs/`; private console logs and auth states also remain
under ignored `.clerk/`. The latest passing
messaging run is `20260930-im-safety-m4`; the earlier failed runs remain distinct
and were not relabelled as passes.

`pnpm exec node node_modules/vitest/vitest.mjs run --config
vitest.unit.safe.config.ts` exited 0 with 288 files and 2,062 tests after the
application fixes. `pnpm exec tsc --noEmit --incremental false` exited 0 after
the final browser specs. `pnpm lint` exited 0 with only three existing/generated
warnings. `pnpm exec node scripts/verify-offline-build.mjs` exited 0 with the
optimized Next build, 74 static pages and two Workflow manifest entries; the
subsequent edits were browser tests and evidence only. `git diff --check`
exited 0. No broad database suite or truncating integration setup was rerun
for these test-only additions.

The final guarded `start-local.mjs counts` exited 0 after the browser server
was stopped: 81 public tables, 54 applied migrations, 3 users, 5 organizations,
6 branches, 8 students, 20 seats, 9 shifts, 5 fees, 19 live and 4 voided
receipts, and ₹4,300 billed/₹1,900 collected/₹0 waived/₹2,400 pending. The
two new onboarding workspaces and receipts are intentionally retained;
temporary finance, operations, messaging and draft rows were removed by ID.
No schema or migration was changed in this continuation, and no Production
migration or deployment was authorized.
