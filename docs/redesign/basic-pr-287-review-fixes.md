# PR #287 — Three Basic review fixes

Review baseline: abb3506e3c62b045f932b3fe4649b9d37b4596c2 on codex/basic-workspace.
The remote head was checked before editing; no subsequent work was overwritten.
The PR remains draft. No production data, provider flow, schema, pricing, cron,
Vercel plan, subscription policy or Standard/Pro design change is in scope.

## Findings and resolution

1. **Missing student lifecycle.** Basic did not expose the existing student-status
   service. Its detail view now offers Mark inactive / Reactivate student with a
   localized, keyboard-accessible confirmation. The existing branch PATCH and
   StudentService are reused with KEEP. Outstanding dues and immutable collection
   evidence stay intact; all current allocations end. Reactivation preserves the
   original fee anchors and history and offers a fresh seat assignment.
2. **False admission confirmation.** The old client treated matching name, phone
   and monthly fee as proof of success. The endpoint ignores the generic operation
   key and has no durable admission receipt. The fix deliberately uses explicit
   review: candidate matches remain scoped to the branch, the original fee intent
   and draft stay saved, and recovery never creates, confirms or assigns a seat.
   The owner can inspect a record and explicitly close recovery while keeping the
   draft. Even a genuinely committed lost response remains review-required. No
   duplicate-prevention or normalization behavior was changed on the server.
3. **Receipt calendar mismatch.** Basic receipt and history used account date
   preferences. They now use receiptCollectedAt / receiptPeriodDate, as PDF content
   does. The full workspace collection-history timestamp had the same issue and
   receives the same narrow correction. Amounts, snapshots, stored dates, PDF
   generation and document-language preference are unchanged.

## Validation

All reset-capable runs create a fresh empty local database, verify the Docker
container and loopback binding, and apply the existing migrations. Connected runs
use the existing verified disposable Basic fixture. The previously authorized
Clerk Test-key procedure is unchanged: intended instance verified, child-process
keys only, no copied sessions or printed credentials. Unrelated providers are held.

- Focused initial Basic integration: 23/25 passed; two new fixtures used incorrect
  enum/field names. Both fixture definitions were corrected before the final run.
- Receipt units: 8/8 passed after the explicit disposable-target guard. The first
  direct unit invocation stopped in global setup because no confirmed test target
  was supplied; no tests ran in that attempt.
- Final general CI: **359/360 files and 3,059/3,060 tests passed**, including all
  25 Basic integration cases and the new receipt units. The only failure was
  `quarantines an ambiguous provider 5xx without resubmitting it`: Vitest reported
  a 15-second test timeout, while the recorded wall duration was 1,362 seconds
  during the long local host pause. Its exact-case rerun passed (1 passed, 100
  excluded by the filter; 8.20s total). No timeout or assertion was weakened. This
  is not a claim of a single green broad run; clean final-head remote CI remains
  required. The pause coincided with the failure; it is not a proven root cause.
- Connected full run: 17/18 passed. The receipt fixture attempted to rewrite an
  immutable recorded date and was correctly rejected before browser assertions.
  A focused clock-based fixture attempt then hit a test-loader import error.
  The final fixture inserts a historical ledger record once, with its collection,
  allocation, paid counter and audit evidence in one transaction. It does not
  disable database protection or change existing evidence. The real authenticated
  receipt/history/void APIs and PDF rendering are then exercised: 1/1 passed.
- All 18 connected scenarios therefore have passing evidence across the full run
  and the focused receipt rerun. This is not a single 18/18 broad-run claim.
- A separate 1/1 admission-review capture passed to replace an animation-obscured
  full-page screenshot with a clear dialog capture.
- Guarded build, final TypeScript and lint passed. Lint reports zero errors and
  one pre-existing generated Workflow warning. Scoped lint of the final browser
  fixture passed. No application source changed after the passing build.

### Exact command record

All commands run from the isolated worktree. REPORT and PATTERN below denote
process-only BILLING_REPORT_NAME and BILLING_TEST_NAME_PATTERN values.

| Command | Actual result |
| --- | --- |
| REPORT=basic-review-focused.json; node tests/billing-verification/run-integration.mjs basic-workspace.test.ts | 23 passed, 2 fixture failures; corrected before final CI |
| pnpm exec node node_modules/vitest/vitest.mjs run tests/unit/components/BasicReceipt.test.tsx tests/unit/lib/feeReceiptDates.test.ts | First stopped at the missing disposable-target guard. Same tests passed 8/8 with an explicitly verified local target supplied through environment |
| REPORT=basic-review-ci.json; node tests/billing-verification/run-integration.mjs --ci | 359 files passed, 1 failed; 3,059 tests passed, 1 billing timeout; all 25 Basic cases passed |
| REPORT=basic-review-ci-timeout-retest.json; PATTERN='quarantines an ambiguous provider 5xx without resubmitting it'; node tests/billing-verification/run-integration.mjs billing-mutation.test.ts | 1 passed, 100 intentionally excluded by the exact-case filter; 8.20s |
| node tests/dashboard-connected/basic-local.mjs build | Passed: optimized compilation, type checks, static generation, Workflow manifest |
| node tests/dashboard-connected/basic-local.mjs test | 17 passed, 1 immutable fixture failure |
| node tests/dashboard-connected/basic-local.mjs test --grep 'Basic receipt and PDF' | First focused attempt hit a fixture service-import error; corrected fixture passed 1/1 in 20.7s |
| node tests/dashboard-connected/basic-local.mjs test --grep 'uncertain admission requires review: different admission fee' | 1/1 passed; clear dialog screenshot |
| pnpm exec tsc --noEmit --pretty false | Final check passed, no diagnostics |
| pnpm lint | 0 errors; 1 existing generated-file warning |
| pnpm exec eslint tests/dashboard-connected/basic-workspace.spec.ts | Passed after final receipt fixture correction |
| git diff --check | Passed |

The verified-target unit launcher read the fresh local proof, checked the exact
Docker container/loopback port and current_database(), then supplied only
TEST_DATABASE_URL / TEST_DATABASE_RESET_CONFIRM / DATABASE_URL to Vitest. It did
not reset or copy a database. Local logs use the basic-review prefix under
test-results/; no credentials are included in this report.

### Fresh visual evidence

- [Inactive confirmation — desktop](basic-pr-287-review-evidence/status-inactive-desktop.png)
- [Mobile English](basic-pr-287-review-evidence/status-inactive-mobile-en.png), [Hindi](basic-pr-287-review-evidence/status-inactive-mobile-hi.png), [Hinglish](basic-pr-287-review-evidence/status-inactive-mobile-hinglish.png)
- [Reactivation confirmation — mobile](basic-pr-287-review-evidence/status-reactivate-mobile.png)
- [Explicit uncertain-admission review](basic-pr-287-review-evidence/admission-review.png)
- [Canonical India dates with a UTC account](basic-pr-287-review-evidence/receipt-india-utc.png)
- [Voided receipt retains its recorded calendar](basic-pr-287-review-evidence/receipt-india-voided.png)

The receipt scenario downloads a real PDF under each of Asia/Kolkata, UTC and
America/Los_Angeles account preferences and checks the text drawn into the PDF
canvas against screen dates. It also verifies voided history and the reversed
collection counter. Unit coverage preserves English/Hindi/Hinglish PDF content.


## Delivery status

- `f95f9fa` — canonical receipt dates and receipt-unit regressions.
- `a0f4ed6` — lifecycle, explicit admission review and connected/service regressions.
- Implementation head: `a0f4ed65e5ed9566f0419ea14e477661f7eb3796`, on
  `codex/basic-workspace`. The report commit adds this audit, canonical guidance
  and eight fresh screenshots; it does not change the verified application source.
- The [PR description](https://github.com/itssunnyfunny/lab_lords/pull/287) records
  the final delivery SHA, including the documentation commit, and latest CI snapshot.
- At report publication, final-head remote CI is **pending/unverified**. The
  pre-update head `abb3506e` passed GitHub Run Tests and failed its Vercel status;
  those earlier checks do not verify these fixes. The intentional hosting hold
  is unchanged. Final owner review is also pending.
- All 137 local Markdown targets checked in the affected guidance/report exist;
  all eight screenshot files are present. `git diff --check` passed.

## Remaining boundaries

No migration or environment setting is required. Admission recovery intentionally
cannot prove the legacy request; manual review is the honest supported fallback.
A clean remote CI run and final owner review are required before leaving draft.
Existing production billing-release prerequisites and the intentional Vercel Pro
hold remain separate. No merge or deployment is authorized by these results.
