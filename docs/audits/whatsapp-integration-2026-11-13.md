# WhatsApp integration audit and controls — 13 November 2026

Status: local changes and verification; not provider, deployment or release approval.

Follow-up: the five open findings recorded below were fixed and reverified on
[14 November 2026](whatsapp-followup-2026-11-14.md). This document retains the
original audit's findings and verification limits as historical evidence.

## Result

The audit covered the integration's main authorization, onboarding, consent,
template, collection, report, notice, dispatch, webhook and operations paths.
Three confirmed defects are corrected: automatic collection reminders use the
remaining fee, queued user-initiated messages recheck their creator's current
permissions, and dispatcher job evidence retains earlier committed outcomes when
a later batch operation fails. Branch and organization controls now distinguish
saved settings, prerequisites and read failures.

This is not a clean production-readiness verdict. The five source-backed issues
below remain open. Review used local code and mocked tests; it did not inspect
customer data, call Meta, send messages, run database integration tests, verify
deployed flags or reverify current Meta policy. The separate sealed Codex Security
report covers the inspected security slices and records the authorization defect
before its fix; its coverage is explicitly partial, not a repository-wide proof.

## Corrected findings

### Automatic reminders overstated partially collected or waived fees

`buildCollectionCandidates` normalized balances in its per-student map but built
shared-phone collections from the original payments. Due-today and past-due
messages therefore used gross fees. Four regressions reproduced the error before
the fix: a 1,000-rupee fee with 400 collected and 100 waived rendered 1,000 rather
than 500; grouped fees rendered 3,000 rather than 1,800.

`services/whatsappPlanner.service.ts` now derives one immutable array using the
existing `remainingFee` function for student/phone grouping, rendered amounts and
fingerprints. Planning, safe refresh and send-time validation use that same
builder. Existing queued incorrect amounts fail current-source comparison unless
safely refreshed; submitted history is untouched and no resend is introduced.
Regression cases cover both stages, individual/shared-phone recipients,
fingerprint balances and unchanged input data.

### Queued messages retained a former staff member's authority

Manual reminders and service notices persisted `createdByUserId`, but dispatch
did not recheck current membership or the permissions required to queue them.
Removal or permission revocation could therefore leave previously queued work
eligible to send. This contradicted `SECURITY.md`'s current-authorization rule.

`services/whatsappDispatcher.service.ts` now uses the existing `StaffService` /
`AccessPolicy` checks in the submission transaction. Reminders require
`view_payments`, `view_whatsapp` and `send_whatsapp`; notices require
`manage_whatsapp`, `send_whatsapp` and `view_whatsapp`. A missing creator or denied
access produces `SOURCE_AUTHORIZATION_CHANGED`, suppresses safely unsubmitted
work, releases its reserved estimate and reconciles notice status. Unexpected
authorization-storage errors propagate without pretending access was revoked.
Existing report and automatic-source authorization, tenant checks, consent,
budget, pause admission and accepted/ambiguous history remain unchanged.

Regression tests exercise the actual `StaffService` / `AccessPolicy` boundary
with synthetic storage: removed membership, every relevant denied permission,
missing actor, current owner/manager, unrelated purposes and storage failure.
Positive controls reach the next independent sender check; they do not claim a
real provider send or database-concurrency proof.

### Failed dispatch runs lost earlier committed counts

The dispatcher copied local counters into job evidence only after the entire
batch and backlog read succeeded. A later failure could report zero completed
work after earlier messages had changed state. The dispatcher now accumulates
directly into the evidence counters. The regression exercises two claims, a
committed suppression and recovered stale claim before a later preparation error.

## Open findings

| Priority | Finding and evidence | Consequence and required follow-up |
| --- | --- | --- |
| P2 | `lib/metaWhatsApp.ts` sends `biz_opaque_callback_data`, but `services/whatsappWebhook.service.ts` drops it from the status schema and looks up only sender/provider-message identity. | A timed-out or stale submitted message commonly has no provider message ID. A later valid signed status becomes an orphan rather than resolving its `UNKNOWN` state. Add strictly validated correlation with sender, tenant, mode, recipient and admission checks plus concurrency/replay tests. Never retry the send. |
| P2 | `services/whatsappMaintenance.service.ts` selects the first 100 active senders by ID for expired-rate incidents on every run. | Later senders can lack proactive expiry evidence. Dispatch still fails closed and can create its own incident. Add fair bounded progression or appropriate existing-incident exclusion together with the identity repair below. |
| P2 | Dispatcher and maintenance use the same sender-wide rate-card dedupe key, but dispatcher supplies a branch and maintenance supplies none; `WhatsAppIncidentService.createOrTouchInTransaction` rejects the differing scope. | One path can roll back after the other creates the incident. Define one compatible sender-level identity and handle existing branch-scoped historical incidents without deleting evidence. A change only to new rows is insufficient. |
| P2 | `services/whatsappHealth.service.ts` checks the sender lease/status, then reconciles templates and updates sender status by ID; `disconnectLocal` can commit between that read and write. | A concurrent successful health read can restore `ACTIVE` after a local disconnect. Branch unassignment/cancellation still limits delivery impact. Fence finalization atomically against disconnect and stale leases; verify both interleavings with a disposable database. |
| P2 | `services/whatsappConnection.service.ts` validates an unexpired completion lease, writes sender/audit state, then consumes the intent by ID without a terminal lease-token comparison or row lock. | A completion that outlives its lease can overwrite a reclaim between validation and final write. Same-owner/tenant binding and provider-phone uniqueness constrain impact. Add a final conditional consume that rolls back the whole transaction on lost ownership, and verify the lease-expiry interleaving. |

These are bounded source findings, not observed Production incidents. The
provider-correlation and health-race fixes need dedicated state/concurrency
verification, as does onboarding lease finalization; the rate-card fixes need historical-identity compatibility. No
unreviewed repair or data migration was applied here.

A suspected report `NOT_DUE` scheduling starvation was rejected after examining
the actual scheduling window: before today's cutoff it selects yesterday, and
reachable branches advance the revisit timestamp. No planner change remains.

## UI changes

- Branch settings show saved/unsaved state and offer Discard changes. Activation
  uses saved state and is disabled while an edited draft is visible.
- Time, daily limits, cycle limits and estimated budget expose validation before
  saving. Delivery and automation have separate state labels and prerequisites.
- Emergency disable remains available with invalid/unsaved settings. Its refresh
  preserves the draft; changing fields clears prior automation confirmation.
- Unassign sender uses the shared confirmation dialog and explains cancellation,
  report reconfirmation and preserved submitted history.
- An organization sender-read failure offers Retry and does not claim there are
  no connected senders. Feedback uses the English/Hindi/Hinglish catalogues.

Production UI owners: `components/whatsapp/BranchWhatsAppPanel.tsx`,
`components/whatsapp/OrganizationWhatsAppPanel.tsx`, `lib/i18n/whatsapp.ts`.
Shared buttons, fields, badges and confirmation/focus ownership are reused.

## Verification

The unit command uses the existing DB-free config and throwing external-IO
guard. A process-only `TEMP`/`TMP` override points to
`test-results/whatsapp-audit-temp` to avoid Windows sandbox cache-rename failures.
No saved environment file is changed.

- `pnpm exec vitest run --config vitest.unit.safe.config.ts whatsapp localization`
  — **65 files / 463 tests passed**, after the partial-fee correction.
- `pnpm exec vitest run --config vitest.unit.safe.config.ts tests/unit/services/whatsappDispatcherAuthorization.test.ts tests/unit/services/whatsappDispatcherEvidence.test.ts`
  — initial 14 tests passed; subsequently expanded positive and preserved-purpose
  coverage is included in the final suite.
- `pnpm lint` — **passed**, zero errors and two pre-existing generated-output /
  coverage warnings. After the planner fix,
  `pnpm exec eslint services/whatsappPlanner.service.ts tests/unit/services/whatsappPlanner.test.ts`
  also passed.
- `pnpm exec node scripts/verify-offline-build.mjs` — offline Production build;
  default Turbopack attempt stalled in compilation and was stopped. The Webpack
  fallback described below passed. Both use an unreachable loopback database and
  held provider writes, not the saved application database.
- `pnpm exec node tests/dashboard-connected/start-local.mjs build` — blocked
  before connecting: the previously verified disposable container is unavailable.
  No fallback database was used.
- `git diff --check` — **passed**. Twenty documented source/guidance/configuration
  paths were also checked for existence.

Mounted browser tests use actual settings components and synthetic route data,
abort external requests and exercise desktop/mobile layouts and three languages.
The test-only font loader accepts `PILOT_FONT_STATIC_ROOT` for previously captured
self-hosted font assets when an optimized build is unavailable. This does not
change application font or environment configuration. Exact browser commands and
results are recorded at closeout.

The first broad development run overlapped a provisional planner test, which
failed and was removed when the hypothesis was disproved. Later suite results
are authoritative. An additional build invocation encountered the active build's
lock; the original build was retained rather than deleting its lock.

## Change and release boundaries

No package versions, schema, migrations, seed data, saved environment values,
provider configuration, deployed flags, cron schedules or Production records
changed. No real messages, commits, pushes or pull requests were created during
the initial audit. Subsequent owner-authorized publication is recorded in the
[follow-up](whatsapp-followup-2026-11-14.md#review-before-publication).
The pre-existing untracked `debug.log` was left unchanged.

Home, Features, Pricing and FAQ retain their approved conditional WhatsApp
wording. These controls add no plan entitlement, unlimited messaging promise,
provider availability or delivery guarantee; no marketing copy change is needed.
See `docs/product/public-claims.md` and the page-family migration ledger.

Local verification, owner visual acceptance and release remain separate. Deploy
the application changes through the existing runbook only after normal review;
no migration or environment change is required. Reverting the dispatcher fix
would restore the stale-authority behavior, so preserve the existing delivery
hold while evaluating any rollback.

## Additional coverage and closeout

Supplementary source review covered complete recipient/consent mutation paths,
managed provisioning and its final lease CAS, onboarding finalization, health,
maintenance and job-run paths, collection planner claims/circular cursors/complete
shared-phone bounds, aggregate report analytics and canonical snapshot time,
WhatsApp schema models and six relevant migration/constraint surfaces. No further
confirmed schema or aggregate-report defect emerged. Migration execution,
deployed constraints, PostgreSQL concurrency and live Meta behavior are untested.

The mounted suite passed 24 cases across 1440/834/390/320px. It covers save,
discard, invalid input, guarded activation, stopping with preserved draft,
unassignment cancellation/confirmation, failed sender reads and retry, plus
Hindi/Hinglish feedback. Scoped axe and horizontal-overflow checks passed.
Desktop and 320px screenshots were visually inspected. The exact browser command:

```powershell
$env:TEMP = Join-Path (Get-Location) 'test-results/whatsapp-audit-temp'
$env:TMP = $env:TEMP
$env:PILOT_FONT_STATIC_ROOT = Join-Path (Get-Location) 'test-results/whatsapp-audit-2026-11-13/fonts'
pnpm exec playwright test --config tests/visual-consistency/whatsapp-controls.config.ts
```

Results: `test-results/whatsapp-audit-2026-11-13/browser/results.json` (ignored
local evidence). The font root contains the actual self-hosted assets recovered
from prior local fixture traces; it does not represent a new production build.
Final desktop/mobile control captures are in the adjacent `controls-review`
directory. Screenshot-only recaptures passed another six translated cases and
two focused control cases without changing behavior assertions.

`pnpm exec tsc --noEmit` passed. `pnpm lint` passed with no errors and two existing
unused-eslint-disable warnings in generated workflow output and coverage assets.
The final unit run after the planner correction passed 65 files / 463 tests.
The Production build passed with Webpack: compilation, TypeScript, all 76 static
pages and build traces completed. The temporary ignored wrapper
`test-results/whatsapp-offline-webpack.mjs` is an exact copy of the existing
offline wrapper with only its child command changed from `pnpm build` to
`pnpm exec next build --webpack`. Run command:
`pnpm exec node test-results/whatsapp-offline-webpack.mjs`.
The original stalled audit-owned Turbopack process was stopped and its stale
build lock was removed only after checking that no Next build remained. No
application build configuration changed. The Webpack result does not establish
that the default Turbopack invocation is healthy in this local environment.

`pnpm exec node scripts/verify-import-workflow-manifest.mjs` passed separately
after the Webpack build, completing the package build's post-build check.

Final independent regression review found no introduced blocker: all candidate
builder callers supply raw fee records and normalization is applied once; queue
and dispatch permissions match; UI enablement uses saved configuration and stop
controls preserve edits. Database concurrency and provider behavior remain the
limits stated above.
