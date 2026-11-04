# Guided import workspace review

Local implementation and verification for PR #290, 3–4 November 2026. This continues
`codex/ai-guided-current-month-imports` after reviewed commit `8751c3e`.
Owner visual acceptance, merge and Production release remain separate.

## Behavior and ownership

The previous guided screen still embedded the row editor. A clean import opened
an empty help filter, several summaries competed above the work, and a dead
“Fix these first” instruction referenced a section the guided route did not own.
CREATE_NOW also mislabeled paid and waived fees as outstanding dues.

The guided route now owns student cards with relevant correction tasks, a focused
details/seating/fees dialog, an immutable-plan review, and saved outcomes. Task
buttons open the relevant correction. The cards show student names first and
keep source record numbers for reference. Clean imports open the ready list. Group decisions retain
whole-file scope while student cards paginate. Seating can be deferred without
excluding the student. The shared picker shows combined access through each
included timing and distinguishes draft conflicts from live occupancy. The
student name and uploaded timings remain visible while the picker scrolls.
Real Basic screenshots exposed dark shared panels inside its light shell. The
import slot now opts into the existing shared workspace token scope, covering
entry, guided/compatibility screens and their body portals without changing
unrelated Basic screens or introducing another palette.

Preparation is offered for unresolved columns or equivalent source meanings that
can reuse an uncontradicted owner answer. It does not promise to infer missing
dates, payments or seat choices. Successful answers and preparation report global
ready/help counts and the actual number changed; unresolved records stay held.
Unavailable, cancelled and exhausted preparation retain manual correction.

The single final fee summary separates outstanding, paid, waived, existing,
future, no-current-due and held information. Student monthly fees remain distinct
from recorded amounts. Missing amounts remain blank through fee/shift changes;
explicit values and clears retain the reviewed provenance fixes. Saved totals
come only from successful payment operations and their original immutable plans,
deduplicated across recovery. A successful student operation is insufficient.
Future/no-due tracking is reported only after the student operation succeeds.
The results describe historical import facts. Fees shows today's balances and collections.

Results retain a completion action for remaining draft records even when the
selected ready records all saved successfully. Partial execution, refresh and
recovery preserve successful domain records and do not add them twice.
Already saved student details, monthly fees, payments and seat assignments are
read-only in recovery. A retry can repair a failed assignment or payment while
retaining the fields saved by successful operations. Reset restores the original
fee-link setting as well as field values. Cancelled runs show saved work and
offer a route back to import history.

The separate review identified seven issues. The amendments count missing
monthly fees among held records, distinguish fully completed students, give
stale plans a refresh action that reads the latest mapping and revision, protect successful seat assignments, scope shared
import styles inside Basic, guard branch and search navigation during draft
edits, and explain terminal cancellation. Owners can reset source column changes
before leaving the draft.

Main implementation owners are `GuidedImportWorkspace`, `GuidedStudentEditor`,
`GuidedFinancialReview`, `GuidedImportResults`, `guided-import-presentation` and
`import-saved-outcomes`. The guided route no longer embeds RowsStep, PreviewStep
or ResultStep; those remain unchanged for compatibility sessions. Shared controls,
tokens, the allocation picker and domain services are reused.

## Boundaries and deployment

No package, schema, migration, seed, application environment, hosting or cron
change is needed. New JSON plans include optional held-fee/deferred-seating
counts. Cached reviews missing those counts request an explicit refresh and a new
revision. Existing immutable plans and started runs retain their original data.

Tenant/branch authorization, staff permissions, all-plan import availability,
immutable plan confirmation, revision/date fences, idempotency, stale-response
guards and durable recovery remain authoritative. Draft preparation creates no
live student, allocation or payment. Original joining dates, anniversary billing,
current-month eligibility, future generation and historical-cycle exclusion are
unchanged. No live payment-table reads were added to session detail. AI remains
advisory and receives opaque structural context, never student values.

Home, Features, Pricing and FAQ retain their approved claims; the improved
presentation introduces no broader automation or AI accuracy claim.

## Full application evidence

Before images were captured from the existing local Production build at `8751c3e`.
After images use the rebuilt Next application and actual protected import routes,
with a real saved Clerk Test session inside BranchWorkspaceShell. The isolated
PostgreSQL container is verified by exact container identity, image, task label,
loopback port and connected database name before operations. All displayed
students/branches are synthetic, avatars are masked, provider writes are held,
and Gemini is disabled. No Production, Preview or shared database was used.

The connected component and service browser fixture uses a deterministic Gemini
proposal response. The full Next application uses real local Workflow execution
and deterministic structural parsing with Gemini disabled.

| State | Before | After in Standard workspace |
| --- | --- | --- |
| Mixed students | [Desktop](import-guidance-evidence/before/mixed-1440.png), [narrow](import-guidance-evidence/before/mixed-390.png) | [Desktop](import-guidance-evidence/after/standard-mixed-1440.png), [narrow](import-guidance-evidence/after/standard-mixed-390.png) |
| Clean students | [Desktop](import-guidance-evidence/before/clean-1440.png), [narrow](import-guidance-evidence/before/clean-390.png) | [Desktop](import-guidance-evidence/after/standard-clean-1440.png), [narrow](import-guidance-evidence/after/standard-clean-390.png) |
| Student correction | [Before](import-guidance-evidence/before/student-editor-1440.png) | [Desktop](import-guidance-evidence/after/standard-editor-1440.png), [narrow](import-guidance-evidence/after/standard-editor-390.png) |
| Fee review | [Desktop](import-guidance-evidence/before/payment-review-1440.png), [narrow](import-guidance-evidence/before/payment-review-390.png) | [Desktop](import-guidance-evidence/after/standard-review-1440.png), [narrow](import-guidance-evidence/after/standard-review-390.png) |
| Visual seating | — | [Desktop](import-guidance-evidence/after/standard-seating-1440.png), [narrow](import-guidance-evidence/after/standard-seating-390.png) |
| Partial save and recovery | — | [Partial](import-guidance-evidence/after/standard-partial-1440.png), [existing fee retained](import-guidance-evidence/after/standard-recovery-review-1440.png) |
| Saved outcomes | — | [Desktop](import-guidance-evidence/after/standard-saved-1440.png), [narrow](import-guidance-evidence/after/standard-saved-390.png) |
| Ready records saved with other students still held | — | [Remaining draft work](import-guidance-evidence/after/standard-draft-remains-1440.png) |
| Group clarification and saved correction | — | [Clarification](import-guidance-evidence/after/standard-clarification-saved-1440.png) |
| Student included with seating deferred | — | [Deferred seating](import-guidance-evidence/after/standard-deferred-seating-1440.png) |

The Basic and Pro runs exercise the same protected routes inside each workspace
shell. See the [Basic narrow ready list](import-guidance-evidence/after/basic-clean-390.png),
[Basic narrow Hindi view](import-guidance-evidence/after/basic-hi-390.png),
[Pro desktop seating editor](import-guidance-evidence/after/pro-seating-1440.png)
and [Pro narrow Hinglish view](import-guidance-evidence/after/pro-hinglish-390.png).
The Standard run covers [file upload](import-guidance-evidence/after/standard-file-prepared.png)
and [table paste](import-guidance-evidence/after/standard-paste-prepared.png) through real
local Workflow preparation.

## Validation

The final review rechecked the seven amendments and the concurrent-tab refresh
path. Review refresh reads the latest saved mapping and revision before applying
the server revision check. No remaining merge blocker was found in those paths.

All commands ran from the PR worktree. Database-backed checks used guarded
loopback PostgreSQL 16 fixtures. The browser fixtures and full suite used
separate databases so test resets could not affect the running application.

| Command | Result |
| --- | --- |
| `pnpm exec prisma migrate deploy` | Applied all 58 existing migrations to each disposable fixture. |
| `pnpm test:coverage` | Full suite passed with 3,165 tests in 372 files. Coverage measured 77.32% lines, 87.12% functions, 74.63% statements and 68.27% branches. |
| `pnpm test:workflow` | 1 passed. |
| `pnpm exec vitest run --config tests/import-browser/vitest.config.ts` | 2 passed at 1440 px and 390 px. Covers injected date and revision conflicts, late allocation failure, payment retry with a retained seat, PDF confirmation, and recorded payment edits. |
| `pnpm exec playwright test tests/browser/import-guided-workspace.spec.ts --project=chromium --project=mobile-chromium` | 12 passed across Basic, Standard and Pro. Checks task focus, keyboard tabs, contrast, fee labels and branch switching with unsaved column changes. |
| `pnpm exec tsc --noEmit --pretty false` | Passed. |
| `pnpm lint` | Passed with one warning in a generated Workflow file. |
| `pnpm build` | Passed and verified both import Workflow entries. |
| `git diff --check` and `git diff --cached --check` | Passed. |

The focused command passed 54 tests in seven files.

```text
pnpm exec vitest run tests/unit/importing/guided-import-presentation.test.ts tests/unit/importing/guided-import-results.test.tsx tests/unit/importing/import-saved-outcomes.test.ts tests/unit/importing/guided-payment-draft.test.ts tests/unit/importing/guided-shift-assistance.test.ts tests/unit/lib/workspace-navigation-guard.test.ts tests/integration/importing/guided-import.test.ts
```

The local runner `powershell -NoProfile -File .agent/run-all-actual.ps1` prepared
synthetic records, started the built Next application on localhost, ran the
Playwright spec and captured the screenshots. The smoke run used
`node .agent/actual-guided-flow.mjs full` in Standard and
`node .agent/actual-guided-flow.mjs screens` in Basic and Pro. Each run observed
zero browser or HTTP errors. The Standard run exercised a late live seat
conflict and verified saved students, allocations and payments after recovery.
