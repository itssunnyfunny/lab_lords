# Branch billing provider setup

Configure Razorpay for independent branch mandates. See [branch billing operations](billing/independent-branch-rollout.md) for initialization, schedules, recovery and rollback.

## Environment isolation

Preview and Production must use separate databases, Clerk instances, Razorpay modes, webhook secrets, and cron secrets. An authorized operator must identify and independently verify the Production database; an existing or locally configured database is not Production merely because of its name or history. Provision a separate Preview database with migrations and demo-only data.

| Variable | Preview | Production |
| --- | --- | --- |
| `DATABASE_URL` | Preview-only database | Independently verified Production database |
| `ACCELERATE_URL` | Preview database endpoint, if used | Production database endpoint, if used |
| `RAZORPAY_KEY_ID` | Test Key ID (`rzp_test_...`) | Live Key ID (`rzp_live_...`) |
| `RAZORPAY_KEY_SECRET` | Matching Test secret | Matching Live secret |
| `RAZORPAY_WEBHOOK_SECRET` | Test webhook secret | Separate Live webhook secret |
| `RAZORPAY_MODE` | `TEST` | `LIVE` |
| `RAZORPAY_BILLING_WRITES_ENABLED` | `true` | `true` during operation, `false` for a write pause |
| `RAZORPAY_MULTI_METHOD_SUBSCRIPTIONS_ENABLED` | `false` until multi-method Test acceptance | Enable for verified account-supported methods |
| `CRON_SECRET` | Unique Preview value | Unique Production value |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Test instance | Clerk Live instance |
| `CLERK_SECRET_KEY` | Matching Clerk Test secret | Matching Clerk Live secret |
| `NEXT_PUBLIC_SITE_URL` | Operator-approved stable Preview URL | Operator-approved Production URL |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Monitored support inbox | Monitored support inbox |
| `NEXT_PUBLIC_BUSINESS_ADDRESS` | Exact KYC-matching address | Exact KYC-matching address |

On a correctly configured installation, an omitted `RAZORPAY_BILLING_WRITES_ENABLED` permits billing writes. Set it to `false` for an emergency pause. Branch plans and historical billing records remain available during the pause.

`RAZORPAY_KEY_ID` is server-only. Do not configure `NEXT_PUBLIC_RAZORPAY_KEY_ID`; the server includes the public Key ID in the authenticated Checkout payload. Never put an API secret or webhook secret in a `NEXT_PUBLIC_` variable.

### Diagnosing a Card-only Checkout

Account capability configuration controls the payment methods offered by Checkout. If `RAZORPAY_MULTI_METHOD_SUBSCRIPTIONS_ENABLED` is absent or not exactly `true`, the billing overview reports `checkoutMethodAvailability.mode` as `CARD_ONLY` and the Checkout payload intentionally contains a card-only `config.display` block. For an approved local Test-mode check, set the server-only flag to `true` in the ignored local environment file and restart the Next.js process; environment changes are not applied to an already-running server. The overview should then report `PROVIDER_MANAGED`, and the Checkout payload must omit `config` so Razorpay can choose eligible recurring methods.

`PROVIDER_MANAGED` does not guarantee that every candidate method appears. Razorpay still requires Card, UPI AutoPay, and eMandate to be enabled for Subscriptions in the matching Test or Live account, with any required account approval complete. Currency, mandate amount, merchant category, device, UPI app, and bank support can further narrow Checkout. Netbanking appears only as an eMandate authorisation route, not as a separate one-time payment option.

Set GitHub Environment secret `PRODUCTION_DIRECT_DATABASE_URL` to the direct Production Postgres URL. The protected `.github/workflows/production-migrate.yml` workflow requires an explicit confirmation and is the only supported Production migration path.

## Provider and database preflight

`scripts/razorpay-preflight.ts` is read-only. It validates the target, `VERCEL_ENV`, key prefix, Clerk mode, feature switches, required public business data, database identity, provider-mode rows, active operations, and provider fetchability. It also calls Razorpay's account-specific [`GET /v1/methods`](https://razorpay.com/docs/payments/subscriptions/supported-banks-apps/?preferred-country=IN) endpoint using only the Key ID and reports aggregate Card, UPI, recurring-card, and recurring-eMandate capabilities. Bank, app, handle, and card-network lists are never compiled into this repository; Razorpay's current response remains authoritative. It prints fingerprints and aggregate counts only; it never prints credentials or raw provider IDs.

The Methods API does not prove every Dashboard-only or device-dependent setting. When `--expect-multi-method-subscriptions=enabled` is used, the preflight therefore requires explicit evidence flags for Subscription settings, Standard Checkout UPI Intent, desktop UPI QR, webhook subscriptions, and amount eligibility. The output records those attestations, the required webhook event set, and the highest configured charge per currency. Eligibility is still decided by Razorpay Checkout for the account, amount, customer bank/app, and device; do not turn these checks into a static allow-list.

The following environment-pull and Production preflight commands are for an
explicitly authorized human operator on an approved workstation. Coding agents
must not execute them or access the resulting values. If the operator-approved
procedure permits a local pull, place each Vercel environment in a separate
ignored, access-restricted file. Because local script execution is not itself a
Vercel deployment, set `VERCEL_ENV` explicitly for the invocation:

```powershell
vercel env pull .env.preview.local --environment=preview --yes
pnpm exec cross-env BILLING_ENV_FILE=.env.preview.local VERCEL_ENV=preview tsx scripts/razorpay-preflight.ts --target=preview
```

Record the Preview database fingerprint. An authorized operator can check an explicitly paused Production environment with an empty Live catalogue during initial setup.

```powershell
vercel env pull .env.production.local --environment=production --yes
pnpm exec cross-env BILLING_ENV_FILE=.env.production.local VERCEL_ENV=production tsx scripts/razorpay-preflight.ts --target=production --must-differ-from=<PREVIEW_DATABASE_FINGERPRINT> --expect-billing-writes=disabled --expect-empty-provider-catalog
```

The command exits non-zero for a shared database, wrong-mode row, credential mismatch, inaccessible provider entity, plan snapshot mismatch, unresolved configuration placeholder, unexpected feature-switch value, unavailable Methods API, or missing expected recurring capabilities. Use `--expect-billing-writes=enabled`, or `--expect-multi-method-subscriptions=enabled` for the actual write-pause and Checkout-method settings in that environment.

After Card, UPI, and eMandate have been enabled and exercised in the target Razorpay mode, run the enabled check with evidence captured from that same mode:

```powershell
pnpm exec cross-env BILLING_ENV_FILE=.env.preview.local VERCEL_ENV=preview tsx scripts/razorpay-preflight.ts --target=preview --expect-multi-method-subscriptions=enabled --confirm-subscription-settings --confirm-upi-intent --confirm-upi-qr --confirm-webhook-events --confirm-amount-eligibility
```

The preflight has no `--apply`, cleanup, cancel, delete, or migration mode. Old Test artifacts in the operator-verified Production database require all of the following before any change: a current backup, a reviewed itemized report, explicit owner approval, and a separately reviewed one-off operation. Preserve organizations, branches, students, owner trials, selected post-trial plans, and subscription history. Do not improvise cleanup SQL from this runbook.

## Razorpay Dashboard configuration

Configure these settings independently in Test and Live Mode:

- Disable Flash Checkout and Quick Buy.
- Under Subscription payment methods, enable Card, UPI AutoPay, and eMandate. “Netbanking” is an eMandate authorisation route, not a separate one-time payment option.
- Verify account approval for both recurring methods. If UPI or eMandate is missing from the account-specific Methods API response or Checkout, stop and resolve account enablement with Razorpay Support.
- Exercise UPI Intent on supported mobile devices and UPI QR on desktop Standard Checkout. Do not infer support from a hardcoded app list.
- Exercise Basic, Standard and Pro independently, each with quantity one. Razorpay Checkout, the selected bank/app, and the current account/MCC decide amount eligibility.
- Use a unique webhook secret for each mode.

Use a stable, publicly reachable Preview hostname for the Test webhook. Do not use an ephemeral deployment URL that changes on every push, and ensure Vercel Deployment Protection does not block Razorpay from reaching the webhook route.

Webhook endpoints:

- Preview Test Mode: `https://<stable-preview-host>/api/razorpay/webhook`
- Production Live Mode: `https://<approved-production-host>/api/razorpay/webhook`

Enable exactly:

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

Authorization expiry is handled by local deadlines and provider reconciliation. Leave `subscription.expired` out of the webhook event list. A signed callback or webhook triggers a read of the exact subscription. Verified mandate authorization can grant bounded upgrade access. Advancing `paidThrough` requires a matching captured payment and paid invoice for the branch's billing period.

The public endpoint accepts at most 512 KiB, verifies the HMAC and payload hash
over the exact received bytes before JSON parsing, and uses an expiring
token-fenced receipt claim. Concurrent same-body deliveries must produce one
provider reconciliation; the nonowner is acknowledged as in progress. Reusing
an event ID with a different payload remains a `400` collision.
