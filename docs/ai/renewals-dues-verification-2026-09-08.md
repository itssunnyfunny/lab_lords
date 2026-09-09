# Renewals & dues verification — 2026-09-08

## Delivered behavior and files

- `app/branch/[branchId]/renewals/page.tsx`,
  `components/renewals/RenewalsContent.tsx`, `components/layout/BranchSidebar.tsx`
  and `lib/branchPageAccess.ts`: accessible branch queue, today/3-day/7-day,
  outstanding and overdue filters, search, full matching counts, cursor pages,
  per-period amounts, contact details, permitted seat/shift information, latest
  follow-up and profile/collection/reminder actions.
- `services/renewals.service.ts`, `lib/renewals.ts`, `lib/renewalsHttp.ts`,
  `lib/api/renewals.ts`, and the two routes under
  `app/api/branches/[branchId]/renewals/`: authenticated scoped reads and
  follow-up writes, bounded database batches and page memory, anniversary
  projection and typed-cycle/legacy-date suppression.
- `prisma/schema.prisma` and
  `prisma/migrations/20260908100000_renewal_follow_ups/migration.sql`: additive
  latest follow-up storage, author, outcome, next date, unique cycle identity
  and composite student/branch foreign key. No existing data is rewritten.
- `components/payments/MarkPaidDialog.tsx` and the Payments page: shared
  existing collection dialog, with optional collection context and inline error.
  The payment service and its resolution/idempotency behavior are unchanged.
- `lib/paymentReminderDraft.ts` and the Overdue page: shared existing manual
  English/Hindi wording, with expected-fee wording for projections. The queue
  reuses `ApprovedPaymentReminderReview`; there is no new delivery integration.
- `SECURITY.md`, `docs/domain-invariants.md`, `docs/ai/current-state.md` and
  `docs/production-runbook.md`: permission, projection, storage and release handoff.

New tests are `tests/integration/services/renewals.test.ts`,
`tests/unit/lib/renewals.test.ts`, `tests/unit/api/renewals.route.test.ts`, and
`tests/browser/renewals.spec.ts`.

## Verification evidence

The dedicated Docker container `lab-lords-renewals-test` was created for this
work, with PostgreSQL on loopback port 55439 and database
`lab_lords_renewals_test`. The exact database identity was independently checked.
No existing Development, Preview or Production database was used. After observing
test resets waiting on `DataFileImmediateSync`, fsync and synchronous_commit
were disabled only in this disposable container. This is test acceleration,
not a production configuration recommendation.
The disposable container was stopped after validation; its synthetic database
was retained. No background preview server remains running.

Commands and final results:

```text
pnpm install --frozen-lockfile
PASS; locked package versions unchanged; postinstall Prisma generation passed.

pnpm exec node node_modules/prisma/build/index.js migrate diff --from-schema .agent/renewals-before.prisma --to-schema prisma/schema.prisma --script --output prisma/migrations/20260908100000_renewal_follow_ups/migration.sql
PASS; generated SQL was inspected. The temporary before-schema was removed.

pnpm exec node scripts/bootstrap-isolated-database.mjs
PASS; 49 migrations, required billing identity, validated constraints,
and no application records at bootstrap. Explicit isolated target supplied.

pnpm test tests/integration/services/renewals.test.ts tests/integration/services/payment.test.ts tests/unit/lib/renewals.test.ts tests/unit/api/renewals.route.test.ts tests/unit/components/BranchSidebar.test.tsx tests/unit/components/whatsapp-collections-ui.test.tsx tests/unit/api/whatsapp-payment-reminder.route.test.ts tests/unit/utils/studentBillingCycles.test.ts tests/unit/utils/studentBillingCycles.whatsapp.test.ts tests/unit/lib/paymentStatus.test.ts
PASS; 95 tests in 10 files.

pnpm test tests/unit/prisma
PASS; 33 tests in 8 files.

pnpm test:browser tests/browser/renewals.spec.ts
PASS; 6 tests across desktop Chromium and mobile Chromium.

pnpm exec tsc --noEmit
PASS.

pnpm lint
PASS; zero errors. Two existing/generated unused eslint-disable warnings:
app/.well-known/workflow/v1/flow/route.js and coverage/block-navigation.js.

pnpm build
PASS; TypeScript, static generation and the import Workflow manifest check.

git diff --check
PASS.
```

Database tests used the existing explicit test-target and exact reset-confirmation
mechanism. No application environment files were changed. The full unrelated
repository suite and coverage were not completed in this task.

Browser checks mounted the real queue component, shared dialogs and reminder
controls in a temporary local component preview with synthetic API responses and
an anchor substitute for Next Link. They proved collection error/retry/refresh,
immediate follow-up saves and date clearing, manual fallback status/no delivery
write, and mobile width. Screenshots were inspected for both viewports. They do
not establish real Clerk authentication, full-shell navigation, provider
delivery, or deployed behavior. Real tenant permissions and database effects were
covered by the integration tests. The committed Playwright file supports the
repository's existing authenticated browser setup for the subsequent Preview
smoke check. Temporary preview scripts/server were removed/stopped.

Initial failures were resolved: dependency executable/access problems required
repairing the existing installation; Workflow compilation required execution
outside the sandbox; two test enum literals and extracted unused imports were
corrected; a trailing blank line was removed. `pnpm test -- <files>` unexpectedly
started the general suite, was stopped on the unavailable local test target, and
was replaced with `pnpm test <files>`. Integration runs stalled on disposable
database disk sync before the local-only adjustment above.

## Review follow-up — 2026-09-09

Review found that a stale projected follow-up could be saved after a legacy
monthly payment suppressed that projection in the queue. The write path now
uses the same legacy due-day guard as the read path, including PAID, WAIVED
and DUE records, while leaving admission fees distinct. Three integration
regressions verify rejection without overwriting the saved follow-up.

The recorded focused command above was repeated on the same independently
verified disposable local database: **98 tests in 10 files passed**.
`pnpm lint` passed with the same two generated-file warnings and no errors.
`pnpm build` passed, including TypeScript and both import Workflow manifests.
The required hosted CI remains release work. The owner confirmed that only
Production has a database and explicitly waived the Preview migration and
authenticated Preview smoke check on September 9. No Production payment or
follow-up writes substitute for that check. The earlier browser results remain
component-preview evidence only.

## Release status and boundaries

The migration has been applied and verified **locally only**. The September 8
implementation pass did not commit, push, open a PR, merge, or deploy. The
September 9 review/release pass uses `codex/renewals-dues`; its PR and workflow
records provide the subsequent CI and deployment status. Existing unrelated
Production-reset documentation and SQL remain excluded from the feature.

Remaining release work follows the existing workflow: review/PR and green CI,
isolated Preview migration plus authenticated smoke checks, protected Production
Prisma Migration workflow, then the reviewed Vercel application release. Apply
the additive migration before the application. Retain its data on application
rollback. No new feature flags, runtime environment variables, cron jobs,
provider integration or release approval stages are required.

Anniversary anchors, active-student generation eligibility, later dues while
earlier periods remain unpaid, payment resolution/idempotency, branch writability,
membership status, seats and provider consent/delivery rules are unchanged.
Runtime-local billing date semantics remain the existing behavior. Exact queue
counts scan matching records in bounded batches; very large branches may need
future measurement against the 30-second read-snapshot timeout. Follow-ups store
the latest state per cycle, not a CRM history or independent task system.
