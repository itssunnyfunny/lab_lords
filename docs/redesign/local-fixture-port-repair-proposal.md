# Disposable connected-fixture port repair — proposal only

Connected verification in the application closeout remains **BLOCKED**. On
2026-09-28, `netsh interface ipv4 show excludedportrange protocol=tcp` reported
`55371–55470` as excluded; the guarded fixture is configured for loopback port
`55447`. No connected test, migration, seed, reset, or fallback database is part
of this closeout.

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
