# Independent branch billing

## Ownership and release scope

The persisted organization model selects the billing policy. A BRANCH_V3 organization has one agreement per branch, each with its own selected plan, FIFO sequence, current mandate, replacement slot and history. New provider subscriptions use quantity one. Account Billing lists the branches together. Debits, due dates and invoices follow each mandate individually.

The selected future plan can differ from both the current billed plan and the workspace the user can open. For example, a branch can select Basic for its first payment and continue its original Pro owner trial until the original deadline. A verified eligible upgrade authorization can temporarily raise access. Promotion still needs the candidate's own exact settlement. Review [the schema](../../prisma/schema.prisma), [agreement coordination](../../services/billingAgreementScope.service.ts), [paid evidence](../../services/billingPaidEvidence.service.ts) and [branch access](../../services/entitlement.service.ts).

## Read-only inventory

Run the following against an expressly authorized target, with credentials supplied through the operator's normal environment. Keep the resulting internal IDs in the restricted release record.

```sh
psql -X --set ON_ERROR_STOP=on --set organization_id=ORG_ID --file scripts/branch-plan-inventory.sql
```

The repeatable-read snapshot covers exactly one organization, its branch lifecycle states, trial dates, subscription quantities, paid periods, invoice IDs, offers, staged changes, action outcomes and webhook receipts. It also returns operational row counts, checksums and fee totals. Record the original source subscription and every covered branch. Resolve mismatches between the provider quantity, active branch IDs, cancellations, archived branches and paid coverage before proceeding. Inventory each model separately.

## Schema and cohort admission

1. Back up the database and test restore against a disposable copy. Deploy the additive agreement and carried-coverage migrations and matching generated client before enabling new organizations. These migrations allocate **zero** branch agreements and initiate **zero** provider requests. Existing provider IDs and payment evidence stay on their original subscriptions. The aggregate sequence retains a partial unique index.

   Rehearse the first migration against a realistically sized restored ledger and record lock duration. It replaces the organization-wide sequence index inside the same DDL transaction, adds scoped indexes and validates foreign keys. Schedule the DDL accordingly. Drain older application and cron workers before admitting a V3 cohort. Only the new workers understand the two scopes.
2. For new onboarding, keep the existing workspace billing control enabled and enable `BRANCH_BILLING_V3_ONBOARDING_ENABLED=true` only for the reviewed release environment. Turning it off stops new enrollment into the model. Previously enrolled branches continue through their recorded agreement. Existing Razorpay write controls, mode checks, catalogue mappings and owner trial rules apply.
3. For an existing V2 organization, prepare a JSON object mapping **every** branch ID, including archived ones, to its reviewed future plan. Run the following dry run with an explicit direct database URL. Save the returned digest and exact scope.

   ```sh
   pnpm exec tsx scripts/convert-branch-billing.ts preflight ORG_ID branch-plans.json
   ```

4. The converter admits never-billed V2 cohorts and fully reconciled terminal-source cohorts. A current paid interval must match the original exact settlement. An active or uncertain recurring mandate, unresolved actions, open lifecycle changes, mismatched quantity, conflicting provider mode or outstanding discount commitment holds the entire group. LEGACY workspaces retain their historical commercial rules. A held result leaves all payments and entitlements under the original model.
5. With an authorized cohort and a matching digest, the operator can apply its reviewed mapping. This operation only **reads** Razorpay. It compares each terminal mandate's plan, quantity, current cycle and paid count with the reviewed database inventory. It reads the complete paginated invoice collection and matches each invoice's subscription, payment, period, status, amount and currency. An open invoice, an unrecorded payment, an uncertain association or a changed final period holds the whole cohort. The payment funding carried coverage must still be captured for the exact amount with no recorded refund. On a mismatch, reconcile the original mandate and run preflight again. The serializable database transaction locks the organization, repeats preflight, creates one agreement and one conversion receipt per branch, releases the terminal current slot, and switches the model once. A stale digest, partial write or concurrent mutation aborts the transaction. After a lost response inspect the model, agreements and receipts before retrying.

   ```sh
   pnpm exec tsx scripts/convert-branch-billing.ts apply ORG_ID branch-plans.json REVIEWED_DIGEST
   ```

6. Previously covered active branches retain the remaining exact source period via an immutable reference and original end date. Each successor's first recurring charge respects that boundary and any longer existing owner trial. Archived and subsequently added branches receive no inherited paid interval. The owner authorizes the prepared successor in Account Billing. Its own invoice and captured payment establish its new paid coverage. Compare the original and final SQL snapshots. Expect one new agreement and conversion receipt per branch, identical original invoice/history counts and zero changes to operational IDs, fee totals, enrollment, receipts, allocations or staff overrides from conversion.

### Renewing aggregate mandates

A renewing V2 preflight returns a proposed successor roster. It lists each branch's status, selected future plan, INR catalogue amount and proposed monthly gross. Each active branch contributes one unit. Archived branches contribute zero and keep their future selection. An unresolved lifecycle state has an unknown quantity. Each active row identifies its existing settled aggregate coverage and any unexpired owner trial. These amounts are catalogue prices before discounts.

For one reconciled, active, undiscounted monthly mandate with matching exact paid coverage, supported payment method and a complete branch inventory, preflight uses the existing safe-cycle rule to propose a common start. The candidate must have at least seven days' lead time. The existing authorization cutoff is 72 hours before that boundary. When the proposed date falls after the original paid period the roster marks the intervening source renewal as conditional on exact settlement. Conflicting obligations, an unsupported source or a trial ending beyond the candidate leave both dates unknown. A proposed date creates no provider reservation or authorization.

A paying aggregate with renewal still active stays on its current agreement. Keep the old coverage in force while the owner reviews the complete successor roster, common safe boundary, discounts and payment method requirements. The local converter cannot stage authorizations against a still-renewing aggregate. Release of such a cohort requires a coordinated provider-tested handoff covering **all** successors, proof of old-source nonrenewal and a way to unwind every already-authorized successor before its first debit if another authorization fails. If the cutoff cannot be met, defer the whole cohort. Never collect from the successors first and cancel the aggregate afterward. A terminal-source conversion must have independent evidence of the earlier termination. Do not terminate a customer's live mandate to clear the converter's hold.

## Operations, scheduling and rollback

Organization advanced analytics identifies the active Standard and Pro branches it includes. Organization WhatsApp reports include the active Pro branches and retain organization-level sender and recipient requirements. A branch report still checks its branch assignment. Cached organization snapshots and queued sends revalidate included and excluded branch identities. A final send takes agreement locks before admitting the external call. The organization sender can continue serving eligible siblings after a downgrade.

The billing deadline endpoint runs at `0 * * * *` in [vercel.json](../../vercel.json). It needs the existing cron secret, provider mode and correctly scoped credentials. Before release, exercise authenticated hourly reconciliation across independent agreements, expired authorizations, cutoff dispatch and source retirement on the intended hosting plan. Verify run duration and retries at the intended cohort size. The repository records an unresolved Hobby deployment gate. Hobby supports daily cron, and the checked-in schedules require sub-daily execution. [Vercel cron limits](https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing)

If a provider call times out, inspect the durable action, source/candidate IDs, agreement and operation receipt. Reconcile that exact provider object before admitting another operation. Preserve uncertain captures, cancellations, accepted WhatsApp deliveries and budget reservations until their outcomes are known.

To pause rollout, disable new V3 onboarding and hold new provider writes while keeping reconciliation and Account Billing recovery available. Keep the schema, converted records and a V3-aware application running. Once a customer has authorized a new mandate, a rollback requires reconciling each provider obligation and its paid-through date. Restoring the old application or flipping the model could expose old access or collect twice. Do not remove agreement ownership, rebind invoices, reset provider IDs or re-enable an aggregate mandate as a database rollback.

## Provider evidence required for release

The [local verification record](../evidence/independent-branch-plans-2026-11-25.md) covers access changes, disposable database checks and operational regressions. The [Razorpay Test record](../evidence/branch-subscriptions-razorpay-test-2026-11-25.md) includes all three real subscription creations, their expiry and the separate simulated payment tests.

Razorpay creation supports quantity and future starts. Domestic card subscriptions restrict in-place updates to offers. The initial authorization requires the payment method's authentication step. Maintain the replacement path, safe-cycle rules and exact paid promotion. Exercise real Test authorizations at all three prices, all six plan transitions, interrupted checkout, subsequent settlement, cancellation and recovery before enabling collections. [Create Subscription](https://razorpay.com/docs/api/payments/subscriptions/create-subscription) · [Update Subscription](https://razorpay.com/docs/payments/subscriptions/update) · [Subscription FAQs](https://razorpay.com/docs/payments/subscriptions/faqs)
