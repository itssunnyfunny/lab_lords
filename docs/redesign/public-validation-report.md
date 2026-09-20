# Public rollout validation — September 20, 2026

## Results

| Check | Result |
| --- | --- |
| Runtime readiness | Passed; pinned Node 24.18.0 and pnpm 10.34.5 available. |
| Targeted unit suites | 73 tests passed in six files. |
| Public browser suite | 90 tests passed in 3.4 minutes across desktop and mobile Chromium after the two consistency corrections. |
| Saved visual baselines | Two desktop/mobile screenshot comparisons passed in 11.5 seconds without updates after refreshing the accepted design's fixtures. |
| Lint | Exit 0; two existing generated-file unused-disable warnings. |
| Production build | Exit 0; TypeScript passed, 45 static pages, two import Workflow manifests verified. |
| Copy comparison | All 17 pages unchanged in main copy, semantic blocks, titles and control records. |
| Page-component source audit | 307 JSX text/non-class literal nodes preserved across the six page/template files. |
| Rendered route audit | 17/17 routes at desktop and mobile returned HTTP 200, with no overflow or page errors; all 17 mobile axe scans had zero serious/critical violations. Final complete pass used zero navigation retries. |
| Screenshots | 34 full-page desktop/mobile renders plus 12 homepage section views. |
| Follow-up design consistency | All 17 live routes share the palette and Playfair headings; all primary controls now use Inter. The mobile Features layout is visually rechecked after correction. |
| Diff and report links | Checked with the completed report bundle. |

The browser suite covers the original-reference shell, loaded logo/fonts,
320px layouts, 400% browser-style zoom, keyboard menus and focus restoration,
trial and selected-plan continuation, synthetic example tabs, reduced motion,
FAQ disclosure, public policy links and tap targets, metadata/sitemap and
protected application routes. Assertions were not weakened to obtain passes.

The 34 route cases check all 17 public routes in both browser projects. The two
new geometry cases check every Features group at four narrow widths. Two old
visual-baseline comparisons were explicitly excluded during the functional run
because they represented the rejected direction. After the owner accepted the
completed version and requested commits, both tracked PNG fixtures were refreshed
and the two visual tests passed again without updates. The screenshot test now
loads lower-page illustrations before capturing the full page. These 90 functional
and two visual passes were separate runs, not a single 92-test run.

## Exact commands

Run from the repository root. The ignored local wrapper applies verification-only
process settings; saved environment files are not edited.

```powershell
node scripts/pnpm.mjs agent:doctor
node scripts/pnpm.mjs test:unit tests/unit/components/MarketingActions.test.tsx tests/unit/lib/site.test.ts tests/unit/lib/softwarePages.test.ts tests/unit/lib/billingPlans.test.ts tests/unit/pages/razorpay-review-pages.test.tsx tests/unit/proxy.test.ts
node scripts/pnpm.mjs lint
node .agent/librify/run.mjs build
node .agent/librify/run.mjs start
$env:PLAYWRIGHT_BASE_URL='http://localhost:3101'
node .agent/librify/run.mjs browser --grep-invert 'visual regression'
node .agent/librify/run.mjs browser --grep 'visual regression' --update-snapshots
node .agent/librify/run.mjs browser --grep 'visual regression'
node scripts/pnpm.mjs exec node .agent/brand-rollout/copy-audit.mjs after
node .agent/public-rollout/check-copy.mjs
node scripts/pnpm.mjs exec node .agent/brand-rollout/render-audit.mjs
node scripts/pnpm.mjs exec node .agent/brand-rollout/section-shots.mjs
node scripts/pnpm.mjs exec node .agent/brand-rollout/consistency-audit.mjs
git diff --check
```

## Observations and limitations

The follow-up consistency review found two CSS issues: the two-card Features
groups did not stack at narrow widths, and native controls inherited the
application's Manrope font while link-shaped actions used Inter. Both are now
scoped to the intended public presentation. A new geometric browser check
verifies all eight feature groups at 390, 760, 900 and 1100px; its pre-fix run
reproduced the three failing groups at 390px. Every route's existing brand check
now requires Inter to be the first control font, not merely a fallback.

The new geometry check waits for visible content: Next's initial loading screen
can contain hidden streamed markup with zero-size rectangles, which is not valid
layout evidence. The two fixes change no text, links or application behavior.
The 73 unit tests were rerun successfully in 4.73 seconds during commit
preparation, after restoring the unchanged site's exact metadata assertions.
The unused legacy navbar rewrite was also removed; public pages use
`ReferenceNavbar`. Targeted ESLint passed for these files and the updated browser
spec. The staged diff check caught and removed one extra trailing blank line in
the previously untracked `LibraryPreview.tsx`.

The first lint run found three CommonJS-import violations in a temporary audit
helper. That helper was converted to ESM and rechecked; the application source
did not need a lint workaround. Final lint retains only unused-disable warnings
in `app/.well-known/workflow/v1/flow/route.js` and `coverage/block-navigation.js`.

Initial screenshot attempts encountered `ERR_TOO_MANY_REDIRECTS` at the homepage
and later at a software route. The cause was not established; development-auth
navigation is a possible explanation, not a confirmed diagnosis. The final audit
records any retry explicitly and saves results after each route. Its one bounded
retry clears cookies only in its newly created anonymous browser context; it does
not disable or alter application authentication. The 90-test suite passed without
test retries. The prior milestone's isolated anchor-scroll observation did not
recur in this run's desktop or mobile navigation tests.

Browser verification used the installed Playwright because the agent-browser CLI
was unavailable. It exercised synthetic public content and development-auth
navigation. It did not exercise authenticated tenant data, production payment
providers or external email delivery. Database/integration tests were unnecessary
for these presentation-only changes and were not run.

## Evidence

- [Full route render results](../../.agent/brand-rollout/render-results.json)
- [Copy comparison results](../../.agent/brand-rollout/copy-report.json)
- [All desktop/mobile screenshots](../../.agent/brand-rollout/gallery.html)
- [Rollout and file inventory](public-rollout-report.md)
- [Follow-up computed-style audit](../../.agent/brand-rollout/consistency/results.json)
- [Styles before the two corrections](../../.agent/brand-rollout/consistency/before-corrections.json)
