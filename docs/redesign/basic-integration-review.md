# Basic workspace integration review — 29 October 2026

Status: implemented locally on codex/basic-workspace, based on merged main
22d1d093ae991cd4525a5149a2cdd2470846c60d. Final owner review and release are separate.
The owner subsequently requested focused commits and a new PR. This delivery is
packaged on the same isolated branch for a draft PR against main; PR #284 is the
merged baseline. No merge, deployment or production operation is authorized here.

The subsequent three review findings and their corrections are tracked in the
[PR #287 review-fix report](basic-pr-287-review-fixes.md). Its results supersede the
initial admission-recovery acceptance described below.

## What now works

Basic's approved cream/forest Overview, Students, Seats and Fees run through normal
authenticated application routes. Independent Basic forms create/edit students,
assign/move seats and shifts, record full/partial student fees, and show real
receipt/history data. Library setup, Account, the shared organization and central
subscription Billing remain reachable. The shared organization entry uses actual
branch setup counts for Basic instead of treating unavailable premium analytics
as an error; Standard/Pro retain their analytics view.

The connected journey exercised an actual admission fee, seat assignment and
move, profile edit (including the server-formatted phone), ₹300 collection against
₹1,000, the ₹700 remaining balance, receipt history, refresh persistence, separate
branch records, Account return, setup and central Billing. This is local test
money recorded in the student ledger, not a payment-provider charge.

One organization has one commercial plan. Effective server access chooses Basic
or the full workspace. Standard trials, temporary grants, scheduled boundaries,
branch activation/archive and read-only rules retain the existing billing model.
The one-owned-organization rule and billable-branch quantity policy are unchanged.
No browser flag, selected card or optimistic Checkout outcome grants access.

## Enforcement and recovery

| Area | Basic | Standard / Pro |
| --- | --- | --- |
| Students, seats/shifts, student fees and receipts | Existing object permissions and writability | Same underlying records/services |
| Necessary setup, Account, subscription recovery | Permission/owner appropriate | Existing flows |
| Imports, attendance, operational tasks/follow-ups, renewals and reports | Rejected server-side through AccessPolicy | Existing permissions/access required |
| Staff administration, advanced analytics, AI reports | Existing premium entitlement denies access | Existing premium entitlements |
| WhatsApp | Denied | Pro only; setup and rollout checks still apply |

A profile-only edit omits an unchanged monthly fee, preserving any existing
shift-linked price. An explicit fee change keeps the existing manual-price
semantics. Lost profile-edit responses are reconciled using server name/phone
normalization. Admission matching is only a review aid: after the PR review fix,
an uncertain create retains its request and draft until explicit owner review.
It cannot be automatically confirmed from an older matching record.

Existing staff memberships survive downgrade; authorized core work follows their
existing permissions. No richer-plan balances, waivers, partial collections,
allocation bundles/history or other operational records are deleted.

Mutations recheck scope on the server. Submitted student, shift and allocation
IDs are also bound to their route's branch. Basic payment recovery can read the
exact actor/branch/key receipt after access expires, while new collections remain
blocked. Frozen requests survive uncertain responses. Navigation, refresh and
interface changes never automatically replay them. Non-idempotent legacy actions
require record reconciliation instead of an automatic second create.

Branch switching strips object IDs and incompatible destinations. Account return
paths must be internal and present in the authorized directory. Drafts and late
responses are tied to identity and branch. Large-roster, read-error, Back-navigation
and unsaved-plan-transition browser checks cover these boundaries.

## Evidence and verification

All database-backed commands use the verified loopback-only Docker fixture and
fresh disposable databases. The retained original fixture was not reset. General
CI now applies repository migrations to a newly empty database, preserving
migration-created identity and readiness metadata that schema-only cloning omitted.
No new production migration or schema change was added.

The owner authorized only two Clerk Test app keys from the primary checkout.
Test prefixes and the intended existing development identity/instance were checked;
keys stayed in child-process environment. Existing local owner development
authentication was refreshed normally. No primary-checkout sessions were copied.
Billing, messaging, AI and other provider writes stayed disabled. Reports exclude
credentials and redact authentication headers/tokens from browser errors.

### Recorded commands and outcomes

The final validation table is completed from saved command results below; broad
runs and focused reruns are intentionally reported separately.

- Initial general CI: 330/358 files passed, 2,923/3,035 assertions passed;
  28 files failed, 112 assertions failed, two unhandled errors. This exposed
  outdated feature fixtures/mocks and the incomplete schema-only test database.
- Recheck of those integration files: 9/10 files and 168/170 assertions passed.
  Two existing billing tests hit very long setup timeouts during long local execution
  stalls. No product assertion failed in those two cases.
- Basic service integration: all 18 cases passed in that recheck, covering six
  plan directions, tenant/role/feature access, normal trial, stale writes,
  overlapping/concurrent seats, multi-shift movement, anniversary dues, waived
  and partial balances, lost-response recovery and retained history.
- All unit files: 2,313/2,317 assertions passed. Two old wording/permission
  assertions were corrected; two unrelated cases timed out during the same
  local stalls. The four affected files then passed all 17 tests unchanged in
  meaning (basic-unit-retest.json).
- Connected browser: all 11 distinct cases have passed across focused commands.
  The two final profile/admission recovery regressions passed on the final build
  (15.0s and 8.0s), including one write per operation, linked-fee preservation,
  intentional manual repricing, normalized phone recovery and draft clearing.
  The latest visual/shared-page capture and the Basic/Standard/Pro organization
  regression passed after the organization-page fix.
  These are normal routes, actual services and persistent local PostgreSQL records.
- Organization preview: initial 24/28 passed, then the four corrected checks
  passed on desktop/mobile. The affected isolated component/unit suite passed
  63/63. Preview evidence remains synthetic and does not prove authorization.
- The final general CI run passed 358/359 test files and 3,048/3,049 tests.
  The remaining billing-mutation.test.ts case stopped in beforeEach during a local
  execution stall (about 22 minutes elapsed), without a failed product assertion.
- That timed-out general-CI billing recovery case passed in isolation (1 passed,
  100 deliberately skipped), with no billing code change.

The broad run overlapped the last UI recovery refinements. Those refinements are
covered separately by the final affected-component, browser, static and build
checks; this is not a claim of a single all-green final CI run.

Broad CI, build/static results and exact commands are recorded in the
validation appendix. Earlier failed command logs
remain retained; none is relabelled as a single green broad run.

### Fresh visual evidence

The connected screenshots in [the evidence directory](basic-integration-evidence/) show the current local
application, with synthetic test identities and records. Organization, Account,
Billing, Basic Overview/Students/Seats/Fees, student/payment forms, setup and receipt
are included, plus narrow mobile and Hindi/Hinglish examples and full Standard/Pro
comparisons. October 28 prototype screenshots are historical reference only.

| View | Desktop | Mobile |
| --- | --- | --- |
| Overview | [Overview](basic-integration-evidence/overview-desktop.png) | [English](basic-integration-evidence/overview-mobile.png), [Hindi](basic-integration-evidence/overview-mobile-hi.png), [Hinglish](basic-integration-evidence/overview-mobile-hinglish.png) |
| Students | [Roster](basic-integration-evidence/students-desktop.png), [Admission form](basic-integration-evidence/student-form.png) | [Roster](basic-integration-evidence/students-mobile.png) |
| Seats | [Seat allocation](basic-integration-evidence/seats-desktop.png) | [Seat allocation](basic-integration-evidence/seats-mobile.png) |
| Fees | [Dues](basic-integration-evidence/fees-desktop.png), [Payment form](basic-integration-evidence/payment-form.png), [Receipt](basic-integration-evidence/receipt.png) | [Dues](basic-integration-evidence/fees-mobile.png), [Receipt](basic-integration-evidence/receipt-mobile.png) |
| Shared areas | [Basic organization](basic-integration-evidence/organization.png), [Account](basic-integration-evidence/account.png), [Billing](basic-integration-evidence/billing.png), [Library setup](basic-integration-evidence/setup-desktop.png) | Same shared routes |
| Full workspace | [Standard branch](basic-integration-evidence/full-standard.png), [Pro branch](basic-integration-evidence/full-pro.png), [Standard organization](basic-integration-evidence/organization-standard.png), [Pro organization](basic-integration-evidence/organization-pro.png) | Existing full interface |

## Review scope and recoverability

The original 98-file checkpoint and stash remain recoverable locally. The
superseded shared-form BasicOverview/BasicNavigation/basic-workspace.css scaffold
and its old preview tests were retired only after verifying recovery copies.
Main's original AppShell and branch overview page were restored as full-workspace
owners. The new Basic product is selected at BranchWorkspaceShell.

See [the exact scope manifest](basic-integration-scope.json) for exact paths grouped as production,
verification, preview, canonical documentation and historical evidence, together
with checkpoint hashes. The validated pre-commit inventory contained 185 paths. Publication omits one
generated preview report and three tracked paths with no content diff, and adds
a narrow preview-output ignore rule. The 182 published paths are separated into
60 production paths, 8 documentation paths, 28 preview-only paths, 27 verification
paths, 37 historical-reference paths and 22 fresh connected screenshots. The original
inventory and checkpoint remain recoverable locally; staging uses explicit paths. The historical design reports/assets are retained as a separate review
group; they do not establish current acceptance.

## Release and rollback

No package version, schema, migration, seed-data or production environment change
is required. Synthetic test fixtures are confined to test runners. No extra
subscription state machine or branch-specific commercial controls were added.
The existing production three-plan cutover, provider verification and intentional
Vercel Pro hold still apply. No additional real Razorpay checkout was attempted.

Owner review, a scoped PR and its remote CI must precede release. Reverting the
presentation must preserve operational records and existing billing migrations;
reverting the narrowed feature policy would need an explicit product decision.
This report does not claim production deployment, physical mobile-device testing,
a new staff browser login or live provider validation. Staff/tenant policy is
covered by real service/API fixtures; browser authentication used the existing
synthetic owner only.

## Validation appendix

Commands were run from the isolated worktree. In the table below, REPORT means
PowerShell's process-only BILLING_REPORT_NAME and PATTERN means the process-only
BILLING_TEST_NAME_PATTERN; no provider credentials are part of these commands.

| Command | Result / retained local evidence |
| --- | --- |
| REPORT=basic-full-ci.json; node tests/billing-verification/run-integration.mjs --ci | Initial broad failure, described above; test-results/billing-verification/basic-full-ci.json |
| REPORT=basic-failed-integration.json; node tests/billing-verification/run-integration.mjs --failed | 168 passed, 2 setup timeouts; all 18 Basic cases passed |
| REPORT=basic-final-ci.json; node tests/billing-verification/run-integration.mjs --ci | 358/359 test files passed; 3,048/3,049 tests passed. One beforeEach setup timeout in billing-mutation.test.ts; exact case passed separately below |
| PATTERN='recovers a confirmed source after response loss using reads only'; REPORT=basic-ci-recovery-retest.json; node tests/billing-verification/run-integration.mjs billing-mutation.test.ts | 1 passed, 100 deliberately skipped; no product change |
| node tests/dashboard-connected/basic-local.mjs test --grep 'real Basic admission' | First rerun found the formatted-phone edit bug; repaired journey passed in the next command |
| node tests/dashboard-connected/basic-local.mjs test --grep 'real Basic admission&#124;large roster&#124;an access change' | Admission/seat move/edit/partial receipt/persistence/navigation passed; the two edge cases needed focused recheck |
| node tests/dashboard-connected/basic-local.mjs test --grep 'large roster&#124;an access change' | 2 passed; read failure, >100 records, Back, late response and draft transition |
| node tests/dashboard-connected/basic-local.mjs test --grep 'real Basic admission&#124;lost payment&#124;direct excluded&#124;organization plan transitions' | 3 passed, admission failed on an accessible selector later corrected; no provider actions |
| node tests/dashboard-connected/basic-local.mjs test | Initial development-server run: 1 passed (keyboard/Escape and three languages), 4 failed; fixed route, fixture and runtime problems were rechecked in the built-app runs |
| node tests/dashboard-connected/basic-local.mjs test --grep 'fresh connected visual' | 1 passed on the built application; loaded shared destinations and mobile captures |
| node tests/dashboard-connected/basic-local.mjs test --grep 'shared organization entry' | 1 passed; Basic vs Standard/Pro organization presentation |
| pnpm exec playwright test --config tests/application-design-pilot/organization-preview/playwright.config.ts | 24 passed, 4 outdated assertions failed |
| pnpm exec playwright test --config tests/application-design-pilot/organization-preview/playwright.config.ts --grep 'slow reads&#124;current product' | 4 passed after correcting the current organization-wide model and exact selector |
| pnpm exec node node_modules/vitest/vitest.mjs run --config tests/application-design-pilot/organization-preview/vitest.config.ts | 8 files, 63 tests passed |
| node tests/dashboard-connected/basic-local.mjs test --grep 'profile edits preserve' | Initial added regression exposed omitted-fee/normalized-phone recovery comparison; fixed without changing service semantics |
| node tests/dashboard-connected/basic-local.mjs test --grep 'profile edits preserve&#124;lost admission response' | 2 passed on final build; test-results/basic-final-recovery-browser.log |
| pnpm test:workflow | 1 file, 1 workflow test passed |
| pnpm exec tsc --noEmit --pretty false | Passed on the final source; test-results/basic-final-tsc.log (exit 0, no diagnostics) |
| pnpm lint | 0 errors; generated-file warning plus one cleanup-ref warning. Targeted eslint after the ref fix passed; only the generated-file warning remains |
| pnpm exec eslint 'app/org/[orgId]/page.tsx' tests/dashboard-connected/redact-reporter.ts | Passed after the lint-only cleanup |
| pnpm exec eslint components/basic/BasicStudentForm.tsx components/basic/BasicWorkspace.tsx 'app/org/[orgId]/page.tsx' tests/dashboard-connected/basic-workspace.spec.ts | Passed on the final recovery source; test-results/basic-final-targeted-lint.log |
| node tests/dashboard-connected/basic-local.mjs build | Passed on the final recovery source; optimized compilation, TypeScript, static generation and Workflow manifest verification; test-results/basic-final-build.log |
| git diff --check | Passed |

The all-unit command was a verified-target Node helper launching
node node_modules/vitest/vitest.mjs run tests/unit --reporter=json
--outputFile=test-results/basic-all-unit.json. It verified current_database()
against the already-created disposable proof, then supplied TEST_DATABASE_URL and
TEST_DATABASE_RESET_CONFIRM through environment. The focused rerun launched the
same Vitest executable with tests/unit/lib/attendance.test.ts,
tests/unit/pages/public-site.test.tsx,
tests/unit/importing/import-workflow-retry-finalizer.test.ts and
tests/unit/services/billing-dispatch-boundary.test.ts: 4 files/17 tests passed.
Do not reproduce either command using a shared database.

Local Markdown links were checked (12 changed reports/guides, no missing targets).
The publication inventory, file hashes and excluded local artifacts are in the
scope manifest. Runtime sources are unchanged from the verified implementation;
packaging adds only documentation and the generated-output ignore rule.

## Commit review order

1. Enforce the narrowed Basic feature policy and align its service fixtures.
2. Bind student, allocation and fee operations to the authorized branch.
3. Add the independent Basic screens, forms, recovery and scoped styling.
4. Select the workspace from organization access and preserve scoped navigation.
5. Explain workspace changes in Billing and align public plan wording.
6. Add guarded connected verification and persistent-operation regressions.
7. Retain the approved preview journey, excluding generated browser output.
8. Preserve historical design evidence in a separate documentation commit.
9. Publish this audit, canonical guidance and fresh connected screenshots.

Existing successful checks are retained rather than rerun just for Git packaging.
The new PR must obtain a clean remote CI result; the local broad-run timeout and
its passing focused rerun remain disclosed above.
