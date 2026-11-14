# WhatsApp audit closure — 14 November 2026

Scope: fix the five open findings in the
[13 November audit](whatsapp-integration-2026-11-13.md) and repeat full local
verification. This is not provider, deployment or release approval.

## Changes

| Finding | Repair and evidence |
| --- | --- |
| Missing callback correlation | Signed callbacks retain a bounded local message ID. Recovery requires exact organization, sender, provider mode and normalized recipient, an admitted `SUBMITTING`/`UNKNOWN` message, and an unbound provider ID. The atomic bind commits the existing estimate and clears the lease. Orphan events are attached and projected with the same ordering as response finalization. Early callbacks survive later acceptance/timeout responses; late callbacks resolve uncertainty without resending. Tests cover concurrent/replayed statuses, stronger orphan evidence and mismatched scope. |
| Rate-expiry batch starvation | Maintenance selects active senders without an unresolved expiry incident for the current rate-card version. Repeated bounded runs reach later senders; a current card resolves incidents and a later expired version reopens them. A 105-sender PostgreSQL regression proves progress beyond the 100-row limit. |
| Conflicting rate-incident scope | Dispatch and maintenance use the same sender incident helper. New rows are sender-scoped. Existing branch-scoped rows retain their branch, count and historical identity after exact tenant/sender/type checks. Tests cover dispatch-first, maintenance-first, legacy branch evidence and foreign dedupe collisions. |
| Health finalization race | Success uses an atomic identity/status/token/expiry comparison. Losing the lease rolls back template and other local writes. Failure uses the same conditional fence and cannot clear a successor. Two database connections exercise disconnect/reclaim/expiry after the initial read; the opposite ordering permits a later owner disconnect. |
| Onboarding finalization race | The final intent consume conditionally checks actor, organization, mode, processing status, token and current lease expiry. A failed consume rolls back sender and completion-audit writes; cleanup cannot overwrite a successor lease. Tests exercise normal completion, expiry and reclaim. |

The callback projection helper moved unchanged from the dispatcher to
`lib/whatsappWebhookProjection.ts` so both acceptance paths use the existing
ordering rules. No automatic retry or provider mutation was added.

## Files and tests

Application changes are in `services/whatsappWebhook.service.ts`,
`services/whatsappDispatcher.service.ts`, `services/whatsappIncident.service.ts`,
`services/whatsappMaintenance.service.ts`, `services/whatsappHealth.service.ts`,
`services/whatsappConnection.service.ts`, and `lib/whatsappWebhookProjection.ts`.

Regression coverage is in
`tests/integration/services/whatsapp-audit-closures.test.ts`, the expanded
`tests/integration/services/whatsapp-delivery.test.ts`, and
`tests/unit/services/whatsappConnection.test.ts` and
`tests/unit/services/whatsappWebhook.test.ts`. The previous UI, permission,
dispatcher-evidence and remaining-fee fixes remain in the same working tree.

Canonical records updated: `SECURITY.md`, `docs/domain-invariants.md`,
`docs/ai/current-state.md`, `docs/production-runbook.md`,
`docs/product/public-claims.md`, `docs/redesign/page-family-migration.md`, and the
historical audit's follow-up link. No Accepted ADR was created or changed.

## Verification

Database tests used a newly created PostgreSQL 16 container bound only to a
random loopback port. Its purpose label and exact database identity
`lablords_whatsapp_audit_test` were checked before applying the repository's 58
existing migrations. Test processes explicitly set `DATABASE_URL`, `DIRECT_URL`
and `TEST_DATABASE_URL` to that disposable database and set
`TEST_DATABASE_RESET_CONFIRM` to its exact name. Saved environment files and
other databases were not used. Provider calls use synthetic injected clients;
the new audit regression file also rejects external fetches.

Commands use a process-only `TEMP`/`TMP` override to
`test-results/whatsapp-audit-temp` for Windows test-cache permissions.

| Command | Final result |
| --- | --- |
| `pnpm exec prisma migrate deploy` with the disposable target above | Passed; 58 existing migrations applied to the new empty test database. |
| `pnpm exec vitest run --config vitest.unit.safe.config.ts --fileParallelism --maxWorkers=4 --reporter=dot` | Passed: 319 files, 2,521 tests. |
| `pnpm exec vitest run tests/integration/services/whatsapp tests/integration/services/billing-whatsapp-tenant-migration.test.ts --reporter=verbose` | Passed: 8 files, 58 tests, including the 21-test audit-closure file and 20-test delivery file. |
| `pnpm exec playwright test --config tests/visual-consistency/whatsapp-controls.config.ts` | Passed: 24 tests, four viewport widths, English/Hindi/Hinglish controls, keyboard/accessibility/overflow checks. |
| `pnpm lint` | Passed: zero errors, two existing unused-disable warnings in generated workflow output and coverage output. |
| `pnpm exec tsc --noEmit` | Passed again after the final source and test edits; the Production build's type check also passed. |
| `pnpm exec node test-results/whatsapp-offline-webpack.mjs` | Passed: compile, TypeScript, page generation and traces. |
| `pnpm exec node scripts/verify-import-workflow-manifest.mjs` | Passed: both import workflows present. |
| `git diff --check` and canonical-link checks | Passed; 189 local document targets resolve. Git reports only line-ending notices. |

The browser run uses existing synthetic routes and locally captured self-hosted
fonts through `PILOT_FONT_STATIC_ROOT`. It sends no real WhatsApp messages.
The ignored Webpack wrapper is the existing `scripts/verify-offline-build.mjs`
with only its child build command changed to `pnpm exec next build --webpack`.
It disables provider writes, requires development auth keys, redacts secrets and
sets an unreachable loopback database. The previous audit recorded a stalled
default Turbopack build; this follow-up uses the verified Webpack path.

Development failures were corrected before the final runs: an initial consume
patch matched the expiry branch instead of completion; new test fixtures needed
required schema fields; and a race-test hook originally waited behind a sender
foreign-key lock. The hook now races after the read, before template writes,
and the new tests fake only Date so database timeouts remain active. The stalled
owned worker was stopped and its disposable database locks were confirmed clear.
These exploratory attempts are not counted as successful verification.
The first complete unit run passed 2,519 tests and failed one old exact webhook
projection expectation because correlation is now retained. The expectation was
updated, malformed-correlation coverage was added, and the full suite rerun.
The first complete integration run passed 56 tests; the final run includes two
additional callback-ordering/global-ID-collision regressions.
After the last test and projection edits,
`pnpm exec eslint services/whatsappWebhook.service.ts tests/unit/services/whatsappWebhook.test.ts tests/integration/services/whatsapp-audit-closures.test.ts tests/integration/services/whatsapp-delivery.test.ts`
also passed without warnings.

Logs are local ignored artifacts under `test-results/whatsapp-audit-2026-11-14/`;
the unchanged browser config writes its rerun artifacts to
`test-results/whatsapp-audit-2026-11-13/browser/`.

## Rollout and remaining boundaries

All five findings are fixed in source. No schema, migration history, package,
seed, saved environment, provider configuration or deployed flag change is
required. At the initial audit closeout, there was no commit, push, PR or
deployment. The subsequent owner-authorized publication packages the reviewed
changes on `codex/whatsapp-audit-controls` in focused commits for a PR against
`main`; it does not approve deployment. The pre-existing `debug.log` is excluded.
The disposable database container and temporary
credential file were removed after verification; the container's exact label and
name were checked before stopping it and absence confirmed afterward.

Already processed historical receipts are not automatically reprocessed. Without
a new signed callback carrying sufficient matching evidence, an uncertain
message remains `UNKNOWN`. Recovery does not retry messages, undo an owner pause
or resume a circuit breaker. A recovered failed callback retains committed
estimated usage pending authoritative billing evidence. Existing webhook HMAC,
consent, entitlement, authorization, budget and release gates remain unchanged.

Home, Features, Pricing and FAQ retain their conditional WhatsApp wording: these
repairs add no plan entitlement, delivery guarantee or availability claim.
Owner visual acceptance and actual provider/deployment readiness remain separate
from local verification. Rollback restores the five defects; use the existing
runbook's held-operation procedure while evaluating it.

## Review before publication

The follow-up review found no actionable regression in the reviewed changes.
Fresh checks passed: 65 unit files / 465 WhatsApp and localization tests, all
24 mounted browser checks, `pnpm exec tsc --noEmit`, changed-file ESLint,
`git diff --check`, and all 189 local documentation targets. The complete
database suite and Production build above were not repeated during that review.
The application and test behavior is unchanged while separating commits.
Publication updates the audit wording and removes one trailing blank line in
the extracted projection helper caught by staged whitespace validation.
