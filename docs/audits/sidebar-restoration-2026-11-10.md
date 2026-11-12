# Sidebar design restoration 10 November 2026

The earlier Standard/Pro sidebar is restored as the shared presentation for
Basic, Standard, Pro, organization, workspace entry and Account. The owner
identified the outlined-row sidebar in the previous audit as the wrong design.
The optional decorative leaf quote is omitted so Account remains easy to reach.
Local verification is complete: **161 unique browser cases, 791 unit tests,
lint and the production build passed**, with the documented test/fixture
corrections below. Final owner visual review and release remain separate.

## Reference and correction

The reference is the saved 6 November dashboard image and the corresponding
sidebar presentation before the remote update (`ca9938b`). The earlier audit
verified consistency against the replacement shared frame and missed its
mismatch with that reference. Its screenshots and results are retained as
historical evidence.

The shared owners now provide the original 230px desktop width, pale sidebar
background, two-tone wordmark and tagline, original Inter/500-weight Latin labels,
plain compact rows, and filled green
active item. Basic, organization and Account inherit the same presentation.
Hindi retains the existing Devanagari shaping font. The branch menu now has one
scroll region. The fixed Account or sign-out action
sits beside the desktop collapse control; mobile rows retain 44px targets.

Current Account destinations, workspace return context, separate identity-scoped
collapse preferences, permission/entitlement filtering, mobile drawer focus and
unsaved-change protection are preserved. No API, service or billing behavior is
changed. Public navigation and marketing previews use their existing separate
presentation; Home, Features, Pricing and FAQ need no wording change.

## Files and validation

Implementation owners:

- [Shared frame](../../components/layout/SidebarFrame.tsx),
  [navigation item](../../components/layout/SidebarItem.tsx) and
  [branch grouping](../../components/layout/BranchSidebar.tsx).
- [Basic workspace grouping](../../components/basic/BasicWorkspace.tsx),
  [shared navigation styles](../../styles/account-navigation.css) and
  [semantic palette](../../styles/tokens.css).
- [Sidebar browser regression](../../tests/visual-consistency/sidebar.spec.ts),
  [route sweep fixtures and failure summary](../../tests/visual-consistency/sweep.mjs)
  and [verification instructions](../../tests/visual-consistency/README.md).
- Canonical presentation/current-state notes, migration evidence and public-claims
  notes were updated; the prior remote-sync audit now links to this correction.

The new sidebar regression has three cases at four widths: every navigation
surface, short translated screens, and independent desktop collapse/keyboard
behavior. It covers nine surfaces, 568px-tall Hindi/Hinglish layouts, fixed
footers, a single scroll owner, 44px mobile targets and Account reachability.
Axe scans cover the sidebar on every surface at every width. API-failure
assertions also prevent unhandled fixture responses passing as valid pages.
No unit tests were added for this presentation-only correction; the existing
safe allowlist verifies its callers and retained navigation behavior.

Application source remained unchanged throughout the final broad regressions,
the fixture corrections and the unit suite. The [task-only patch](../../test-results/sidebar-restoration-2026-11-10/sidebar-restoration.patch)
and [SHA-256 source manifest](../../test-results/sidebar-restoration-2026-11-10/source-manifest.json)
are saved with the evidence, separately from the earlier uncommitted visual-audit
changes. The branch remains `codex/complete-owner-setup-import` at remote-sync
base `50f2fa9b3b8ca06348c27a0e5c03f5ccbcba77b1`.

## Verification results

Commands below ran from the repository root. The fixture server was
`pnpm exec node tests/visual-consistency/server.mjs` on loopback port 4193.
`VISUAL_AUDIT_RUN_ROOT` selected the evidence directories listed below;
`PLAYWRIGHT_REVIEW_EVIDENCE_DIR` selected the corresponding `shared-evidence`
folder for the shared suite. Browser suites ran with one worker.

| Command | Result and evidence |
| --- | --- |
| `pnpm exec node node_modules/@playwright/test/cli.js test --config tests/visual-consistency/playwright.config.ts` | 92 passed, 4 assertion failures, 12 intentional viewport skips. All four failures were the new test incorrectly expecting Inter for Hindi; the application correctly used Noto Sans Devanagari. Preserved in `final-regression/focused/results.json`. |
| Same command with `sidebar.spec.ts --grep 'translated navigation'` | After correcting the test's script-specific font expectation: 4 passed, no failures. Evidence: `locale-recheck/focused/results.json`. This verifies 96 unique applicable cases across the broad run and recheck; it is not represented as one uninterrupted all-green run. |
| `pnpm exec node node_modules/@playwright/test/cli.js test --config tests/visual-consistency/shared-regression.config.ts` | 65 passed, 5 intentional desktop skips for mobile-only cases. Evidence: `final-regression/shared/results.json`. Combined browser coverage: **161 unique applicable cases**, 17 intentional skips. Rechecks are not counted again. |
| Same focused command with `sidebar.spec.ts` | **9 passed, 3 intentional non-desktop collapse skips**. All nine surfaces and translated/keyboard behavior pass with final fixture/API guards. Evidence: `sidebar-final/focused/results.json`. The earlier fixture recheck caught the missing invoice-list response and was interrupted after diagnosis; it is retained under `sidebar-fixture-recheck` and excluded from totals. |
| `pnpm exec node tests/visual-consistency/sweep.mjs` | 132 captures: 33 routes at 1440, 834, 390 and 320px. Final inventory has zero capture errors, uncaught page errors, failed API responses or horizontal page overflow. Zero axe color-contrast violations in the 33 views at 390px. |
| Same sweep command with `AUDIT_ROUTES=settings,org-settings` | Replaced eight settings captures after supplying the missing, provider-disabled WhatsApp GET fixtures. The original inventory is retained as `sweep-initial-inventory.json`; final aggregate: `sweep/summary.json`. No production WhatsApp code changed. |
| `pnpm exec node tests/visual-consistency/desktop-comparison.mjs` | Passed: byte-identical images, zero differing pixels. Same current dashboard markup with and without the three appended responsive CSS rules at 1440px. This does not claim pixel identity with the older sidebar golden. |
| `pnpm exec node node_modules/vitest/vitest.mjs run --config tests/account-navigation/vitest.config.ts --maxWorkers 1 --testTimeout 15000` | **72 files, 791 tests passed**. Evidence: `unit.log`. Explicit unit allowlist with throwing DB/network guards; the truncating repository test setup was not used. |
| `pnpm lint` | Passed, exit 0: **0 errors, 2 existing unused eslint-disable warnings** in generated `app/.well-known/workflow/v1/flow/route.js` and `coverage/block-navigation.js`. Evidence: `lint.log`. Generated files were not hand-edited. |
| `pnpm exec node tests/visual-consistency/build-local.mjs` | **Passed**, exit 0. Wrapper ran `pnpm build`: production compilation, TypeScript, route generation and verification of both import workflows completed. It verified a fresh, exact loopback-only disposable database, enforced read-only transactions and disabled external providers; only its own container was removed. Evidence: `build.log` and `build-runner.log`. |
| `pnpm exec node tests/shared-system/check-presentation.mjs HEAD` | Passed changed-file presentation guard against `50f2fa9`. |
| `git diff --check` | Passed. Local documentation links also resolve. |

The first broad browser attempt before the final Latin font correction was
interrupted and is retained under `full-regression`; it is excluded from these
counts. Chart initialization and synthetic duplicate-allocation console warnings
occurred in the harness; they are not uncaught page exceptions. The audit's
runtime-error counts refer specifically to `pageerror`, not every console message.

## Before and after review

Evidence root: `test-results/sidebar-restoration-2026-11-10/`.
Open [the organized gallery](../../test-results/sidebar-restoration-2026-11-10/review/index.html).
It contains 169 entries:

- Nine matching desktop sidebar pairs and nine matching 390px mobile pairs.
- Eighteen final tablet/320px sidebar views, with no invented before images.
- The original 6 November Standard/Pro reference alongside restored Pro.
- All 132 refreshed route viewport captures, including 90 historical comparisons
  and 42 views without a matching older capture.

The `before` directory records the rejected shared sidebar; `after` records the
restored one. Sidebar images are native browser captures, with whole-viewport
images linked for context. Original PNGs are preserved. Historical pairs include
remote Account/language/content changes and do not isolate this correction.
Workspace selection's earlier context image had an unhandled list fixture;
the final context image uses two synthetic organizations. Account Billing also
received its missing empty invoice-list fixture. Those content differences are
labeled in the gallery, and the initial images remain archived. No application
API or billing code changed for either fixture correction.

The gallery references 330 source capture files, stored as 327 distinct PNG
assets where identical images share a filename. Originals and copied assets
are checked by SHA-256. Its browser verifier checks every entry, images, page-view links,
search, viewport filters, empty state and direct links at four widths. Final
browser verification passed for all 169 entries with no JavaScript errors,
failed requests or horizontal overflow at 1440, 834, 390 and 320px. The
`verification.json` file records this check.

Gallery commands: `python test-results/sidebar-restoration-2026-11-10/build-review.py`
and `pnpm exec node test-results/sidebar-restoration-2026-11-10/verify-review.mjs`.
Dedicated images were captured with `pnpm exec node
test-results/sidebar-restoration-2026-11-10/capture.mjs before` and `after`;
the final workspace/billing recapture used
`SIDEBAR_CAPTURE_ROUTES=workspaces,account-billing`.

The [portable review ZIP](../../test-results/sidebar-restoration-2026-11-10/sidebar-restoration-review.zip)
contains the gallery, its referenced assets, the comparison preview and a plain
text copy of this report. Extract it, then open `index.html`. Packaging command:
`python test-results/sidebar-restoration-2026-11-10/package-review.py`;
`package-summary.json` records the ZIP checksum, CRC check and image-hash checks.

These tests render real application components with synthetic identity and
in-memory APIs. External requests are blocked. Geometry tests remove only the
21px harness banner so 100dvh shells have the real application's viewport; the
review captures retain that banner. Enabled WhatsApp operations, live Clerk,
provider checkout and real database behavior are outside this local visual run.
The legacy synthetic Billing route renders the retained component; production
redirects that legacy route to Account Billing. Viewport captures do not show
every lower section of internally scrolling pages; interaction regressions cover
the selected scrolling and form flows.

## Embedded gallery viewing correction

The owner could not see the page comparisons in the embedded browser. The
original file-based Chrome verification did not cover that viewer. In the actual
375 x 684px panel, selecting a page left the comparison at about 772px and the
first image at about 1076px, below the viewport. Direct file navigation also
could not be inspected through the embedded browser tooling.

The gallery now runs at `http://127.0.0.1:4194/` from a loopback-only static
server containing just the saved review. Selecting a page or using Previous/Next
brings its comparison into view below 900px. Browse pages and sizes returns to
the categories and filters. Compact headings, notes below the images and bounded
image height leave room for the screenshots. No application code or source PNG
was changed for this delivery correction.

Fresh verification used the actual Codex embedded browser: **all 169 entries
loaded their images with the selected comparison visible**, no horizontal page
overflow and no console errors. Search, viewport filters, Previous/Next, return
to browsing and the full-size image link passed. Additional viewport checks at
320 x 568, 834 x 844 and 1440 x 1024 passed; the override was reset afterward.
Evidence is `review/viewer-verification.json` and `review/viewer-fixed.jpg`.

The refreshed ZIP contains `Open-gallery.cmd` and `serve-gallery.py`. The launcher
uses the existing Python installation, binds only to loopback, and opens the
saved gallery. Keep it running while viewing; Ctrl+C stops it. If the preferred
port is occupied, the launcher uses an available local port. The current local
server is intentionally left running for review. There are no database or
provider connections. The application lint/build results above remain unchanged;
this follow-up changes only ignored review artifacts and this documentation.

## Delivery boundary

No schema, migration, seed, dependency or saved environment change is required.
No Production/shared data is accessed. Branch, commits, remotes and original
screenshots are preserved. No commit, push, PR or deployment is part of this
correction. The current fixes remain local for owner review.
