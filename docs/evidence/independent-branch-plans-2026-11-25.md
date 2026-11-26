# Independent branch plans verification

The default branch-billing change builds on main at `82bf04f9`, which includes PR 299's reviewed fixes at `3104e7e`. The verification uses synthetic accounts and branches. [Provider observations](branch-subscriptions-razorpay-test-2026-11-25.md) · [Browser checks](branch-plans-browser-2026-11-25.md) · [Initialization, scheduling and recovery](../billing/independent-branch-rollout.md)

## What changes when a plan takes effect

The selected future plan, the current billed subscription and the branch's effective access can differ. Starting a checkout leaves current access in place. Eligible, verified replacement authorization can grant bounded upgrade access. Exact captured payment and its matching invoice establish the successor's own paid period. A downgrade retains its previous tier until the commercial change takes effect. The server computes the charge date and undo cutoff. Each transition preserves the branch's operational records, including original receipt and enrollment identities.

| Transition | Change to the workspace at the effective access change |
| --- | --- |
| Basic → Standard | Open the full workspace and allow entitled staff administration, attendance, advanced analytics and AI reports within the user's permissions. |
| Basic → Pro | Open the full workspace and enable eligible WhatsApp workflows after checking sender, setup, consent and actor permissions. |
| Standard → Pro | Keep the full workspace and enable eligible WhatsApp workflows. |
| Pro → Standard | Keep the full workspace and remove WhatsApp entry points and send eligibility. Retain its configuration and keep eligible siblings using the shared sender. |
| Standard → Basic | Open the simple workspace. Keep permitted student, seat, shift, import and fee work. Retain existing staff assignments and overrides. |
| Pro → Basic | Apply the Basic workspace and permissions and suppress safely unsubmitted premium work. Preserve accepted and uncertain sends for reconciliation. |

Account Billing keeps branch context on checkout, recovery, history and invoice reads. It displays known branch commitments and the next confirmed charges independently. At catalogue prices, settled Basic, Standard and Pro branches total ₹897 in monthly commitments. Their debit dates and invoices belong to their separate subscriptions.

## Default product verification, 25–26 November 2026

The repository's CI runtime is Node 20, pnpm 9 and PostgreSQL 15. Local validation used Node 20.19.6, pnpm 9.15.9 and separate named databases in a disposable loopback-only PostgreSQL 15 container. The runner checked database name and server version before every invocation. The cluster used `fsync=off` for disposable test throughput. It was used for application transactions, isolation and replay tests. Power-loss durability was outside this exercise.

- `pnpm prisma validate` passed with the existing composite-relation SetNull warnings. `pnpm prisma generate` generated client 7.8.0. `pnpm prisma migrate deploy` applied all 63 migrations to each of two empty databases, including both new forward migrations.
- The seven-case replacement matrix passed all six directed plan changes and a same-plan card replacement in card-only Checkout. The checks cover the original monthly commitment while authorization is pending, temporary access, exact first settlement, sibling isolation and subsequent renewal. Two separate trial-time cases cover increasing and decreasing the selected tier without changing the grant. [Replacement and trial integration cases](../../tests/integration/services/billing-mutation.test.ts)
- The checkout and renewal tests cover captured payment, replay, delayed provider events, HALTED and PAUSED recovery, and subsequent purchase. The provider-action tests cover the original lease, admission, response loss and definite rejection. The deadline tests cover an unreadable checkout, later provider expiry, read-only recovery of an uncertain create or retirement, and independent branch processing. [Checkout and renewal](../../tests/integration/services/billing.test.ts) · [Provider actions](../../tests/integration/services/billing-provider-action.test.ts) · [Deadlines](../../tests/integration/services/billing-deadline.test.ts)
- The PostgreSQL cases check repeatable structural initialization, retained ownership, foreign-branch denial, archival/reopening, original student/fee records, an unpaid earlier monthly fee alongside a later anniversary due, and stopping accrual when enrollment ends. [Branch plans and history](../../tests/integration/services/independent-branch-plans.test.ts) · [Branch lifecycle](../../tests/integration/services/independent-branch-lifecycle.test.ts) · [Student fee engine](../../tests/integration/services/payment.test.ts)
- Local Chromium passed 90 billing cases across three widths, 12 branch-navigation and settings cases, and two Basic pending-save cases. Two additional desktop and mobile runs signed in through Clerk Test and opened the selected branch's Billing page. Separate public-page checks passed all 21 cases across English, Hindi and Hinglish. Browser checkout used simulated provider responses. The real Razorpay Test observations used a separate retained database. [Browser evidence](branch-plans-browser-2026-11-25.md) · [Provider evidence](branch-subscriptions-razorpay-test-2026-11-25.md)

| CI command | Observed result on the default product |
| --- | --- |
| `pnpm prisma validate` | Passed with existing composite-relation SetNull warnings. |
| `pnpm prisma generate` | Generated Prisma Client 7.8.0. |
| `pnpm prisma migrate deploy` | Applied all 63 migrations to a fresh PostgreSQL 15 database, including both forward branch initializers. |
| `pnpm lint` | Passed with one existing warning in a generated Workflow route. |
| `pnpm run test --pool=threads --maxWorkers=1` | All 3,503 tests passed in 399 files, exit 0, in 1,248.83 seconds. |
| `pnpm test:coverage --pool=threads --maxWorkers=1` | All 3,503 tests passed in 399 files, exit 0, in 1,265.68 seconds. V8 measured 80.80% lines, 89.97% functions, 71.82% branches and 78.22% statements. Both configured thresholds passed. |
| `pnpm build` | Passed with an isolated build environment and a 4 GB heap. Next.js generated 76 static pages and verified two import workflows. |
| `pnpm exec tsc --noEmit --pretty false` | Passed on the final application and test sources. |
| `git diff --check` | Passed. |

## Earlier PR 299 database and build checks

The destructive integration setup ran only after checking the Docker container identity, PostgreSQL image, loopback-only binding, exact database name and empty initial schema. Each independent test process had a separate database. The provider fixture used a separate persistent database. Prisma applied all 61 migrations from an empty database. Both new migrations are additive to existing commercial and operational data.

| Command run from the repository root | Observed result |
| --- | --- |
| `pnpm prisma validate` | Passed. Prisma also emitted its pre-existing composite relation SetNull warnings. |
| `pnpm prisma generate` | Passed with client 7.8.0. |
| `pnpm exec vitest run --config vitest.unit.safe.config.ts tests/unit/services/billingDeadlineReplacement.test.ts tests/unit/api/branches.route.test.ts tests/unit/api/organization-access-parity.routes.test.ts tests/unit/api/billing-change-conflict-routes.test.ts` | 45 passed in four files. The new primary branch creation route test supplies the same required seat count as the form. |
| `pnpm exec vitest run --hookTimeout 90000 --testTimeout 60000 tests/integration/services/independent-branch-lifecycle.test.ts tests/integration/services/owner-trial.test.ts tests/integration/services/independent-branch-plans.test.ts` | 14 passed in three files. Covers migrated trial claims, six distinct branch/aggregate lifecycle and conversion cases across the independent fixtures, and original trial compatibility. |
| `pnpm exec vitest run --hookTimeout 90000 --testTimeout 60000 tests/integration/services/branch-premium-access.test.ts tests/integration/services/entitlement.test.ts tests/integration/analytics/payment.analytics.test.ts` | 29 passed in three files. Both orderings of final send admission and downgrade were exercised. Checks included retained payments, receipts, enrollment, allocation and staff overrides. |
| `pnpm exec vitest run --config vitest.unit.safe.config.ts tests/unit/services/branchConversionTarget.test.ts` | Eight CLI target checks passed. |
| `pnpm exec vitest run --config vitest.unit.safe.config.ts tests/unit/pages/public-site.test.tsx tests/unit/lib/public-localization.test.ts tests/unit/lib/billingPlans.test.ts` | 38 passed in three files. Public pricing and FAQ copy follow new-workspace enrollment in English, Hindi and Hinglish. |
| `pnpm exec vitest run --no-file-parallelism --maxWorkers=1 tests/integration/importing/owner-setup.test.ts tests/integration/services/audit-closeout-recovery.test.ts tests/integration/importing/import-commit-flow.test.ts` | 32 passed in three files with repository test timeouts. |
| `psql -X --set ON_ERROR_STOP=on --set organization_id=local_sql_validation --file scripts/branch-plan-inventory.sql` | Read-only script completed against migrated local PostgreSQL. |
| `pnpm exec vitest run --hookTimeout 90000 --testTimeout 60000 tests/integration/services/relationship-catalog.test.ts tests/integration/services/independent-branch-lifecycle.test.ts tests/integration/services/billing-deadline.test.ts tests/integration/services/payment.test.ts tests/integration/services/student-enrollment.test.ts tests/unit/api/billing-hourly-cron.route.test.ts` | 71 passed in six files. Checks include the 215 owning relationships against installed PostgreSQL, hourly deadline handling, fee generation and enrollment. |
| `pnpm lint` | Passed with zero errors and one existing generated Workflow directive warning. |
| `node tests/dashboard-connected/build.mjs`, which invokes `pnpm build` | Production build passed on the dedicated local build database. The build verified two import workflow manifests. An earlier attempt encountered a locked temporary log in the Next output directory. A later attempt identified an optional-field error in the Test harness, which was corrected. |

## Earlier PR 299 complete suite

The first `pnpm test` and `pnpm test:coverage` processes overlapped active implementation and test changes. The test run finished with 3,475 passed and 24 failed. The coverage run finished with 3,472 passed and 27 failed. The failures included old transformed modules being exercised by new assertions, database operation timeouts under load, an onboarding flag missing from a unit mock, the relationship catalog missing six entries, and a UTC overdue cutoff asserted using host-local midnight. The catalog, mock and assertion were corrected. The full-file billing, import and lifecycle checks above were rerun on dedicated databases.

The final coverage run used one verified database per partition. Each command used the same test configuration, provider simulation and coverage instrumentation. Partition 2 was restarted after the first-branch onboarding fixture supplied the explicit time slot required by that flow.

```powershell
# In each process, set the verified database target for its own partition first.
$part = 1 # repeat using 2 and 3 with their respective disposable databases
pnpm test:coverage --shard=$part/3 --hookTimeout 90000 --testTimeout 60000 --reporter=default --reporter=blob --outputFile.blob=test-results/independent-branch-coverage-blobs/shard-$part.json --coverage.reporter=json --coverage.reportOnFailure --coverage.reportsDirectory=test-results/independent-branch-coverage-$part
pnpm test:coverage --mergeReports=test-results/independent-branch-coverage-blobs --coverage.reporter=text-summary --coverage.reporter=json-summary --coverage.reportsDirectory=test-results/independent-branch-coverage-merged
```

The final partitions passed 1,286, 1,057 and 1,176 tests respectively. Each partial report fell below the whole-repository coverage threshold on its own. The merged report passed **3,519 tests in 400 files** and both configured thresholds. Coverage was **80.81% of lines**, **89.89% of functions**, **71.73% of branches** and **78.10% of statements** in the included services and utilities.

A final independent `pnpm test` run used the repository's default timeouts and a single verified local database. It passed **3,519 of 3,519 tests in all 400 files**, exit 0, in 766.32 seconds.

## Earlier PR 299 release decision (superseded)

PR 299 originally shipped an opt-in onboarding flow and a terminal-source converter. The current product uses independent agreements for all branches. The forward migrations initialize retained records, and the schedule manifest covers billing and the seven existing operational jobs. See the [current operating guide](../billing/independent-branch-rollout.md).
