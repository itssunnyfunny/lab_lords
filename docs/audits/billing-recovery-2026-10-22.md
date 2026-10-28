# Billing recovery, dedicated Billing page, and Razorpay verification

Date: 2026-10-22. Scope: Lab Lords organization subscriptions and Razorpay,
including recovery, subsequent plan changes, and feature access.

## Isolation and outcome

Implementation and verification are on `codex/billing-recovery`, based on
`60760aa74be27b23deaa31460ff1e4b8c582816a`, in the managed `billing-recovery`
worktree. Billing work was moved out of the shared `main` checkout; the other
agent's pre-existing changes were preserved. Nothing has been committed,
pushed, merged, or deployed.

Acceptance result: the identified defects and dedicated Billing page are
implemented and verified. Actual Razorpay Test evidence confirms paid Basic and
Standard checkout, recovery of the original Standard payment, subsequent
scheduled plan changes in both directions, and correct feature access. Final
unit, browser, lint and production-build checks passed; all 234 integration
cases have passing evidence across the broad run and the corrected focused
rerun. Future renewal/cutover and public webhook delivery are explicitly
separated from completed Test-account events below.

The dedicated `/org/[orgId]/billing` page now owns subscription overview,
plan comparison, checkout/recovery, scheduled changes and undo, cancellation,
and invoice history. Settings links to it and old billing links redirect.

The recovery defect was a mismatch between the recovered domain state and
its durable provider-action receipt: a successful recovery could leave an
`UNKNOWN` action blocking the next change. Recovery now confirms the matching
receipt in the same database transaction as the adopted result. It does not
confirm independent cancellation or replacement actions.

## Findings and changes

| Finding | Result and evidence |
| --- | --- |
| Recovered scheduled undo left its provider receipt unresolved | Confirm the exact `UNDO_SCHEDULE` action atomically with recovery. The database regression performs another real service mutation afterward. |
| Owner Retry routed uncertain scheduled undo into unrelated settlement reconciliation | Add an owner-authorized scheduled-undo reconciliation path. It reads provider state and confirms the matching receipt without replaying queued provider writes; a subsequent explicitly requested change can proceed. |
| Exact paid settlement could leave an in-place mutation receipt unresolved | Exact commercial evidence confirms only the matching `MUTATE` receipt, including already-adopted rows from older workers. |
| A late provider timeout could race receipt confirmation | Confirmation accepts the same dispatch in `ADMITTED` or `UNKNOWN`; a failed compare-and-set requires an already-confirmed identical dispatch or aborts the transaction. |
| Invoice reconciliation read only one provider page | Fetch and validate all pages through an empty terminal page. Reject duplicates, foreign subscriptions, malformed collections, and incomplete history. The bounded read fails closed after 25 requests. |
| Real Test checkout rejected a payment response without `subscription_id` | Paid settlement accepts an omitted/null direct field only through the fetched invoice's exact subscription ID and reciprocal payment/invoice IDs. An explicit conflicting identity still fails; all amount, currency, capture, plan, quantity, offer, cadence and period checks remain. |
| Future-start authorization can omit both invoice and direct subscription identity | Require the server-verified signed callback pair, or the same previously confirmed payment/intent binding on later reads. Unverified browser payment hints cannot establish that binding. Authorization alone never grants paid access. |
| Stored entitlement validation compared millisecond intent timestamps against second-precision provider payment times | Use the same provider-second precision as live commercial validation. Same-second settlement remains valid; settlement in an earlier second remains rejected. |
| Reopening Checkout after payment quarantine could create a second local authorization attempt | Hold reuse while the subscription has an unresolved manual-review authorization; require owner reconciliation. Existing duplicate history is retained and can be closed through the authorized checkout-event service. |
| Actual domestic-card plan update was rejected by Razorpay | New CARD plan/quantity changes use a separate replacement mandate and fresh authorization. Stored CARD identity has no geography evidence, so all cards use this conservative path. Card-only replacement works with the multi-method flag off. Historical admitted commands retain their recovery/undo identity. |
| An authorized future-start source has no current paid cycle to cancel at its end | Preserve the exact future charge date; hold when it is too close. After exact candidate authorization, retire the source with the existing durable cancellation protocol only with fresh zero-paid-count, empty complete invoices, unchanged terms and local evidence. Lost responses remain held for read-only recovery. |
| Replacement checkout payload reported the monthly fee as due today | Return zero Lab Lords plan fee today and the frozen provider start date for a replacement. The confirmation UI already shows the separate mandate verification disclosure. |
| Retry returned a nested replacement checkout that the UI ignored | The shared checkout extractor handles both direct payloads and the owner operation envelope; Billing and the processing page can reopen the existing mandate. |
| Trial branch retry/discard omitted its billing operation type | Include the tenant-scoped trial update and preserve the normal lease/cancellation guards. A missing candidate cannot justify discarding an admitted or uncertain provider action. |
| Complimentary upgrade notice inferred access from candidate status | Require the matching operation's actual unrevoked grant and authoritative entitlement state before showing the notice. |
| Complimentary feature access was mislabeled as the billed plan | The price summary uses the canonical subscription for the billed plan and separately displays effective feature access. A paid Basic source remains visibly Basic while a recorded complimentary Standard grant is active. |
| An authorized trial subscription lacked cancellation controls | Expose the existing server-supported cancellation boundary for eligible authenticated trial subscriptions, with matching confirmation, scheduled state and undo. Preserve the trial end date. |
| Razorpay automatically refunded the INR 5 verification payment before callback validation | Accept only the exact fully refunded verification token for an authenticated, uncharged future mandate with complete empty invoice history and trusted callback binding. Record that binding after signature and scope checks before provider reads so later recovery can reuse it. Refunded invoices never settle paid access. |
| Local execution could select LIVE mode | Only explicit Vercel Production can use LIVE. Local, unknown, development and Preview contexts require TEST. |
| Replacement discovery did not compare every frozen provisioning term | Match identity, notes, mode, source, plan, quantity, start/expiry, total count and offer absence. An uncharged candidate requires explicit `paid_count = 0`. |
| Authorization-expiry cleanup could act on stale provider state | Recheck exact current subscription, tenant, mode, unpaid status, complete empty invoice history, fresh provider state and local payment evidence before dispatch. |
| Billing controls were buried in Settings | New dedicated navigation and shared-design-system Billing page, authoritative plan/trial/pending states, plan capabilities, invoice pagination and recovery controls. |
| Slow overview responses could overwrite a newer scope or plan | Request-version and unmount fencing protect the page and shared billing context; successful refresh updates feature gates. |
| Plan descriptions and capabilities lacked Hindi/Hinglish ownership | Added owned translations and responsive browser assertions. |
| Shared billing summary and payment-method panels retained English-only text | Use the owned dictionaries for both panels and test their Hindi/Hinglish labels. |

Principal implementation files: [billing service](../../services/billing.service.ts),
[mutation recovery](../../services/billingMutation.service.ts),
[reconciliation](../../services/billingReconciliation.service.ts),
[provider action receipts](../../services/billingProviderAction.service.ts),
[replacement provisioning](../../services/billingReplacement.service.ts),
[Razorpay adapter](../../lib/razorpay.ts),
[Billing content](../../components/billing/OrganizationBillingContent.tsx),
[invoice history](../../components/billing/BillingInvoiceHistory.tsx), and
[shared billing context](../../components/billing/BillingExperienceProvider.tsx).

## Plans and feature access

Existing prices and product policy are unchanged. Internal `PRO` is presented
as Standard. Access comes from the existing server-side entitlement policy and
exact confirmed payment evidence, or the existing eligible owner trial.

| Capability | Basic: INR 299/active branch/month | Standard: INR 499/active branch/month |
| --- | --- | --- |
| Students/imports, seats/shifts, payments/receipts, fees/follow-ups, attendance, language preferences | Included | Included |
| Staff invitations, roles and permission controls | Locked | Included |
| Advanced branch and cross-branch analytics | Locked | Included |
| AI reports and message drafting | Locked | Included |
| WhatsApp automation | No plan entitlement | Plan entitlement exists; separate operational rollout and readiness still apply |

Hidden Agent Control and Custom plans remain unavailable for checkout.
An `ACTIVE` provider status by itself does not grant paid features. Scheduled
downgrades retain current paid access until the applicable boundary; pending
or unverified payment cannot silently upgrade access. The existing replacement
policy can grant temporary complimentary upgrade features after exact mandate
authorization; this is separately recorded and does not create paidThrough or
promote an unpaid candidate. Core mutations still
require organization permission, tenant scope and branch writability.

The public Home, Features, Pricing and FAQ copy was reviewed. No price or feature
claim changed, and no new payment-method, refund or rollout promise was added.
See [public claims](../product/public-claims.md).

## Validation evidence

All commands run from the isolated worktree with `pnpm`. The normal integration
setup truncates its database, so verification uses the guarded
[integration runner](../../tests/billing-verification/run-integration.mjs).
It verifies the exact local Docker container and loopback binding, creates a
new empty random database, copies schema only, proves zero users/organizations,
and injects a synthetic TEST provider. No shared, Preview or Production data
is used. Browser component fixtures also use synthetic APIs.

| Check | Command | Result |
| --- | --- | --- |
| Affected unit tests | `pnpm exec vitest run --config vitest.unit.safe.config.ts --pool=threads --no-cache billing razorpay subscription entitlement RazorpayCheckoutLauncher CheckoutConfirmationDialog application-design-pilot RouteBoundaries branch-capabilities contextual-navigation --reporter=default --reporter=json --outputFile=test-results/billing-verification/unit-final.json` | 57 files, 622 tests passed on the final implementation |
| Database recovery and billing suite | `BILLING_REPORT_NAME=integration-final.json pnpm exec node tests/billing-verification/run-integration.mjs` (process environment set using PowerShell) | 233/234 passed; the remaining assertion expected the old native-update error wording. Corrected it for card replacement and added an explicit zero-create assertion; focused rerun below passed. |
| Wrong-mode replacement guard | `BILLING_TEST_NAME_PATTERN='wrong-mode subscription' BILLING_REPORT_NAME=integration-wrong-mode-final.json pnpm exec node tests/billing-verification/run-integration.mjs billing-mutation.test.ts` | 1 passed, 93 intentionally skipped; mode mismatch blocks create, update and provider reconciliation. All 234 cases have passing evidence across the broad and corrected focused runs. |
| Future-start source retirement | `BILLING_TEST_NAME_PATTERN='pre-start\|source cancellation\|source after response loss' BILLING_REPORT_NAME=integration-pre-start-source-final.json pnpm exec node tests/billing-verification/run-integration.mjs billing-mutation.test.ts` | 25 passed, 68 intentionally skipped; synthetic provider, fresh local database |
| Branch replacement lifecycle | `BILLING_REPORT_NAME=integration-card-branches.json pnpm exec node tests/billing-verification/run-integration.mjs branch-billing-lifecycle.test.ts` | 18/18 passed |
| Historical undo recovery followed by replacement | `BILLING_TEST_NAME_PATTERN='scheduled.change undo\|scheduled.undo retry\|rejected scheduled undo' BILLING_REPORT_NAME=integration-historical-undo-replacement.json pnpm exec node tests/billing-verification/run-integration.mjs billing-mutation.test.ts` | 5 passed; historical native receipt fixtures, no new native update |
| Trial branch retry/discard | `BILLING_TEST_NAME_PATTERN='pending trial branch' BILLING_REPORT_NAME=integration-trial-branch-recovery.json pnpm exec node tests/billing-verification/run-integration.mjs branch-billing-lifecycle.test.ts` | 11 passed, 18 intentionally skipped |
| Refunded authorization and recovery | Guarded `billing.test.ts` run; `integration-refunded-authorization-verified.json` | 6 passed, 72 intentionally skipped; signature, delayed reads, audited recovery and unverified-hint rejection |
| Responsive component browser suite | `pnpm exec playwright test --config tests/billing-verification/playwright.config.ts --max-failures=1` | 33/33 passed on the final implementation, including nested checkout retry, revoked-grant notices, billed/effective plan distinction, trial cancellation and localized shared panels |
| ESLint | `pnpm lint --ignore-pattern 'test-results/**'` | Passed; one unused eslint-disable warning in a generated Workflow route, zero errors |
| Production build | `pnpm exec node tests/dashboard-connected/start-local.mjs build` with process-only Clerk development keys | Passed, including type checking, 74 static pages and the two-workflow manifest |
| Patch whitespace | `git -c core.safecrlf=false diff --check` | Passed |
| Documentation links | Relative Markdown targets across the audit, ADR and changed canonical documents | All 122 targets across 10 documents resolve |

The recovery unit tests cover exact/missing/mismatched settlement evidence,
mode and provider identity, independent unresolved action holds, transactional
rollback, and the late-timeout race. The entitlement regression checks Basic
to Standard to Basic across client gates and server entitlement enforcement.
The database regression explicitly loses a successful undo response, recovers
it, then dispatches a subsequent billing change without duplicating the first.
The additional owner-entry regression passes with provider writes disabled:
unauthorized callers and foreign/missing operations are denied before provider
reads, the original undo dispatch becomes confirmed, and the queued successor
remains queued. Re-enabling the existing write switch and making a separate
owner plan-change request dispatches exactly once. Its focused database run
passed 1 test with 63 intentionally skipped; six added safe unit cases cover
the read-only route and its refusal of unrelated or ambiguous operations.

New provider-shape regressions exercise signed paid callbacks with missing/null
direct payment subscription IDs, exact invoice adoption and feature access,
same-second settlement timestamps, future-start trial authorization, eMandate
reconciliation, replacement authorization, and rejection of unverified payment
hints or conflicting identities. Checkout-quarantine coverage also proves that
repeated Start cannot create another operation, owner recovery works with
provider writes held, and a separate subsequent plan change dispatches once.
The authorization-only regressions use synthetic provider responses. Both paid
plan checkouts below have actual Test-account evidence. Additional negative
cases reject proof reuse for a different payment, invalid callback signatures,
unverified refunded-payment hints and refunded invoices as paid settlement.

Browser coverage includes desktop 1440px and mobile 390px/320px, English,
Hindi and Hinglish, legacy links, plan comparison and confirmation, invoice
paging/error retry/deduplication, and recovery followed by a plan-change request.
These are production components using controlled API fixtures, not gateway
checkout evidence.

Earlier verification attempts found stale TEST/LIVE test assumptions, a
Playwright configuration type error, and temporary-directory contention between
build and integration tests. These were corrected. Integration tests now use
their own cache directory and a 60-second database-reset hook timeout. Browser
artifacts have a dedicated output directory so they cannot erase database or
unit reports. Failed/interrupted attempts are not counted as passes.
The final unit rerun also corrected an in-memory test fixture missing the audit
model introduced by callback-proof persistence; it now starts with an empty
audit collection and does not fabricate trusted evidence. All 620 tests passed
after that fixture correction; the final UI additions increased the passing
suite to 622. The preceding failed report is retained.
The first complete database run passed 177 of 180 tests; its three failures
were stale local-LIVE fixture assumptions. All three passed after explicitly
scoping their simulated runtime to Production while retaining the isolated
local database and injected provider. Final broad results are recorded above.

## Actual Razorpay Test-account verification

A read-only request using the configured `rzp_test_` credentials returned HTTP
200 and a valid plan collection. This proves API connectivity only.

The user started the Standard checkout in the isolated service harness. The
real Test provider created the subscription and the durable CREATE receipt is
CONFIRMED. Before authorization the subscription is CREATED, paidThrough is
null, the workspace is READ_ONLY, all three premium server entitlement checks
deny access and the client feature gates are false. Sanitized evidence is saved
in `test-results/billing-verification/real-test-standard-before-authorization.json`.

Automatic approval review rejected the agent's initial Checkout click as a
recurring-payment action requiring user handoff. The user completed the Test
simulator. Actual provider reads then confirmed a captured INR 49,900-subunit
payment and a fully paid matching subscription invoice; the payment response
omitted `subscription_id`. The old validator had quarantined this valid payment.
The repaired owner Retry adopted the original frozen intent using five provider
reads and zero provider writes. The original operation is APPLIED, the
subscription is ACTIVE/CARD, paidThrough is 2026-11-21T18:30:00Z, and workspace
access is FULL/PRO. All three premium server checks and all four client feature
gates are true. Evidence: `real-test-provider-inspection.json` and
`real-test-phases-standard-resumed-0da313adf1aa.json` under
`test-results/billing-verification/`. No second charge was needed.

The user also completed Basic checkout. Its matching provider invoice is paid
INR 29,900 subunits; the production service adopted ACTIVE/CARD, FULL/BASIC and
paidThrough 2026-11-21T18:30:00Z. All three premium server checks and all four
client feature gates are false. This is independent paid Basic evidence, not a
locally changed plan label.

The attempted native Standard-to-Basic update was rejected with the provider's
domestic-card restriction. No successful native scheduled undo occurred, so the
intended lost-undo-response scenario is **not** claimed as actual gateway proof.
The rejected operation and its queued successor were closed through the owner
undo service with no provider writes, preserving Standard access. Historical
native undo recovery remains covered by injected failure regressions.

The first replacement verification exposed an additional defect. The Standard-to-
Basic candidate remained CREATED, with zero paid count and no invoice. The Basic-
to-Standard candidate is AUTHENTICATED, also unpaid, with the correct future
start. Its INR 500-subunit card verification payment is fully refunded,
`captured=false`, and has no invoice or direct subscription field. The callback
was quarantined as PAYMENT_NOT_AUTHORIZED. This revealed another integration
gap: Razorpay automatically refunds this verification fee. The fix is covered by
115 focused unit and six database checks. It records a verified callback pair
before provider reads and permits only this exact authorization-only shape.
The pre-fix Basic operation lacks that retained proof and remains held; an
unverified payment hint cannot be converted into trusted historical evidence.
Both original paid terms remain intact. A clean Basic retest fixture was added
in the same independently verified disposable database. Its separate proof
records preservation of the original fixtures and zero provider calls during
fixture creation. The user completed the final authorizations on the repaired
code. Read-only provider inspection at 2026-10-22T12:04:54Z used 21 GET requests
and zero provider writes, confirming the following results:

| Actual Test flow | Confirmed result |
| --- | --- |
| Recovered Standard subscription, then Standard to Basic | The same replacement candidate is AUTHENTICATED and the change is SCHEDULED for 2026-11-21T18:30:00Z. The original paid Standard subscription remains ACTIVE with unchanged paidThrough; all three premium server checks and four client gates remain true. No premature downgrade. |
| Fresh Basic checkout | Exact INR 299 captured payment and matching paid invoice; ACTIVE/FULL/BASIC, with all three premium server checks and four client gates false. |
| Basic to Standard after that checkout | Candidate AUTHENTICATED and change SCHEDULED for the same future boundary. The original paid Basic subscription remains canonical with unchanged paidThrough. A separately recorded complimentary grant enables all three premium server checks and four client gates. The unpaid candidate has no paidThrough and is not promoted. |
| Both replacement verification payments | Each is INR 5, fully refunded and uncaptured, with no invoice. Both valid signed callbacks are now accepted as authorization only. Candidates have zero paid cycles and empty invoice histories. |
| Provider mutations in the final harness session | Two creates for the fresh Basic subscription and its Standard candidate; the existing Standard-to-Basic candidate was reused. Zero native updates, scheduled undos or other writes. |

Evidence files under `test-results/billing-verification/`:
`real-test-provider-inspection.json`, `real-test-summary-standard.json`,
`real-test-summary-basic-retest.json`,
`real-test-phases-standard-resumed-2ffab9952d05.json` and
`real-test-phases-basic-retest-resumed-2ffab9952d05.json`. The phase history
records the fresh Basic gates as false before authorization of the upgrade and
true afterward. The original failed Basic attempt remains quarantined as
historical evidence. No LIVE transaction was performed.

The real harness uses the production billing services and Razorpay Checkout in
a loopback-only test page. It does not exercise authenticated Next.js/Clerk
routes. It uses a separate fresh database and synthetic owner/workspace per
plan. It never disables application authentication or changes a saved
application environment file. Actual public webhook delivery is not claimed.
The future scheduled boundary has not occurred: actual source retirement,
renewal collection and paid candidate promotion are covered by deterministic
integration regressions, not claimed as completed Test-account events.

## Deployment, rollback, and remaining limits

No package versions, Prisma schema, migration history, seed data, saved
environment configuration or production data changed. Local verification
databases are disposable test fixtures. No migration is needed. Existing
gateway keys, webhook configuration, billing-write controls and account-level
recurring-payment availability still govern deployment.

Roll out only after owner review and the applicable Test-account acceptance
checks. The runbook documents recovery inspection and release evidence.
Rollback must retain confirmed receipts, replacement state and payment evidence.
Do not restore a writer that repeats uncertain actions or issues new unsupported
domestic-card plan updates; prefer a compatible forward repair. A durable action that remains uncertain should
stay held for reconciliation/manual review rather than be blindly replayed.

Razorpay exposes no atomic compare-and-cancel API: a provider transition after
the last expiry-cleanup read and before cancellation remains a distributed
race. The added checks reduce the window and refuse observed ambiguity; they
cannot claim to eliminate that provider boundary. Very large or inconsistent
invoice histories fail closed and require investigation. Test-mode success
does not establish LIVE account enablement, real bank behavior, or every future
renewal/webhook delivery condition.

Canonical follow-up: [current state](../ai/current-state.md),
[domain invariants](../domain-invariants.md), [security](../../SECURITY.md),
[production runbook](../production-runbook.md),
[design system](../ai/application-design-system.md), and
[migration/release evidence](../redesign/page-family-migration.md).
The conservative all-card routing choice is recorded for human review in
[Proposed ADR 0006](../decisions/0006-card-subscription-replacement.md); it is not
an Accepted decision or deployment approval.

## External references

- [Razorpay subscription invoice API](https://razorpay.com/docs/api/payments/subscriptions/fetch-invoices/)
- [Razorpay payment fetch API](https://razorpay.com/docs/api/payments/fetch-with-id/): payment responses expose `invoice_id`; subscription invoice evidence supplies the subscription association.
- [Razorpay subscription creation](https://razorpay.com/docs/api/payments/subscriptions/create-subscription/)
- [Razorpay subscription states](https://razorpay.com/docs/payments/subscriptions/states/)
- [Razorpay Test subscriptions](https://razorpay.com/docs/payments/subscriptions/test/): Test cards and sandbox lifecycle limitations.
- [Razorpay subscription updates](https://razorpay.com/docs/api/payments/subscriptions/update-subscription/)
- [Razorpay update restrictions](https://razorpay.com/docs/payments/subscriptions/update): domestic-card subscriptions support linked-offer updates only.
- [Razorpay subscription FAQ](https://razorpay.com/docs/payments/subscriptions/faqs/): the INR 5 card/UPI verification amount is automatically refunded without capture.
- [Official Razorpay Node invoice adapter](https://github.com/razorpay/razorpay-node/blob/master/lib/resources/invoices.js)
- [ChatGPT plan-selection reference](https://learn.chatgpt.com/docs/pricing): conceptual separation of plans, included capabilities and upgrade controls; Lab Lords pricing and entitlements were preserved.
