# Branch billing operations

## Creating and initializing workspaces

Onboarding creates the organization, first branch, branch agreement, selected future plan and onboarding receipt in a transaction. The original owner trial records its own tier and expiry. A later branch has its own selection and quantity-one mandate. The owner manages the individual branches in Account → Billing. Separate debits can occur on different dates.

Apply repository migrations in order. For a database already on PR #299, the forward migrations are `20261125000300_default_branch_billing` and `20261125000400_initialize_pending_branch_closures`. Drain previous application and scheduled writers, take a restorable backup, and run the migration before starting the matching application. The migration assigns the BRANCH_V3 default and initializes every retained branch, including archived branches. It preserves existing branch choices. A missing agreement receives the organization's recorded future preference or Basic. That preference carries no payment or access grant. Original mandates, invoices, settlements, operation receipts, trial identities and operational records keep their IDs.

For a scoped repair or rehearsal, use the following SQL with an explicitly bound organization ID. The function locks that organization and returns the number of branches seen, agreements inserted and organization records updated. On a second invocation the latter two counts should both be zero.

```sql
SELECT * FROM initialize_branch_billing(:'organization_id');
SELECT * FROM initialize_branch_closures(:'organization_id');
SELECT count(*) AS missing_agreements
FROM "Branch" b
LEFT JOIN "BranchBillingAgreement" a
  ON a."branchId" = b.id AND a."organizationId" = b."organizationId"
WHERE b."organizationId" = :'organization_id' AND a."branchId" IS NULL;
```

Expect zero missing agreements. The closure initializer links definite provider-free scheduled removals to their original receipt and dates. Review any unresolved historical closures in its counts against their actual provider obligations. Compare pre/post operational and financial counts using the [read-only inventory](../../scripts/branch-plan-inventory.sql). The migration makes no provider requests. An outstanding mandate remains a real external obligation. Review its actual debits and status with the account owner before authorizing a new collection for an overlapping period. Keep original provider receipts on the original subscription.

## Plan and payment lifecycle

The Basic, Standard and Pro monthly catalogue amounts are ₹99, ₹299 and ₹499 per branch. Account Billing distinguishes the selected future plan, current mandate, effective plan, next confirmed charge and pending changes. The owner's one-time trial keeps its original tier and end date across branch creation, changes and reopening.

Initial checkout requires an owner and a branch. Signed callbacks and webhooks trigger scoped provider reconciliation. Paid activation and a later renewal require an exact captured payment, matching invoice period and amount, provider mode, subscription and frozen commercial intent. Read-only branches retain operational records and recovery access. When provider confirmation is uncertain, resume the original operation in the branch's Billing view.

Paid plan changes use a newly authorized quantity-one mandate. A verified eligible upgrade can raise access during the remaining covered period. Downgrades take effect at the quoted boundary. Each quote allows at least one hour for authorization before the Undo cutoff. The cutoff leaves 48 hours to retire and reconcile the old mandate before the replacement collects. When the next renewal is too close, the server quotes a later cycle. The candidate's first paid period requires its own settlement. See [replacement policy](../../services/billingReplacementPolicy.ts) and [entitlements](../../services/entitlement.service.ts).

Removing a branch schedules its own closure. Archival waits for the effective boundary and confirmed retirement where required. Reopening uses the same branch and agreement and the remaining original trial or a new verified purchase. A Pro downgrade preserves the shared sender, staff overrides and accepted or uncertain messages. Eligible siblings continue using their own access.

If Razorpay has accepted the replacement but retirement of the original mandate is uncertain, open the affected branch in Account → Billing and reconcile the existing operation. Its record identifies both mandates and the planned first debit. Review the original cancellation response, the provider's scheduled date or terminal state, and the invoices on both subscriptions. Before the planned debit, escalate unresolved competing obligations to the payment-account owner for a provider-side determination. Retain both receipts and reconcile the same operation after the provider confirms the outcome. A local write pause does not stop an already authorized bank debit.

## Scheduling and recovery

[vercel.json](../../vercel.json) declares eight named Vercel Schedules. The path targets use GET, UTC and the environment-specific CRON_SECRET bearer. Registration takes effect when this version is promoted to Production. Keep a single registration per route. The billing sweep expires owner trials, reconciles overdue checkouts, retries eligible operations, processes replacement and cancellation deadlines, and archives due branches. Each branch uses its own lease and operation sequence. Provider uncertainty leaves the original evidence available to the next pass. The delivery worker checks current branch access again at final send admission.

| Job | UTC cadence |
| --- | --- |
| Student fee generation | Daily 00:00 |
| Billing reconciliation | Hourly at :00 |
| Import retention | Daily 00:30 |
| WhatsApp planning | Every 15 minutes |
| WhatsApp send | Every 5 minutes |
| WhatsApp reports | Every 15 minutes |
| WhatsApp health | Every 30 minutes |
| WhatsApp maintenance | Daily 02:00 |

The five-minute sender requires Vercel Pro or Enterprise. Current Hobby Schedules have a minimum 15-minute window. After an authorized deployment, inspect the eight named schedules, their target environment and execution history. Preview schedules start inactive for each branch. Vercel retains subsequent enablement decisions across deployments. A path target receives no automatic HTTP retry. The next scheduled invocation rechecks durable due work. An operator can invoke the same named schedule after a failure, using the existing replay and lease controls. Review failed branch operations in Account Billing before admitting further provider work. [Vercel migration guide](https://vercel.com/docs/schedules/migrate-from-cron-jobs), [schedule limits](https://vercel.com/docs/schedules/limits), [environment defaults and retries](https://vercel.com/docs/schedules/concepts).

## Test authorization and incident handling

Use the [provider setup guide](../workspace-billing-rollout.md) for mode, catalogue and webhook configuration. For interactive verification use a disposable migrated database and Razorpay Test credentials. Select the branch in Account → Billing, open its selected plan, confirm the quote and complete Razorpay Test authorization. Return to that branch's processing view, reconcile, and inspect the exact Test invoice and captured payment. Record the effective access, charge/paid-through dates and the sibling states separately. An authenticated mandate with no captured invoice demonstrates authorization only. The [guarded local Test harness](../../tests/billing-verification/branch-preauthorization.ts) provides prepare, serve and inspect modes for isolated fixtures.

To reproduce the three-branch Test checkout locally:

1. Start a dedicated `postgres:16-alpine` container bound to a loopback port and create an empty database named `lab_lords_branch_plans_preauth_test` from `template0`. Record the full Docker container ID in `BILLING_REAL_TEST_CONTAINER_ID` and its published port in `BILLING_REAL_TEST_PORT`. Use that database's password through `PGPASSWORD`.
2. Set `DATABASE_URL`, `DIRECT_URL` and `TEST_DATABASE_URL` to the identical password-free URI `postgresql://postgres@127.0.0.1:<port>/lab_lords_branch_plans_preauth_test`. Set `TEST_DATABASE_RESET_CONFIRM` to the exact database name, clear `ACCELERATE_URL`, set `VERCEL_ENV=development` and `RAZORPAY_MODE=TEST`. Set `BILLING_TEST_CREDENTIAL_DIR` to the directory containing the Test credentials described in the provider setup guide.
3. After verifying the exact database and port, run `pnpm prisma migrate deploy` against that database using its local credential. Restore the identical password-free URLs required by the harness, then run `pnpm exec tsx tests/billing-verification/branch-preauthorization.ts --prepare`. Preparation uses a separate real Razorpay Test subscription for each plan. Keep the database and its identity for the remainder of the check.
4. Run `pnpm exec tsx tests/billing-verification/branch-preauthorization.ts --serve` and open [the loopback checkout](http://127.0.0.1:4193). Choose a branch and complete the Razorpay Test authorization before its displayed expiry. Record the callback outcome.
5. In another shell with the same isolated settings, run `pnpm exec tsx tests/billing-verification/branch-preauthorization.ts --inspect`. This reconciles the original subscriptions. Paid activation requires the exact captured invoice and payment, a verified paid-through period, and writable access on that branch. Its two siblings should retain their own results. Preserve expired and unpaid observations as such. A subsequent authorization exercise uses a new disposable database and a distinct set of operations.

For incident containment set `RAZORPAY_BILLING_WRITES_ENABLED=false` and deploy the control. This pauses new outbound billing writes for all tenants. Existing bank mandates and in-flight requests retain their actual outcomes. Preserve webhook ingress and evidence for reconciliation. Drain incompatible workers before changing versions. Roll forward with a compatible application and retain branch agreement rows, receipts, subscriptions and migration history. Reverting to aggregate-writing code requires separate database and provider recovery planning.
