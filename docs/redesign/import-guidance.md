# Guided imports and current-month fees

Local implementation, 3 November 2026. Owner acceptance and release are separate.

The subsequent student-focused presentation and full Next workspace verification
are recorded in [the workspace review](import-workspace-review.md). The validation
tables below retain the evidence for the earlier implementation and review fixes.

New uploads use `GUIDED_CURRENT_MONTH_V1` in the existing session JSON. The owner
adds records, receives a prepared draft, resolves a student help queue, then
reviews an immutable plan and explicitly confirms it. Existing drafts without
the marker retain the original wizard and payment-history options. Executing
and completed plans are not converted.

Known columns and supported branch matches require no separate approval step.
Uncertain columns with values require an explicit mapping or ignore decision.
Repeated unknown shift names are grouped across the entire staged file; an
owner confirmation selects an existing branch shift/bundle and applies only to
matching, non-imported, non-excluded students under the expected revision.
Manual normalized rows and confirmed column mappings survive reanalysis.

Gemini remains advisory and receives masked source shapes and structural draft
context: opaque row/answer aliases, whitelisted field names, issue categories,
manual flags and affected counts. Raw values and branch configuration stay local.
Relationships between opaque source, meaning and branch-choice aliases preserve
owner-confirmed shift meanings. Re-preparation can propose applying such an
answer to non-manual unresolved spellings equivalent under NFKC, case, spaces,
periods, hyphens and underscores. The server rejects unsupported/contradictory
bindings, rechecks current scoped branch choices and mutable rows under the
publication lock, preserves newly mapped financial values/parse holds, then
revalidates. The UI reports actual prepared-row counts. Arbitrary new meanings,
dates, fees, payments and seats remain outside this proposal path.

Preparation is limited to three passes and 15 seconds per provider request;
fallback and manual corrections retain saved progress. The provider transport
and SDK are unchanged. The structured JSON response adds an optional
bounded `draftShiftProposals` array using the existing supported object/array
schema primitives ([Google documentation](https://ai.google.dev/gemini-api/docs/generate-content/structured-output)).
Real-provider accuracy/latency is not claimed by mocked tests.

## Financial outcomes

The new flow creates only an eligible anniversary due in the current calendar
month whose due date has arrived. A future due remains for normal generation;
a first due next month produces no current-month payment. Original joining dates
are retained. `billingStartAt` is the period start of the first cycle whose due
date is on/after month start, even when no payment is created now. The existing
generator compares period starts against this boundary, preventing later
historical backfill while allowing subsequent unpaid cycles.

For 2 November 2026: eligible 1/2 November dues are included; 15 November is
deferred to generation; a November join with its first due in December creates
no November due. Original month-end anchors and leap-day behavior come from
`studentBillingCycles.ts`. The existing runtime-local business-date convention
is preserved, including its documented organization-timezone discrepancy.

Explicit full paid/waived facts use existing payment resolution operations.
Paid requires a supported recorded method; methods are never defaulted by this
flow. Partial amounts, unclear status, mismatched amounts and payment facts
before an eligible due remain unresolved. There is no new partial-payment
migration, advance ledger or invented receipt/date. Existing identity matches
are held for review, never automatically linked or financially overwritten.
The guided editor uses recorded-only payment drafts: an absent amount stays
blank, while a source or owner-entered amount is retained even when equal to the
fee. Direct fee edits, shift/bundle changes and linking a fee cannot create or
resynchronize payment facts. The legacy editor's defaults remain unchanged.
Explicitly cleared fields stay blank after reload and later edits; fallback
hydration respects the existing cleared-field metadata while still displaying
unresolved invalid raw amounts.

The plan hash includes the business date and student-level outcomes. A changed
business date blocks a new commit until outcomes are refreshed and a new plan
reviewed. A previously started run or identical lost-response replay retains its
frozen plan and successful mutation hashes. Results show completed rows and
partial student creation separately; recovery reuses only exact successful
mutations. Shift/bundle components and live/draft occupancy are rechecked through
the existing allocation services at execution.

## Local validation

Use a new disposable loopback PostgreSQL fixture, never the normal application
database. The private `.agent/check-import.cjs` guard verifies Docker ID, image,
task label, loopback port and connected database identity before each check.
It injects only the fixture connection and Test provider holds. Existing
migrations are applied with `scripts/bootstrap-isolated-database.mjs`.

Connected browser command:
`pnpm exec vitest run --config tests/import-browser/vitest.config.ts`.
This dedicated test origin mounts real application components and executes real
API handlers, authorization, services, immutable plans and domain writes against
the disposable DB. Only identity, Gemini and the Workflow scheduler are test
adapters. No bypass or fixture flag exists in production application routes.
Chromium exercises desktop paste and narrow CSV upload, grouped clarification,
manual date correction, visual bundle/seats, keyboard selection, payment review,
confirmation, partial allocation failure, refresh, repair and persisted results.
Hindi/Hinglish labels, overflow and console/network failures are checked.

Focused tests cover date matrices, future generation without historical backfill,
paid/partial/waived facts, existing identities, all three plans, cross-branch and
permission rejection, staged/live conflicts, provider failure/timeout, validated
AI mappings, stale publication and bounded passes. The Basic lifecycle test now
compares exact canonical anniversary instants instead of the UTC day number;
this preserves the existing runtime-local convention and strengthens its check.

Final command counts, review findings and results are recorded after validation
below. No schema, migration, package version, seed or application environment
change is required. No Production access, migration, deployment or merge is
authorized by this implementation.

## Separate final review

A read-only review agent inspected the complete implementation and amended diff.
The following findings were fixed: editing while Save is pending, remapping
confirmed ignored columns, cross-month partial recovery recomputing financial
boundaries, mixed clocks in plan/recovery preview, date-refresh actions being
unreachable after reload, lost PDF confirmation state, rounding signed/decimal
money inputs, preparation cancellation closing the draft, and stale four-policy
copy. The amended review reported no remaining confirmed blocking findings;
the final command reruns passed as recorded below.

A further consistency review found whole-row manual provenance could hide newly
interpreted financial source cells or drop earlier parse errors after a shift
answer. Mapping and AI publication now reconcile only newly understood columns
under the existing lock, enrich missing fields, retain conflicts/parse holds,
and preserve explicitly cleared fields and seating deferral. Group confirmation
retains earlier normalization errors. Only explicit row correction clears these
holds; invalid raw money remains visible in the guided editor instead of being
replaced with a fee default. Real-service regressions cover unknown receipt 300,
conflicting confirmed 1000 versus source 300, and invalid 300.50 amounts/fees.

Reconciliation reloads mutable rows under the session lock, since a run can
finish without advancing the draft revision. A concurrent partial commit must
not allow a stale mapping read to modify newly imported rows. Guided mappings
also reject duplicate target fields and equivalent seat/shift aliases rather
than applying the last source value. The regressions cover both cases.

Cross-month recovery now loads the original financial review date from the
successful student's immutable source plan, under the same session/branch
boundary. Validation, row preview and compilation use that date for the existing
student; the new plan itself is fenced to today's review date and labels the
original recovery date. This prevents both billing-boundary drift and applying
last month's paid facts to this month's due. Normal generation remains responsible
for later cycles.

## Command evidence — initial implementation

Commands ran from the feature worktree through the private fixture-identity guard
on a new task-labelled PostgreSQL 16 container. Application data and Production
providers were excluded. The application environment and checked-in test limits
were not changed. A temporary process-scoped awake request was used after host
timing pauses; it ends with validation and does not change saved power settings.

| Expanded command | Result |
| --- | --- |
| `pnpm install --frozen-lockfile --offline` | Passed; existing Prisma client generated, lockfile unchanged |
| `pnpm test:workflow` | Passed, 1 test |
| `pnpm test` | Passed, 3,129 tests in 366 files; no failures or unhandled errors |
| `pnpm test:coverage` | Passed, 3,129 tests in 366 files; lines 77.09%, functions 86.86% (both exceed the unchanged 70% thresholds), statements 74.34%, branches 67.85% |
| `pnpm exec tsc --noEmit --pretty false` | Passed |
| `pnpm lint` | Passed; one unused-directive warning in generated Workflow code |
| `pnpm build` | Passed; 2 import Workflow manifests verified |
| `pnpm exec prisma validate` | Passed |
| `pnpm exec prisma migrate status` | Passed; all 58 existing migrations current |
| `pnpm exec vitest run --config tests/import-browser/vitest.config.ts` | Passed, 2 connected browser scenarios |
| `git diff --check` | Passed |

The browser scenarios cover 1440px desktop paste and 390px CSV upload, real API
preparation, grouped clarification, manual corrections, searchable bundle/seat
selection including keyboard use, date/payment preview, explicit commit, injected
partial allocation failure, refresh and repair. They also check a delayed
save/next response, saved PDF extraction confirmation, invalid raw monetary
values, review/editor overflow, Hindi/Hinglish labels and console/network errors.
Persisted student, allocation and payment counts are asserted after recovery.
Gemini responses and scheduler dispatch are deterministic test adapters; there
was no live Gemini, live Clerk or hosted/provider verification claim.

Earlier full-suite attempts encountered timing/worker failures; the affected
files passed unchanged on focused reruns. Overlapping/interrupted development
validation attempts are excluded from final readiness evidence. The final
exclusive run passed every check, including the complete suite and coverage.
Coverage percentages use the repository's existing `services/**/*.ts` and
`utils/**/*.ts` scope; importing regressions also run in both complete suites.
The temporary awake request ended and the exclusive validation lock was removed.

## PR #290 review corrections

The two reported P2 issues are addressed by recorded-only payment drafts and
validated equivalent-shift proposals. New helper and real-service regressions
cover absent/partial/equal-fee amounts, a second pass with correct columns and
previous answers improving unresolved rows while preserving manual work, invalid
alias/contradictory bindings, and financial-column interpretation during the same
pass. Connected browser scenarios exercise direct fee edits, fee linking, linked
bundle changes and retained partial amounts. Validation for this amended diff
is recorded below separately from the original commit's evidence.

The read-only follow-up review found a further cleared-field fallback issue.
Both the fallback and invalid-value display now honor explicit clears; the
server records nonempty mapped source fields removed by an explicit full-row
save even if an invalid value never normalized. Group confirmations keep their
existing source holds. The amended review reported no remaining concrete blocker.

Focused command (through the same verified disposable fixture):
`pnpm exec vitest run tests/unit/importing/guided-payment-draft.test.ts tests/unit/importing/guided-shift-assistance.test.ts tests/unit/importing/import-guidance-ai.test.ts tests/unit/importing/import-column-mapper-privacy.test.ts tests/unit/importing/import-wizard-view-model.test.ts tests/integration/importing/guided-import.test.ts`
— **49 tests in 6 files passed**.

Development checks first found a test-only JSON typing error and a browser fixture
that had a zero-price shift while expecting 1000; both were corrected. Validation
queues stopped for the follow-up clearing fixes are not final readiness evidence.
One automatic approval attempt timed out before starting a type check; its
permitted retry ran. No check/assertion/timeout was weakened.

The first amended full-suite attempt was stopped after existing billing/Basic
tests exceeded their timeouts. Windows Kernel-Power events confirmed Modern
Standby with reason `Lid` at the corresponding 99-second and 61-second pauses.
The owner agreed to keep the lid open for the clean rerun; its process-scoped
awake request also includes the display, preventing idle display sleep during
validation without changing saved power settings. Paused results are excluded.

| Amended command | Result |
| --- | --- |
| Focused command above | Passed, 49 tests in 6 files |
| `pnpm exec vitest run tests/integration/services/billing-mutation.test.ts tests/integration/services/basic-workspace.test.ts` | Passed unchanged, 126 tests in 2 files |
| `pnpm test:workflow` | Passed, 1 test |
| `pnpm exec tsc --noEmit --pretty false` | Passed |
| `pnpm lint` | Passed; 2 unused-directive warnings in generated Workflow/coverage artifacts |
| `pnpm exec vitest run --config tests/import-browser/vitest.config.ts` | Passed, both expanded desktop/mobile scenarios, including the actual re-preparation button |
| `pnpm exec eslint tests/import-browser/flow.test.ts` | Passed; no warnings after the final browser extension |
| `pnpm build` | Passed; both import Workflow manifests verified |
| `pnpm test` | Passed, 3,142 tests in 368 files; no failures or unhandled errors |
| `pnpm test:coverage` | Passed, 3,142 tests in 368 files; lines 77.23%, functions 87.02% (unchanged 70% thresholds), statements 74.50%, branches 68.08% |
| Changed documentation links and `git diff --check` | Passed |

The amended complete-suite and coverage runs passed. The additional connected
browser-button scenario then passed at both viewports, followed by a fresh
successful type check and scoped lint. With columns already correct, an owner
answer and the actual button produce a validated persisted shift change, the
correct prepared count, a redacted prompt and no pre-confirmation domain writes.
Coverage retains the repository's existing services/utils scope. The exclusive
queue ended, its lock was removed, and the temporary display/system awake
request was released. Main application data, providers and configuration were
not modified.
