# Import decision correction — local review, 5–6 November 2026

This continues the [owner setup restoration](owner-setup-import.md) on the existing
branch, based on main `4678dfa`. It retains the allocation work, original naming
correction and Basic/Standard/Pro parity. It is not a new screen redesign.

## Reproduced mismatch and correction

The attention query included WARNING while the count and card excluded it. Saving
and asking for the next student could therefore return a row labelled ready with
no actionable task. `import-readiness.ts` now owns the readiness partition used
by filtering, guidance, task presentation and plan eligibility. Warnings remain
available as information. Due and deliberately deferred seating are nonblocking.

A draft save compares the validated before/after decisions. It identifies what
resolved and lists what remains. An unresolved student stays open; a ready student
leaves actionable help. The message explicitly distinguishes a saved draft from
an imported record. Final execution still uses the immutable reviewed plan.

## Owner walkthrough

The connected browser fixture uses a realistic synthetic November register:
one title, one repeated header, six students, missing phone numbers, two missing
required details, mixed rupee/date formats, a combined name/phone field, an
uncertain payment note, a recorded Cash payment and a future anniversary due.

| Transition | What the owner sees and decides | What changes |
| --- | --- | --- |
| Upload | Eight source rows are retained beneath the detected register header. | Draft only; no students or payments exist yet. |
| Review non-student rows | The title and repeated header are shown with their uploaded values. The owner explicitly leaves them out. | Two skipped rows remain as source evidence. No silent record loss. |
| Review allocations | An exact Morning/B1 match is visible. Five absent assignments need a decision. | The owner explicitly defers those five; missing information itself is not consent. |
| Correct numbering | Rename B1 to C1, inspect affected allocations and draft rows, then confirm the live correction. | The same seat ID/history remains. The current assignment follows C1 and drafts are revalidated. This action does not import students. |
| Resolve one of two problems | Confirm the original joining date for the incomplete student. | The draft is saved; the missing monthly fee is still named. The student stays open. |
| Finish that student | Enter the confirmed ₹450 fee. | The student becomes ready; optional missing-phone information does not trap it. |
| Clarify combined fields | Separate the supplied name and phone; then confirm the uncertain payment note individually as Due. | Only confirmed facts are used. The payment question remains visible until answered. |
| Choose Due | Review three eligible unrecorded fees totalling ₹1,550. Choose to collect later. | Draft Due choices persist. Source-confirmed Due/Paid records are protected. |
| Recover a lost response | The server saves Due choices but the response is lost. Refresh the payment review, then reload the page. | Three persisted Due choices remain; no payment has been created. |
| Select Paid | Select only the ₹600 payment, explicitly choose UPI, inspect its consequence and save. | Two batch Due choices and one confirmed Paid choice remain visible. |
| Final review | Review six students, one matched seat, five explicit deferrals, Due ₹1,850, Paid ₹1,400 and a future ₹700 fee. | Nothing is imported until the owner confirms this exact plan. |
| Confirm and inspect records | Six student records and one allocation are saved. Five current-month fees are recorded; the future fee is absent. | Original joining dates and normal anniversary generation remain. The two excluded source rows stay visible in the result. |

The connected walkthrough passed with normal development authentication, real
routes, Workflow execution and database assertions. Six students, five payments
and one allocation were persisted with the totals above. Reloading the result
shows zero remaining students; excluded source rows do not trigger an empty
recovery loop. The final ten-case desktop/mobile/all-plan run passed on 6 November
in 4.1 minutes, including local Workflow retries before the second preview stopped.

Visual review found and corrected misleading excluded-row wording, an optional
missing-phone warning falling back to a generic error, and assignment-decision
labels on deliberately excluded rows. Excluded title/header rows are also absent
from payment choices; already saved payment operations are labelled as saved
rather than described as a future creation. The final visual rerun verified these fixes.

Final evidence:

- [One correction saved; monthly fee still unresolved](owner-setup-evidence/mixed-partial-correction.png).
- [Persisted Due and selected Paid choices](owner-setup-evidence/mixed-payment-choices.png).
- [Final students and assignments review](owner-setup-evidence/mixed-final-review.png).
- [Saved records and exact fee totals](owner-setup-evidence/mixed-saved-records.png).

Separate persistence checks cover potential duplicate identities: excluding the
earlier copy releases the retained copy, restoring it restores the duplicate
decision, and both original source rows remain. Existing-student duplicate checks
still apply. Configuration corrections retain resolved manual source facts;
they cannot resurrect an invalid uploaded fee after the owner has confirmed it.

## Configuration and payment boundaries

New configuration remains proposed until final import. Existing-seat renaming and
timing corrections have a separate explicit immediate-change confirmation. Preview
shows collisions, active/history allocations, affected students/drafts, combined
access and directly linked monthly-fee consequences. Apply uses authorization,
serializable validation, exact preview/revision checks and replay receipts. It
retains physical identity, manual draft fields and source evidence. Existing
recorded payments and independent fixed student fees are not rewritten.

Payment batches are draft decisions, not collections or payment-provider calls.
The server rederives eligibility, protects source/confirmed facts, requires a
method for selected Paid payments, and rejects future or ambiguous choices. Final
review and execution still preserve tenant checks, permission checks, immutable
plans, idempotency, partial recovery, current-month start and anniversary dues.

## Validation record

- Database-free parser/readiness checks: 4 files, 36 tests passed.
- Focused persistence: 2 files, 40 tests passed, including concurrent Due saves,
  lost-response replay, warning-only queue removal, remaining reasons, source/future
  protection, untidy rows, seat history, stale configuration and linked prices.
- Type checking passed; production build passed with both Workflow manifests.
- Lint passed with two existing generated/coverage-file warnings after correcting
  the new payment panel's state-reset effect.
- The full suite completed: 375 files passed, one file had two timeout cases;
  3,190 tests passed and two timed out (3,192 total). Both timed-out cases are in
  unchanged `billing.test.ts`; that complete file passed independently, 81/81,
  with the same 15-second test and 30-second hook limits and no assertion changes.
  The broad run remains an exit-1 result, not a claimed clean full-suite pass.
  The final connected browser check passed all ten journeys.
  An initial connected run passed five cases before a long local-runtime stall;
  the local Workflow process reported a Windows rename/lock error. The retry has
  explicit localhost callbacks. Inspection of installed `@workflow/next` 4.1.0
  subsequently showed that it forces `.next/workflow-data`, overriding an
  attempted separate data directory. The local runner now refuses concurrent
  review/validation servers and refuses rebuilding while either preview runs.

The final retained V1 browser suite passed both desktop/narrow flows
(69.04 seconds), including preparation, partial allocation/payment failure,
saved-field protection and recovery. The initial long-running full-suite attempt
was stopped after repeated local database I/O stalls (`DataFileImmediateSync`),
not counted as a pass. Its replacement uses a separately verified empty
`postgres:16-alpine` container with temporary in-memory storage and `fsync=on`,
only the repository's unchanged migrations, and the exact local database
`lab_lords_correction_suite_test`. This test infrastructure has no deployment
or application-environment implication.

The 6 November continuation preserves all working changes and the persistent
review database. The interrupted build and full-suite processes had no terminal
result and are not claimed as passes. Docker-assigned loopback ports were
reverified after restart; the empty temporary suite database received the same
58 migrations again. The final build and explicit type check subsequently passed.

| Command | Final result |
| --- | --- |
| `pnpm test --hookTimeout 30000 --reporter=verbose` | 375/376 files passed; 3,190 passed, two timeouts in unchanged `billing.test.ts`; 1,483.10 seconds, exit 1. |
| `pnpm exec vitest run tests/integration/services/billing.test.ts --hookTimeout 30000 --reporter=verbose` | 81 passed in 51.12 seconds; both timeout cases pass without code or assertion changes. |
| `pnpm exec vitest run tests/integration/importing/owner-setup.test.ts tests/integration/importing/guided-import.test.ts --hookTimeout 30000` | 40 passed in 114.38 seconds on the final application code. |
| `pnpm exec vitest run --config vitest.unit.safe.config.ts tests/unit/importing/import-readiness.test.ts tests/unit/importing/untidy-register.test.ts tests/unit/importing/guided-import-results.test.tsx tests/unit/importing/guided-payment-draft.test.ts tests/unit/importing/guided-import-presentation.test.ts` | 30 passed; database/network I/O forbidden. |
| `pnpm exec node tests/owner-setup/local.mjs browser` with `OWNER_SETUP_CORRECTION=1` | 10 passed in 4.1 minutes; normal development auth, real routes/Workflow/DB, all plans at 1440px and 390px. |
| `pnpm exec vitest run --config tests/import-browser/vitest.config.ts` | 2 passed in 69.04 seconds; retained V1 partial-recovery journeys. |
| `pnpm test:workflow` | 1 passed; simulated Workflow world. |
| `pnpm exec tsc --noEmit` | Passed. |
| `pnpm lint` | Passed, zero errors; two existing generated/coverage warnings. Final local-runner scoped lint also passed. |
| `pnpm exec node tests/owner-setup/local.mjs build` with `OWNER_SETUP_CORRECTION=1` | Passed; invokes `pnpm build` against an exact local read-only target and verifies both Workflow manifests. |
| Attempt to start port 3149 while port 3150 is active | Correctly rejected before server startup by the test-only isolation guard. |
| `git diff --cached --check` | Passed. |
| Local changed-document link/path check | 168 relative targets verified, none missing. |

All database-backed commands set an independently verified loopback
`TEST_DATABASE_URL` and an exact matching `TEST_DATABASE_RESET_CONFIRM`.
No `.env.test` fallback is used. Original onboarding/browser/localization checks,
including 36 onboarding cases, are recorded in the linked setup report.

## Final review

The separate review traced the new routes through tenant authorization, staff
permissions, locked revisions, payment provenance and immutable plan execution.
It checked that configuration changes retain seat IDs/history, bind the preview
to current affected state, reject collisions/stale revisions and preserve manual
confirmations. The existing all-plan engine, original joining dates, anniversary
dues, future generation, reviewed confirmation and successful recovery ledger
items remain intact.

Review findings fixed and revalidated include: excluded duplicate copies blocking
retained copies; resolved source errors resurfacing after configuration changes;
excluded headers appearing as unfinished students/payment decisions; optional
phone information becoming a generic error; and two local previews sharing
Workflow storage. No unrelated payment/allocation engine replacement was made.

Implementation owners are the guided import components, `import-session.service.ts`,
the new payment/configuration correction services, `import-readiness.ts`, parser
header handling and the existing plan compiler. The naming/shared-shell owners
remain listed in the setup report. Regression coverage is in the owner-setup,
guided-import, parser/readiness/result and connected-browser test files.

All destructive fixture resets are restricted to independently verified loopback
PostgreSQL databases in the dedicated test container. Browser validation now uses
`lab_lords_correction_browser_test` on localhost:3150; it preserves the earlier
review database on localhost:3149. No production/shared/preview data is accessed.

## Compatibility and claims

No schema, migration, seed, package-version or application environment change.
New provenance/receipts use existing JSON. Ship matching UI/routes/services and
retain the V2 compatibility and rollback rules in the production runbook.
Home, Features, Pricing and FAQ do not need expanded claims: this restores the
advertised import capability. The earlier simple naming-copy correction remains.
Owner visual approval and production release are separate from local evidence.
Remaining validation limits: the broad run's two timeout failures did not
reproduce in the independent billing-file rerun; live AI and payment-provider
calls were held or simulated; browser checks used Chromium. CI and owner visual
acceptance remain separate. No merge, deployment or Production operation occurred.
