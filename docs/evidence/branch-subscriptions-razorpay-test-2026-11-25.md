# Razorpay Test branch subscriptions, 25 November 2026

## Default branch billing verification

The final implementation was exercised with a second dedicated loopback-only PostgreSQL 16 container, a freshly migrated database, a synthetic owner with three branches, and the real Razorpay Test API. At 11:33 UTC preparation had created one quantity-one subscription for each of Basic (₹99), Standard (₹299) and Pro (₹499). Replaying checkout returned each original operation and subscription. The provider received three subscription creates and zero plan creates. The manual checkout was made available for owner authorization.

At 11:50 UTC all three checkout deadlines had passed. Razorpay still reported each as created, with zero paid cycles. The application found zero captured invoices, no paid-through dates and read-only access on all three branches. This inspection made zero provider writes. [Interactive checkout and verification steps](../billing/independent-branch-rollout.md#test-authorization-and-incident-handling).

Final readback at 09:55 IST on 26 November returned `expired` for each original Test subscription. Each retained one create receipt and zero captured invoices. Paid-through remained empty and each branch stayed read-only. Inspection issued zero provider writes. Payment authorization and paid activation still require an operator to complete a fresh Test checkout.

## Earlier PR 299 observations

A fresh template0 PostgreSQL database on a verified loopback-only PostgreSQL 16 container received the full Prisma migration history. The test seeded one synthetic owner, one V3 organization, three pending branches and zero trials. Each checkout ran through the application owner, agreement, catalogue, durable dispatch and reconciliation services.

| Branch plan | Monthly INR | Quantity | Real provider creation | Checkout replay | Readback at 05:51 UTC |
| --- | ---: | ---: | --- | --- | --- |
| Basic | 99 | 1 | Confirmed | Same operation and subscription | Created, zero paid cycles |
| Standard | 299 | 1 | Confirmed | Same operation and subscription | Created, zero paid cycles |
| Pro | 499 | 1 | Confirmed | Same operation and subscription | Created, zero paid cycles |

Readback verified the Test plan, price, currency, interval, branch and organization notes, original operation, and one confirmed create action per branch. All three branches stayed read-only. The application reused the three existing Test catalogue mappings discovered through the provider. Across the two preparation invocations it sent three subscription creates and zero plan creates. Standard's first catalogue discovery failed before any Standard subscription dispatch. Resuming the same database reused Basic's receipt. A separate inspection at 05:51:40 UTC issued zero provider writes. The provider reported checkout expiry at 06:03:23 UTC for Basic, 06:05:50 UTC for Standard and 06:05:56 UTC for Pro.

At 06:06:59 UTC, after all three provider-supplied deadlines, the Test API still returned created and zero paid cycles for each subscription. Reconciliation classified every result as pending and all three branches remained read-only. The original operation endpoint rejected reopening each expired checkout with HTTP 409. The local manual checkout server was then closed. No operator performed a mandate authorization or provider cancellation during this check.

Final official readback at 06:14:24 UTC returned expired for all three Test subscriptions, zero paid cycles, one original create receipt per agreement and zero additional provider writes. All three local subscriptions reconciled the terminal state and remained read-only. An intermediate inspection found that closing the local checkout excluded its original create intent from later reconciliation. The new fallback selects that exact branch-bound immutable create when no paid intent exists. The final run used this fix. The synthetic database, original identities and audit history were retained.

## Reproducing this check

The local evidence container `lab-lords-branch-plans-20261125-test` was stopped after verification. Its PostgreSQL data volume and original Test receipts were retained. For readback on the same machine, start that container, recheck its identity and loopback binding and use `--inspect`.

Provision and migrate a new, empty database named `lab_lords_branch_plans_preauth_test` in a disposable, loopback-only `postgres:16-alpine` container. Verify its full Docker ID, the sole port binding and `current_database()` before running migrations. Preserve that database for subsequent reads. Do not truncate the preauthorization fixture.

Set `BILLING_REAL_TEST_CONTAINER_ID` to the verified full Docker ID and `BILLING_REAL_TEST_PORT` to the verified loopback port. Set `DATABASE_URL`, `DIRECT_URL` and `TEST_DATABASE_URL` to the same local URL for that database, `TEST_DATABASE_RESET_CONFIRM` to the exact database name, `ACCELERATE_URL` empty, `VERCEL_ENV=development` and `RAZORPAY_MODE=TEST`. The harness reads the allowlisted Razorpay Test credential pair from the existing local Test credential directory. It refuses other targets and keys.

```sh
node --import tsx tests/billing-verification/branch-preauthorization.ts --prepare
node --import tsx tests/billing-verification/branch-preauthorization.ts --inspect
node --import tsx tests/billing-verification/branch-preauthorization.ts --serve
```

Preparation allows one test subscription per exact synthetic branch. Inspection re-fetches the original subscriptions and reconciles evidence through the application. The optional server runs on loopback port 4193. Opening its page performs zero provider writes. An owner must click their branch and manually authorize inside the official Razorpay Test Checkout. The server verifies the original operation, branch and signed callback. Original checkout payload reads for all three branches succeeded before their expiry.

Real mandate approval, recurring settlement, provider replacement, subsequent paid cutover and cancellation recovery require separate real Test evidence. The six-transition integration suite uses a fake gateway and an isolated PostgreSQL database.

## Local payment simulations

The following commands used an injected fake Razorpay client. For database-backed cases, the runner independently verified the loopback Docker identity, port and target database before enabling fixture resets. The resettable integration database was separate from the retained real Test database.

| Command | Result |
| --- | --- |
| `pnpm.cmd exec vitest run tests/integration/services/billing.test.ts --hookTimeout 120000 --testTimeout 120000 --reporter=verbose` | 86/86 passed in 649.90 seconds, including mixed Basic, Standard and Pro, failed renewal containment, lost authorization responses, capture evidence, duplicate callbacks, receipt ordering and recovery. Three later regressions are covered by the next command. |
| `pnpm.cmd exec vitest run tests/integration/services/billing.test.ts -t 'binds the owner trial\|reconciles the original unpaid branch authorization\|quarantines a late renewable aggregate\|bills Basic, Standard and Pro branches\|isolates a lost provider response' --hookTimeout 120000 --testTimeout 120000 --reporter=verbose` | 5 passed, 84 filtered, in 38.29 seconds. The tests exercise exact owner/workspace trial binding and re-read after lease acquisition, checkout expiry, late aggregate renewal quarantine, three independently settled branches, and read-only recovery from a lost provider response. |
| `pnpm.cmd exec vitest run tests/integration/services/billing-mutation.test.ts -t 'isolates .* to .* authorization' --hookTimeout 120000 --testTimeout 120000 --reporter=dot` | All six directed plan changes passed, 103 filtered, in 72.55 seconds. Each exercised authorization and replay, feature access before and after the boundary, exact settlement and promotion, sibling isolation and preservation of the original student record. |
| `pnpm.cmd exec vitest run --config vitest.unit.safe.config.ts tests/unit/services/billing tests/unit/api/billing --reporter=dot` | 355/355 passed across 18 files in 22.61 seconds. |
| `pnpm.cmd exec tsc --noEmit --pretty false` | Passed after the exact owner/workspace trial changes. |

After the owner check was added directly to the database admission lock, the command `pnpm.cmd exec vitest run tests/integration/services/billing.test.ts -t 'binds the owner trial' --hookTimeout 120000 --testTimeout 120000 --reporter=dot` passed one test with 88 filtered in 31.21 seconds.

An earlier two-case run hit the default 10-second setup hook during concurrent local validation. The rerun with a 120-second hook and test timeout passed both cases. An earlier repository-wide run recorded a mixed-plan failure; the same case passed in the dedicated complete-file run and in the final five-case run.
