# Basic attendance verification — 2026-09-11

## Delivered behavior and files

- `prisma/schema.prisma`, `prisma/migrations/20260911120000_basic_attendance/`,
  `prisma/preflight/basic-attendance.sql`, `prisma/relationship-coverage.json`:
  four attendance tables, composite student ownership, daily/open-visit identity,
  ordered timestamps, version checks and durable immutable retry/audit evidence.
- `services/attendance.service.ts`, `lib/attendance.ts`, `lib/attendanceHttp.ts`,
  `lib/api/attendance.ts`, branch attendance/lookup API routes: bounded roster,
  history and audit reads; marks, visits, QR issuance/lookup and corrections;
  transaction-time policy checks, locking, idempotency and stale-write rejection.
- `components/attendance/*`, branch Attendance page, Students page,
  `BranchSidebar`, branch capabilities/page access and `next.config.ts`: connected
  manual/bulk attendance, open visits, student history/QR, download/print,
  supervised scanner, permissions, mobile layout and scoped camera policy.
- `lib/attendanceCamera.ts`: session-owned camera lifecycle and callback gate.
  `components/ui/Dialog.tsx`: inert parent dialogs no longer intercept keyboard
  events from nested dialogs, preserving correction/retry modals.
- New attendance integration, route, date/permission, camera, QR and browser
  tests; updated header test; canonical domain, security, architecture,
  relationship coverage and release documentation.

Focused dependencies added: `@zxing/browser` 0.2.1, `qrcode` 1.5.4 and
`@types/qrcode` 1.5.6. Existing dependency versions were not changed.
Official scanner/generator references and exercise instructions are in the
[feature contract](basic-attendance.md).

## Isolated databases and migration evidence

All database work used a new PostgreSQL 15 container,
`lab-lords-attendance-test-20260911`, bound only to `127.0.0.1:55433`.
`lab_lords_attendance_test` was dedicated to integration tests;
`lab_lords_attendance_browser_test` was separate so signed-in browser work could
not collide with truncation by the service tests. The existing `.env.test` target
was not used. Session-local TEST_DATABASE_URL and exact reset confirmation bound
tests to these targets; no repository environment configuration was edited.
No shared, Preview or Production database was read or written.

The existing `scripts/bootstrap-isolated-database.mjs` verified each empty local
target before applying all **51 maintained migrations**. Its postchecks confirmed
the migration count, required billing identity and validated constraints, with
no sample/customer/provider rows. AttendanceMark, AttendanceVisit,
AttendanceCredential and AttendanceCommand all began empty. Existing business
tables were empty in this bootstrap, so no populated Production migration
preservation claim is made.

The new read-only preflight SQL was also executed successfully on the synthetic
browser database (`transaction_read_only = on`, 51 completed migrations,
18 attendance/domain-target constraints validated and 13 attendance indexes).
`test-results/attendance-preflight.txt` contains local aggregate inventory.
After eight independent real smoke fixtures it recorded: 8 organizations,
8 branches, 8 students, 8 marks, 16 visits, 40 commands, 40 audit rows, 0 attendance
credentials, 0 payments and 0 allocations. Those are deliberate test-fixture
changes after migration, not migration backfills. QR persistence is tested in
the real service suite; browser download/print/scanning tests use mocked HTTP
fixtures and actual local QR algorithms.

During the first full run, local database I/O caused a pre-existing staff
transaction to exceed its 5-second timeout. Only this disposable container was
adjusted to `fsync=off` and `synchronous_commit=off`; subsequent tests retain
transactional rollback/uniqueness/isolation checks but do not test crash durability.
No corresponding application or deployment setting was changed.

## Commands and results

Commands used process-local isolated connection settings as described above;
credentials are deliberately omitted here.

- `pnpm exec node node_modules/prisma/build/index.js generate`: passed.
- `pnpm exec node scripts/bootstrap-isolated-database.mjs`: passed on both empty
  databases; 51 migrations and validated constraints.
- `pnpm exec tsc --noEmit`: passed on final feature code.
- `pnpm exec vitest run tests/integration/services/attendance.test.ts
  tests/integration/services/staff.test.ts
  tests/integration/services/relationship-catalog.test.ts
  tests/unit/theme-contract.test.ts`: **4 files, 44 tests passed**. Includes the
  final 13 attendance tests and all three initially failed full-suite areas.
- Focused route, date/permission, camera, branch-capability, header and student
  route checks: **6 files, 37 tests passed**.
- `pnpm exec vitest run tests/unit/lib/attendance-qr.test.ts
  tests/unit/lib/attendance-camera.test.ts`: **2 files, 5 tests passed**, with actual
  QR generation/software decoding and mocked camera lifecycle.
- Final route/catalog follow-up: **2 files, 5 tests passed**.
- `pnpm test:workflow`: **1 file, 1 test passed**.
- `pnpm build`: passed after final source changes, including TypeScript, static
  pages and both import Workflow manifests.
- `pnpm lint`: passed, **0 errors**, one existing unused-disable warning in
  generated Workflow JavaScript. An earlier lint overlap with coverage output
  failed while that output directory was being rewritten; the sequential rerun
  passed.
- `git diff --check`: passed. Windows line-ending notices are warnings.
- Final `pnpm test:coverage`: **276 files, 2,068 tests passed**, exit 0 in
  452.93 seconds. Coverage: statements 69.79%, branches 63%, functions 82.8%,
  lines 72.8%. Both configured gates (70% functions and lines) passed. This
  includes existing Renewals, Collections, student, seat and access regressions.
- Documentation link validation: **47 local links checked, none missing**.

The first full coverage run executed **275 files / 2,065 tests**, with 2,062
passing and three failures: an undefined new theme token, the relationship
inventory not yet reflecting new foreign keys, and the existing staff transaction
timeout during slow I/O. The first two were fixed and the third passed unchanged
on rerun. That failed run is not represented as a passing CI run. The coverage
command runs the same full Vitest suite as `pnpm test`, plus its coverage gates.

## Browser and device results

Used the existing saved development test-account session through real Clerk
authentication on `http://localhost:3106`; no authentication bypass was added.
The browser verification skill's installed agent-browser launcher verified the
local page, controls, screenshot and browser errors. Playwright then exercised
the signed-in application. The development server was stopped afterward.

`pnpm exec playwright test tests/browser/attendance.spec.ts
tests/browser/attendance-connected.spec.ts --workers=1`: **10 tests passed** across
Chromium desktop and Pixel 7 mobile emulation. Coverage includes exact selection,
confirmed results, lost-response retry using identical payload/key, camera
denial/manual fallback, no camera request before opening, QR PNG download,
print-window content, QR decoding from a generated video stream, explicit scanner
mode, duplicate callback suppression and stopped tracks, history and corrections.

The real connected test uses actual routes/services/PostgreSQL: manual Present
creates no visit, check-in/out and a later visit work, an explicitly entered
checkout correction updates history, and final counts are attended=1,
absent=0, notMarked=0, open=0. It verifies two visits and five atomic audit rows,
with no payment/allocation writes or membership changes. After extending this
test to the real Students row menu → Attendance & QR entry, both desktop and
mobile checks passed again (**2 tests**). Nested-dialog Escape plus uncertain
correction retries separately passed on both viewports (**4 tests**).

Real generation and software decoding ran. Camera media, denial and duplicate
callbacks were simulated; no physical phone/webcam or real printer was tested.
Mobile emulation is not a hardware-camera compatibility claim. Screenshots are
in ignored `test-results/attendance-roster-*.png` and
`test-results/attendance-connected-*.png` (and history screenshots from the full
browser run); the reviewed layouts fit their viewports.

## Release status and unchanged behavior

### Follow-up release review

The release review verified local and remote `main` at
`468f67b2c9682ba0440cf52eedeb6fad6f964a60`, then created
`codex/basic-attendance-release` under the owner's release authorization.
Only attendance and necessary shared changes are staged; unrelated reset files,
`debug.log` and 94 lines of reset documentation are excluded.

Review covered transaction-time permissions and branch writability, composite
student ownership, durable input/actor-bound retries, mark/visit conflicts,
versioned corrections, immutable audit/receipt storage and existing payment audit
writers. Existing payment/collection writers always provide paymentId and no
studentId, matching the new domain-target constraint; their code is unchanged.

One concrete defect was fixed: Next.js client navigation retained the previous
document's camera Permissions-Policy. `AttendanceCameraBoundary` in the root
layout uses document navigation when entering/leaving Attendance and withholds
destination controls during a programmatic route transition until the document
reloads. Header scope remains Attendance-only. The final navigation/Back/Forward
regression passed on desktop and mobile (**2 tests**). This follows the
[document-scoped camera policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy/camera).

The existing attendance browser cases and expanded collection receipt/void
dialog case passed on both viewports (**10 tests**). Collection tests now cover
receipt dismissal, required void reason, ordinary Escape dismissal and Escape
being blocked during an in-flight void. Navigation testing drove document-level
navigation at the boundary as well as destination hydration waits. Earlier
failed attempts are not counted as passing checks.

Release-review commands:

- `pnpm exec vitest run tests/integration/services/attendance.test.ts
  tests/integration/services/fee-collection.test.ts
  tests/integration/services/payment.test.ts tests/unit/next-config.test.ts
  tests/unit/lib/attendance-camera.test.ts tests/unit/api/attendance.route.test.ts`:
  80/81 passed initially; one unchanged payment test's database-reset hook timed
  out while other local checks were running. With the dev server stopped,
  `pnpm exec vitest run tests/integration/services/payment.test.ts` passed all
  **39 tests** in 16.97 seconds. No timeout or payment-code change was made.
- `pnpm lint`: **passed, zero errors**; unused-disable warnings in generated
  Workflow JavaScript and the generated coverage report.
- `pnpm build`: **passed**, including TypeScript, 43 generated static pages and
  both import Workflow manifests. Final `pnpm exec tsc --noEmit` also passed.
- `pnpm test:workflow`: **1 file, 1 test passed**. Working and staged
  `git diff --check` passed.
- `pnpm exec playwright test tests/browser/attendance.spec.ts
  tests/browser/fee-collections.spec.ts --workers=1`: the **10 existing/expanded
  interaction cases passed**; the new boundary checks required the fixes above.
  Final `pnpm exec playwright test tests/browser/attendance.spec.ts --grep
  'navigation and browser' --workers=1`: **2 passed** in 48.3 seconds.

Physical phone-camera and printer verification remains unperformed. The live
release outcome (PR/CI, protected migration, exact deployment and owner smoke)
must be recorded separately; these local checks do not establish release.

### Original implementation handoff

Implementation is uncommitted in the existing working tree. No branch was
created/switched, no commit/push/PR/merge was performed, and no Production
migration, Vercel deployment or promotion was performed. Local migrations and
tests do not imply remote release. The concrete remaining release step is the
existing reviewed PR/CI and protected migration-before-traffic Vercel workflow
in the [runbook](../production-runbook.md).

The starting checkout remains `main` at `468f67b`. The additive migration
`20260911120000_basic_attendance/migration.sql` has SHA-256
`99060fd9c63611220e008c69c62463f4a66b05d2a8e053e7c9f61e19c1a738c4`.

No new deployment environment variable, feature flag, service, cron or Preview
database requirement is introduced. Attendance never changes fees, collections,
renewals, seats or membership. The unrelated pre-existing documentation/reset
artifacts and `debug.log` were preserved. Physical device-camera checks remain
unavailable in this run. No automated messages, student portal or self-scanning
authentication were added.
