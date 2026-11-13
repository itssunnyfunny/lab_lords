# Design completion — 12 November 2026

## Scope and starting state

The owner requests completion of the current refined application, preserving grouped navigation, the original Standard/Pro sidebar, daily mobile navigation, dashboard hierarchy and the selected-seat desktop panel/mobile drawer. The existing Basic header overrides its auto height with 76px while its switcher wraps; narrow student rows reserve an automatic-width dues column. Seat tiles repeat availability and use wrapping action rows. Guided and legacy import reviews retain large introductory/progress surfaces; payment states span date and status columns. Billing, reporting and secondary workflows need interior refinement.

## Boundaries and implementation approach

Use existing feature components and shared typography, panels, controls and overlays. Preserve request identities, dirty-form guards, actor/tenant/plan permissions, read-only access, payment/receipt arithmetic and date meanings, billed/effective/scheduled subscription distinctions, combined-shift allocation rules, import revisions, source facts, manual decisions, staged configuration and successful-operation recovery. API handlers, service rules, schema, migrations, package versions, seed data and saved environment configuration are outside this presentation pass. No Production/shared data or live provider calls.

The local source baseline contains 545 files and the attached brief under `test-results/design-completion-2026-11-12/`. Earlier uncommitted work and review galleries are preserved. A fresh four-width baseline is captured before presentation edits.

## Worklist

| Priority | Page family | Work | Status |
| --- | --- | --- | --- |
| 1 | Basic | Header composition; narrow identities, dues and detail actions | Implemented; locally verified |
| 2 | Seats, Allocations, Shifts | Compact scan tiles; consistent selection/actions; operator-facing capacity scope | Implemented; locally verified |
| 3 | Guided and legacy import | Records first; connected editing; field/seat/fee decisions; final review and recovery | Implemented; locally verified |
| 4 | Fees, receipts, reports | Group payment states; explicit primary amounts; formatting/alignment and date scope | Implemented; locally verified |
| 4 | Account Billing | Subscription hierarchy, plain unusual-state wording, discoverable navigation | Implemented; locally verified |
| 5 | Analytics and AI reports | Balanced metrics/charts; one priority/risk/time; supporting details | Implemented; locally verified |
| 5 | Settings, Staff, Tasks, Attendance, Organization, Onboarding | Complete record interiors, actions, contextual copy and final steps | Implemented; locally verified |
| 6 | Verification and delivery | Plan/language/width/state checks; lint, typecheck, build; fresh gallery/report/ZIP | Locally verified; review package complete |

## Verification plan

Use the existing provider-disabled synthetic browser harness with real rendering components. Extend meaningful regressions for Basic geometry and identity width, seat selection/assignment and full guided/legacy review paths. Preserve assertions for financial facts, saved drafts, command identity, access and recovery. Check wide desktop, tablet and 320/390px phones; English, Hindi and Hinglish; loaded, empty, error, disabled and overlay states. Run the safe explicit unit allowlist, affected existing browser families, presentation guard, TypeScript, lint, guarded disposable-database production build and `git diff --check`. Never use the broad DB-resetting test setup.

No migration or data rollback is needed. Revert only this pass's presentation changes if required, preserving earlier working-tree work. Local verification, owner acceptance and release are recorded separately. Home, Features, Pricing and FAQ need no commercial/capability wording changes unless this pass reveals an actual mismatch.

## Current implementation

Basic context wraps within an auto-height header and narrow student cards place
seat/shift/dues below identity. Seat tiles use one status, selected state and a
single consistent assignment footer. Guided review puts records before payment
support, connects the wide-screen editor and keeps smaller-screen Dialog behavior;
legacy progress/counts are compact, with mobile step selection and bulk controls after the records. Final review and recovery retain existing
confirmation and command identity. Payment statuses share one area, the primary
amount is labelled, detailed balances remain available, and receipts/report
previews format rupees without changing values or calendar semantics.

Billing leads with its purpose/current subscription, uses state-specific plain
wording and retains every section in responsive navigation. Analytics uses a
balanced chart/summary and explicitly scoped numbers. AI overall risk appears
once. Staff distinguishes invitation from adding an existing account; Tasks no
longer mixes dashboard setup into the record footer. Settings distinguish fee
defaults/subscription and put IDs behind disclosure. Populated attendance, branch
selection and later onboarding review use the same record/action hierarchy. Narrow attendance dates retain their full value.

New local browser fixtures cover actual guided/legacy review paths. Basic/seat
checks pass at four widths, with long context in English, Hindi and Hinglish.
Final local checks pass: 279 browser cases (29 intentional viewport skips), 791 safe unit tests and a separate 66-test import/calendar suite. All 132 route views and 44 workflow captures pass the recorded runtime/overflow checks; 33 route views at 390px pass the contrast rule. Lint passes with two existing generated/coverage warnings; TypeScript, the presentation guard and isolated production build pass.

The [full audit report](../audits/design-completion-2026-11-12.md) records commands, changed files, findings, coverage and release limits. The gallery, report, ZIP and hash manifest are under `test-results/design-completion-2026-11-12/review/`. Local verification is complete; owner visual acceptance and release remain pending.
