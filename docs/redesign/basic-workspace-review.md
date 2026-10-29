# Basic workspace review — 2026-10-28

> Superseded for design direction: the owner rejected the shared Standard forms
> and narrowed Basic to students, seats and basic fees. See the
> [new standalone prototype review](basic-prototype-review.md). This report is
> historical evidence for the earlier unapproved implementation, not approval
> or release readiness.

The ₹99 Basic workspace is implemented on `codex/basic-workspace`, based on
`c63fb1f8e0e3cf477180fa7c7c3d979e5b4ead7f` (the isolated billing work).
Changes are uncommitted and separately reviewable. Main was not changed; PR #284
was not merged. No deployment, production access or provider action occurred.

## Behavior and implementation

- One server-derived branch access snapshot selects Simple for Basic and Full
  for Standard/Standard trial/Pro. Selected plans, pending Checkout and preview
  parameters cannot change production access. NONE/READ_ONLY retains recovery
  and read-only core pages. Effective dates, focus and visible 30-second polling
  refresh the snapshot; every mutation still rechecks authorization server-side.
- Basic reproduces the hero's small navigation, cream/sage/forest palette,
  typography, three metrics, configured shifts and complete seat grid. Metric
  wording is “Fees collected this month”; occupancy includes overlapping and
  multi-shift allocations. No sample seat limit or fake success notification.
- Students, attendance/import, seats/shifts/allocations, payments/dues/follow-ups,
  reports/exports, tasks and permitted settings remain reachable. Existing
  services, forms and records are shared. Basic does not mount the premium
  dashboard, notification/search chrome or locked WhatsApp reminder panel.
- Forms stay mounted during plan changes. Transport failures block interaction
  while preserving drafts; retry restores them. Account/branch changes and
  explicit membership loss clear private data/drafts. No persistent draft store
  or automatic submission was added.
- Billing remains the only subscription flow. It now contains static Simple/Full
  illustrations and capability-specific downgrade/retained-record explanations.
  New copy supports English, Hindi and Hinglish.

Main owners: `components/layout/BranchAccessProvider.tsx`,
`lib/workspacePresentation.ts`, `components/basic/`,
`styles/basic-workspace.css`, shared shell/access/billing consumers,
`components/billing/WorkspacePreviews.tsx`, `lib/i18n/basicWorkspace.ts`.
`Toast.tsx` only gains styling hooks; the reminder component skips its premium
panel in Simple. Business services, API policies and billing algorithms are unchanged.

## Visual evidence

All data is synthetic. Component previews use real production components with
an isolated API adapter. Connected screenshots use the built app, Clerk Test
session and verified disposable PostgreSQL. Screenshots do not prove payment or
authorization correctness; service and connected assertions provide that evidence.

| Evidence | Image |
| --- | --- |
| Actual landing hero beside Basic | [Comparison](basic-workspace-evidence/hero-versus-basic.png) |
| Basic desktop / students / admission | [Overview](basic-workspace-evidence/basic-desktop.png), [Students](basic-workspace-evidence/basic-students.png), [Dialog](basic-workspace-evidence/basic-admission.png) |
| English / Hindi / Hinglish at 390px | [English](basic-workspace-evidence/basic-mobile-en.png), [Hindi](basic-workspace-evidence/basic-mobile-hi.png), [Hinglish](basic-workspace-evidence/basic-mobile-hinglish.png) |
| Real local setup / partial collection / changed seat | [Setup](basic-workspace-evidence/basic-connected-setup.png), [₹300 receipt](basic-workspace-evidence/basic-connected-receipt.png), [Allocation](basic-workspace-evidence/basic-connected-allocations.png) |
| Billing workspace illustrations | [Billing](basic-workspace-evidence/billing-previews.png) |
| Shared full dashboard before / Standard and Pro after | [Before](basic-workspace-evidence/full-before.png), [After](basic-workspace-evidence/full-after.png) |
| Shared full Students before / after | [Before](basic-workspace-evidence/full-students-before.png), [After](basic-workspace-evidence/full-students-after.png) |

Full dashboard comparison: **zero changed pixels**, 1440 × 1021. Explicit
Standard and Pro captures have the same SHA-256 as both shared full frames:
`77af1ae15cd362bf58b3f0789e7a600509d24ee2b2f4e82542583833690beaac`.
Students: 0.33% changed pixels, confined to the Export control
(x973–1077, y163–214); its loading/disabled state differs. No other layout pixels
changed. The final portal typography/toast adjustment was separately checked;
its CSS scope disappears when returning to Full.

## Commands and results

All commands ran from the isolated worktree with `pnpm`. Successful cases were
not repeatedly replayed. The default integration command is deliberately avoided:
the guarded runner proves exact container/image/loopback/database identity before
creating a fresh empty database. No tests use shared/Preview/Production databases.

```powershell
pnpm exec vitest run --config vitest.unit.safe.config.ts tests/unit/lib/workspacePresentation.test.ts tests/unit/lib/billingState.test.ts tests/unit/lib/branchCapabilities.test.ts
# 2 files / 29 passed. The last filename did not exist; correct capability file is below.
pnpm exec vitest run --config vitest.unit.safe.config.ts tests/unit/lib/billingPlans.test.ts tests/unit/lib/branch-capabilities.test.ts tests/unit/lib/localization.test.ts tests/unit/components/AddStudentDialog.test.tsx tests/unit/components/CheckoutConfirmationDialog.test.ts tests/unit/components/BranchWorkspaceShell.test.tsx tests/unit/lib/workspacePresentation.test.ts
# 7 files / 67 passed; overlapping presentation tests are not an extra 29 unique cases.

$env:BILLING_REPORT_NAME='basic-workspace-integration.json'
pnpm exec node tests/billing-verification/run-integration.mjs basic-workspace.test.ts dashboard.test.ts student.test.ts seatAllocation.test.ts payment.test.ts allocation-tenancy.test.ts shift-hardening.test.ts entitlement.test.ts
# Existing operational suites: 122 passed. New file: 2 passed / 7 fixture failures.
$env:BILLING_REPORT_NAME='basic-workspace-retest.json'
pnpm exec node tests/billing-verification/run-integration.mjs basic-workspace.test.ts
# Corrected fixture dates/admission due/invite argument order: 9/9 passed.
# Final distinct affected service cases: 131 passed; no assertion was weakened.

pnpm exec playwright test --config tests/application-design-pilot/basic-workspace.playwright.config.ts
# 14/14 passed at that revision.
pnpm exec playwright test --config tests/application-design-pilot/basic-workspace.playwright.config.ts --grep 'account identity|Basic staff|Billing exposes'
# 3/3 subsequently added checks passed.
pnpm exec playwright test --config tests/application-design-pilot/basic-workspace.playwright.config.ts --grep 'dialogs and real'
# Final portal/toast check: 1/1 passed. Total: 18 distinct component browser cases.

pnpm exec node tests/dashboard-connected/start-local.mjs basic-test
# Original connected journey: 1/1 passed before focused checks were added.
pnpm exec node tests/dashboard-connected/start-local.mjs basic-test seat-change
# Seat-change check: 1/1 passed.
pnpm exec node tests/dashboard-connected/start-local.mjs basic-test setup
# Setup check: 1/1 passed after adding the existing Primary choice to the test.
# Three distinct connected journeys passed.

pnpm exec tsc --noEmit --pretty false
# Passed.
pnpm lint
# Passed: zero errors, one existing generated-workflow unused-disable warning.
pnpm exec eslint tests/application-design-pilot/basic-workspace.spec.ts tests/dashboard-connected/basic-workspace.spec.ts tests/dashboard-connected/basic-workspace.playwright.config.ts tests/dashboard-connected/start-local.mjs
# Final test-file additions: passed, no warnings.
$env:BILLING_TEST_CREDENTIAL_DIR='C:\Users\shani yadav\Desktop\lab_lords'
pnpm exec node tests/billing-verification/run-build.mjs
# Final build passed: compiled, TypeScript passed, 74 static pages, two valid workflows.
git diff --check
# Passed.
pnpm exec node tests/shared-system/check-presentation.mjs c63fb1f
# Passed for tracked changed lines; new Basic palette is the documented hero-copy exception.
```

Coverage includes all six effective plan directions/return, Standard trial with
Basic selected, grant/revocation/expiry, unpaid/pending/cancelled states, stale
form server rejection, scheduled boundary and second-tab refresh, failed access
and retry, account/branch isolation, staff permissions/pending invitations,
144 configured seats, empty/custom/overlapping scopes and partial-payment
idempotency. Existing payment regressions retain anniversary generation and a
later monthly due while an earlier due is unpaid. Browser checks include 320px
navigation, 390px in three languages, keyboard/dialog focus and zero scoped axe
WCAG A/AA violations on the three overview variants and final admission dialog.

Connected checks confirm seat/custom-shift setup through real controls,
admission/edit, allocation/change, actual ₹300 partial
collection with one receipt and matching database balance, overview totals and
operational reports. The initial connected harness needed a synthetic Test-mode
identity for read-only billing resolution; ambiguous selectors and the setup test’s omitted shift-type selection were then fixed.
No real Razorpay authorization was repeated for this presentation-only work.

## Limits and release state

Owner visual/functional review is next. This is local evidence, not a production
or Live-provider verification. Mobile evidence covers representative screens,
not every device, hardware scanner or native share destination. Background tabs
refresh on focus; external changes can take up to the visible poll interval to
appear, while server mutations always enforce current access.

Existing staff memberships retain permitted core operations after Basic downgrade;
new invitation acceptance and staff management remain gated. Broad public “Staff
access requires Standard or Pro” wording needs owner policy/copy resolution.
The discrepancy is recorded in `docs/domain-invariants.md`; this task does not
silently revoke memberships. No new public launch claim is made.

No new schema, migration, package, seed, deployed environment, cron or hosting
configuration is required. Existing three-plan migration/Live mapping/cutover
and intentionally deferred Vercel Pro prerequisites remain separate in
[the billing runbook](../billing/three-plan-cutover.md). Records, financial
history, billing recovery, subscription timing and provider idempotency are unchanged.
