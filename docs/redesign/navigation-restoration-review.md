# Feature restoration and navigation review

The 22 October 2026 restoration addresses the 20 findings in the
[feature discoverability audit](../audits/ui-feature-discoverability-2026-10-22.md).
It keeps the selected UI, shared controls and original workflow authorization.
The map below includes the owner's 23 and 24 October corrections. Final evidence
uses the corrected Lab Lords name and excludes superseded UI captures.

## Owner UI correction — 23 October 2026

The owner confirmed that AI Messages had been retired, and that the current UI
supports one organization per account. The earlier restoration of that page and
additional-organization navigation was incorrect. Current UI entry points and
the unused UI upgrade policy are removed; old page bookmarks redirect to the
same branch's Follow-ups. Stored drafts, AI APIs and service authorization are
not changed by this UI-only correction.

Organization/branch headers display the current organization once and offer
branch switching. Personal Account settings omits workspace controls entirely.
Account settings is accessed from the header. The branch menu's final Workspace
section contains the owner-only Back to organization link. The leaves are the
last sidebar element on desktop and mobile. Organization/account navigation and
completed onboarding omit additional-organization and duplicate account links.
Account settings retains Profile, Preferences, Workspace defaults and read-only
System Info. Its redundant outer sidebar and old access-link cards are removed.
A visible return link on desktop and mobile opens the originating branch or
organization page directly. A strict internal-path hint and account-scoped session
hint retain that origin; direct visits fall back to the authorized directory,
without using the legacy organization chooser. Mobile navigation carries the
same selected styling, Lab Lords wordmark and menu as desktop, with 44px links;
the generic dialog title and duplicate language row are visually omitted while
the shared dialog keeps focus, Escape, inert background and scroll ownership.
Organization System Settings keeps its original position. Initial workspace
readiness and cold loading use the selected light canvas; cookie preferences
reuse AppPanel, shared action styles and the explicit overlay theme, retaining
the original consent choices and tracking restrictions.

This pass changes no schema, migration, package version or saved environment.
Additional-organization creation remains possible through the older service
contract: enforcing the clarified one-organization policy at that boundary is
separate domain work, not silently introduced by this presentation cleanup.
The owner subsequently authorized small UI-only commits and a pull request after
a final full-suite pass. Verification is recorded below; release is separate.

## Restored features and corrected destinations

| Audit finding | Implemented behavior |
| --- | --- |
| N01 | Account settings stays in the application header; duplicate sidebar and switcher entries are removed. |
| N02 | Superseded by owner correction: AI Messages is retired; no navigation/search/dashboard entry remains. Old page bookmarks redirect to Follow-ups. |
| N03 | Setup and access → Dashboard setup exposes expectations, membership terms and utilization settings to permitted viewers. Branch Settings also links there. |
| N04 | Owners have Back to organization in the menu's final Workspace section. The header shows one organization name and a branch-only selector. |
| N05 | Bell restores unassigned active students, full shifts, near-full shifts and active invitation alerts with independent permissions. |
| N06 | Dashboard retains recent enrollments, recorded-overdue fee review/selection and Import records. The retired Draft follow-ups shortcut is removed. |
| N07 | Search → Add Student opens the existing admission dialog. |
| N08 | Search includes Attendance, Renewals, Overdue, Import, Shifts and Dashboard setup; Tasks and Exports discovery match the destination's view permissions. |
| N09 | Organization attention → Review overdue payments opens the actual overdue queue. |
| N10 | Billing processing → Back to billing settings uses the supported `#billing` anchor. |
| N11 | Activity opens the exact receipt, student, attendance history, allocation, task, follow-up or scoped setup record. |
| N12 | Attendance gaps has full-count pagination, with the same agreed-expectation predicate; bell and dashboard open it. |
| N13 | Authorized WhatsApp initial failures show an error and Retry. Explicit rollout-disabled responses remain disabled. |
| N14 | Follow-ups searches student names and phone numbers. |
| N15 | Follow-ups and Renewals apply query changes while mounted; open edits and financial command identity survive. |
| N16 | Payments exposes a capability-aware Record payment button using the existing student chooser and collection dialog. |
| N17 | Seats recovery opens the permission-aware `/app` workspace entry. |
| N18 | Superseded by owner correction: additional-organization shortcuts are removed. Initial onboarding and safe continuation of a saved setup remain available. |
| G01 | Organization Settings → Branches exposes reviewed schedule/undo billing removal, final-branch explanation, stable retry identity and existing-operation recovery. |
| G02 | Import Assistant → Saved import recipes exposes explicit confirmed deletion; historical import sessions remain intact. |

Restoration does not invent membership-term edit/delete. Existing term creation
and renewal remain in Dashboard setup. Payment collection, corrections, attendance,
onboarding, exports and provider actions retain their existing service contracts.

## Implementation boundaries

Navigation owners are `components/layout`, `lib/topSearch.ts` and
`lib/contextualNavigation.ts`. Dashboard service/contract changes supply restored
alerts, bounded enrollments, exact activity targets, phone search and the read-only
attendance-gap route. Feature components own their dialogs, paging, recovery and
confirmation. `BranchBillingControls` persists a scoped removal key in session
storage before POST, retains it through uncertain outcomes/reload, and routes
provider work through the existing processing page. Opening review does not write.
`ImportRecipeManager` uses the existing scoped recipe list/delete API.

No schema, migration, dependency, seed, saved environment, cron, auth bypass,
provider activation or production-data change is required. Domain invariants and
security policy are unchanged. Rollback can revert this application change without
discarding existing receipts, import runs or billing-operation history. Existing
server endpoint protection and provider-authoritative replay/undo checks remain
the enforcement boundary.

## Changed files and regression coverage

Application changes are limited to the existing navigation/layout owners, dashboard
and search contracts/services, and the affected feature controls. Additions are
AttendanceGaps, DashboardOperationalPreviews, BranchBillingControls,
ImportRecipeManager, useWorkspaceReturnHref, the navigation translation catalogue,
the read-only attendance-gaps route and the branch loading boundary. The only
organization-service projection addition is the existing branch billingStatus,
needed by the restored billing controls. No billing or import service mutation
contract changes.

Existing unit, API and integration tests cover scoped gap paging, independent
alerts, exact activity targets, phone lookup, retired-page redirects, account
returns, workspace navigation, theme and consent. The restoration browser matrix
covers the existing actions, retries, confirmations and navigation in three
languages at widths 1440, 834, 390 and 320. The main browser suite separately runs
authenticated desktop and mobile flows with normal development Clerk sessions.
Tests retain their existing assertions, timeouts and conditional role/gate skips.

## Final verification — 24 October 2026

The final candidate is copied from the tracked base plus the explicit UI-only
file list. Three unrelated import-test timing edits are restored to their base
versions in that candidate. The untracked migration, September audit, superseded
UI screenshots and local runtime/authentication files are excluded from the PR.
They remain intact in the working directory. Full main and Workflow results
therefore apply to the selected PR content, rather than depending on those edits.

The following commands run in the isolated UI-only candidate where noted. The
local wrappers verify the exact disposable target and hold business providers;
their generated logs and authentication/runtime metadata are not PR files.

| Command | Result |
| --- | --- |
| `pnpm exec node test-results/restoration-full-review/run-full-tests.mjs test` in the candidate, label `ui-pr-r11-main-ram-final` | 346 files, 2,672 tests passed; no failed or skipped main tests |
| `pnpm exec node test-results/restoration-full-review/run-full-tests.mjs test:workflow` in the candidate, label `ui-pr-r11-workflow` | 1 file, 1 test passed |
| `pnpm exec node tests/navigation-restoration/run-browser.mjs --retries=0` | All 44 restoration cases passed at four widths, with all three navigation languages checked; no retries or skips |
| `pnpm exec node test-results/restoration-full-review/run-browser-suite.mjs focused tests/browser/public-site.spec.ts --project=chromium --grep "desktop Resources works" --retries=0` | The earlier public navigation timeout passed unchanged in isolation: 1/1 |
| `pnpm exec node test-results/restoration-full-review/run-browser-suite.mjs test --retries=0`, label `ui-pr-r11-browser-final` | All 294 collected: 255 passed, 39 existing conditional skips, zero failures, retries or flaky cases; desktop 125 passed / 22 skipped, mobile 130 passed / 17 skipped |
| `pnpm lint . --ignore-pattern "test-results/**"` in the candidate | Passed with zero errors or warnings |
| `pnpm lint tests/browser/public-billing.spec.ts tests/browser/public-site.spec.ts` and `pnpm exec tsc --noEmit --incremental` in the updated candidate | Both passed after the two public UI-readiness changes |
| `pnpm exec node test-results/restoration-full-review/run-pr-build.mjs` | Guarded candidate production build passed compilation, TypeScript, all 74 static pages and both import workflow manifests |
| `pnpm exec node test-results/restoration-full-review/check-brand-source.mjs` | 727 runtime files match R11, zero mismatches |
| `pnpm exec node tests/shared-system/check-presentation.mjs --self-test` | All 10 presentation-guard regression cases passed |
| `pnpm exec node docs/audits/evidence-ui-features-2026-10-22/validate-evidence.mjs` | 51 local links, 29 routes, 20 findings and both original audit widths validated |
| `pnpm exec node tests/navigation-restoration/validate-review.mjs` and `git diff --check` | Passed; no whitespace errors |

The serial browser attempt exposed another public Terms-page timeout waiting for
the full browser load event, while its snapshot already contained the rendered
page. Only the public-brand loop and Resources keyboard test now wait for
DOMContentLoaded at navigation. Their existing visible-content, font readiness,
loaded-logo, layout/zoom, keyboard and accessibility assertions remain intact;
no timeout, retry count or skip was changed. These two test-only readiness fixes
passed all four desktop/mobile focused cases, lint and a fresh complete candidate
TypeScript check. They do not
affect application source or the already-passing main/Workflow suite inputs.

The [final verification summary](navigation-restoration-evidence/2026-10-24-final-pr/verification-summary.json)
records actual report counts, per-project results, exact conditional skip reasons,
runtime matching and earlier incomplete attempts. No skip condition was added to
hide a failure. The final main and Workflow runs and the 20.8-minute full browser
run completed successfully; the browser run used zero retries. The owner-authorized
commit sequence separates dashboard wiring, existing feature entry points,
workspace/mobile navigation, loading/consent presentation, UI tests and evidence.

Docker stopped during the first browser attempt, before it produced a completed
report. After restart Windows reserved the previous integration port. A fresh
loopback-only disposable container on port 35432 was independently verified by
container ID, image, purpose label, binding, connected database name and zero
application tables. Only the 54 tracked migrations were applied; no seed or
customer/provider records were loaded. A concurrent attempt hit five attendance
transaction timeouts and one initial public About-page navigation timeout. The
attendance file then passed all 13 tests unchanged on its own. A subsequent
serial disk-backed run stalled on PostgreSQL DataFileImmediateSync, with cases
taking minutes beyond normal duration. Those attempts were stopped and are not
final evidence.

The final main/Workflow fixture is a new independently verified disposable
PostgreSQL container on loopback port 35433 with a memory-backed data directory.
The same 54 tracked migrations and SQL constraints apply; PostgreSQL fsync and
synchronous_commit remain on. Application code, assertions, test timeouts and
transaction settings are unchanged. The review and automated-browser databases
remain separate from this fixture.

The review app runs on port 3117 from the R11 production build. Its 727 runtime
source files match the selected application tree. Browser automation uses port
3118 and a separate disposable database so test writes do not disturb review.
External payment, messaging, AI and import provider writes remain held. These
checks do not claim live-provider delivery or production deployment.

## Desktop and mobile review

The landing-page PublicBrandLockup and organization AppLogo use Lab Lords. The
branch sidebar now uses the same name without the obsolete .in suffix on desktop
and mobile, preserving the symbol, colors, typography, menu and bottom artwork.
The existing signed-in Chrome session confirms the corrected wordmark and working
mobile drawer close control; its temporary viewport was reset afterward.

Final presentation evidence:
[desktop dashboard](navigation-restoration-evidence/2026-10-24-brand-correction/chrome-dashboard-desktop.png),
[mobile navigation](navigation-restoration-evidence/2026-10-24-brand-correction/chrome-mobile-navigation.png),
[Account at 390px](navigation-restoration-evidence/2026-10-24-brand-correction/account-cleanup-mobile-390.png),
[cookie preferences at 390px](navigation-restoration-evidence/2026-10-24-brand-correction/consent-cleanup-mobile-390.png),
[landing-page reference](navigation-restoration-evidence/2026-10-24-brand-correction/landing-brand.png),
[runtime source check](navigation-restoration-evidence/2026-10-24-brand-correction/runtime-source-check.json).
Owner presentation acceptance and production release remain separate from tests.

## Public wording

Home, Features, Pricing and FAQ already use the approved Lab Lords branding.
Their feature claims need no change: the UI exposes existing supported workflows
and removes retired entry points without changing plans, rollout gates, reminder
consent, provider confirmation or trial eligibility. The public design is unchanged.
