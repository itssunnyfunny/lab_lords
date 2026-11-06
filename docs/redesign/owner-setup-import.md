# Complete owner setup and import

Local implementation and review: 5 November 2026. Base: merged main
`4678dfada77eb6d55a21085081f58fb2c690c513`. This is a new change after PR #290.
Owner visual acceptance, release, merge and deployment are **not** claimed.

## Owner journey

1. Enter the library/centre name once. It becomes the operational branch name,
   including the branch switcher. The optional parent workspace uses the
   authenticated signup name when available, with `My workspace` as fallback.
   Example text is a placeholder, not a saved input value.
2. Review physical seats and labels, daily time slots, optional combined access,
   independently chosen monthly prices and the eligible Basic/Standard/Pro trial.
   The existing onboarding receipt and idempotency contract remain unchanged.
3. Upload records into the same import shell on every plan. Records, Timings,
   Seats and assignments, and Review and import stay directly reachable.
4. Inspect existing setup; confirm repeated interpretations once; prepare missing
   seats/timings/combinations with explicit shared prices. Supported exact labels,
   unique hours and complete component sets are prepared without inventing seats.
   Missing information requires assignment or an explicit individual/group deferral.
5. Review student identity, source values and selected assignments together. The
   assignment-only dialog uses the existing searchable visual picker, with live
   and draft occupancy across component shifts. It leaves student/payment facts
   and unresolved financial source holds intact.
6. Review the actual additions and assignments before current-month fee outcomes.
   Referenced proposed setup requires the existing configuration approval and
   reviewed commit. Nothing operational is written during preparation. Results
   report saved assignments, deferred work and fees, with links to the workspace.

## What earlier work supplied

Inspection compared `b0b4fe1` with `f6d22ca`, `8751c3e` and `0f99680` and traced
the merged implementation through normalization, evaluation, immutable plans and
the execution ledger. The earlier importer exposed configuration decisions and
reviewed creation; the newer guided policy disabled all missing-configuration
creation and derived most help from errors. Consequently, absent seating could
look complete, and valid assignments were hard to inspect outside an editor.

This change restores visible setup review, approved configuration creation and
visual assignment editing through the existing compiler/executor. It retains
the newer current-month fee policy, structural AI privacy boundary, source
confirmation holds, revision fencing, replay protection and recovery. It does
not roll back the importer or add AI calls for deterministic matching.

## Implementation and trust boundaries

- `OnboardingWizard` changes new form values and review/payload meaning together;
  `onboardingNames` supplies the optional suggestion. Existing pending commands
  are replayed verbatim. No stored organizations or branches are renamed.
  Workspace and branch settings explain the name each edits.
- New uploads carry `GUIDED_SETUP_V2` in existing source JSON. Retained V1 and
  compatibility drafts keep their original policy; frozen runs keep their plans.
- `guided-setup` bounds explicit additions, validates hours/components/duplicates,
  prepares evidence-supported matches and separates missing from deferred seating.
  Proposed IDs exist only in draft validation/availability contexts.
- The thin `/setup` route delegates to `ImportSetupService`; grouped and individual
  decisions use the existing mutation authorization and revision-checked writes.
  Foreign/nonexistent sessions keep tenant-safe errors. Successful allocations
  and imported rows are excluded from changes.
- Preparing/approving configuration requires `manage_branch`. Commit derives
  required permissions from the reviewed mutations and revalidates availability.
  Shared prices come only from explicit setup definitions, never student fees.
  Only configuration referenced by reviewed assignments or fee links is emitted.
- New explicit-decision imports force legacy silent-skip flags off. Staff rights,
  branch writability, access/entitlements and all-plan availability remain enforced.
- Current-month anniversary eligibility, historical exclusion, due generation,
  fee/payment-amount separation and provider billing behavior are unchanged.

## Before/after evidence

Before images below are **existing repository captures**, retained from the merged
work, rather than newly captured baseline-browser runs. After images are from the
actual local Next application with development authentication and disposable data.
The import shell scrolls internally; captures show the indicated viewport/section.

| Area | Before | After |
| --- | --- | --- |
| Naming | [Business and location inputs](onboarding-evidence/business-desktop.png) | [Single library name and optional workspace](owner-setup-evidence/onboarding-name.png) |
| Timing review | [Merged guided student queue](import-guidance-evidence/after/standard-clean-1440.png) | [Existing daily timing, narrow screen](owner-setup-evidence/STANDARD-390-timings.png), [proposed timings and grouped answer](owner-setup-evidence/proposed-timings-and-group-answer.png) |
| Seating | [Merged per-student editor](import-guidance-evidence/after/standard-seating-390.png) | [Assignment-only visual picker](owner-setup-evidence/BASIC-390-assignment.png), [explicit missing-seat decision in Hindi](owner-setup-evidence/missing-seating-hi-390.png) |
| Final import | [Merged financial review](import-guidance-evidence/after/standard-review-1440.png) | [Setup and assignments review](owner-setup-evidence/proposed-setup-final-review.png), [secondary fee review](owner-setup-evidence/proposed-setup-fee-review.png), [saved result](owner-setup-evidence/proposed-setup-saved-result.png), [resulting seat workspace](owner-setup-evidence/resulting-seat-workspace.png) |

## Isolated validation setup

An independently created `postgres:16-alpine` container was verified by exact
container identity, loopback-only port and database identity. It contains three
separate empty databases bootstrapped through the existing 58 migrations:
`lab_lords_owner_setup_test` (full suite),
`lab_lords_owner_setup_focused_test` (focused suites), and
`lab_lords_owner_setup_browser_test` (actual application). No seed, shared,
Preview or Production database was used. No schema or migration file changed.

The checked-in test-only runner `tests/owner-setup/local.mjs` requires an ignored
`test-results/owner-setup/runtime.json` proof containing the independently verified
container ID, current loopback port and exact browser database name. It rejects
identity/binding mismatches and verifies the connected database. For reproduction,
create and verify a fresh disposable container, create these databases, and run
`scripts/bootstrap-isolated-database.mjs` with an explicit
`BOOTSTRAP_DATABASE_URL` and matching `BOOTSTRAP_DATABASE_CONFIRM` for each.
Do not reuse an application URL or infer disposability from a `test` substring.

Actual-app authentication used the existing synthetic Clerk development identity
and refreshed development session. Test mode keys were read without printing;
business/payment/messaging/AI credentials were held. No real signup, OTP, message,
provider charge, live Gemini extraction or Production provider test was performed.
Plan parity uses local trial-plan fixtures, not provider-authorized subscriptions.
Workflow dispatch/execution in the actual-app checks used the normal local runtime;
the retained V1 fixture and Workflow unit suite simulate dispatch/provider results.

## Validation results

The continued correction's final results and mixed-register walkthrough are in
[Import decision correction](import-decision-correction.md). The table below
retains the original setup/naming validation evidence. Database
commands always use an explicit verified `TEST_DATABASE_URL` and matching
`TEST_DATABASE_RESET_CONFIRM`; no `.env.test` fallback is used.

| Command | Result |
| --- | --- |
| `pnpm test` | See the continued correction's full-suite result linked above |
| `pnpm exec vitest run tests/integration/importing/owner-setup.test.ts tests/integration/importing/guided-import.test.ts --hookTimeout 30000` | 2 files, 33 passed; subsequent proposed-choice reuse regression included in the next command |
| `pnpm exec vitest run tests/integration/importing/owner-setup.test.ts --hookTimeout 30000` | 1 file, 9 passed after final service review; includes simulated AI reuse and raw-value privacy checks |
| `pnpm exec vitest run --config vitest.unit.safe.config.ts tests/unit/importing/guided-setup.test.ts tests/unit/importing/guided-payment-draft.test.ts tests/unit/importing/current-month-import.test.ts tests/unit/lib/onboarding-pending-command.test.ts tests/unit/lib/public-localization.test.ts` | 5 files, 56 tests passed; DB/network I/O forbidden |
| `pnpm exec vitest run --config vitest.unit.safe.config.ts tests/unit/pages/onboarding-recovery.test.tsx tests/unit/lib/onboarding-pending-command.test.ts` | 2 files, 33 passed after replacing the old mandatory-organization-field fixture; frozen command/replay assertions retained |
| `pnpm exec playwright test --config tests/onboarding-browser/playwright.config.ts` | 36 passed, desktop and narrow; includes Hindi/Hinglish, keyboard, draft recovery and access restrictions |
| `pnpm exec node tests/owner-setup/local.mjs auth` | Existing development session refreshed |
| `pnpm exec node tests/owner-setup/local.mjs browser` | 9 passed on final build (2.7 minutes); actual auth/API/Workflow/DB, all-plan desktop/narrow matrix, no dialog axe violations or horizontal overflow |
| `pnpm exec vitest run --config tests/import-browser/vitest.config.ts` | 2 passed; retained V1 desktop/narrow preparation, partial allocation/payment failure, immutable saved fields and recovery |
| `pnpm test:workflow` | 1 file, 1 test passed; simulated Workflow world |
| `pnpm exec vitest run tests/integration/services/staff.test.ts --hookTimeout 30000` | 21 passed unchanged after the full run reported a 10-second timeout |
| `pnpm exec tsc --noEmit --pretty false` | Passed after final code changes |
| `pnpm lint` | Passed with two generated-output unused-disable warnings (Workflow route and coverage helper) |
| `pnpm exec eslint importing/services/import-session.service.ts "app/branch/[branchId]/onboarding/import/[sessionId]/_components/GuidedImportWorkspace.tsx" "app/branch/[branchId]/onboarding/import/[sessionId]/_components/GuidedSetupReview.tsx" tests/browser/owner-setup-connected.spec.ts tests/integration/importing/owner-setup.test.ts` | Passed after final scoped changes |
| `pnpm exec node tests/owner-setup/local.mjs build` | Final production build passed; two-workflow manifest verified |
| `git diff --check` and `git diff --cached --check` | Passed |
| Local documentation link/path check | 160 relative links verified |

The build runner calls the repository production build through the existing
`tests/dashboard-connected/build.mjs` readonly wrapper, with explicit local runtime
settings. This avoids application environment/database fallback and retains the
normal Workflow manifest verification.

Connected assertions cover input typing/clearing/replacing, inserted paste text,
Chromium address autofill, back navigation and response-loss retry. The latter
commits server-side before dropping the response and confirms identical request
body/key, exactly one organization/branch/receipt/trial, and no billing action.
Each plan at 1440px and 390px imports due-now/future-due students, checks immutable
reviewed billing boundaries against persisted records, and opens the saved student
workspace. Narrow cases use CSV; desktop cases paste tables. Additional journeys
prepare separate-price timings and combinations, resolve a repeated source meaning,
create physical seats, bulk-defer absent assignments and recover a failed draft
request. Persisted component allocations, names, prices and payment counts are
checked directly in the isolated database.

## Separate final review

After implementation, review traced the new route through branch authorization,
draft revisions, source holds, setup approval, configuration dependencies and
immutable operations. React review checked shared owners, bounded derived state,
dialog focus, labels, narrow wrapping and expensive seat-map loops. Findings fixed:

- Assignment-only/group answers now preserve invalid source fees/payment amounts
  instead of treating unrelated facts as confirmed.
- Fee-linked proposed configuration remains a dependency when seating is deferred;
  independent assigned and fee-linked combinations both retain their components.
- V2 cannot inherit legacy silent-skip allocation flags.
- Proposed removal acts only on the selected configuration kind, even when a seat
  and timing share a name.
- Native setup selects have explicit accessible labels. Proposed seat review is
  naturally sorted, and configuration approval explains the needed choice instead
  of displaying the generic error fallback. New setup validation errors are localized.

Targeted persistence tests and connected browser paths are rerun after relevant
findings. A failed selector/order expectation was investigated against the rendered
review and persisted draft; it was not counted as a pass. Local visual inspection
is implementation evidence and does not substitute for owner approval.

The first focused 33-test run had 32 passes and one database-reset hook timeout
at the default 10 seconds under concurrent local disk load. The same suite passed
all 33 with a 30-second hook timeout; application/test assertions were unchanged.
The added proposed-choice reuse regression uses a simulated valid AI proposal,
while all other new persistence cases exercise unavailable-AI manual fallback.
Both preparation and its publication recheck now include the same staged choices.
The final UI review also preserves open setup forms from unrelated mutations and
moves heading focus/scroll on section or result changes, instead of leaving the
owner at the bottom of the previous screen.
The full run also found an outdated recovery fixture filling `orgName` as a
mandatory visible field. It now fills the library name, revisits it with Back,
and verifies the optional workspace fallback in the frozen request. Recovery
visibility checks still assert that a new branch-name form is absent while a
pending command is retained. The 33 focused recovery/command checks passed.

## Compatibility, rollout and limits

No schema, migration, dependency or new application environment requirement.
Ship UI/API/compiler/Workflow artifacts together through the existing release
process. Existing Import V2 enablement and mutation caps still apply. Rollback
must retain a compatible reader/executor for marked V2 drafts/plans, or keep
those drafts unavailable while draining/cancelling work through existing controls;
an older compiler must not reinterpret them. Never erase successful ledger items.

Existing names and settings data, pending onboarding commands, trial eligibility,
provider authorization, historical records and earlier import policies are
intentionally unchanged. Home, Features, Pricing and FAQ require no expanded
marketing claims. The setup FAQ and How it works walkthrough now describe one
library/centre name with optional location/workspace details in all three languages;
the import entry describes the corrected journey.

Remaining limits: provider AI/paid billing were simulated or held; cross-browser
autofill beyond Chromium was not exercised. The fixtures are synthetic local
journeys, not a claim of owner visual acceptance or Production release readiness.
