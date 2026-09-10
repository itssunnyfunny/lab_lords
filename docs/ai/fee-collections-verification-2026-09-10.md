# Fee collection verification — 2026-09-10

## Scope and delivered files

- `prisma/schema.prisma` and `20260910120000_fee_collections`: collection and
  allocation records, immutable receipt facts, balance counters, ownership keys,
  positive/balance constraints, immutable evidence and deferred consistency checks.
- `services/feeCollection.service.ts`, collection APIs and shared client helpers:
  transactional collection, selected-dues allocation, permission checks,
  idempotent replay, history, receipt retrieval and owner-only reasoned void.
- `CollectFeeDialog`, `CollectionHistory`, `FeeReceipt`, `feeReceiptPdf` and the
  Payments, Renewals and student screens: partial/full collection, history,
  receipt recovery, print, PDF, device share and summary fallback.
- Existing payment/student writers, analytics, renewal/search readers and
  manual/automated WhatsApp consumers: remaining balances, actual receipts,
  historical/import provenance and voided acknowledgement checks.
- Domain/security/current-state/runbook documentation and relationship coverage
  catalog updated alongside focused integration, unit and browser regressions.

## Isolated verification environment

All database tests used the task-created PostgreSQL 15 container
`lab-lords-fee-collection-test`, bound to `127.0.0.1:55439`, database
`lab_lords_fee_collection_test`. The existing `.env.test` target was not used.
Credentials were generated solely for this disposable database, kept outside
tracked source, and not printed. No shared, Preview or Production database was
accessed. No Production inventory or affected-row count is claimed.

The existing `scripts/bootstrap-isolated-database.mjs` applied all 50 migrations
to the empty local database. A subsequent read-only metadata query confirmed
50 completed migrations. The final fee migration's recorded checksum matches
the file's SHA-256:
`da2187e77871f22a4c83575779b2f2f1010ed5a3dda3837cdcce0c4d23052218`.

Commands below used a local, ignored runtime wrapper to inject the exact verified
test URL and reset confirmation without exposing credentials or changing project
environment configuration. `node_modules/vitest/vitest.mjs run --coverage` is
the same runner/arguments as `pnpm test:coverage` and includes the full `pnpm test`
suite plus the repository's coverage gates.

## Commands and results

- Focused integration/unit run: **6 files, 91 tests passed**, including collection,
  payment/student compatibility, relationship coverage and receipt balance helpers.
- `pnpm exec tsc --noEmit`: **passed** on the final feature source.
- `pnpm test:workflow`: **1 file, 1 test passed**.
- Final full coverage run: **271 files, 2,041 tests passed**, exit 0. Line coverage
  **72.48%** and function coverage **82.62%** both pass the existing 70% gates
  (statements 69.42%, branches 62.61%; neither has a configured threshold).
- `pnpm build`: **passed**, including optimized compilation, TypeScript, page
  generation and verification of both import workflow manifests.
- `pnpm lint`: **passed**, 0 errors; 2 unused-disable warnings in generated
  workflow and coverage JavaScript.
- `git diff --check`: **passed**. Git's Windows line-ending notices are warnings.

Final full-suite command (the wrapper only provides the isolated test environment):

```powershell
pnpm exec node .agent/fee-collection-verification/fee-test-runtime.mjs node_modules/vitest/vitest.mjs run --coverage
```

The earlier full noncoverage run exposed five stale assertions/catalog fixtures;
these were corrected. An intermediate coverage run also discovered a temporary
browser harness under the unit-test glob and one stale report query assertion.
The harness was archived outside test discovery and the assertion updated.
Those failed runs are not presented as successful validation.

## Browser and PDF evidence

The temporary isolated browser harness rendered the actual collection and receipt
components with the application's CSS, mocked collection HTTP responses and the
real jsPDF generator. Playwright passed **2/2 tests** on desktop and mobile:
700 Cash against 1,200; lost-response retry with an identical key/payload; receipt
action failure and retry without another collection; real PDF download; then
500 UPI with a separate receipt; and no horizontal viewport overflow.
The harness was rerun after integrating the shared brand mark: **2/2 passed**.
Agent-browser also inspected the rendered page.

The downloaded PDF was rendered with Poppler and visually inspected: branch and
Lab Lords logo, INR glyph, date, billing period, 700 received, 500 remaining and
recorded-by information were visible without clipping. PDF text is rasterized
to preserve browser-rendered Unicode and is not searchable.

The committed browser scenarios use the existing development Clerk storage-state
configuration and clearly mark mocked APIs. A saved session was unavailable, so
the connected authenticated browser-to-API-to-database flow was **not verified**.
Real database integration tests separately cover the accounting and authorization
paths. Native device sharing and physical printing were not delivery-tested.

## Exercise and release status

Follow [the exercise steps](fee-collections.md#exercise-the-feature): choose an
existing due from Payments, Renewals or the student's fee drawer; accept the
default full balance or collect 700 Cash then 500 UPI against 1,200; reopen
Collections & receipts to retrieve either receipt. After a lost response, retry
the same collection; after a PDF/share failure, retry only the receipt action.

The implementation pass made no commit, push, branch change, PR, Production
migration or deployment. Subsequent release evidence is recorded separately.
The task-created database container was stopped after verification.
Pre-existing unrelated changes were preserved. The only new application dependency
is jsPDF; no application environment variable, flag, service or cron was added.
Anniversary generation, admission/monthly identity, later unpaid cycles, student
membership/seats and organization subscription billing retain their existing rules.

The migration adds false/zero defaults to existing fees and starts two empty
tables; it does not backfill historical collections, receipts, dates or resolution
events. Before an authorized release, run the read-only aggregate
`prisma/preflight/fee-collections.sql` against the approved target, retain its
inventory, apply the additive migration before dependent code through the existing
workflow, then perform the documented post-checks and smoke test. Once partial
collections exist, old payment writers/readers are incompatible; use a compatible
forward repair and the existing operational controls described in the runbook.

## Release review follow-up

Review found that the deterministic legacy full-payment key could retrieve a
voided collection and report success while its fee remained DUE. The compatibility
writer now rejects that response and directs the operator to Collect fee. The
regression proves no duplicate receipt, the unchanged outstanding balance, and
successful collection with a fresh explicit request. Existing assertion changes
were checked against the contract: dateless history contributes no invented
income, fully collected fees are not erased by a waiver, and legacy full-payment
callers record Cash with their original resolution provenance.

After this fix, the following affected run passed **113 tests in 6 files** on
the same verified disposable database:

```powershell
pnpm exec node .agent/fee-collection-verification/fee-test-runtime.mjs node_modules/vitest/vitest.mjs run tests/integration/services/fee-collection.test.ts tests/integration/services/payment.test.ts tests/integration/services/student.test.ts tests/integration/services/renewals.test.ts tests/integration/analytics/payment.analytics.test.ts tests/unit/analytics/whatsapp-report.analytics.test.ts
```
