# Batch 2 local review

The owner approved the refined Students comparison on 2026-09-27 as the reusable
hierarchy. That presentation approval, local verification and production release
are separate in the [migration ledger](page-family-migration.md). Staff is migrated
and verified before Tasks. No subsequent batch or release is authorized.

Staff uses the existing RecordList, compact table, panels and overlays. Its card
hierarchy is member/email → role → access summary → added date. Its role,
invitation, permission override and removal workflows retain their existing
authorized data, validators and request bodies/paths. The existing theme route
allowlist now includes Staff. No shared primitive default changes.

## Focused Staff views

- [Actual desktop route](batch-two-evidence/connected/staff-en-1491.png) and
  [actual Hindi mobile records](batch-two-evidence/connected/staff-hi-390.png).
- [Populated desktop fixture](batch-two-evidence/staff/en-desktop-1440.png),
  [390px cards](batch-two-evidence/staff/en-records-mobile-390.png),
  [320px Hindi cards](batch-two-evidence/staff/hi-records-mobile-320.png) and
  [Hindi access overlay](batch-two-evidence/staff/access-hi-mobile-390.png).
- [Connected Staff assertions](batch-two-evidence/connected/staff-verification.json).

Fixtures import the actual feature components and stay isolated from databases
and providers. Connected views use the actual production build and existing
development authentication against the independently verified disposable fixture.
No captured invitation credential is present in this review packet.

## Staff validation

Commands use pnpm and existing scoped configurations, not the repository's
truncating integration setup. PowerShell invokes the existing pnpm.cmd shim.

| Exact command | Final result |
| --- | --- |
| `pnpm exec node node_modules/vitest/vitest.mjs run --config tests/shared-system/vitest.config.ts tests/unit/services/staff.test.ts tests/unit/api/branch-staff-member.route.test.ts tests/unit/api/branch-staff-invites.route.test.ts` | 3 files, 31 passed |
| `pnpm exec node node_modules/vitest/vitest.mjs run --config tests/shared-system/vitest.config.ts tests/unit/api/staff-overdue-pagination.route.test.ts -t "uses the default staff\|decodes a stable staff"` | 2 Staff cases passed; 3 unrelated overdue cases skipped |
| `pnpm exec node node_modules/vitest/vitest.mjs run --config tests/shared-system/vitest.config.ts tests/unit/lib/localization.test.ts tests/unit/lib/public-localization.test.ts` | 2 files, 12 passed |
| `pnpm exec node node_modules/vitest/vitest.mjs run --config tests/shared-system/vitest.config.ts tests/unit/application-pilot-theme.test.ts tests/unit/components/BranchWorkspaceShell.test.tsx tests/unit/components/BranchSidebar.test.tsx tests/unit/components/WorkspaceSwitcher.test.tsx tests/unit/components/record-pattern.test.tsx` | 5 files, 28 passed |
| `pnpm exec node node_modules/@playwright/test/cli.js test --config tests/shared-system/playwright.config.ts staff-family.spec.ts --project=desktop-1440 --project=mobile-390 --project=mobile-320 --output=test-results/staff-family` | 15 passed; three languages, narrow wrapping, menus/focus, failed access drafts, invitation/add/delete commands, readonly/view-only/denied, pagination/retry; no serious/critical axe violations or page errors |
| `pnpm exec node node_modules/@playwright/test/cli.js test --config tests/shared-system/playwright.config.ts student-card.spec.ts --grep "short cards keep" --project=mobile-390 --project=mobile-320 --output=test-results/batch-two-students-consumer` | 2 passed; no historical screenshots regenerated |
| `pnpm exec node tests/dashboard-connected/start-local.mjs build` | Production build/typecheck and two-workflow manifest passed, exact loopback DB proven read-only |
| `pnpm exec node tests/dashboard-connected/start-local.mjs batch-two-test Staff` | 2 connected checks passed; role/override persistence, fixture restoration, all three languages at 1491/390px, readonly/restricted/foreign scope; financial aggregates unchanged |
| `pnpm exec node tests/shared-system/check-presentation.mjs b102af3` | Passed |

Scoped ESLint passed with zero findings for Staff, its dictionary, harness, new
tests/configs/runner, route gate and route-gate unit. `git diff --check` passed.

Initial checks exposed test-selector errors after changing language, missing
typed access-menu translations and Staff's legacy-theme route exclusion; these
were fixed and the affected checks rerun. The initial mixed Staff/overdue unit
file timed out importing the unrelated overdue route (35/36 passed); final
Staff-only cases pass without rerunning overdue scope. A runner syntax typo and
anchored family-filter mismatch failed before connected tests started; corrected.
The first connected run assumed "Set Access" despite an existing override, and
assumed a 403/404 from the legacy denial handler; corrected to verify actual
access and indistinguishable scope denial.

## Existing limitation and scope

Staff GET currently returns generic `500` / `Branch not found` for both foreign
and missing branches. Both deny roster data and match; the desired tenant-safe
not-found status remains a separate backend correction. This is recorded as
existing behavior, not declared a desired contract. No backend change is included.

No schema, migration, seed, dependency, environment or provider changes. No
production/shared database operation, push, PR, merge, deployment or live external
communication. Public claims need no changes: this is authenticated presentation.
Students cards/table, selected dashboard and public code stay unchanged; reuse
their existing accepted comparison evidence and verification.
