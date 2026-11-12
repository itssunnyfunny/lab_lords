# Application refinement — 10 November 2026

## Authorization and scope

The owner's attached 10 November brief authorizes a comprehensive presentation refinement across existing application families. It supersedes the previous frozen dashboard composition and serif control styling. The original Standard/Pro sidebar palette, wordmark and filled active treatment remain the visual reference. Implementation evidence, owner acceptance and release remain separate; this record does not claim owner acceptance or deployment.

## Starting behavior and preserved boundaries

Shared compact actions use serif text, operational headers and filters push mobile records down, the full workspace lacks daily bottom navigation, and the dashboard gives decorative art and equal-weight colored summaries substantial space. Existing shared components own presentation; feature components and server services own data, permissions and mutations.

Preserve tenant-safe authorization, role and effective-plan gates, read-only access, request cancellation, account ownership, provider-authoritative billing, financial units/date meanings, allocation conflicts, import validation/recovery and dirty-form navigation. No schema, migrations, saved environment, dependencies, routes or service contracts are required to change. Tests use synthetic local fixtures and the guarded disposable build database only.

## Work and evidence

Before sources and the requested brief are preserved in `test-results/ui-refinement-2026-11-10/`. The initial screenshot sweep was captured before application edits. Final evidence must identify exact commands and observed results; historical evidence is not a fresh pass.

| Order | Family | Planned refinement | Status |
| --- | --- | --- | --- |
| 1 | Foundation | Sans controls/numbers; readable density; restrained surfaces; consistent states | Implemented; locally verified |
| 2 | Shell | Compact active groups; branch context; full-plan daily mobile navigation; contextual back links | Implemented; locally verified |
| 3 | Students | Search/records first; Add/Import; secondary tools; readable identities and balances | Implemented; locally verified |
| 3 | Fees | Compact period/status filters; clear balance/date semantics; primary row action | Implemented; locally verified |
| 3 | Seats/shifts/allocations | Shift-first dense map; compact summaries and adjacent details | Implemented; locally verified |
| 4 | Dashboard | Four quiet metrics; prioritized attention list; useful charts; secondary queues | Implemented; locally verified |
| 5 | Billing | Subscription first; compact context and navigation; ownership and scheduled changes clear | Implemented; locally verified |
| 5 | Onboarding/import | Fields and upload first; compact progress; contextual guidance and retained recovery | Implemented; locally verified |
| 6 | Attendance/follow-ups/tasks/staff/org | Work and branch selection ahead of summaries | Implemented; locally verified |
| 6 | Analytics/AI/exports | Scope and finding first; supporting explanations progressively disclosed | Implemented; locally verified |
| 6 | Account/settings | Focused compact sections and consistent dialogs/states | Implemented; locally verified |
| 7 | Verification | English/Hindi/Hinglish, plans, widths, meaningful interactions, lint and build | Complete locally |

## Validation plan

Use the existing isolated browser harness for real components with synthetic API fixtures. Capture desktop and mobile before/after evidence, then check 320/390/834/1440px and supported languages. Add navigation and record-density regressions where they protect new behavior. Run the safe explicit unit allowlist, existing affected browser flows, presentation guard, lint, guarded production build and `git diff --check`. Old dashboard composition assertions must be updated to the newly authorized design, preserving business and accessibility assertions.

Marketing capabilities and commercial promises are unchanged; review Home, Features, Pricing and FAQ for any wording impacted by navigation naming. Rollback consists of reverting this presentation patch, preserving pre-existing changes; no data rollback is needed.

## Initial checks

- Baseline: 66 captures / 33 routes, desktop 1440px and mobile 390px. No capture/runtime/API/overflow/contrast failures.
- First visual review: 42 captures / 14 changed families / 1440, 390 and 320px. No capture/runtime/API/overflow/contrast failures. Manual review still identified excessive mobile seat and attendance setup height; those were refined further.
- First TypeScript checks: passed (`pnpm exec tsc --noEmit --incremental false`).
- First lint: no errors; five new unused-import warnings identified and removed; two pre-existing generated-file warnings remain.
- First safe unit run: 784 passed / 7 failed. Failures concerned old navigation grouping, compact billing context selectors, date formatting and confirmation wording. These were corrected; the final safe unit run passed all 791 tests.
- Added browser regressions cover active navigation groups, direct routes, permission-filtered mobile navigation, translated roster density, and desktop/mobile seat inspection.

## Final local verification

- Safe unit allowlist: 72 files / 791 passed.
- Browser coverage after corrections: 102 focused + 97 family + 36 setup = 235 passing executed cases; 29 deliberate project skips. Original results and reruns are retained.
- Final sweep: 132 views / 33 routes / 1440, 834, 390 and 320px; zero capture, runtime, failed API, document-overflow or detected contrast failures. Contrast was checked across all 33 routes at 390px.
- Dashboard intermediate-width matrix: 15 English/Hindi/Hinglish combinations passed.
- Final TypeScript, presentation guard and guarded production build passed. Lint passed with zero errors and two existing generated-file warnings. `git diff --check` passed.
- Review package includes 66 matching before/after pairs, 66 additional responsive views, focused interaction captures, source diff and verification evidence. The gallery and ZIP have separate integrity/browser checks.

Exact commands, changed owners, findings, evidence limitations and release boundaries are in the [full report](../audits/ui-refinement-2026-11-10.md). The artifact root is `test-results/ui-refinement-2026-11-10/`; the gallery is `review/index.html`. Final owner acceptance and deployment remain separate.
