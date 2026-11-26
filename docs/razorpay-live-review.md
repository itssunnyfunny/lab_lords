# Razorpay live-review checklist

Before requesting Live review, retain the isolated Test acceptance results
and use the operator-authorized procedure in [branch billing operations](billing/independent-branch-rollout.md).

## Public website

Verify these routes return `200` without Clerk authentication and remain linked in the public footer, sitemap, and robots allow-list:

- `/privacy`
- `/terms`
- `/refund-policy`
- `/shipping-delivery-policy`
- `/contact`

The Contact page must display the exact business/operational address supplied in Razorpay KYC. `NEXT_PUBLIC_BUSINESS_ADDRESS` cannot be empty, “available on request,” or another placeholder. Also confirm the monitored support email, one-business-day response time, billing/refund instructions, and Lab Lords brand name.

Verify Basic at ₹99, Standard at ₹299 and Pro at ₹499 per branch per month.
Three branches choosing one of each total ₹897 before tax. Each can renew
on its own date and has its own invoice. Basic includes student records,
reviewed imports, seats, shifts, allocations and fees. Standard adds staff
administration, analytics and AI. Pro adds eligible WhatsApp functionality
subject to sender setup and messaging terms. The once-per-owner trial uses
the chosen trial tier and original expiry. A new branch can select a different
future plan without extending that trial.

## Checkout, mandates, saved cards, and OTP copy

Initial authorization and recovery Checkout must set `remember_customer: false`. In Razorpay Dashboard, disable Flash Checkout and Quick Buy in both Test and Live Mode. This prevents Lab Lords from asking Razorpay to save the card for later selection; the recurring subscription mandate itself remains available for provider-initiated charges.

Keep billing phone and email editable. They are Checkout contact and notification defaults, not proof of the contact registered with a card, bank account, or UPI app. When the multi-method flag is enabled, omit the card-only Checkout display configuration and allow Razorpay to show only the recurring methods eligible for that account, amount, bank/app, and device.

For UPI AutoPay, verify mobile app Intent and desktop QR paths in Standard Checkout; do not collect or trust a VPA in Lab Lords. For eMandate, explain that authorisation can use netbanking, debit card, or Aadhaar and may remain in `CREATED` while the bank completes setup. No paid access or `paidThrough` advancement follows from browser success alone.

Only when Card is selected, tell the customer:

- Lab Lords does not know or control the card-registered phone.
- The issuer/bank sends the required 3-D Secure authorization OTP to the mobile, email, or device registered with that card.
- A skippable “Securely saving your card” OTP is Razorpay saved-card/contact verification, not the issuer's mandatory card-authorization OTP.
- Test Mode authentication is simulated and sends no real SMS.
- Razorpay may make a temporary ₹5 verification charge that it automatically refunds; the plan fee starts only on the provider-confirmed charge date.

Confirm the skippable saved-card OTP screen no longer appears after disabling the Dashboard features and deploying `remember_customer: false`. If it still appears, capture the Razorpay payment/subscription IDs and screen recording and open a Razorpay support case; do not replace the Checkout contact with a guessed “card phone,” because merchants cannot read that value.

A `billingPlan` query may highlight a plan and open the Lab Lords confirmation sheet only. It must never create a subscription or open Razorpay until the owner explicitly confirms.

## Razorpay account settings

Configure and verify settings independently in Test and Live Mode:

- Subscription payment methods: Card, UPI AutoPay, and eMandate enabled. Netbanking is an eMandate authorisation route, not a separate one-time rail.
- Account approval: the account-specific Methods API and Standard Checkout both expose the expected recurring capabilities.
- Dynamic eligibility: use the Methods API for current recurring card/eMandate catalogs and Razorpay Checkout for UPI, amount, and device eligibility; do not maintain bank/app lists in Lab Lords.
- UPI presentation: mobile Intent and desktop QR complete successfully for an eligible Test amount.
- Flash Checkout: disabled.
- Quick Buy: disabled.
- Test and Live webhook endpoints use different secrets.

Webhook events:

- `subscription.authenticated`
- `subscription.activated`
- `subscription.charged`
- `subscription.updated`
- `subscription.pending`
- `subscription.halted`
- `subscription.paused`
- `subscription.resumed`
- `subscription.cancelled`
- `subscription.completed`
- `invoice.paid`
- `invoice.partially_paid`
- `payment.authorized`
- `payment.captured`
- `payment.failed`

Do not select `subscription.expired`. Verify a signed delivery receives `2xx` and produces one idempotent receipt before acceptance. The endpoint must reject declared and streamed bodies above 512 KiB with `413`, authenticate exact bytes before parsing, reconcile only once for simultaneous same-body deliveries, acknowledge the nonowner as in progress, reclaim an expired claim, and reject same-ID/different-body collisions. Invoice-only events must resolve their subscription/payment IDs and reconcile provider state. Frontend success and `subscription.activated` alone never advance `paidThrough`.

## Test Mode acceptance

Use an isolated Test database, Test credentials and a restricted QA account containing demo data. Run integration suites only against their dedicated disposable database.

1. Confirm onboarding stores the first branch’s future plan and grants one eligible owner trial without opening Checkout.
2. Check the chosen trial tier, original end date, ₹0 plan fee today and quantity-one renewal quote for each branch. Confirm the first charge date against the provider.
3. Authorise Basic, Standard and Pro. Exercise eligible card, UPI AutoPay and eMandate options offered by Checkout, including mobile Intent, desktop QR and delayed eMandate authorization.
4. Decline authorisation, close Checkout without an attempt, retry with another eligible method, delay the callback, and complete via signed webhook. Existing trial/current entitlement must remain unchanged until mandate confirmation. Card contact remains editable and the saved-card OTP screen is absent.
5. Confirm Basic direct calls to Standard analytics/staff/AI APIs return `403`; Standard succeeds when the role also permits it.
6. Exercise all six directed plan changes and a payment-method switch on an existing branch mandate. Check the exact candidate identity, accepted method, quantity one and payment date quoted for the selected branch.
7. Verify an eligible upgrade after candidate authorization, a downgrade at its quoted boundary and Undo up to its stored cutoff. For a paid change allow one hour for authorization and 48 hours before the charge to retire the source. Verify scheduling, Undo and archival for one branch leave sibling mandates and original trial dates intact.
8. Test candidate failure/undo, old-subscription cancellation retry, duplicate events, orphan adoption after response loss, overlapping-charge manual review, atomic cutover, and the three-day eMandate bank-confirmation grace. For initial checkout, deliberately lose the response after Razorpay accepts the create and verify owner retry performs provider reads only, adopts the one exact uncharged `CREATED` object, and leaves the provider create count at one. Inject zero matches, two exact matches, and one authorized/charged match; all must remain typed manual review without cancellation, recreation, entitlement, or cross-tenant/cross-mode adoption. Do not expect an automatic refund.
9. Test renewal `PENDING`, `PAUSED`, `HALTED`, hosted mandate recovery, Card fallback recovery, and full-access restoration only after captured payment/paid invoice advances `paidThrough`.
10. Replay callbacks and webhooks out of order, race two identical signed deliveries, reclaim one deliberately expired Test claim, and confirm one provider reconciliation plus one invoice/history/activation effect. Confirm a stale token cannot finalize its successor.
11. Run the enabled preflight with Subscription settings, UPI Intent, UPI QR, webhook, and amount evidence flags; retain its aggregate account Methods API report.
12. Verify the target Preview branch and Test credentials, invoke the protected billing schedule and inspect its execution result. Check the eight named schedules in the deployed environment.

Run and retain results for Prisma validation/migration status, full Vitest, lint, production build, authenticated desktop/mobile Playwright, Test Mode lifecycle, and signed webhook reconciliation.

## Production release evidence

Before the first Live authorization, the held Production preflight must prove:

1. Production `SaasRazorpayPlan`, current subscriptions, offers, and provisioning records contain no `TEST` row.
2. On an empty Live catalogue, the first controlled authorization provisions the selected branch tier with its exact INR monthly terms. On an existing catalogue, verify the same-mode provider plan and its stored terms before reuse.
3. Preview and Production database fingerprints differ.
4. The account-specific Methods API is reachable with the Live Key ID and reports current recurring Card/eMandate capabilities plus UPI account availability. Dashboard evidence confirms Card, UPI AutoPay, eMandate, UPI Intent/QR, required webhooks, and tested amount eligibility.

After the controlled authorization, rerun the preflight with the returned Live `plan_...` ID in Production and forbid that ID in Preview. This proves:

5. The Live plan returned by Razorpay is stored and provider-fetchable in Production only.

Also retain evidence of a signed Live webhook `2xx`, completed processing page, the selected branch’s quantity-one mandate and charge date, `paidThrough` behavior, replacement/cutover, pause/resume, cancellation, hosted recovery, and successful Production hourly cron invocation.

Drain incompatible writers and active leases before applying the forward
migrations. Check the structural initialization counts and any unresolved
historical mandates. Verify signed Test webhooks, initial provisioning,
replacement cutover, uncertainty recovery and the eight schedules against the
release candidate. Production release and any Live payment require separate
operator authorization. Keep ambiguous provider outcomes on the original
operation for read-only reconciliation.
[Branch billing release and recovery](billing/independent-branch-rollout.md).

## Reviewer access

Create a dedicated restricted Clerk reviewer account only if Razorpay requests login credentials. Include demo-only organization, branch, student, and payment data. Share credentials privately through Razorpay onboarding or another approved private channel; never commit them, place them in logs, or include them in a pull request.
