# Import decision correction — local review, 5–6 November 2026

This continues the [owner setup restoration](owner-setup-import.md) on the existing
branch, based on main `4678dfa`. It retains the allocation work, original naming
correction and Basic/Standard/Pro parity. It is not a new screen redesign.

## Recovery correction and same-register walkthrough — 6 November 2026

The correction following the owner audit below keeps the existing steps and
allocation editor. Owner acceptance is still pending; local verification is not
approval to merge or release.

- **Records:** the same 40-row import shows 23 saved and 17 needing help. All 17
  have recorded payments before their current-month anniversary due dates. Each
  card names that conflict and date. The dialog explains what to check, when to
  recheck, and that keeping pending neither excludes a student nor changes Paid
  to Due. Advancing visited all 17 once and stopped, without wrapping back.
- **Save draft:** an edit saves and validates, then leaves the outcome visible.
  In a separate three-student synthetic draft, confirming the joining date named
  the remaining payment-amount conflict. Correcting that amount made the student
  ready. Optional missing-phone notes stayed outside actionable help. The empty
  queue then directed the owner to final review.
- **Payment choices:** the original register offers the relevant conflict group
  instead of an empty bulk selector. The synthetic draft previewed two Due fees
  totalling ₹1,200, then one selected Paid fee of ₹550 with an explicit UPI
  method. Refresh retained one Due and one Paid choice. Final review showed
  ₹650 Due and ₹950 Paid, including the separately confirmed ₹400 Cash payment.
  This synthetic draft was not committed into the owner's review branch.
- **Seating:** the original remaining records show 16 matched, one explicitly
  deferred, zero decisions and zero conflicts. The completed list is collapsed;
  its review control still opens the existing timing/seat picker. The tested
  assignment retained Morning 06:00–10:00 and seat 5. No assignment was changed.
- **Refresh/recheck:** refresh retains the selected recovery section. Recheck
  preserved 23 saved / 17 pending; history now shows saved progress rather than
  a misleading zero-readiness mapping label. Server revalidation treats all
  actionable states consistently, including BLOCKED and CONFLICT.

Read-only repeatable-read snapshots compared hashes of every original row before
and after the walkthrough: Student 23, SeatAllocation 23, Payment 10, Seat 60,
Shift 3, MultiShift 1 and the original 40 ImportRows were unchanged. Draft
revisions/evaluation metadata changed through ordinary authorized revalidation.
Screenshots remain local under `test-results/owner-setup/recovery-*.jpg`.
The browser reset runner now refuses the preserved review database and requires
the separately verified disposable correction database.

The focused pure suite passed 62 tests in 10 files; the focused persisted import
suite passed 41 tests in two files, including the new saved-history/recheck
regression. Broader results below are dated separately from this walkthrough.

Regression verification also exposed two recovery presentation problems. Analysis
and commit runs with an identical timestamp could select the older run; ordering
now breaks ties by revision and ID. Saved financial outcomes are computed from
saved work even after a later preparation run. Both cases have persisted-service
assertions. The applied preparation count also remains visible after its now-useless
action panel disappears; the retained-draft browser test verifies both facts.
Final-import response recovery reads the received run only when its plan ID
matches the reviewed plan. The recovery-section URL is cleared before sending
the confirmed request so refresh can show the actual result. The mixed-register
fixture drops that response and checks that only one import POST was sent.

### Correction validation (6 November)

Commands using the general suite ran through the local proof-checking
`test-results/owner-setup/recovery-suite.mjs` wrapper: the exact disposable
PostgreSQL container, tmpfs storage, loopback port 50854, database identity and
58 applied migrations were verified before execution. Browser reset tests used
`OWNER_SETUP_CORRECTION=1` and a different database on port 50855. The preserved
owner review database was never a reset target.

| Command | Observed result |
| --- | --- |
| `pnpm test --config tests/owner-setup/vitest.config.ts` | 62 tests, 10 files passed; database/network I/O forbidden. |
| `pnpm test tests/integration/importing/guided-import.test.ts tests/integration/importing/owner-setup.test.ts` | Final focused run: 41 passed in 54.30 seconds, including saved-summary ordering and later-reanalysis preservation. |
| Initial `pnpm test` | 3,197 passed, one 15-second concurrency timeout; 376/377 files passed in 932.41 seconds. The complete file rerun passed that concurrency case but exposed the timestamp-tie summary defect described above; that defect was fixed and the focused suite rerun. |
| Final `pnpm test --testTimeout 30000 --hookTimeout 30000` | All 3,198 tests in 377 files passed in 803.03 seconds. The local run used a 30-second test/hook budget; assertions and concurrency checks remained enabled. |
| `node tests/owner-setup/local.mjs browser` with `OWNER_SETUP_CORRECTION=1` | Final run: 10 authenticated journeys passed in 3.3 minutes. Includes Basic/Standard/Pro at 1440/390px, actual Workflow execution, lost payment-choice and final-import responses, configuration changes, and mixed-register persisted totals. The lost final-import response sent exactly one commit POST and recovered the saved result. An earlier run stopped at an obsolete assertion expecting a completed match to remain expanded; the assertion now opens and checks the retained review disclosure. |
| `node tests/owner-setup/local.mjs retained-browser` with `OWNER_SETUP_CORRECTION=1` | Two retained V1 desktop/narrow journeys passed in 58.76 seconds. Covers partial allocation/payment recovery, concurrency and business-date rejection, refresh, PDF confirmation, manual financial facts and preparation-result visibility. |
| `pnpm test:workflow` | One simulated-world Workflow test passed in 6.90 seconds. |
| `pnpm exec tsc --noEmit` | Passed on the final source. |
| `pnpm lint` | Passed: zero errors, two existing unused-disable warnings in generated Workflow/coverage files. |
| `node tests/owner-setup/local.mjs build` (runs `pnpm build`) | Passed on final source: compilation, TypeScript, 74 static pages and two import Workflow manifests verified. |
| `git diff --check`; local Markdown-link check | Passed; 97 local links across three changed documents, none missing. |

The final built preview was checked again at localhost:3149: 23 students and
23 assignments saved, 17 still pending, three dues totalling ₹3,600, seven paid
records totalling ₹8,700, and 13 future fees left to normal generation. The
remaining students' recorded payments and source dates remain unchanged. Local
evidence includes `recovery-preserved-results.jpg` and `recovery-payment-action.jpg`.
Provider-backed AI, payment and messaging calls remained held or simulated;
normal development authentication was used for the ten authenticated journeys.

No schema, migration, seed, package-version or application-environment change is
required. The optional summary JSON field is additive, and old summaries get
their saved count from existing row statuses. Rollback does not require data
conversion. Home, Features, Pricing and FAQ need no new claim: this clarifies the
existing import feature. The earlier naming correction and all-plan parity remain.
The correction was validated locally before publication. The owner subsequently
authorized focused commits and an update to the existing PR #291. No merge,
deployment or Production action was performed. Owner acceptance of the experience
remains separate from these checks and permission to publish the commits.

### Changed files and final review

- Existing import components: `GuidedImportWorkspace.tsx`, `GuidedStudentEditor.tsx`,
  `GuidedPaymentChoices.tsx`, `GuidedSetupReview.tsx`, plus the small
  `GuidedPaymentProblem.tsx` explanation component in the same component directory.
  Import history changes are in `app/branch/[branchId]/onboarding/import/page.tsx`.
- Shared presentation and translations: `importing/utils/guided-import-presentation.ts`
  and `lib/i18n/ownerSetup.ts`.
- Persistence summaries and consistent revalidation:
  `importing/services/import-session.service.ts` and the additive summary field in
  `importing/contracts/import-session.contract.ts`.
- Regression coverage: `tests/unit/importing/guided-payment-problem.test.tsx`,
  `tests/unit/importing/guided-import-presentation.test.ts`,
  `tests/integration/importing/guided-import.test.ts`,
  `tests/browser/owner-setup-connected.spec.ts`, and `tests/import-browser/flow.test.ts`.
  The isolated runners are `tests/owner-setup/local.mjs` and
  `tests/owner-setup/vitest.config.ts`.
- Documentation: this report, `docs/ai/current-state.md` and
  `docs/redesign/page-family-migration.md`.

The final diff review checked the retained-editor revision fence, forward queue
selection, tenant-scoped saved counts and reviewed-plan identity during response
recovery. It found and removed a duplicated documentation paragraph. Server
authorization, staff permissions, entitlements, recorded facts, anniversary dues,
normal future generation and existing migration history remain unchanged. The
17 pending records are a real eligibility constraint, not a successful import;
provider-backed AI and external payment/messaging delivery were not exercised.

## Live owner review after PR creation — 6 November 2026

**Historical audit before the recovery correction above; owner acceptance remains pending.** The passing fixture below does not
establish that the existing owner's recovery flow is understandable. A direct
review of the open Chrome session on localhost:3149 at `c4c3a06` found:

- The existing 40-row register has 23 saved students and 17 awaiting payment
  decisions. Recovery repeats generic help panels without explaining the shared
  reason beside the affected students.
- Two inspected records contain a recorded Paid amount before the eligible due.
  The task says only "Confirm payment information". The editor warns that an
  early payment will not be created, but does not show the relevant due date or
  explain a truthful next step. Saving one record without changing its facts
  preserves the draft and displays the remaining reason, but "Save & next"
  leaves the same student open. This is accurate persistence feedback and an
  incomplete decision flow.
- "Keep eligible fees Due · 0" remains prominent. "Review payments and select
  Paid" expands all 40 records even though none can be selected in this state.
  It gives no direct route from a protected record to its specific conflict.
- Seats correctly show 16 matched assignments, one deliberate deferral, and
  zero unresolved seating decisions among the remaining students. Nevertheless,
  the page repeats matched-label editors and the general student list, including
  unrelated payment tasks. Completed work is not sufficiently separated from
  the next required decision.
- Refresh preserves 23 saved / 17 remaining, but returns from the recovery
  workspace to the result page. Saved records were not reimported during review.

Code inspection explains these observations: `guidedStudentTasks` collapses the
payment issues into one label; the payment panel renders bulk review whenever a
review response exists, including zero eligible choices; the seats section
reuses the general student list. The next correction must address those specific
transitions, retain the useful allocation controls, and preserve recorded payment
facts and the prohibition on early dues. A genuine advance payment cannot be
made valid by silently changing Paid to Due or changing the original joining date.

This review made no application-code, schema, migration, environment, or payment
changes. One unchanged draft was saved to reproduce the behavior. Browser
evidence is local in `test-results/owner-setup/live-review-overview.jpg` and
`test-results/owner-setup/live-review-stalled-payment.jpg`; these captures are not
published with the repository. Runtime suites were not repeated for this
inspection-only finding. The earlier command results remain historical evidence,
not approval of this owner experience.

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
