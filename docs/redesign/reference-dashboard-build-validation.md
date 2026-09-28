# Reference dashboard build and migration verification

Date: 27 September 2026. These checks concern the local implementation; they do
not authorize deployment or represent the owner's visual acceptance.

## Target and provider isolation

The integration suites used the independently created, verified disposable
PostgreSQL target `127.0.0.1:55447/lab_lords_dashboard_final_test`. Build verification
used `lab_lords_dashboard_final_browser_test` on the same loopback port; final
connected browser review uses the separately verified
`lab_lords_dashboard_review_browser_test` target recorded in its own report.
Test setup was inspected: explicit TEST_DATABASE_URL plus
an exactly matching TEST_DATABASE_RESET_CONFIRM prevent `.env.test` fallback.
The connected verification agent applied all 53 maintained migrations to the
fresh targets before these checks.

`tests/dashboard-connected/build.mjs` privately verifies the actual database
identity and `transaction_read_only = on` before starting the normal `pnpm build`
script. It pins DATABASE_URL/DIRECT_URL to that loopback target, disables
Accelerate, blanks external-provider credentials, holds billing/import/messaging
flags and retains only the existing Clerk development authentication keys.
No persistent environment file is edited. Build output is redacted before being
written to the ignored `test-results/dashboard-build.log`.

## Commands and observed results

PowerShell invokes the existing pnpm shim as
`& "$env:APPDATA/npm/pnpm.cmd"`. Direct Prisma/Vitest/ESLint binaries use their
Node entrypoints because this workspace's executable shims are unavailable.

| Command | Observed result |
| --- | --- |
| `pnpm lint` | Final PASS, exit 0; zero errors, two unused eslint-disable warnings in the generated Workflow route and existing `coverage/block-navigation.js` artifact |
| `pnpm exec node node_modules/eslint/bin/eslint.js tests/application-design-pilot/reference-fixture.ts tests/application-design-pilot/reference.spec.ts tests/unit/lib/dashboard-fixture.test.ts` | PASS, exit 0; no warnings or errors on the three final test-only edits |
| `pnpm exec node node_modules/vitest/vitest.mjs run tests/integration/services/relationship-catalog.test.ts tests/integration/services/operational-tenant-migration.test.ts tests/integration/services/operational-tenant-integrity.test.ts tests/integration/services/billing-whatsapp-tenant-migration.test.ts tests/integration/services/import-tenant-migration.test.ts` | PASS: 5 files, 28 tests, 23.45 seconds |
| `pnpm exec node tests/dashboard-connected/build.mjs` (verified local browser-test target in process environment; executes the unchanged `pnpm build` script) | Final PASS, exit 0: Next 16.2.5 Turbopack compiled in 52 seconds; TypeScript passed in 106 seconds; 74/74 static pages generated in 995ms; all dashboard and destination routes included |
| `node scripts/verify-import-workflow-manifest.mjs` (run by `pnpm build` after compilation) | PASS: both required import workflows registered |

The first build attempt exited 1 before Next compilation because the sandbox
blocked Workflow/esbuild from reading `../..`; the resulting alias-resolution
failure was a consequence of that filesystem denial. The identical provider-held
wrapper was then rerun with approved sandbox escalation. No dependency,
application import or compiler configuration was changed to bypass the failure.
That attempt compiled successfully in 59 seconds, then reported the missing
typed translation key `Organization overview`. English/Hindi/Hinglish entries
were added by the destination implementation agent. The next rebuild passed
with those entries and the SVG chart aspect-ratio correction; the failed
attempt's redacted log is retained locally as
`test-results/dashboard-build-attempt2.log`.

That intermediate successful build was retained as
`test-results/dashboard-build-intermediate-pass.log`. Final review then added
historical-chart refresh/restriction handling, timezone-safe calendar labels,
and legacy settlement normalization in the CSV report. Full lint was rerun and
passed after those changes. One subsequent build was intentionally stopped at
the TypeScript stage to include the last visual-review typography correction;
its log remains as `test-results/dashboard-build-interrupted-css.log`.

The typography build passed in 47 seconds with TypeScript in 64 seconds; its
log remains as `test-results/dashboard-build-before-notification-repair.log`.
Connected browser checks then found a stale notification condition after a
follow-up mutation. The repair refreshes on dialog open, guards writes while
loading or failed, and refreshes after a stale-condition response without
acknowledging its replacement. The application shell also waits for Clerk's
client identity readiness before mounting interactive branch content, preserving
the existing identity reset and server authorization boundaries.

The latest build started after those repairs were frozen: application shell
12:07:02 local, notification component 12:09:50, and localized notification
message 12:09:51. Full lint was rerun on the same frozen runtime source and
passed. This build passed with the timings recorded above. The prior compiled
CSS inspection independently confirmed the 10.5px worklist text, visible mobile
search, and 149px desktop plot height; no CSS changed in these repairs. The chart
source includes
`preserveAspectRatio="none"`. The current redacted
`test-results/dashboard-build.log` ends with the successful manifest check and
build exit code 0. The connected verification agent was then notified that the
production-built local app was ready to restart; this report does not substitute
for its authenticated route/action tests.

The initial lint pass had one additional request-ref cleanup warning, which was
corrected. A later lint run overlapped an incomplete test-file write and reported
a parser error in `tests/application-design-pilot/pilot.spec.ts`; after that file
was saved, the full lint retry passed with only the two artifact warnings above.
The visual-fixture and coherence-test changes were checked separately, and the
latest full lint pass includes the chart/calendar, report-service, notification,
and shell-readiness fixes. No runtime source changed during the latest build.

The relationship inventory now contains 199 owning relations: all previous 186
entries were retained, and exactly the 13 relations introduced by the seven
dashboard tables were added. The catalog test verified every listed foreign key
against validated PostgreSQL constraints. The migration suites separately
verified valid-history preservation and rejection of mixed-tenant histories;
direct integrity tests exercised foreign/sibling branch references. The new
dashboard service integration coverage is recorded separately by the connected
verification agent, including actual SQL source-failure/savepoint recovery.

No shared or Production database was accessed. No package versions, public
website runtime, provider rollout flag or persistent environment configuration
was changed by these checks.
