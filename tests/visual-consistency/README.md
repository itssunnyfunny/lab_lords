# Local visual consistency verification

This harness renders the real application components with synthetic identity and
in-memory API fixtures. It uses Chrome on loopback port 4193, the Preferences language
controls and real workspace switcher, and the existing self-hosted build fonts. It excludes
the obsolete organization prototype CSS, history guard and transport.

Run from the repository root using pnpm. The browser tests start/reuse the local
server automatically. The standalone sweep/comparison need that server running.
The default repository Vitest setup must not be used here: it can truncate a DB.

```powershell
$env:VISUAL_AUDIT_RUN_ROOT = Join-Path $PWD 'test-results/visual-remote-sync-2026-11-07'
pnpm exec node tests/visual-consistency/server.mjs
pnpm exec node node_modules/@playwright/test/cli.js test --config tests/visual-consistency/playwright.config.ts
$env:PLAYWRIGHT_REVIEW_EVIDENCE_DIR = Join-Path $env:VISUAL_AUDIT_RUN_ROOT 'shared-evidence'
pnpm exec node node_modules/@playwright/test/cli.js test --config tests/visual-consistency/shared-regression.config.ts
pnpm exec node tests/visual-consistency/sweep.mjs
pnpm exec node tests/visual-consistency/desktop-comparison.mjs
pnpm exec node node_modules/vitest/vitest.mjs run --config tests/account-navigation/vitest.config.ts --maxWorkers 1 --testTimeout 15000
pnpm lint
pnpm exec node tests/visual-consistency/build-local.mjs
git diff --check
```

Run the browser suites and unit/build checks sequentially on constrained machines.
The safe Vitest config prevents unmocked DB/network operations. Set `VISUAL_AUDIT_RUN_ROOT` to a fresh directory for each complete rerun; focused,
shared, sweep and desktop evidence use separate children. Omit it only to use the
original dated locations. Each browser suite replaces its own report directory; preserve a completed JSON report before doing
filtered reruns. Set the review evidence directory as above so shared tests never
write over historical approval screenshots. The route sweep resumes completed
captures; `AUDIT_ROUTES` (comma-separated route names) explicitly recaptures a
subset and `AUDIT_WIDTHS` selects widths. The sweep writes `summary.json` and fails for capture/runtime errors, failed API responses, horizontal page overflow or detected contrast violations. WhatsApp uses an explicit provider-disabled synthetic state; enabled messaging workflows are outside this presentation sweep.

The guarded build helper requires Docker, an already installed
`postgres:16-alpine` image, and existing development Clerk configuration. It
creates a unique empty, loopback-only disposable DB, verifies its exact identity,
and invokes the existing read-only/provider-disabled `pnpm build` wrapper. Only
that helper's own container is removed afterward. No schema/seed installation or
saved environment change is needed. A successful build supplies the fonts needed
by the browser harness.

The desktop comparison renders the same dashboard at 1440px with and without the
appended mobile and intermediate-width CSS rules. Images are decoded and two
consecutive captures must settle before comparison. Software rendering avoids
decorative-image GPU raster differences; no pixels are masked. The check also
asserts all three responsive rules are inactive at 1440px. It records the git baseline
and exact pixel deltas;
a one-value channel tolerance allows raster rounding. It does not compare against
or replace the historically approved desktop golden image.

See the [dated audit report](../../docs/audits/visual-consistency-2026-11-07.md)
for findings, observed results, evidence paths and verification limits.

The intermediate-width dashboard regression checks five widths in all three
languages, including title/action placement, wrapping and page overflow. The
mobile header cases cover dashboard, Students, import and organization pages in
all three languages at 320px and 390px.

The Account cases cover all three workspace plans, return context, independent
sidebar collapse state, Preferences persistence/language, mobile save-bar clearance,
shared confirmations, Back/Forward cancellation and failed/pending saves. Shared
family tests simulate a preference save/notification from elsewhere to verify
reactive localization without restoring removed dialog language controls; the
Account cases separately operate the actual Preferences controls.

See the [remote-sync rerun](../../docs/audits/visual-consistency-remote-sync-2026-11-07.md)
for fresh results against main 50f2fa9.

## Shared sidebar regression

`sidebar.spec.ts` checks the original Standard/Pro presentation across nine
workspace/Account surfaces at all four viewports. It verifies filled active rows,
plain inactive rows, common branding/width, one menu scroll region, fixed footer
actions, 44px mobile targets, translated labels on short screens and independent
collapse preferences with keyboard navigation. Sidebar accessibility scans cover
all nine surfaces. Geometry checks remove only the harness's 21px synthetic
banner so 100dvh shells have the real application's viewport; application content
and navigation remain untouched. The separate before/after captures retain the
banner. Use a fresh `VISUAL_AUDIT_RUN_ROOT` to preserve older evidence.

## PR verification

The [12 November PR verification record](../../docs/redesign/ui-refinement-pr-readiness-2026-11-12.md)
keeps the full unit/integration and coverage results separate from this synthetic
browser harness. Root Vitest excludes this directory because its specs use
Playwright. Run the visual config, the page-family config and the onboarding
config separately; use fresh evidence directories for retries. The report case
checks full-width date controls at 320px and retained CSV filter values, while
the Account case checks translated header geometry and return targets at all
four viewports.

Database-backed `pnpm test` and `pnpm test:coverage` require an independently
verified disposable local target and the existing `tests/setup/testDatabaseSafety.ts`
guards. A test-like database name alone is not sufficient proof. The safe unit
allowlists above are useful focused checks, not substitutes for the full suite.
