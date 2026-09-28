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

For the 2026-09-28 local closeout, this procedure was completed on a **new**
disposable container `lab-lords-dashboard-test-20260928` (ID
`14c435177e235c254e58b7b62bfd20eae9818d66f3ebf0720144688db48556d4`,
`postgres:16-alpine`, image ID
`sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685`).
Its sole host binding is `127.0.0.1:59117 → 5432/tcp`, outside the then-current
Windows IPv4/IPv6 excluded ranges, and its database is
`lab_lords_dashboard_closeout_browser_test`. Independent Docker and host-side
PostgreSQL checks confirmed its identity, zero public tables before setup,
53 existing migrations and 80 tables after bootstrap, and the exact synthetic
`DashboardEvent` schedule marker after the single transactional seed. The
pre-test financial baseline is ₹4,300 billed, ₹1,900 collected and ₹2,400
pending; later tests intentionally create durable synthetic records, so compare
post-test counts by declared mutations and financial invariants. The former
fixture (`94ec32d894ea…`, port `55447`) remained untouched and stopped; copies
of its prior ignored metadata were retained privately before the current
ignored records were changed. See the [fixture repair record](../../docs/redesign/local-fixture-port-repair-proposal.md).

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

For a focused current connected case, the same exact-target guard accepts only
an allowlisted spec filename, for example
`pnpm exec node tests/dashboard-connected/start-local.mjs test rollout-closeout.spec.ts`
or `... test rollout-recovery.spec.ts`. The filename comes from the runner's
fixed allowlist; it cannot supply another database or bypass the container,
binding, fixture or live database identity checks. Run the prepared `test`
suite before additional focused cases, with the built application running under
normal development authentication and business providers held.

For the bounded shared-presentation/Students run, use `start-local.mjs build`
to build with the same exact verified target and enforced read-only transactions,
then `start-local.mjs students-test` for the dedicated three-test configuration.
This avoids the repository integration setup and its truncation. The Students
test confirms a scalar edit through the actual route/API and PostgreSQL, preserves
allocation context and financial aggregates, captures all three languages, and
checks readonly/staff/foreign access plus public and unmigrated routes. It holds
external business providers. It restores only its known synthetic student's name,
phone and interface preference; restoring the original null phone uses scoped SQL
because the existing edit form requires a nonblank phone. No schema, migration,
seed, saved environment or production authentication changes are involved.

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
