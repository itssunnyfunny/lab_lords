# Remaining audit closeout — 25–26 October 2026

Base: `070d264`. Scope: the eight follow-ups from the preserved audit and the
named investigations. Local implementation is not owner approval or release.

## Resulting behavior

| Issue | Resolution |
| --- | --- |
| Lost seat-change response | Actor/branch/key receipts and allocation replacement commit together. Retries reauthorize, check the same request hash and return current assignments. Concurrent identical/no-op commands produce one receipt. Recovery detects a later replacement and suppresses its stale fee adjustment. Read-only replay is lookup only; new commands require writable access. |
| Admission recovery | Reuse the saved student. Freeze its persisted shift/bundle and fee-link choice; allow a different seat. |
| Receipt dates | Screen/PDF share en-IN/Asia-Kolkata formatting, including month/year/leap-day and browser-timezone boundaries. |
| Membership terms | Distinct reasoned correction, void of a recording error, cancellation before a genuine membership starts, and genuine early end. Serializable overlap checks exclude self and terminal terms. Expected revisions prevent overwrites. Append-only before/after history; no effects on fees, allocations, attendance, student status or SaaS. |
| Billing history | Owner settings browse all invoices and subscription history with createdAt/id keyset pagination. Tied timestamps and concurrent newer inserts are covered. Unknown historical provider mode is labeled honestly. |
| Organization trends | Unused unfinished endpoint returns authenticated tenant-safe 410. Supported snapshots remain; no historical data is fabricated. |
| AI Messages | Authenticated tenant-safe 410; unused generator/publisher/callers removed. Historical drafts and DRAFTS leases remain; payment operations retain drafts. AI Reports publication fences remain. Home, Features, Pricing, FAQ, fee-reminder examples and Terms remove obsolete drafting claims; Privacy describes retained historical drafts. Existing public layouts and three-language wording are preserved. |
| One owned organization | Existing owner-row lock serializes all onboarding keys. Existing receipt replays; another new request is refused. Staff memberships and all legacy multiple owned organizations remain authorized/readable. No destructive owner constraint or cleanup. |

## Investigations and limits

- **Races:** real-PostgreSQL barriers reproduced two shift overlap races and
  eight pre-transaction permission/archive races. Shift create/edit and student
  admission/profile/status now recheck and write inside serializable transactions
  with bounded whole-operation retries. All 13 race cases pass. Tested allocation
  and deactivation interleavings were already protected; this does not promise
  universal commit-time revocation across unrelated writers.
- **Staff revocation:** a confirmed cold import inside the five-second removal/
  permission-update transaction exhausted its deadline before recipient
  invalidation. Resolve the module before opening the transaction and recheck
  staff-management access inside it. The deadline and invalidation remain;
  all 72 related regression tests pass.
- **Public navigation:** a delayed-script probe reproduced the native Resources
  menu being closed by the header's initial pathname effect. Initial hydration
  now preserves that user-opened state; pathname changes still close menus. The
  same probe changes from open/closed to open/open, and the keyboard regression
  deliberately holds JavaScript before exercising hydration and dismissal.
- **Read-only dues:** user generation requires writability; machine cron and
  trusted ensure currently do not. SECURITY/domain invariants already identify
  the unresolved product rule. Tests characterize this exception, anniversary
  dues, later dues with earlier unpaid debt and deduplication. The owner must
  decide whether obligations continue during read-only access/on archived
  branches, documenting an explicit system-owned contract if retained.
- **Historical analytics:** trends recompute from mutable records with current
  student status/shift capacity; organization snapshots include archived
  branches. UI qualifiers disclose this. Reliable historical data and an approved
  cohort/archive policy are prerequisites for as-of historical claims.
- **PS-01 / GA:** local synthetic navigation/intercepted Google traffic can prove
  application sanitization and consent gating. Actual GA stream/Enhanced
  Measurement settings, deployed SPA behavior and receipt by the real property
  require operator verification. An intercepted local attempt is not receipt.
- **Webhooks:** local synthetic signature, mode, replay/order and settlement
  tests do not prove real charges, live configuration, reachability or delivery.
- **Imports:** local workflow/durability/benchmark evidence cannot approve the
  Proposed Workflow ADR or enable held gates. Processing/residency, runtime,
  retention, SLOs, mutation limits and rollback authority remain owner decisions.

## Migration and recovery

New migrations: `20261024130000_audit_recovery_and_membership_history` and
`20261024133000_membership_cancellation`. They add command receipts, membership
status/revision and immutable revision history. Financial/provider/ownership
records and existing dates remain. Migrated terms have BASELINE evidence recorded
at migration time with an explicitly unknown original author, not a fabricated
admission timestamp. The old exact-date uniqueness becomes a lookup index so a
voided/cancelled record can be replaced; effective overlap is service-enforced.

For a separately authorized release, drain old writers/in-flight draft publishers,
apply tracked migrations, generate the client and deploy matching code. Old term
writers do not understand terminal status/history and must not run alongside new
actions. Retain receipts/revisions during recovery. Prefer a forward fix or hide
new actions while keeping compatible readers. Blind schema rollback or old
binaries after new actions can lose evidence or reintroduce overlap/drafts.
Refresh cached clients during cutover; allocation-change PATCH now requires the
branch ID and a stable UUID `Idempotency-Key` supplied by the matching UI.
No production migration, deployment, owner cleanup or provider mutation occurred.

## Validation evidence

Validation runs use independently verified disposable loopback PostgreSQL
containers. Database reset suites run sequentially against their own target;
connected browsers use a separate current-date synthetic fixture, existing
development authentication and held business-provider writes. Repeated review
captures can use a separate ignored evidence root without replacing preserved
design-review images. No saved application environment was changed.
The authenticated-browser setup retries its initial public GET once only for
Chromium's `ERR_NETWORK_CHANGED`. Other navigation failures still fail, and no
feature assertion or application mutation is replayed by that transport guard.

| Command | Result |
| --- | --- |
| `pnpm test --reporter=default --reporter=json --outputFile=.agent/audit-closeout/full-test-r7-20261026.json` | Final-source run passed 350 files / 2,680 tests. Includes integration, migration, provider replay/order, recovery and concurrency coverage. |
| `pnpm test:coverage --reporter=default --reporter=json --outputFile=.agent/audit-closeout/coverage-r7-20261026-tests.json` | Final-source run passed all 350 files / 2,680 tests. Lines 74.47%, functions 84.22%; both configured 70% thresholds passed without changes. |
| `pnpm test:workflow` | 1 file / 1 test passed. |
| `pnpm benchmark:import-v2` | Passed local compiler scenarios at 100 / 500 / 2,000 rows, seven iterations. This is not Production qualification. |
| `pnpm test:browser --config tests/dashboard-connected/followups.playwright.config.ts --repeat-each 2 --output .clerk/audit-browser-runs/20260930-connected-r10-followups` | All 12 passed after the terminal-focus fix: each desktop/mobile × English/Hindi/Hinglish journey twice. Covers real committed move response loss/retry, saved admission/fee recovery, membership correction/history/void/replacement, focus after a terminal term change and all billing pages. |
| `pnpm test:browser tests/browser/public-site.spec.ts --grep "desktop Resources works" --repeat-each 5 --output .clerk/audit-browser-runs/20260930-connected-r12-resources` | All 10 delayed-hydration keyboard journeys passed, five in each browser project. Waits for header-local readiness; authentication loading is separate. |
| `pnpm exec playwright test --config tests/application-design-pilot/playwright.config.ts --reporter=list,json --output .agent/audit-closeout/fixture-pilot-final-1-artifacts` | 84 passed / 16 intentional viewport skips, covering all four configured widths and all three languages. |
| `pnpm exec playwright test --config tests/navigation-restoration/playwright.config.ts --reporter=list,json --output .agent/audit-closeout/fixture-r2-2-artifacts` | All 44 passed. |
| `pnpm exec playwright test --config tests/shared-system/playwright.config.ts --reporter=list,json --output .agent/audit-closeout/fixture-r2-3-artifacts` | 228 passed / 28 intentional viewport skips. |
| `pnpm exec playwright test --config playwright.localization.config.ts --reporter=list,json --output .agent/audit-closeout/fixture-r2-4-artifacts` | All 16 passed. |
| `pnpm exec playwright test --config tests/application-design-pilot/reference.playwright.config.ts --reporter=list,json --output .agent/audit-closeout/fixture-native-r2-5-artifacts` | 21 passed / 3 intentional geometry/viewport skips. Desktop geometry was checked against a frozen copy of main: identical positions, so stale assertions were corrected without moving the layout. |
| `pnpm exec playwright test --config tests/application-design-pilot/reference-regression.playwright.config.ts --reporter=list,json --output .agent/audit-closeout/fixture-native-final-6-artifacts` | All 7 passed. |
| `pnpm test:browser --config tests/dashboard-connected/playwright.config.ts --output .clerk/audit-browser-runs/20260930-connected-r4-connected` | 39 passed / 2 mobile-only skips in the desktop configuration. |
| `pnpm test:browser --config tests/dashboard-connected/audit.playwright.config.ts --project mobile --output .clerk/audit-browser-runs/20260930-connected-r5-audit-mobile` | 11 passed / 6 explicit desktop cases skipped. Those desktop operations also check their affected mobile widths. |
| `pnpm test:browser --max-failures 1 --output .clerk/audit-browser-runs/20260930-connected-r13-default --reporter=list,json` | Complete default suite passed: 278 passed / 16 intended role or viewport skips; all 294 configured cases accounted for, no failed or flaky tests. |
| `pnpm test:browser --config tests/shared-system/connected.playwright.config.ts --max-failures 1 --output .clerk/audit-browser-runs/20260930-connected-r13-students-alias --reporter=list,json` | All 3 Students connected alias cases passed. |
| `pnpm test:browser --config tests/shared-system/batch-two.connected.playwright.config.ts --max-failures 1 --output .clerk/audit-browser-runs/20260930-connected-r13-batch-two-alias --reporter=list,json` | All 4 Staff/Tasks connected alias cases passed. |
| `pnpm lint` | Passed with zero errors and two unused-disable warnings in generated Workflow/coverage code. |
| `pnpm exec tsc --noEmit --incremental false` | Passed. |
| `pnpm build` through the guarded local `tests/dashboard-connected/build.mjs` runner | Passed, including TypeScript, route generation and the two-import-workflow manifest verification. Uses an exactly verified read-only local database and held external providers; no deployment. |
| `pnpm prisma validate`, `pnpm prisma generate`, `pnpm prisma migrate deploy` | Passed; 56 local migrations, none pending. Existing composite SetNull warnings remain unchanged. |
| Local operator smoke: `node node_modules/tsx/dist/cli.mjs .agent/audit-closeout/review-smoke.ts preview` | Passed against the original retained review fixture on port 3117: real owner session, desktop dashboard/setup link, mobile drawer/focus, no overflow and retired Messages bookmark redirect. No business records changed. |

All required local checks are complete and passing. Role/viewport skips are
explicit configuration choices; no missing-credential skips or failure-based
exclusions were used. Passing full runs account for every configured case.
