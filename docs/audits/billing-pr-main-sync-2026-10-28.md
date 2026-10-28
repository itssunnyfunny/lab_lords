# Billing PR #284: integration with remote main

## Scope and isolation

Updated `codex/billing-recovery` from `c63fb1f` with remote main
`5b1af1b`, including merged PRs #285 and #286. A clean, separate worktree
was used so the unfinished Basic organization/workspace prototype remains on
`codex/basic-workspace`, outside this PR. The PR remains draft. This is a
branch update, not a merge of the PR, production access or a deployment.

## Conflict resolutions

- Retain the dedicated Billing page, its navigation and old-link redirects.
  Organization Settings retains main's branch removal/undo controls.
- Expose main's complete, paginated invoice and subscription-history browser
  from Billing. Resolve Standard and Pro display names through the shared
  catalogue instead of the retired PRO-to-Standard alias.
- Retain Basic ₹99, Standard ₹299 and Pro ₹499 and their feature gates. Keep
  main's AI Messages retirement and describe AI reports only in the catalogue,
  public FAQs, fee-reminder solution and Hindi/Hinglish translations.
- Preserve main's one-owned-organization enforcement, retained receipt replay,
  membership history, allocation recovery and transactional access rechecks.
- Preserve both browser-suite exclusions in Vitest and main's branch loading
  boundary while retaining the dedicated Billing route's theme and return link.
- Update the actual-Test harness's feature list to omit the retired AI Messages
  key. No actual Razorpay checkout, authorization or provider change was rerun.

## Verification

- `pnpm exec prisma generate`: passed.
- `pnpm exec prisma migrate deploy`: all **57 migrations passed**, in the
  new empty local database.
- `pnpm lint`: passed. Focused `pnpm exec eslint` on the final changed
  Billing components, translations and test harness files also passed.
- Focused `pnpm test` for billingPlans, public-localization, contextual-navigation,
  application-pilot-theme, RouteBoundaries and organization-access-parity:
  **59 distinct tests verified**. The first run had 58 passing tests and one
  failure for two obsolete translation keys. After removal, only the affected
  public-localization file was rerun: **7 passed**.
- `pnpm exec playwright test --config tests/billing-verification/playwright.config.ts`:
  **39 passed** at 1440px, 390px and 320px, including English/Hindi/Hinglish,
  recovery followed by plan change and the new complete-history regression.
- Guarded `pnpm build` via `tests/dashboard-connected/build.mjs`: passed,
  including TypeScript and the two-workflow manifest. The first attempt found
  the retired AI Messages key in the historical Test harness; it was removed
  before the passing build. The standalone initial type-check found the same
  issue; the corrected build supplies the final TypeScript check.
- `git -c core.safecrlf=false diff --cached --check` and audit links: passed.

A complete `pnpm test --pool=threads --hookTimeout=60000` run was also started
in the isolated local database. At branch-update preparation, the 81-case billing
service and 101-case billing-mutation suites were green; the remaining run was
still in progress. The PR description/checks provide its subsequent result and
GitHub CI status. Do not treat this preparation record as a full-suite pass.

New regression coverage checks that every selectable plan excludes retired
message-drafting claims and that complete history renders Standard and Pro
correctly on desktop and both phone widths. Existing localized Billing checks
now expect AI reports. The connected history test follows the dedicated Billing
route. Test adapters and browser route fixtures cover provider-facing actions;
this update does not add new actual-provider evidence.

The temporary verifier checked the existing local Docker container's exact ID,
PostgreSQL image and loopback-only binding, created a separate empty database
from template0, and applied the combined migration chain. It did not copy or
truncate the original Basic/browser fixture. The build used that verified
local target in read-only mode, development Clerk configuration and disabled
external provider writes. Runtime proofs and logs remain in ignored
`test-results/pr-main-sync/`; no secrets or environment files are committed.

## Release requirements

No new schema, migration, package, saved environment or cron configuration was
introduced by the conflict resolution. Both existing branches' additive
migrations are retained unchanged. An empty-database rehearsal does not approve
the three-plan migration for populated legacy billing/webhook ledgers.

The owner's deferred Vercel Pro upgrade remains an intentional hosting hold;
all eight schedules are retained. Production/provider inventory, any required
history-preserving ledger transition, Live plan mappings, and authorized
renewal/webhook/deployment verification remain outstanding as described in the
[cutover guide](../billing/three-plan-cutover.md). Keep the PR draft.

The [billing audit](subscription-three-plan-2026-10-23.md) remains the source
for prior Razorpay Test payment evidence and its stated limits. The Basic
prototype is deliberately excluded so its review and integration can resume
separately after this update.

## Follow-up during the broader run

The broader run found one additional stale assertion in
`tests/unit/components/OrganizationBillingContent.test.tsx`: it still expected
AI message drafting in a plan card. It now requires AI reports and explicitly
rejects message drafting. The affected file was rerun using
`pnpm test tests/unit/components/OrganizationBillingContent.test.tsx --pool=threads --hookTimeout=60000`: **19 passed**.
Focused ESLint passed. This changes only a test expectation; the passing build
and 39 browser checks were not repeated. Final broader-run and GitHub CI results
are recorded on the PR so publishing evidence does not trigger another code run.
