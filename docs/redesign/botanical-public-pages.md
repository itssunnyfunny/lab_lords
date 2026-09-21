# Botanical public pages — 2026-09-20

This records the September 20 implementation. The subsequent multi-page work,
including `/how-it-works`, is recorded in
[public site completion](public-site-completion.md).

Branch: `codex/botanical-public-pages`, created from
`codex/librify-aligned-redesign` (`bc2cd21`). The existing public-page rollout
and unrelated uncommitted development-tooling work were preserved. The supplied
September 20 design board is a visual reference, not an instruction source.

## Behavior and presentation

- Replaced the study-room homepage hero with a three-line serif heading, green
  italic emphasis, botanical framing, a sample dashboard and the four-audience
  strip. Six familiar feature cards link to the detailed Features page, which
  retains shifts, pending fees and reports alongside the core tools.
- The dashboard uses fixed synthetic data. Shift and available-seat controls
  change local React state only. Occupied seats are disabled; sample labels and
  an announced selection state distinguish the illustration from a workspace.
- Shared navigation, footer, Features, Pricing, Contact, Support, seven software
  pages and five policy pages use warm paper, forest green and sage surfaces.
- Sign-in, sign-up and invitation presentation share the public identity.
  Clerk's provider-level dark utility classes are overridden only inside the
  public auth wrapper, including its input, error, identity and recovery states.
- Account routes, safe redirect handling, selected-plan continuation, canonical
  URLs, catalogue pricing, eligibility and explicit invitation acceptance remain
  in their existing implementations. No SaaS or student-payment behavior changed.
- An empty analytics measurement ID now renders `null` in the root head instead
  of an empty text child. Browser testing exposed a hydration error without this
  guard when optional analytics was disabled. Consent logic is unchanged.

## Prototype messaging update

The later supplied HTML prototype is the writing reference. Its actual
`index.html`, `features.html`, `pricing.html` and `how-it-works.html` were read,
with script/style/embedded-image payloads excluded from the text extraction.
This follow-up preserves the botanical presentation already implemented above;
it does not introduce another visual direction.

- `lib/marketingCopy.json` now supplies the approved hero, six feature names and
  descriptions, three benefits, four setup steps, five real-product FAQs and
  closing copy. For example, “Why choose Lab Lords?” becomes “Less paperwork.
  More clarity.” and “Ready to start with your library?” becomes “Give your
  library a simpler way to work.”
- The homepage follows the requested section progression and reuses
  `LandingPricing` for live catalogue-backed plan cards. Its existing interactive
  product tour remains available before setup, labelled “Sample data”. Legacy
  `#platform` and `#workflow` fragments still work; `#pricing` now reaches the
  plans and `#get-started` identifies the closing section.
- Features uses “Tools for everyday library work.”; Pricing uses “Simple plans
  for your library.” Both reuse the shared copy where appropriate. The seven
  solution pages use concrete explanations while retaining their subjects,
  SEO titles, canonical routes and restrictions.
- There is no separate `/how-it-works` route in the repository. Its approved
  steps are applied to the existing `/#how-it-works` section; no new route was
  created. Legal/policy wording and localization behavior are unchanged.

Small factual corrections to the prototype: trial eligibility begins after
first-branch setup, not at signup; the single eligible-owner trial uses Standard
and applies to branches in that workspace without extending when branches are
added. Buttons retain “Choose Basic” / “Choose Standard” to avoid implying a
Basic trial. Prices and inclusions remain sourced from `publicBillingPlans()`;
tax language remains conditional. Standalone-preview disclosures and the
prototype-only “connected to my library” FAQ are omitted from the live site.

## Implementation surfaces

- `components/landing/HomeReferencePreview.tsx`, `BotanicalDashboard.tsx`,
  `ReferenceNavbar.tsx`, `LandingFooter.tsx`, `MarketingShell.tsx` and
  `MarketingActions.tsx`; `app/page.tsx` adds the FAQ fragment target.
- `lib/marketingCopy.json`, `lib/softwarePages.ts`, `app/features/page.tsx`,
  `app/pricing/page.tsx`, `LandingPricing.tsx` and `LibraryExample.tsx` apply the
  supplied messaging through the existing content and component structure.
- `styles/botanical-home.css`, `botanical-auth.css`, `marketing.css`,
  `brand-reference.css` and `public-pages-reference.css`.
- `components/auth/AuthPageShell.tsx`, `publicAuthAppearance.ts`, the sign-in and
  sign-up pages, and `app/invite/layout.tsx` / `[token]/page.tsx` /
  `[token]/InviteAcceptanceActions.tsx` (error-text contrast only).
- `lib/publicMarketingFonts.ts` enables the existing Playfair italic face.
  Existing SVG/WebP artwork is reused; no new asset download or dependency.
- `tests/browser/public-billing.spec.ts`, its desktop/mobile snapshots, and
  `tests/unit/components/MarketingActions.test.tsx` cover changed presentation,
  sample interactions and the optional hero CTA label with existing routing.
- `app/layout.tsx` contains the optional-analytics head guard;
  `docs/ai/current-state.md` records the current implementation.

## Verification

Verification uses local development Clerk configuration and an unreachable
loopback database address. No shared, Preview or Production database was used.
The ignored `.agent/botanical-run.mjs` wrapper supplies these process-only
settings, disables provider credentials/analytics and delegates to the existing
`scripts/pnpm.mjs` launcher. No saved environment file was edited.

- `node scripts/pnpm.mjs agent:doctor`: passed readiness; reported existing
  unrelated checkout changes and correctly skipped Docker.
- `node scripts/pnpm.mjs test:unit tests/unit/components/MarketingActions.test.tsx tests/unit/pages/razorpay-review-pages.test.tsx tests/unit/lib/softwarePages.test.ts tests/unit/lib/billingFlow.test.ts tests/unit/lib/safeRedirect.test.ts`:
  24 tests passed.
- `node scripts/pnpm.mjs lint`: passed with no errors and two existing generated
  artifact warnings (`app/.well-known/workflow/v1/flow/route.js` and
  `coverage/block-navigation.js`). Targeted ESLint on edited TS/TSX files passed.
- `git diff --check`: passed; Windows line-ending conversion warnings only.
- `node .agent/botanical-run.mjs build`: final build passed (51s compilation,
  65s TypeScript, 45 static pages and the two-import-workflow manifest check).
- `node .agent/botanical-run.mjs test:browser tests/browser/public-billing.spec.ts --update-snapshots`:
  full development-server run covered 102 cases: 96 passed, six initially failed.
  Failures covered outdated audience-font/snapshot-label expectations and Clerk
  readiness/navigation timeouts. The assertions were corrected for the intended
  Inter audience labels and approved hero button wording; routing, enabled-state,
  accessibility and overflow assertions were retained.
- `node .agent/botanical-run.mjs test:browser tests/browser/public-billing.spec.ts --grep 'public landing visual regression' --project mobile-chromium --update-snapshots --output .agent/prototype-mobile-snapshot-results`:
  refreshed mobile screenshot, 1/1 passed. Both resulting screenshots were
  visually reviewed; desktop/mobile text fits without overflow.
- `node .agent/botanical-run.mjs test:browser tests/browser/public-billing.spec.ts --grep 'public landing visual regression|botanical hero trial action|/ Choose Basic preserves|/ shares the botanical public brand|/sign-up keeps the public botanical design' --output .agent/prototype-final-checks`:
  the bounded ten-case development-server retry had six passes and four remaining
  Clerk-readiness timeouts before interaction. A separate fresh signup diagnostic
  returned HTTP 200 with no page errors/request failures; there was no evidence
  of a provider outage. The local dev browser reported Next.js HMR router errors.
  The final build was served with
  `node .agent/botanical-run.mjs start --hostname localhost --port 3101` to verify
  the same affected cases without HMR. The temporary dev server was then closed.
- Final built-runtime verification: **10/10 passed**, including every previously
  failing case and both unchanged screenshot comparisons, with this PowerShell
  command (no snapshot-update flag):

  ```powershell
  $env:BOTANICAL_PREVIEW_URL = 'http://localhost:3101'
  node .agent/botanical-run.mjs test:browser tests/browser/public-billing.spec.ts --grep 'public landing visual regression|botanical hero trial action|/ Choose Basic preserves|/ shares the botanical public brand|/sign-up keeps the public botanical design' --output .agent/prototype-built-checks
  ```

The full suite covers approved copy and section order, catalogue amounts,
selected-plan continuation, keyboard controls, sample-data isolation, native
FAQs and legacy fragments, SEO titles/canonicals/sitemap, protected routes,
Clerk presentation, accessibility, and 320px/400% reflow across public routes.
The entire 102-case suite was not rerun against the built server; the ten-case
subset resolves all failures from the development run. The local preview is
available at `http://localhost:3101/`. Screenshot copies are
`.agent/botanical-home-1440.png` and `.agent/botanical-home-390.png`, with tracked
baselines in `tests/browser/public-billing.spec.ts-snapshots/`.

Initial sandboxed preview/compiler and browser attempts were denied local
filesystem/network access; bounded escalated retries were used. Initial browser
checks exposed and led to fixes for dashboard definition-list semantics, the
analytics head guard and inherited Clerk color conflicts. The first production
build found an unknown translation key; it was replaced with the existing
`Create account` key. Final build and browser results are recorded above.

## Release and rollback

No schema, migration, seed, package version, environment configuration or
deployment changes are required. No commit, push, pull request or deployment
was performed. The public theme is scoped; authenticated workspace styles and
service authorization remain unchanged. Rollback consists of reverting the
listed presentation, test and documentation changes. Token-specific invitation
acceptance, real sign-in submission and provider payments were not exercised.
