# Three-plan catalogue cutover — 2026-10-23

Status: implemented in the isolated `codex/billing-recovery` working tree. Prepared as focused review commits; not merged, deployed or applied to a shared database. Production inventory remains an operator prerequisite. This is a clean catalogue replacement, not grandfathering.

## Commercial model

| Identity | INR / active branch / month | Entitlements |
| --- | ---: | --- |
| BASIC | 99 | Existing core operations |
| STANDARD | 299 | Core, staff/permissions, advanced branch/organization analytics, AI reports/drafts |
| PRO | 499 | Standard plus WhatsApp integration/automation |

One organization plan covers every branch. Existing billable-branch lifecycle determines quantity; pending activation, archived branches and scheduled removal retain their existing timing. No new student, seat, branch, message or usage limit is introduced. Student fees, anniversary generation, unpaid-dues handling, tax presentation, refunds and payment-method rollout policy are unchanged. Basic's simplified interface is a later phase.

The normal once-per-owner 30-day trial is explicitly STANDARD. Selecting or authorizing PRO alone does not grant Pro or a paid period. Exact, separately recorded replacement grants may grant the explicit target tier; they cannot lower remaining trial/paid access. Independently paid Pro is not reduced by an overlapping Standard trial. Payment retries and replacement grace retain their existing bounded policy.

WhatsApp requires PRO plus the existing permissions, enabled integration/delivery flags, provider mode/canaries, sender, consent, approved templates, budgets and readiness checks. Entitlement is not proof of availability or delivery. Public and application copy discloses setup/rollout conditions and does not promise unlimited messages. A queued message rechecks entitlement before provider dispatch, including after downgrade.

## Why migration is guarded

Old internal `PRO` means public Standard at 499; it must never silently become new Pro. Old Basic cost 299. Stored commercial snapshots, signed provider identities, action requests/hashes, invoices and unresolved provider writes must remain immutable.

`20261023090000_three_plan_catalogue` takes transactional table locks, rejects any row in the ten legacy billing/webhook tables listed in `scripts/billing-three-plan-inventory.sql`, and rejects obsolete AGENT_CONTROL/CUSTOM selections. On a commercially empty database it replaces the enum with BASIC/STANDARD/PRO and converts only non-commercial Organization.selectedPostTrialPlan PRO to STANDARD. It changes no operational records or trial dates. No existing migration is edited. Catalogue keys are version 2 and include mode, tier and exact terms.

This migration intentionally refuses even closed historical billing rows and old unused mappings. Do not delete billing evidence to make it pass. It is not approved for a populated billing ledger. Retaining the guard is preferable to reinterpreting immutable receipts or orphaning unresolved operations.

## Inventory and finite transition

An authorized operator must run the checked-in read-only inventory on an approved snapshot, then the intended deployment database under the release window. It returns per-table counts and exact affected IDs (no contacts, tokens or raw webhook bodies), selected-plan scope, subscription states by mode and provider-action states. Record database identity, snapshot timestamp and deployed revision with the private evidence. The agent did not access Production or infer it is empty.

If all ten billing/webhook tables are empty and selections are BASIC/PRO/null, the checked-in transaction is the complete data transition. Pre/post acceptance: every billing table remains zero; user/organization/branch/student/payment/trial counts are identical; only selected PRO becomes STANDARD; enum labels are exactly BASIC/STANDARD/PRO. Inspect provider-side obligations separately: a locally empty ledger does not prove the Razorpay account has no live mandates.

If any local or provider live obligation exists, stop the release. Produce a finite per-organization register linking source subscription, invoice IDs, paid-through boundary, pending change, action receipt, candidate mandate and intended new tier. Reconcile unknown writes by reads on the old release; never repeat a provider write to clear the register. Resolve or explicitly retain each manual-review case; preserve paid access until its verified boundary. Schedule new catalogue authorizations under customer consent without overlapping charges. Archive the old ledger with its old catalogue semantics and immutable payloads in an audited, readable history store before a separately reviewed one-time migration can switch canonical pointers. That populated-ledger migration is conditional additional work, not implemented or authorized by this empty-ledger migration. No automatic data wipe, forced mandate cancellation or default repricing is supplied.

Local inspection found a populated **Test-only** old fixture: 6 subscriptions, 9 changes (2 scheduled, 1 confirmation-timeout failure, 1 manual-review failure), 3 invoices, 14 history rows, 7 provider actions, 17 audit rows, 2 plan mappings and 2 provisioning rows. It remains on the old schema and was read only. Do not restart the old real-checkout harness with this new catalogue. Its 2026-10-22 payment evidence is historical, not proof of new-price checkouts.

## Provider mapping and environment

Razorpay Plans are immutable. New keys are `razorpay-plan:v2:{TEST|LIVE}:{BASIC|STANDARD|PRO}:INR:{9900|29900|49900}:monthly:1`. Never reuse a v1 PRO mapping based only on its 49900 amount. Subscription quantity multiplies the monthly unit amount; no new yearly plans or discounts are introduced.

The Test-only `tests/billing-verification/prepare-three-plan-test.ts` prepares and reads back plans through the production catalogue service with a local journal store; it refuses Live credentials and has no subscription/payment/database mutation interface. The three Test plans were created and read back at exact amounts, INR, monthly interval 1; a second read reused each identity. IDs are in the local ignored `test-results/billing-verification/three-plan-test-mappings.json`. Application database mappings must still be provisioned in the deployment database. The local journal is evidence, not deployable DB state.

Environment names: RAZORPAY_MODE, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET (or explicit RAZORPAY_TEST_KEY_ID/RAZORPAY_TEST_KEY_SECRET in the Test helper), RAZORPAY_WEBHOOK_SECRET and existing rotation aliases, RAZORPAY_BILLING_WRITES_ENABLED, RAZORPAY_MULTI_METHOD_SUBSCRIPTIONS_ENABLED, RAZORPAY_LIVE_CANARY_ORG_IDS, WORKSPACE_BRANCH_BILLING_V2_ENABLED. Existing WhatsApp flags/readiness remain independent. No secret or environment file changed. No new variable is required.

## Deployment sequence and recovery

1. Review and commit the complete recovery + catalogue diff on the isolated branch; merge only when authorized. Preserve the old audit as dated evidence.
2. Complete the inventory and provider obligation register. Hold billing writes, webhook processing and billing/WhatsApp workers during the schema/application transition; preserve incoming verified delivery for replay. Take a restorable snapshot. Do not run old application code against the new enum.
3. Apply the new migration only after the empty-ledger precondition is proven. Run exact pre/post count and selection checks. Deploy the matching generated Prisma client and application together. Never use schema push or edit migration history.
4. Provision and fetch-validate separate Live v2 plan mappings in that database using the production catalogue service under approved Live configuration. The service verifies amount/currency/period/interval and durable provisioning identity. On the first local attempt it also scans exact v2 provider notes, so pre-created plans are adopted rather than duplicated. Live mappings are not prepared by the Test-only helper.
5. Before opening sales, perform an authorized deployment smoke check of sign-in, all three prices, one exact checkout/verified invoice, recovered authorization, subsequent plan change, trial/grant distinction, all server feature gates and webhook/reconciliation delivery. Test evidence here does not certify Live onboarding, future bank settlement or actual WhatsApp readiness.
6. Enable billing and provider/webhook workers in the established canary order; watch unknown provider receipts, mismatched amounts, duplicate callbacks and entitlement transitions.

If a precondition fails, the SQL transaction rolls back without enum or row changes. Resolve Prisma's failed migration entry only after verifying that rollback; do not mark it successful. Before any new v2 billing record exists, rollback may restore the pre-release snapshot and matching application with external writes still held, then replay retained webhook evidence. Once any v2 authorization/payment exists, use a reviewed forward repair: never downgrade the enum or rewrite provider identities. Keep paid facts and uncertain action holds intact.

## Evidence boundaries

Deterministic suites cover production services with a verified disposable PostgreSQL database and synthetic providers. Browser fixtures exercise production billing components with synthetic API/Checkout responses. Actual Razorpay Test evidence proves plan creation/readback, initial paid card checkouts at all three new prices, and authenticated replacements Basic→Standard, Standard→Pro and Pro→Basic. Recovery re-entry and same-key replay preserved the original invoices and source periods without provider writes. Other directions, newly injected lost-response recovery and fresh post-undo mandates were not executed against the new catalogue. Future renewal/cutover, public webhook delivery, Live payment and real WhatsApp delivery remain unverified; see the final audit.

Official references: [immutable Razorpay plans](https://razorpay.com/docs/payments/subscriptions/create-plans), [subscription update restrictions](https://razorpay.com/docs/payments/subscriptions/update). Domestic-card plan/quantity changes continue through replacement mandates; no new native card update is inferred safe.

## Hosting gate observed during PR review

The automatic Vercel Git preview for PR #284 at `8637d53` was rejected before
build because the connected account uses Hobby, which does not support the
required hourly billing cron. Do not reduce billing/WhatsApp cron frequency to
make that check pass. Release requires hosting that supports the existing
schedules or a separately approved scheduler design. No account upgrade,
schedule change, deployment or promotion was performed during this review.
