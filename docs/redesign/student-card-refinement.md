# Focused Students card review — 2026-09-27

Review status: **refined; awaiting owner approval**. Staff and Tasks have not
started. This pass starts from the latest local `0c7b80c` implementation on
`codex/shared-students-pattern`, preserving the selected dashboard and history.
Implementation commit: `36d0d0d` — Refine Students cards and edit presentation.
Evidence and reproducible review tools are committed separately from the implementation.

## Result and review images

The real Students grid now renders one outer card with identity, allocation and
financial sections. Name/details and overflow are independent controls with
44px minimum tap areas. Initials use quiet existing theme tokens. Every seat /
shift / bundle-component pair wraps; no allocation is discarded. Due is primary;
monthly fee, recorded paid/waived amounts and joining date retain their separate
meanings. Known zero due does not imply payment received. Undefined aggregates
and restricted financial access are displayed explicitly, never invented zeroes.

The existing Students feature still owns reads, authorized aggregate values,
permissions and actions. The name opens its existing permitted Edit Details
workflow; read-only viewers with payment access enter the existing fee drawer.
Admission, fee collection, attendance, consent, allocation, status resolution,
validation, request recovery, filters and focus behavior retain their owners.

Only the requested page subtitle changes, with natural Hindi/Hinglish versions.
Edit has primary Save / secondary Cancel, the existing language control in a
wrapping header, and a scoped softer backdrop. Other dialogs retain default
headers/backdrops. The gallery imports the actual production StudentRecordCard.

| Review surface | Evidence |
| --- | --- |
| Three consecutive records, same 390px viewport and native scale | [Before / refined pair](student-card-evidence/compare-roster-en-390.png) |
| Narrow Hindi | [320px cards](student-card-evidence/after/roster-hi-320.png) |
| Long Hindi name and multiple allocations | [320px expanded content](student-card-evidence/after/long-multiple-hi-320.png) |
| Refined Edit | [English 390px](student-card-evidence/after/edit-en-390.png), [Hindi 390px](student-card-evidence/after/edit-hi-390.png), [desktop](student-card-evidence/after/edit-en-desktop.png) |
| Actual shared-component gallery | [390px](student-card-evidence/after/gallery-390.png) |
| Selected dashboard preservation | [Native 1491 × 1055 pair](student-card-evidence/compare-dashboard.png) |
| Desktop table preservation | [Same table crop](student-card-evidence/compare-desktop-table.png) |
| Real Next route / authorized local data | [English desktop](student-card-evidence/connected/students-en-1491.png), [Hindi mobile records](student-card-evidence/connected/students-hi-390-records.png), [Hinglish mobile](student-card-evidence/connected/students-hinglish-390.png) |
| Existing real overlays/access | [Edit](student-card-evidence/connected/students-edit.png), [nested collection](student-card-evidence/connected/students-nested-fees.png), [attendance](student-card-evidence/connected/students-attendance.png), [read-only](student-card-evidence/connected/students-readonly.png), [restricted staff](student-card-evidence/connected/students-restricted.png) |

Before and refined captures use the same three isolated records, including Meera
with no phone/no seat and known zero due/paid. Test interception changes her
fixture phone to null in both phases; no production records are altered. English,
Hindi and Hinglish card crops at both 320 and 390px are in `after/`. Stored names
and shift names remain verbatim; interface translation is separate from date /
document preference. Long content expands naturally, without fixed card heights.

At 390px, the short cards change from **283 / 283 / 293px to 209 / 209 / 209px**.
The three-card region, including its unchanged gaps, changes from **892 to 660px**
(232px / 26% less vertical space). The original before measurements record avatar
initials AM/NV/MS in that same order; the refined measurements record names.

Decoded image comparisons report **zero differing pixels** for both the desktop
table and the full selected dashboard. Only one full dashboard frame is checked
here; historical dashboard packets/crops are not regenerated or overwritten.
See [measurements](student-card-evidence/after/measurements.json) and
[comparison results](student-card-evidence/comparison.json). This is preservation
evidence, not automatic visual acceptance.

## Source / usage map

| Owner | Change / boundary |
| --- | --- |
| `app/branch/[branchId]/students/StudentRecordCard.tsx` | Production feature card; formats supplied values and all allocation pairs; no fee arithmetic, reads or commands |
| Students `page.tsx` | Existing aggregate/permission/action wiring and name entry; desktop columns/renderers unchanged |
| Students `EditStudentDialog.tsx` | Presentation opt-ins and button variants only; fields, fee linkage and save command unchanged |
| `components/ui/Avatar.tsx` | Quiet opt-in; default colorful avatars remain compatible |
| `components/ui/Dialog.tsx` | Header-language opt-in and backdrop class hook; existing modal lifecycle unchanged |
| `styles/shared-ui.css` | Compact card hierarchy and scoped 44px menu / edit backdrop rules, using existing tokens |
| `lib/i18n/management.ts` | One requested subtitle and its Hindi/Hinglish translations |
| `tests/application-design-pilot/ComponentGallery.tsx` | Imports the production card alongside existing primitives |

Reuse guidance is maintained in [the central source map](../ai/application-design-system.md).
The existing harness gallery remains development-only; it creates no product
route, data abstraction or alternate card framework.

## Exact checks

Commands below were invoked with the installed PowerShell pnpm shim
`& "$env:APPDATA\npm\pnpm.cmd"` in place of `pnpm`. Dedicated configurations were
inspected first. No broad repository database-connected test setup was run.

| Command | Result |
| --- | --- |
| `pnpm exec node node_modules/vitest/vitest.mjs run --config tests/shared-system/vitest.config.ts` | **12 files / 56 tests passed**, 6.48s; explicit presentation/workflow allowlist, throwing database/network guard |
| `pnpm exec node node_modules/vitest/vitest.mjs run --config tests/shared-system/vitest.config.ts tests/unit/components/record-pattern.test.tsx` | **1 file / 10 tests passed**, 6.14s, after final card changes |
| `pnpm exec node node_modules/@playwright/test/cli.js test --config tests/shared-system/playwright.config.ts student-card.spec.ts --project=mobile-390 --project=mobile-320` | **10 passed**, 35.6s; all three languages, short/long/multiple records, distinct finances, no overflow, 44px controls, keyboard/focus/context, inactive/restricted/readonly, validation/language/pending-save dismissal; serious/critical axe violations absent |
| `pnpm exec node node_modules/@playwright/test/cli.js test --config tests/shared-system/playwright.config.ts shared-system.spec.ts pilot.spec.ts --grep "failed\|background supporting\|gallery\|admission\|status resolution\|branch and account\|student search\|seat scope\|partial collection\|empty, no-results\|English, Hindi" --project=desktop-1440 --project=mobile-390 --output=test-results/card-shared-consumers` | **23 passed / 1 failed**, 2.8m; one desktop Seats initial-load timeout while the build was running. Existing Students failure/retry/draft/nested/identity workflows and collection recovery passed |
| `pnpm exec node node_modules/@playwright/test/cli.js test --config tests/shared-system/playwright.config.ts pilot.spec.ts --grep "seat scope" --project=desktop-1440 --output=test-results/card-seat-recheck` | **1 passed**, 4.1s; isolated recheck of the timed-out existing consumer. No Seats implementation or test changes |
| `pnpm exec node tests/application-design-pilot/student-card-capture.mjs before` | **Passed**; frozen before roster/table/dashboard, loaded fonts, no page errors. Refuses replacing an existing baseline |
| `pnpm exec node tests/application-design-pilot/student-card-capture.mjs after` | **Passed**; corrected language query, all six language/width card crops, long/multiple example, settled edit dialogs, actual gallery, no page errors |
| `pnpm exec node tests/application-design-pilot/student-card-compare.mjs` | **Passed**; dashboard 1491 × 1055 and desktop table 1195 × 221 each have 0 differing decoded pixels |
| `pnpm exec node tests/shared-system/check-presentation.mjs 0c7b80c` | **Passed**; no new literal palette or parallel surface owner |
| `pnpm exec node node_modules/typescript/bin/tsc --noEmit --incremental false` | **Passed**, exit 0 after correcting one test-only HTMLElement/SVGElement typing error |
| `pnpm lint` | **Passed**, exit 0; 0 errors, 2 existing unused-disable warnings in generated Workflow / coverage files |
| Scoped ESLint of all edited TS/TSX/MJS files (exact command below) | **Passed**, exit 0, no warnings/errors |
| `pnpm exec node tests/dashboard-connected/start-local.mjs counts` | **Passed**; exact container/image/loopback/fixture identity verified, 53 applied migrations / 80 public tables / 8 students / 5 fees / 19 live and 3 voided receipts; ₹4,300 billed / ₹1,900 collected |
| `pnpm exec node tests/dashboard-connected/start-local.mjs build` | **Passed**, exit 0 after final runtime changes; exact local database identity and transaction read-only mode proved; development auth retained, business providers held; 74 static pages and both import workflow manifests verified |
| `pnpm exec node tests/dashboard-connected/start-local.mjs start` | **Passed**; completed build started on localhost:3117, using the same guarded local target |
| `STUDENTS_REVIEW_OUTPUT=docs/redesign/student-card-evidence/connected` (process-only), then `pnpm exec node tests/dashboard-connected/start-local.mjs students-test` | **3 passed**, 54.5s; real Next route/API, existing development auth, persisted edit and restoration, allocation context, unchanged financial aggregate, six language/width views, nested focus, attendance, CSV, readonly/staff/foreign scope and public/account regression smoke |
| `git diff --check` and `git diff --cached --check` | **Passed** before local commits |

Exact scoped lint command:

```text
pnpm exec node node_modules/eslint/bin/eslint.js "app/branch/[branchId]/students/StudentRecordCard.tsx" "app/branch/[branchId]/students/EditStudentDialog.tsx" "app/branch/[branchId]/students/page.tsx" components/ui/Avatar.tsx components/ui/Dialog.tsx lib/i18n/management.ts tests/application-design-pilot/ComponentGallery.tsx tests/application-design-pilot/student-card.spec.ts tests/application-design-pilot/student-card-capture.mjs tests/application-design-pilot/student-card-compare.mjs tests/dashboard-connected/students-pattern.spec.ts tests/shared-system/playwright.config.ts tests/unit/components/record-pattern.test.tsx
```

Initial focused browser run: 8 passed / 2 failed, because the existing menu trigger
was 32px. The scoped card presentation now makes it 44px; all ten checks pass.
The capture script's duplicate language parameter was corrected before the final
Hindi/Hinglish packet. Capture animations are settled, avoiding transitional
modal translucency. The final implementation was rebuilt after the tap-target
change. These earlier failures are retained here rather than hidden.

## Data, deployment and remaining boundaries

Connected verification uses the existing runner's independently identified
`postgres:16-alpine` container and loopback fixture database. It does not use
`.env.test`, truncate, reset, seed or migrate. External billing, messaging, AI and
import providers are held; normal Clerk development authentication and tenant /
permission checks remain active. The connected test restores only its synthetic
student's name/phone and interface preference. Its financial aggregate remains
unchanged; see [the connected assertions](student-card-evidence/connected/verification.json).

No backend/service/API, schema/migration, package/dependency, provider integration,
saved environment, public-site copy/layout, navigation or other-family changes
are included. Home, Features, Pricing and FAQ need no copy change because this is
authenticated presentation only; their route smoke checks passed. No push, PR,
merge, deployment or shared/production database operation occurred.

Rollback is the local presentation commit revert; no data rollback is needed.
The review requires the owner's visual decision. Translated/long records can be
taller than 210px by design. The existing form still requires a phone to save a
previously phone-less student; that validation rule is intentionally unchanged.
The isolated fixture validates presentation but cannot prove authorization; the
separate connected checks provide that evidence for the existing tested scopes.

Task servers are stopped at handoff. The local fixture can be reopened using the
existing guarded runner; do not fall back to another database. The
[remaining family plan](page-family-migration.md) keeps Staff and Tasks planned
until the refined Students pattern receives explicit owner approval.
