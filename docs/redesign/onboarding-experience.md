# Guided onboarding implementation — 2 November 2026

## Scope and experience

Base: merged main `735571f`; branch `codex/onboarding-guided-trials-import`.
Initial inspection found no open overlapping GitHub pull request or active
coding chat for this change. The existing main server and its retained local
database are separate from this worktree and its new disposable test fixture.

The flow has four owner-facing decisions: business/location details, seats and
daily timings, a real trial tier, and review/how to add students. It reuses the
botanical mark, cream/forest entry surface, shared buttons, dialogs, numbering
builder and locale/preferences owner. Business type is removed from this wizard
without deleting stored data or changing existing settings. A signup phone can
be offered when present; a person's signup name is never used as a business
name. `Main location` is an editable label rather than invented business data.

One daily session is the starting point. Morning/afternoon/evening is an
explicit editable suggestion, with confirmation before replacing entered
timings, fees or combinations. A physical seat is counted once. Simple labels
are previewed; custom ranges reuse the existing builder. Student monthly fees
are separate from Lab Lords prices, use direct numeric entry, and must be
answered, including an intentional zero. Applying one shared fee is explicit.
Combined access is optional, refers to stable slot IDs during editing and has
its own explicit fee; a suggested total never silently replaces the agreed fee.
Removing a slot removes references and exposes any newly incomplete combination.
Different combinations may share slots; actual allocation overlap protections
and midnight/24-hour semantics are unchanged.

## Trial, import and retry contracts

`OwnerTrialGrant.trialPlan` stores Basic/Standard/Pro. Existing records default
to Standard without deriving a tier from post-trial preferences. New explicit
choices use V2 request hashes; frozen V1 commands retain their exact hash,
behavior and Standard promise. The existing owner lock and transaction commit
workspace, branch, seats/timings, optional grant and receipt together. Replays
do not repeat setup or issue another trial. A changed tier under the same key
conflicts. A second command does not bypass one-organization/one-trial rules.

An eligible Basic trial really selects Basic's simple workspace and core
capabilities; Standard/Pro resolve to their actual tiers. Higher independently
trusted paid access and authorized replacement policy are preserved. Expiry
without trusted paid access is read-only. Selecting a trial neither charges
the owner nor creates a provider subscription. Pro still requires separate
WhatsApp setup, availability, sender/consent/template gates and messaging costs.
Billing summaries use the resolved access source so an older paid boundary does
not relabel a new Basic/Pro trial as a subscription. Verified paid Standard
above a Basic trial remains paid Standard; the original grant stays unchanged.

Basic import changes only `importView`/`importStudents`, the catalogue inclusion
and Basic's import navigation/rendering. Existing import screens remain behind
the branch access guard. Tenant membership, students permission, writability,
flags, row/mutation limits, validation, duplicate handling and durable execution
remain. It does not unlock other full-workspace or premium capabilities.
The final review shows the configuration and states where the owner goes next.
Skipping import keeps a return path in Students and navigation for every plan.

## Validation and evidence

Validation is performed on a newly created loopback-only PostgreSQL 16 container
with disposable memory storage. The private local runner checks the exact
container ID/image/label/binding and connected database identity before every
database-connected command. No existing application database, Preview or
Production database is used. The Vite component fixture has fake identity,
synthetic responses and a rejecting API fallback; it cannot reach application
data or providers. Real database service tests complement component checks.

The ignored local guard is invoked as `pnpm exec node .agent/check-onboarding.cjs
<command>`. It delegates to the exact pnpm command below after independent
container/database verification and excludes existing application configuration
from tests. The baseline switch runs unchanged main source against this same
disposable fixture. The production build uses a read-only connection and fake
Test-mode provider credentials with provider writes disabled.

| Command | Result |
| --- | --- |
| `pnpm install --frozen-lockfile --offline` | Passed; no lockfile/package version changes. |
| `node scripts/bootstrap-isolated-database.mjs` via the verified local fixture setup | Passed: 58 migrations, required billing identity, validated constraints, no sample/customer/provider records. |
| `pnpm test` | 3,088 passed, one existing lifecycle failure; one worker startup timeout. This is not a green full-suite result. |
| `pnpm exec vitest run` with the 15 affected files listed below | 183/183 passed, including the webhook file missed by the worker timeout and the final paid/trial source correction. |
| `pnpm test:workflow` | 1/1 passed. |
| `pnpm exec playwright test --config tests/onboarding-browser/playwright.config.ts` | 36/36 passed in one clean run, desktop 1440 and mobile 390. |
| `pnpm exec playwright test --config tests/billing-verification/playwright.config.ts --grep 'dedicated billing\|Basic reviews\|authenticated trial cancellation'` | 15/15 passed, desktop 1440 and mobile 390/320, including Hindi/Hinglish. |
| `PLAYWRIGHT_BASE_URL=http://localhost:4197 pnpm exec playwright test tests/browser/public-billing.spec.ts --grep=public --update-snapshots` | 116/116 passed against the actual local production build, signed out. Both homepage snapshots refreshed for the trial/import copy. |
| `pnpm exec vitest run tests/unit/pages/public-site.test.tsx tests/unit/lib/public-localization.test.ts --reporter=default` | 18/18 passed after correcting Home's stale import badge to Every plan, with Hindi/Hinglish translations. |
| `PLAYWRIGHT_BASE_URL=http://localhost:4197 pnpm exec playwright test tests/browser/public-billing.spec.ts:76 tests/browser/public-billing.spec.ts:232` | 4/4 passed: final badge assertion and refreshed desktop/mobile snapshots compared normally, no update flag. |
| `pnpm exec tsc --noEmit --pretty false` | Passed. |
| `pnpm lint` | Passed with no errors; one unused-disable warning in generated, ignored `app/.well-known/workflow/v1/flow/route.js`. |
| `pnpm exec eslint tests/browser/public-billing.spec.ts lib/public-i18n/onboarding.ts` | Passed after the final badge correction, no warnings. |
| `pnpm build` | Passed with the actual Turbopack production build and both import workflow manifests verified. Nested worktree root warning only. |
| `git diff --check` | Passed. |

The affected Vitest command contains these exact paths:

```text
tests/integration/services/owner-trial.test.ts
tests/integration/services/owner-trial-plan-migration.test.ts
tests/integration/importing/import-commit-flow.test.ts
tests/unit/components/BillingPriceSummary.test.tsx
tests/unit/api/razorpay-webhook.route.test.ts
tests/unit/api/onboarding.route.test.ts
tests/unit/lib/onboarding-schedule.test.ts
tests/unit/lib/onboardingRequest.test.ts
tests/unit/lib/branch-capabilities.test.ts
tests/unit/lib/billingPlans.test.ts
tests/unit/lib/billingState.test.ts
tests/unit/pages/onboarding-recovery.test.tsx
tests/unit/pages/public-site.test.tsx
tests/unit/lib/public-localization.test.ts
tests/unit/services/onboarding-idempotency.test.ts
```

The remaining full-suite failure is `Basic inactivation keeps ledger evidence,
ends a multi-shift bundle, and reactivation keeps anniversary rules` in
`tests/integration/services/basic-workspace.test.ts`, at its due-date assertion
`afterFees.every(p => p.dueDate.getUTCDate() === 15)`. The identical assertion
fails on unchanged main `735571f` using the same isolated database. The baseline
comparison command ran the unchanged `basic-workspace.test.ts` and
`billing.test.ts`: 104 passed, the same lifecycle assertion failed, and one
separate reset hook timed out during a machine pause. Billing's 81 cases passed.
Student dues generation and that unrelated assertion are intentionally retained.

Machine pauses and memory pressure interrupted earlier runs; final results
above distinguish those interruptions from application assertions. Full-suite
worker startup failed for `razorpay-webhook.route.test.ts`; its maintained tests
passed in the final 183-case affected run. No timeout, assertion, configuration
threshold or production authorization was weakened.

Automatic approval review rejected reusing a saved Clerk session for a connected
authenticated browser check because that identity reuse was not explicitly
authorized. No saved session was used. Browser evidence instead mounts the real
onboarding, Basic workspace and import-entry components with synthetic identity
and HTTP fixtures; real database services, tenancy, paid access, expiry and
durable import execution are covered by the isolated integration suite. This is
not a claim of a real Clerk-to-database browser test or external-provider test.

Screenshots use synthetic data and fixture system-font fallbacks. They record
local visual checks, not human visual approval:

| Screen | Desktop | Mobile |
| --- | --- | --- |
| Business/location | [Desktop](onboarding-evidence/business-desktop.png) | [Mobile](onboarding-evidence/business-mobile.png) |
| Seats/timings | [Desktop](onboarding-evidence/seats-timings-desktop.png) | [Mobile](onboarding-evidence/seats-timings-mobile.png) |
| Trial choice | [Desktop](onboarding-evidence/trial-desktop.png) | [Mobile](onboarding-evidence/trial-mobile.png) |
| Review/import choice | [Desktop](onboarding-evidence/review-desktop.png) | [Mobile](onboarding-evidence/review-mobile.png) |

## Deployment and intentionally unchanged behavior

Apply the additive trial-plan migration and generate the matching client before
serving new choices. Historical trial dates, preferences, subscriptions,
provider evidence and operational records are retained. Keep tier-aware readers
after any non-Standard grants exist; an old Standard-only binary is not a safe
rollback. The production runbook contains the full compatibility handoff.
No new environment variable, cron, provider API or package version is required.

Subscription lifecycle, branch billing model, student dues, allocation engine,
paid settlement proof and provider-write gates remain unchanged. This branch
does not migrate Production, merge a PR or deploy. The policy ADR remains
Proposed; human ADR acceptance, final visual acceptance and production release
are separate from implementing the explicitly requested product changes.
