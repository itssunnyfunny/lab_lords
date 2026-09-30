# Lab Lords remediation connected verification — 30 September 2026

This is local synthetic verification of the 23-finding remediation branch, not
Production, Preview, shared-database, real-provider, or release evidence. The
starting branch was `codex/audit-remediation-2026-09-29` at
`560a80fbc7f326228ec81bed39180c769aa668a7`. The prior untracked audit
report and evidence were kept out of all commits.

## Exact local database targets and preflight

Sandboxed `docker context ls` and `docker version` failed with access denied to
the Docker config/pipe. There were no `DOCKER_HOST`, `DOCKER_CONTEXT`, or
`DOCKER_CONFIG` process overrides. Read-only CLI inspection with filesystem
escalation showed Docker Desktop 4.85.0, active `desktop-linux` context, and
engine 29.6.2. Thus the initial CLI failure was execution access, not proof
that Desktop was stopped. The unrelated running `lab_lords` container bound to
all interfaces on port 5432 was not used.

The repository-pinned disposable container
`lab-lords-dashboard-test-20260928` has exact ID
`14c435177e235c254e58b7b62bfd20eae9818d66f3ebf0720144688db48556d4`,
image `postgres:16-alpine`, and sole host binding `127.0.0.1:59117` to
container port 5432. `pnpm exec node tests/dashboard-connected/start-local.mjs
counts` checked those attributes against ignored local fixture metadata,
started this existing stopped container, checked the connected database name,
and selected only aggregate counts. Its existing
`lab_lords_dashboard_closeout_browser_test` database was documented synthetic
fixture data; it was not used by the truncating integration runner.

For integration, a separate name `lab_lords_audit_20260930_test` was first
confirmed absent within that exact container (`pg_database` count 0), then
created from `template0`. A container-side and a host-side SELECT each confirmed
the exact connected name and zero public tables. Every Vitest integration
invocation explicitly set:

```powershell
$env:TEST_DATABASE_URL='postgresql://postgres@127.0.0.1:59117/lab_lords_audit_20260930_test'
$env:TEST_DATABASE_RESET_CONFIRM='lab_lords_audit_20260930_test'
```

The inspected `tests/setup/global.ts` chooses this explicit URL over `.env.test`;
`tests/setup/testDatabaseSafety.ts` requires loopback, a test-named database,
and exact reset confirmation. `resetDatabase()` truncates this new isolated
database before each service test. No shared, Preview, or Production target was
contacted. The original `.env.test` and the unrelated port-5432 container were
not used.

## LEAD-01 migration and retention evidence

With the isolated integration target bound as above,
`pnpm exec node node_modules/vitest/vitest.mjs run --config vitest.config.ts
tests/integration/services/onboarding-migration.test.ts` passed 5/5. It applied
the additive SQL to temporary synthetic pre-change schemas, preserved their
two users, two organizations and two branches, enforced owner/key uniqueness,
matching branch/organization identity and restrictive deletion, then removed
all temporary schemas. Post-test public tables and temporary schemas were both
zero.

On the empty integration database,
`pnpm exec node scripts/bootstrap-isolated-database.mjs` passed with explicit
`BOOTSTRAP_DATABASE_URL` and matching `BOOTSTRAP_DATABASE_CONFIRM` bound to the
same URL/name. Fresh bootstrap installed all 54 maintained migrations and 81
public tables, with zero unvalidated constraints and zero application users,
organizations, branches, students, payments, collections, onboarding receipts,
billing changes, drafts, WhatsApp messages and import sessions. `pnpm exec node
node_modules/prisma/build/index.js migrate status`, with `DATABASE_URL` and
`DIRECT_URL` explicitly bound to this same target, exited 0 and reported the
schema up to date. The real service suite
`tests/integration/services/onboarding.test.ts` passed 19/19, covering replay,
concurrent commands, changed payload, distinct keys, owner scope, rollback,
trial uniqueness, replay after subsequent business changes, and replay after
the supported branch archival flow. Its final
synthetic case left one user, organization, branch, owner trial and receipt;
the other sampled application tables remained zero. The next suite reset only
this isolated database.

For an actual pre-change fixture upgrade, the pinned browser fixture initially
had 80 public tables and 53 applied migrations, with 3 users, 3 organizations,
4 branches, 8 students, 16 seats, 3 shifts, 5 fees, 19 live and 4 voided
collection receipts. Its financial totals were ₹4,300 billed, ₹1,900 collected,
₹0 waived and ₹2,400 pending. Prisma status identified exactly one pending
migration, `20260929120000_onboarding_request_receipts`. With `DATABASE_URL` and
`DIRECT_URL` explicitly bound to this fixture, `pnpm exec node
node_modules/prisma/build/index.js migrate deploy` exited 0 and applied only
that migration. The guarded counts runner then reported 81 tables and 54
migrations; every listed application count and financial total was unchanged.
The new receipt table had zero rows, zero constraints were unvalidated, and
Prisma status exited 0/up to date. The additive schema and synthetic fixture
were retained; no down migration, cleanup of historical records, or release
operation was attempted.

## Focused real-PostgreSQL scenarios

All commands below used the explicit isolated integration environment above,
Vitest's maintained `vitest.config.ts`, and fake provider adapters where a
provider response was needed. Each file's `resetDatabase()` ran only in the
new audit test database.

| Command suffix after `pnpm exec node node_modules/vitest/vitest.mjs run --config vitest.config.ts` | Result | Scope |
| --- | --- | --- |
| `tests/integration/services/onboarding.test.ts` | 19/19 passed | LEAD-01 service replay, trial, supported branch archival and rollback |
| `tests/integration/services/draft-publication-fence.test.ts` | 11/11 passed | IM-04 unchanged, partial collection, waiver, new monthly due, owner void, NOWAIT, lease takeover, rollback, bulk linked-student fee update and two local-midnight transitions; fake Gemini |
| `tests/integration/analytics/payment.analytics.test.ts` | 9/9 passed | Persisted payment-view denial and operational analytics, direct routes, financial/seat aggregates |
| `tests/integration/services/billing-cancellation-undo-race.test.ts` | 4/4 passed | MONEY-05 direct/generic Undo-wins and worker-wins, exact change, provider-action admission/finalization, fake Razorpay |
| `tests/integration/services/payment.test.ts tests/integration/services/fee-collection.test.ts tests/integration/services/renewals.test.ts tests/integration/services/access-policy.test.ts tests/integration/services/entitlement.test.ts` | 5 files, 89/89 passed | Connected payment, collection, renewal and access services |
| `tests/integration/services/student.test.ts tests/integration/services/seatAllocation.test.ts tests/integration/services/multiShift.test.ts tests/integration/services/seat.test.ts tests/integration/services/shift.test.ts tests/integration/services/allocation-tenancy.test.ts tests/integration/services/dashboard.test.ts` | 7 files, 119/119 passed | Connected student, admission/allocation, bundle and dashboard services |
| `tests/integration/services/whatsapp-report-pause-scope.test.ts` | 1/1 passed | Report-only pause releases only target unsubmitted reservations; another recipient's report, reminder, notice, settings and actor-scoped persisted history remain; no Meta client |
| `tests/integration/services/dashboard-setup-pagination.test.ts tests/integration/services/allocation-remediation-saved-state.test.ts` | 2 files, 4/4 passed | OPS-08 persisted >500 independent pages and distant student, OPS-01/02/07 saved bundle/role decisions |
| `tests/integration/services/whatsapp-foundation.test.ts tests/integration/services/whatsapp-daily-reports.test.ts tests/integration/services/whatsapp-inbound-identity.test.ts tests/integration/services/whatsapp-payment-reconciliation.test.ts tests/integration/services/whatsapp-delivery.test.ts` | 5 files, 18/18 passed | Existing connected messaging foundations, daily reports, inbound identity, collection reconciliation and fake-provider delivery |
| `tests/integration/services/billing-mutation.test.ts tests/integration/services/billing-provider-action.test.ts tests/integration/services/billing-deadline.test.ts tests/integration/services/billing.test.ts` | 4 files, 150/150 passed | Neighboring billing mutation, provider-action, deadline and subscription paths with test provider clients |
| `tests/integration/analytics/payment-financials.test.ts` | 2/2 passed | MONEY-02 daily point cutoff versus full-month summary; MONEY-03 partial receipt, waiver, void and recollection arithmetic |
| `tests/integration/api/tenant-denial.routes.test.ts` | 2/2 passed | MONEY-06 and LEAD-02 persisted foreign/missing 404 parity with authorized controls |
| `tests/integration/services/student-remediation-saved-state.test.ts` | 3/3 passed | OPS-03/05/06 saved move after fee denial, STAFF KEEP ledger and imported null-phone edit |

The inspection sampled User (U), Organization (O), Branch (B), Student (S),
Payment (P), FeeCollection (C), OnboardingRequest (R), OwnerTrialGrant (T),
OrganizationBillingChange (G), BillingProviderAction (A), MessageDraft (D),
WhatsAppMessage (W), and ImportSession (I). Values omitted from a row were zero
among these sampled tables, not necessarily in every database table. The
database began with zero public tables. After bootstrap it had 81 public
tables, 54 migrations, and zero in all sampled application tables. Maintained
fixtures reset the isolated database before each test case; the table records
the post-suite snapshot of the *last* case, before the next suite reset it.
These are not cumulative counts.

| Completed connected check | Sampled post-suite counts |
| --- | --- |
| Onboarding 19/19 | U1 O1 B1 R1 T1 |
| Initial IM-04 8/8, then expanded final 11/11 | U1 O1 B1 S2 P2 D2 G1 |
| Payment analytics 9/9 | U1 O1 B1 S1 P1 G1 |
| MONEY-05 observer/fix exploration and final 4/4 | U1 O1 B1 G3 A1 |
| Payment/collection/renewal/access/entitlement 89/89 | U1 O1 B1 S1 P2 C1 |
| Operations services 119/119 | U1 O1 B1 S1 T1 |
| Report-only pause/history 1/1 | U2 O1 B1 G1 W6 |
| OPS setup paging and allocation 4/4 | U2 O2 B2 S506 T1; additionally 505 expectations and 503 membership terms |
| Messaging services 18/18 | U3 O1 B1 |
| Billing services 150/150 | U1 O1 G1 A1 |
| Financial arithmetic 2/2 | U1 O1 B1 S1 P1 C2 |
| Tenant denial 2/2 | U2 O2 B2 G1 |
| Student saved state 3/3 | U2 O1 B1 S1 T1 |

The first failed OPS setup assertion run ended U3 O2 B2 S3 T1, with zero
expectations and terms. Its corrected final 4/4 run ended with the >500-row
fixture above. Every failed exploratory MONEY-05 race run was also restricted
to this same audit database; sampled post-state was U1 O1 B1 G3 A1. The
maintained migration test's temporary schemas were removed, leaving public
tables zero before bootstrap. The original browser fixture was never reset;
its separate pre/post upgrade counts are recorded above.

The added branch-archival case in `4cd8fd1` was first run alone and passed
1/1. Immediately before it, sampled counts were U2 O1 B1 T1 R0 G0. The
supported `createBranchForOrg` → `scheduleBillingRemoval` → provider-free
`archiveDueBillingRemovals` sequence and same-key replay left U1 O1 B2
(one archived) T1 R1 G2, with no duplicate workspace or trial. The full
19-case onboarding file then passed; its final case left U1 O1 B1 (none
archived) T1 R1 G0. No receipt was deleted or rewritten.

The first MONEY-05 race run failed 4/4 because its test observer held a stale
PostgreSQL statistics snapshot. Refreshing the observer exposed a second
soft-lock queue edge; the refined observer required both waiters and a direct
edge to the known holder. The third run passed three cases and found a real
direct-Undo defect: worker-admitted `PROCESSING` cancellation returned not
found, rather than an in-progress conflict. The in-scope service candidate
lookup now includes `PROCESSING` under the owner lock. The final 4/4 run and
the strengthened 7/7 unit suite passed. No real Razorpay call occurred.
The first OPS connected run failed one assertion because the real service used
the more precise text `Seat is already assigned in shift "Evening"`; the test
was tightened to that exact message and both files then passed 4/4. No product
behavior was weakened for that test.

## Browser evidence and limits

The isolated Vite localization suite passed 16/16 Playwright cases. The
application-design pilot suite passed 36 scenarios with 12 intentional
viewport skips after two harness repairs: a Next navigation shim and an
active-ID/name allocation selector response. Its new LEAD-01 case mounted the
real onboarding page with native Chromium Web Locks and a synthetic account;
response loss after mock commit, reload without automatic resubmit, account
switch isolation, same-key/body retry and completed localStorage all passed
on desktop and narrow mobile (2 passed, 2 intentional viewport skips).
These are browser-component tests with mock API/Clerk, not authenticated
PostgreSQL application tests.

The maintained pilot command was `pnpm exec node
node_modules/@playwright/test/cli.js test --config
tests/application-design-pilot/playwright.config.ts` (36 pass, 12 expected
viewport skips). The local public runner used
`PLAYWRIGHT_BASE_URL=http://localhost:3000` with
`tests/browser/public-site.spec.ts tests/browser/public-localization.spec.ts`
and the focused public routes, metadata and localization grep under the local
`.agent/public-offline.playwright.config.ts`; desktop and mobile each passed
5/5. The focused responsive case in `tests/browser/public-billing.spec.ts`
passed 20/20. That ignored `.agent` config set a dedicated output directory
and disabled browser JavaScript; it is local verification infrastructure, not
a committed application change.

The local Next server needed filesystem escalation for Workflow alias
resolution. Public application HTTP then returned 200 for valid/retired
software entries and 404 for `constructor`, `__proto__`, `toString`,
`hasOwnProperty` and an unknown slug. Provider-isolated desktop/mobile
Chromium recorded 22 expected statuses with zero failures and zero non-local
requests. Local evidence is at
`C:\Users\shani yadav\.codex\visualizations\2026\09\29\01a0eb69-3146-7a40-9963-90d6b38d1d26\lab-lords-public-2026-09-30\results.json`.
Maintained static Playwright checks passed 5 desktop, 5 mobile and 20
responsive layout cases; focused public units passed 46/46. Browser JavaScript
was disabled or non-local requests aborted in these public checks. Thus they
prove local HTTP/static rendering and PS-02 404 status, not hydration, Clerk,
analytics network or external provider settings. Screenshots are beside the
JSON evidence. Saved owner/staff Clerk browser sessions expired on
2026-09-28; refreshing them would call a live provider and was not done.
Authenticated desktop/mobile saved-state, second-role and language browser
flows remain unverified. No real invitation token, GA property/network test,
provider mutation, AI call, or customer message was used.

An early maintained Playwright invocation used its default ignored
`test-results` output directory; the runner's normal cleanup removed older
ignored test artifacts there. On 30 September, the earlier raw
`test-results/dashboard-connected-review/`,
`test-results/dashboard-connected/`, `test-results/dashboard-build.log`, and
`test-results/batch-two-offline-build.mjs` were absent; their prior contents
were not recovered. The selected linked screenshots under
`docs/redesign/reference-dashboard-evidence/connected/` and the untracked
audit `build.log` still existed. The pre-existing untracked audit
report/evidence under `docs/audits/` were not changed, and new public results
were preserved in the visualizations path above. Subsequent browser runs used
dedicated output directories.

## Final validation, cleanup and release boundary

After the runtime fix and connected test commits, `pnpm exec node
node_modules/vitest/vitest.mjs run --config vitest.unit.safe.config.ts` exited
0: 288 files and 2,062 tests passed. `pnpm exec tsc --noEmit --incremental
false` exited 0. `pnpm lint` exited 0 with three known warnings in generated
Workflow/coverage files and the older untracked audit validator. The first
`pnpm exec node scripts/verify-offline-build.mjs` attempt failed only because
the sandbox denied the Workflow alias resolver access to a parent directory;
the same inspected command with filesystem access exited 0, compiling 74
static pages and verifying both Workflow manifest entries. The final
LEAD-01 archival test was added after this broad build; its scoped lint,
typecheck, diff check, focused 1/1 PostgreSQL run and full onboarding 19/19
run passed. The documentation-only final diff also passed `git diff --check`.

Immediately before cleanup, the audit database's final sampled counts were
U1 O1 B1 R1 T1 G0 S0; its exact name was confirmed by `current_database()`,
and `pg_stat_activity` showed zero active connections. The pinned container
identity and sole loopback port were reconfirmed. `docker exec
14c435177e235c254e58b7b62bfd20eae9818d66f3ebf0720144688db48556d4
dropdb -U postgres lab_lords_audit_20260930_test` exited 0 without force.
A subsequent `pg_database` query returned only
`lab_lords_dashboard_closeout_browser_test` among the two names. The retained
fixture still had 81 tables, 54 migrations, 3 users, 3 organizations,
4 branches, 8 students, 16 seats, 3 shifts, 5 fees, 19 live and 4 voided
receipts, with ₹4,300 billed, ₹1,900 collected, ₹0 waived and ₹2,400 pending.

LEAD-01 still needs a separate operator-approved database-first release and
replay-preserving rollback; this local application of its migration is not
release approval. No saved environment, dependency, seed, cloud database,
shared database, push, PR, merge or deployment change was made.
