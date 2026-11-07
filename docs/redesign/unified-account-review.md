# Unified Account review - 6 November 2026

Implemented on isolated branch `codex/unified-account`. On 7 November the branch was fast-forwarded to current `main` (`6b78190`) with the Account changes preserved; the documentation conflict retained both the upstream import notes and Account notes. The original checkout's uncommitted work was not copied or edited. The user subsequently authorized full tests, focused commits, pushes and pull requests. No merge or deployment was performed.

## Behavior and owners

- `components/layout/SidebarFrame.tsx`, `SidebarContext.tsx`, `SidebarItem.tsx` and `styles/account-navigation.css` own the same fixed bottom Account action and collapsible navigation across Basic, organization and branch workspaces. Account has a separate collapse preference, scoped to the signed-in identity. Shared Drawer handles mobile navigation/focus. Workspace entry and signed-in setup use the same frame.
- `app/account/*` and `components/account/*` group Profile & security, Preferences and owner-only Billing. Provider controls are embedded under familiar Profile / Sign-in & security labels; their internal sidebar is hidden. Scoped token overrides cover embedded controls and provider portals. Personal forms preserve existing profile, density, locale, timezone, date, message language and landing defaults; screen and document language retain their existing separate save paths. Existing theme values are not rewritten.
- `AccountBilling` selects an owned organization and optional branch context. The subscription owner remains the organization; existing plans, history, invoices and branch subscription controls use the same service/API paths. Server pages independently authorize owner scope and reject foreign/mismatched branches with the same generic not-found outcome. Navigation hints grant no authority.
- Main headers and shared dialog headers no longer duplicate account/profile/personal-language controls. Receipt/report document-language controls remain contextual. Organization/branch business settings retain their scope. Public signed-in marketing navigation remains outside the application workspace shell.
- Billing banners, branch capability recovery, activation, setup and organization settings use the canonical Account destination. Old billing and processing URLs redirect with plan queries, invoice anchors and operation IDs preserved. Legacy billing URLs normalize to the organization for workspace returns, preventing a return loop.

Affected source families include `AppShell`, `BasicWorkspace`, organization/branch/entry sidebars, `SettingsWorkspace`, `ProfileSecurity`, `PersonalSettings`, billing content/processing and navigation helpers. The full Git diff is the file inventory. Architecture, design ownership, public claims, migration ledger and compatibility/rollback guidance are updated in their canonical documents.

## Browser evidence

Used the actual authenticated Next application and existing Clerk development identity against a separate synthetic PostgreSQL database in the verified loopback Docker container. No Production or shared database was accessed. Business provider writes were disabled.

Observed and exercised during implementation:

| Journey | Evidence |
| --- | --- |
| Basic, Standard, Pro | Organization and branch routes; shared Account destination; correct Basic/Standard/Pro billed and effective plan displays |
| Desktop navigation | Expanded and collapsed workspace and Account sidebars; bottom action, accessible icon labels, keyboard activation, independent persisted collapse |
| Mobile, 390 x 844 | Shared navigation drawers, Account sections, profile/security layout, billing selectors and preference save bar |
| Preferences | Changed density to Compact, saved, reloaded and observed persisted value; restored Comfortable through mobile save |
| Profile/security | Embedded profile and security sections loaded actual Clerk controls; opened the profile editor; no credential, provider identity or destructive account changes submitted |
| Context and return | Branch -> Account -> Billing carries branch/organization; selecting another organization clears foreign branch context; Back returns to the previous workspace |
| Existing entry points | Organization settings branch-billing link reached Account with the correct branch; legacy organization Billing URL preserved the invoice anchor |
| Setup | Signed-in setup displays the same Account footer; a dirty-navigation guard was added |

Browser iterations fixed an organization-settings icon import, provider dark-style leakage, an organization-selection precedence edge case and a legacy-billing workspace-return loop. These observations are local implementation evidence, not owner visual acceptance or production release.

## Validation

Commands were run from the isolated worktree using pnpm (the Windows pnpm.cmd shim where needed). Logs are in ignored `test-results/account-navigation/`.

| Command | Result |
| --- | --- |
| `pnpm prisma generate` | Passed; generated client only, no schema/database migration |
| `pnpm exec vitest run --config tests/account-navigation/vitest.config.ts` | 69 files / 743 tests passed before the final return-loop regression addition |
| `pnpm exec vitest run --config tests/account-navigation/vitest.config.ts tests/unit/lib/accountNavigation.test.ts tests/unit/lib/contextual-navigation.test.ts tests/unit/lib/basicNavigation.test.ts tests/unit/lib/billingFlow.test.ts tests/unit/components/AccountSidebar.test.tsx tests/unit/components/WorkspaceClerkAppearance.test.ts` | Final 6 files / 35 tests passed; superseded legacy return expectation updated |
| `pnpm exec vitest run --config tests/account-navigation/vitest.config.ts tests/unit/api/imports-daily-cron.route.test.ts` | 4 tests passed |
| `pnpm exec tsc --noEmit` | Passed, including generated production route types |
| `pnpm lint` | Passed, zero errors; one generated workflow warning and one unused import warning; the unused import was removed |
| `pnpm exec eslint components/basic/BasicWorkspace.tsx lib/contextualNavigation.ts tests/account-navigation tests/dashboard-connected/build.mjs app/account tests/unit/components/AccountSidebar.test.tsx` | Passed with no warnings |
| Guarded `pnpm build` | Turbopack rejected the worktree's external node_modules junction |
| Guarded `pnpm exec next build --webpack` | Initial compilation passed; Next route validation found two pre-existing exported cron constants. Both are now private with values, authentication and batching unchanged |

Final `pnpm exec node tests/account-navigation/local.mjs build` passed using `pnpm exec next build --webpack`, including production TypeScript and static page generation. `pnpm exec node scripts/verify-import-workflow-manifest.mjs` passed (2 import workflows). `pnpm exec node tests/shared-system/check-presentation.mjs HEAD`, changed Markdown path/UTF-8 checks, and `git diff --check` passed. Final lint of the cron correction and local harness passed.

The built application was reopened successfully. Account profile/preferences and the normalized workspace-return target were rechecked. Interface language was changed to Hindi, the translated Account navigation and independent English document language were observed, then interface language was restored to English. The browser connection was recovered on 7 November. In the built application, changing density to Compact and following Billing produced the unsaved-change confirmation. Cancel retained the Compact draft on Preferences; the form discard dialog then restored the saved Comfortable value. Billing retained Standard Learning Spaces / Central Reading Room, and Back to workspace returned to that branch dashboard. The 390 x 844 mobile workspace drawer, fixed Account footer, separate Account drawer and Billing layout were rechecked. The viewport override was reset and Account Billing was left open for review. The earlier browser-reconnection limitation is resolved.

Added tests cover canonical destinations, unsafe return hints, compatibility URLs, owner/staff/foreign/mismatched scope, processing authorization and Account sidebar organization precedence. Existing billing flow, processing, sidebar, appearance and capability expectations were updated. The initial implementation phase used the explicit no-I/O suite and separately verified browser database. Full integration validation was subsequently requested and uses a new, separately verified disposable database; it never truncates the retained browser fixture.

### Reconnection follow-up - 7 November

The same disposable Docker container had stopped; its dynamic loopback port changed on restart. `tests/account-navigation/local.mjs` now permits a changed port only when the exact recorded container ID and PostgreSQL image match, Docker confirms its original dynamic loopback-only binding, exactly one current loopback port exists, and the named database and fixture proofs still match. No fixture reset or application environment-file change was performed. The guarded `start` command successfully connected and served the existing production build.

`pnpm exec eslint tests/account-navigation/local.mjs`, `node --check tests/account-navigation/local.mjs` and `git diff --check` passed after this harness-only change. An initial Windows `cmd /c` lint invocation failed due to the spaced user path; rerunning through the correctly quoted PowerShell pnpm shim passed. Application source and the previously validated production build were unchanged during this retry.

Review screenshots were saved in the task visualization directory: `account-billing-desktop.jpg`, `account-mobile-workspace.jpg`, `account-mobile-sidebar.jpg` and `account-billing-mobile.jpg`.

## Full-suite and PR follow-up - 7 November

The branch now includes current main (`6b78190`). A separate, exact-ID-checked `postgres:16-alpine` container with a single loopback-only port and memory-backed storage hosts `lab_lords_account_20261107_full_test`. All 58 existing migrations, billing identity and constraints were verified before test execution. The earlier disk-backed attempt was interrupted because table resets were waiting on disk sync; it is not recorded as a pass. No shared, Preview or Production database is used, and the browser fixture is separate.

The complete `pnpm test` run finished with 3,210 tests passed and 379/380 files passed in 1,146.31 seconds. The only failure was collection of the onboarding recovery harness after the route gained its shared presentation shell. The harness now exercises the actual wizard. Additional assertions exposed and fixed a dirty-navigation warning after durable setup; in-flight requests remain blocked. `pnpm test tests/unit/pages/onboarding-recovery.test.tsx tests/unit/lib/basicNavigation.test.ts tests/unit/lib/workspace-navigation-guard.test.ts` passed all 24 tests in 3 files. Focused lint passed.

The subsequent full coverage run is in progress using `pnpm test:coverage --testTimeout 30000 --hookTimeout 30000 --reporter=verbose`. The 30-second local test/hook budget matches the prior full-suite verification record; assertions and concurrency checks remain enabled. This draft record will be updated with the final result before review readiness.

On the updated base, `pnpm test:workflow` passed (1 test), `pnpm lint` passed (0 errors, 1 existing generated-workflow warning), and `pnpm exec tsc --noEmit` passed. The guarded Webpack production build and `pnpm exec node scripts/verify-import-workflow-manifest.mjs` passed; the browser recheck followed Account -> Billing -> branch -> Account -> Billing successfully with organization/branch context intact. A final rebuild follows the saved-setup guard correction.

The independent two-line cron export fix is [PR #292](https://github.com/itssunnyfunny/lab_lords/pull/292). Account work is divided into focused navigation, profile/preferences, billing, workspace integration, test-fixture and recovery-fix commits. The Account PR depends on the cron build fix; matching Account routes, navigation and redirects still ship together.

## Release and limits

No schema, migration, dependency version or application environment changes are required. Ship the Account routes, shared navigation and compatibility redirects together. Roll back the matching application revision without rewriting preferences, subscriptions or operation history.

Billing commands, entitlement decisions, provider verification/idempotency, TEST/LIVE separation and server authorization remain unchanged. The only ancillary build fix removes exports from the two existing import-retention cron constants; the cron runtime values and behavior are unchanged. Local fixture subscriptions have synthetic invoices and no real provider history. No payment authorization, cancellation, branch-removal dispatch, password change, account deletion or live provider transaction was executed. Existing billing service regression coverage was run.

Clerk delivers its UI remotely; its own warning recommends a pinned UI package for future protection against provider DOM changes. This task does not change dependencies. The embedded controls were checked with the currently loaded provider UI. Owner visual review and deployment remain outstanding, separately from implementation verification.
