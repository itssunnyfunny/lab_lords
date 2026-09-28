# Disposable connected-fixture port repair

## Original closeout proposal (2026-09-28)

At the bounded closeout, connected verification was **BLOCKED**. At that time,
`netsh interface ipv4 show excludedportrange protocol=tcp` reported
`55371–55470` as excluded; the guarded fixture was configured for loopback port
`55447`. No connected test, migration, seed, reset, or fallback database was
part of that closeout. This section preserves the reason and proposed repair;
the execution record below describes the separately authorized local work.

In a separate local-fixture maintenance task, choose a loopback port that is
outside the exclusions **at execution time** and has no listener. Recreate a
fresh disposable `postgres:16-alpine` container bound to `127.0.0.1` on that
port; a port binding cannot be repaired by editing metadata for the old
container. Create only a new `lab_lords_dashboard_*browser_test` database,
apply the checked-in migrations to that empty test database, and load only the
synthetic fixture. Independently inspect the container ID, image, binding and
database identity before updating the ignored
`.clerk/dashboard-local-runtime.json` and `.clerk/dashboard-fixture.json`
records to refer to that exact container and fixture.

Then use `tests/dashboard-connected/start-local.mjs` as written. Its identity
guard must pass before any connected build/test; do not relax its container,
loopback, database-name, or reset-confirmation checks. If the port or identity
changes again, stop and repeat the independent verification rather than using
an application environment URL, shared database, or unverified substitute.
This proposal does not authorize a production or shared-database operation.

## Authorized local execution (2026-09-28)

Read-only IPv4/IPv6 exclusion and listener checks found port `59117` outside
the applicable excluded ranges and without a listener; an independent loopback
bind probe succeeded. A **new** disposable `postgres:16-alpine` container was
created, leaving the old stopped container (`94ec32d894ea…`, port `55447`)
untouched. The independently inspected target is:

| Property | Verified value |
| --- | --- |
| Container | `lab-lords-dashboard-test-20260928` |
| Container ID | `14c435177e235c254e58b7b62bfd20eae9818d66f3ebf0720144688db48556d4` |
| Image | `postgres:16-alpine` |
| Image ID | `sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685` |
| Sole host binding | `127.0.0.1:59117 → 5432/tcp` |
| Database | `lab_lords_dashboard_closeout_browser_test` |

The new database had **zero public tables** before setup. The existing
`scripts/bootstrap-isolated-database.mjs` applied the checked-in 53 migrations
only to this exact target; the existing connected seed then wrote one
transactional synthetic fixture. Independent Docker inspection and a host-side
read-only PostgreSQL connection confirmed the container, image, sole loopback
binding, database identity, 80 public tables, 53 completed migrations and the
exact synthetic `DashboardEvent` schedule marker. The pre-test fixture had
8 students, 16 seats, 5 fee rows, 19 live receipts, ₹4,300 billed, ₹1,900
collected and ₹2,400 pending. These are baseline counts, not claims about the
post-test state: connected checks intentionally add durable synthetic history.

Only ignored local fixture/runtime metadata was updated to identify the new
target; copies of the old ignored metadata were retained privately. No saved
application environment configuration, application migration, customer data or
provider state changed. The `start-local.mjs` exact-target guard remains
fail-closed; its only runner change is an allowlist for focused connected spec
filenames. Connected test outcomes and post-test invariants belong in the
[application closeout review](application-closeout-review.md), separate from
this fixture identity and setup record.
