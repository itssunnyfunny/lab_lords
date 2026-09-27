# Connected dashboard verification

This directory exercises the real Next.js routes, server authorization and
Prisma/PostgreSQL services. It is separate from the deterministic component
preview in `tests/application-design-pilot`. No application authentication
bypass or provider impersonation is installed.

## Isolation

Use a **new, independently verified loopback PostgreSQL database** whose name
contains `browser_test`. Keep it separate from the integration database, whose
test setup truncates tables. Set `TEST_DATABASE_URL` and the exact database name
in `TEST_DATABASE_RESET_CONFIRM` privately in the runner process. Never reuse
an unverified `.env.test` target. No runner below prints credentials.

1. Inspect `scripts/bootstrap-isolated-database.mjs`, then apply the maintained
   migration chain with explicitly supplied `BOOTSTRAP_DATABASE_URL` and
   `BOOTSTRAP_DATABASE_CONFIRM`.
2. `pnpm exec node node_modules/tsx/dist/cli.mjs tests/dashboard-connected/seed.ts`
   refuses existing users/organizations and verifies the connected name. It
   writes one transactional, synthetic fixture and an ignored
   `.clerk/dashboard-fixture.json` containing only local fixture identifiers.
3. Existing owner/staff development storage states default to
   `.clerk/rc-owner.json` and `.clerk/rc-staff.json`. Supply different paths via
   `PLAYWRIGHT_OWNER_AUTH_STATE` / `PLAYWRIGHT_STAFF_AUTH_STATE` for seeding.
   The seed links only their existing subjects to synthetic local profiles.

The fixture has 8 active students, 16 physical seats, 3 active shifts, 48 total
slots, 6 allocated slots, 6 explicitly expected students and 5 manual Present
marks. Five monthly fee rows total ₹4,300; 19 synthetic immutable collection
receipts total ₹1,900, leaving ₹2,400. There are 2 scheduled follow-ups and
3 upcoming independent membership terms. Prior occupancy and receipt dates are
**synthetic test evidence**, never a production backfill. Test data has no phone
numbers, provider subscriptions, senders or provider payment records.

## Real development authentication

Saved sessions expire. The optional helper
`pnpm exec node tests/dashboard-connected/refresh-auth.mjs` checks existing
Clerk **test** keys, resolves only the already-saved subject, and refuses any
email outside the synthetic-test allowlist. It issues a 120-second sign-in
ticket, consumes it through the real Clerk client, and saves refreshed state
only inside ignored `.clerk/`. It does not create a user or send email, OTP,
SMS, billing or messaging requests. Tokens are never logged or committed.

For staff, set `PLAYWRIGHT_EXISTING_AUTH_STATE=.clerk/rc-staff.json` and
`PLAYWRIGHT_REFRESHED_AUTH_STATE=.clerk/dashboard-staff-auth.json` for that
helper invocation. The owner default output is
`.clerk/dashboard-owner-auth.json`. The helper's development-provider access
is solely for authentication; it does not replace normal Clerk middleware.

References: [Clerk test authentication](https://clerk.com/docs/guides/development/testing/overview)
and [short-lived sign-in tickets](https://clerk.com/docs/reference/backend/sign-in-tokens/create-sign-in-token).

## Local application and tests

For the verified container and review fixture created in this checkout, restart
without entering credentials or changing an application environment file:

```text
pnpm exec node tests/dashboard-connected/start-local.mjs
```

Keep Docker Desktop running. The helper checks the ignored
`.clerk/dashboard-local-runtime.json` against the exact Docker container ID,
PostgreSQL image, loopback port binding, ignored fixture metadata and connected
database name. It can start that same stopped container; it refuses fallback to
any other target. It starts the completed local build with providers held. In a
second terminal, use `start-local.mjs test`, `start-local.mjs capture`, or
`start-local.mjs counts` for guarded verification. Then open the normal review
window with `pnpm exec node tests/dashboard-connected/open-preview.mjs`.

The remaining instructions support independently recreated fixtures:

`pnpm exec node tests/dashboard-connected/server.mjs` starts webpack development
on `http://localhost:3117`. After the production build, set
`DASHBOARD_CONNECTED_MODE=start` to run the built application locally instead.
The launcher independently verifies the loopback database identity, requires
Clerk development keys, clears inherited non-auth provider credentials and holds
Razorpay billing, WhatsApp, AI and imports. It leaves normal authentication,
tenant checks, permissions and entitlements enabled. The application fixture uses
an explicit synthetic trial; this does not alter entitlement code.

Run:

```text
pnpm exec node node_modules/@playwright/test/cli.js test --config tests/dashboard-connected/playwright.config.ts
```

Override `PLAYWRIGHT_BASE_URL` for a different localhost port. Tests fail if the
explicit database or real synthetic owner/staff authentication is unavailable;
they do not silently skip required connected coverage. On a restricted Windows
runner, browser localhost/development-auth network access and the Workflow
compiler's dependency reads may require approved sandbox escalation.

Coverage includes aggregate/cohort agreement, empty/unconfigured sources,
persistent task/follow-up/notification state, foreign/missing equivalence,
read-only writes, restricted staff, scoped search, all supporting page routes,
real forms and CSV download, setup writes, receipt replay/void recovery, chart
periods, all seating tabs, branch switching and search-result navigation.
Screenshots land in ignored `test-results/dashboard-connected/`. The API tests
use fresh real Clerk tokens with `page.request` so a development HMR navigation
cannot discard a confirmed mutation response. A built local server is preferred
for final results. No provider charge or external message is part of this suite.

For an interactive review with the verified synthetic owner session, run
`pnpm exec node tests/dashboard-connected/open-preview.mjs` while the local
server is running. It opens a normal Chromium window at the original 1491px
width; close the window to finish. A fresh session can be obtained with the
development-only helper above. No sign-in token is placed in a review URL.

The suite restores only its two known synthetic follow-ups after an interrupted
run. It otherwise preserves history: completed verification tasks and voided
verification receipts remain in the disposable fixture as evidence. Membership
term tests add future terms distinct from upcoming renewals and monthly billing.
