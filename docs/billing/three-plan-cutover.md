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

## Release preparation follow-up � 2026-10-23

PR #284 at `605c75a` passed the complete GitHub workflow: lint, 2,967 tests,
production build (74 static pages and two import workflows), and coverage
(74.94% lines, 84.19% functions). This is code evidence, not production readiness.

### Scheduler decision � owner-selected Vercel Pro, upgrade deferred

Keep all eight schedules in `vercel.json`. Five exceed Hobby's daily limit:
billing hourly; WhatsApp planner and reports every 15 minutes; dispatcher every
5 minutes; health every 30 minutes. Together with the three daily jobs, these
schedule 555 invocations per UTC day before duplicates/manual calls. This is a
schedule count, not a cost estimate or guaranteed delivery count.

Owner decision on 2026-10-23: retain Vercel Cron and upgrade the existing project
to Vercel Pro after approximately one week. The current Hobby failure is an
intentional release hold until that owner-managed upgrade is complete. Do not
replace the scheduler or reduce frequencies to bypass it. This is a stated
plan, not evidence of an account upgrade or permission to deploy.

Selected path: use Vercel Pro for the existing project, retaining the same
routes, schedules, bearer authentication, leases and provider-write gates.
The account owner must review the current subscription cost and approve any
purchase. No upgrade, trial activation or deployment is performed here.
Vercel's [current limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)
allow once-per-minute schedules on Pro; function usage remains separately metered.

Alternative: a separately approved external scheduler. Before implementation,
name its provider, owner and budget; retain all eight UTC schedules and HTTPS
GET routes; store `CRON_SECRET` privately in headers; limit concurrency; alert
on missed runs/errors/backlog; preserve application leases and unknown-provider
holds. Establish one scheduler owner and a hold/drain/switch sequence, so the
old and new schedulers cannot both dispatch. Specify retry and redirect handling,
secret rotation, deployment targeting and rollback. A proposed ADR and isolated
fault tests must precede enablement. Simply removing crons or reducing them to
daily does not solve billing or delivery readiness. No alternative scheduler
has been selected, provisioned or authorized.

After the hosting decision and separate deployment authorization, confirm the
project supports the configured intervals, all eight jobs are registered on
the intended production revision, and `CRON_SECRET` authentication fails closed.
Preview schedules do not execute automatically. Use only separately approved
Test fixtures for endpoint checks; preview success cannot prove production
schedule health. Follow the existing runbook's enable order, with provider
writes held until the relevant canary approvals. Vercel's project-wide Disable
Cron Jobs setting persists across promotion/rollback; verify it explicitly.
See [cron management](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

### Inventory handoff and stop conditions

`scripts/billing-three-plan-inventory.sql` now ends with a `cutover_readiness`
JSON row from the same read-only repeatable-read snapshot as its existing
private affected-ID inventory. It includes schema labels, all ten ledger
counts, obsolete selections, unfinished migration count, old PRO selections,
and operational/trial row counts. Lock and statement waits are bounded to 3
and 30 seconds respectively. Timeout, missing tables or any SQL error means no
valid report; never treat partial output as a pass.

An authorized operator may later run it using a private PostgreSQL service
configuration on an approved snapshot first, with `psql -X -v ON_ERROR_STOP=1
-f scripts/billing-three-plan-inventory.sql`, retaining output privately. Do
not paste database identifiers, affected IDs or connection settings into a
public PR. No production connection is authorized by this document.

| Result | Required action |
| --- | --- |
| `EMPTY_LEDGER_PRECONDITION_MET` | Data precondition only; finish every external gate below. It is not release approval. |
| `BLOCKED_LEGACY_LEDGER` | Preserve all history; prepare the finite obligation register and a separate history-preserving transition. Never delete rows to pass. |
| `BLOCKED_OBSOLETE_SELECTION` | Obtain explicit owner choices for old AGENT_CONTROL/CUSTOM selections before migration. |
| `BLOCKED_MIGRATION_HISTORY` | Inspect unfinished/failed migration evidence and repair through the approved runbook; never mark a failed migration successful blindly. |
| `BLOCKED_SCHEMA_REVIEW` | Verify schema lineage and migration history against the intended release. |
| `ALREADY_V2_DO_NOT_RERUN` | This is not a legacy cutover target. Check deployed revision and migration history; do not rerun the enum migration. |

The report always returns `releaseAuthorized: false` and
`providerObligationsVerified: false`. A local empty ledger cannot establish
that Razorpay has no live mandates. Even an empty snapshot needs verified
migration history, a restorable backup and a fresh inventory during the held
release window; concurrent changes after the snapshot invalidate its release
use. The migration's own locked guard remains authoritative.

### Remaining evidence and responsibility

| Gate | Prepared evidence | Still required before release |
| --- | --- | --- |
| Hosting/scheduler | Exact incompatible schedules and two reviewed options above | Owner-managed Pro upgrade (planned after approximately one week), then authorized schedule verification |
| Schema/data | Guarded migration; historical clean/blocked rehearsal; seven new inventory checks on a fresh local DB | Authorized snapshot/target inventory, migration lineage, restorable backup and hold/drain proof |
| Provider obligations | Test checkout/replacement evidence already retained | Operator's private Live obligation register, including mandates outside the local ledger |
| Populated ledger | Release-stop policy and finite-transition requirements | Separate migration/compatibility design if any legacy rows or provider obligations exist |
| Live catalogue | Exact v2 catalogue keys and verification contract | Authorized Live mapping provisioning/readback in the intended DB; no Test mapping reuse |
| Runtime release | Existing isolated regression, build and browser evidence | Authorized webhook/renewal/cutover checks, canary approval and deployment smoke evidence |

The private obligation register must identify organization, provider mode,
source/candidate subscription, old catalogue terms, invoice/payment evidence,
paid-through boundary, pending change/action state, proposed target tier,
consent status and resolution owner. Record evidence references and unresolved
items rather than reconstructing billing facts or inferring consent. Until this
register is available, a populated-ledger migration cannot safely be specified
or claimed complete. None of these external gates was exercised in this task.
