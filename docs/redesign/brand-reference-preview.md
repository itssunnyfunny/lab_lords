# Original brand preview — September 20, 2026

> Historical milestone record. The owner subsequently requested this design
> across the remaining public site with existing sentences retained. See the
> [complete public rollout report](public-rollout-report.md) for current scope,
> copy-preservation evidence, screenshots and verification.

## Scope and review status

The owner's pasted request supersedes the rejected Reading Grove visual
interpretation. This milestone completes only the homepage header, hero,
audience strip and first feature section. It awaits the requested single visual
review before the same treatment is applied elsewhere. The existing working
branch is `codex/librify-aligned-redesign`; no commit, push or deployment occurred.

The supplied original PNG is the visual authority. Librify's
[homepage](https://www.librify.in/), [Features](https://www.librify.in/features)
and [Pricing](https://www.librify.in/pricing) were reviewed for content structure:
a direct product introduction, plainly named features with short explanations,
and explicit plan inclusions. Copy remains original to Lab Lords. Competitor
prices, features, testimonials, usage statistics and promises were not adopted.
Current code and domain contracts continue to determine product claims.

## Presentation and files

- `components/landing/HomeReferencePreview.tsx`: server-rendered hero and nine
  feature links, Playfair Display headings and an accessible, explicitly synthetic
  library summary. Real text and controls sit outside the illustration.
- `components/landing/ReferenceNavbar.tsx`: public book/leaf wordmark, desktop
  links, keyboard-operable mobile menu and existing shared account actions.
- `components/landing/MarketingShell.tsx` and `app/page.tsx`: inject the new
  homepage header and replace the first sections without spreading this preview
  to other pages.
- `styles/brand-reference.css`: scoped original palette, Inter body/feature
  labels, responsive layout, visible focus, restrained finite artwork entrance,
  subtle scroll entrances and reduced-motion support. No motion hides content.
- `lib/marketingCopy.json`: direct product title, introduction and feature
  section copy. Feature capabilities and plan notes retain their meaning.
- `public/brand-reference/`: standalone native SVG logo and a 243 KiB WebP
  illustration. [Palette evidence](brand-reference-evidence.md) records the seven
  printed hex values and the actual sky-blue swatch sample, **#6EB6E4**.
  [Artwork provenance](brand-artwork.md) records the generation prompt and output.
- `tests/browser/public-billing.spec.ts`: updated public headings; loaded fonts
  and artwork, keyboard trial routing, menu Escape/focus and reduced-motion
  acceptance. Shared action unit tests remain applicable and unchanged.

The image is a new illustrated composition of the reference's study room,
reader and botanical elements; it is not the original artwork. The small SVG
mark preserves the open-book, two-leaf and flame idea with simpler shading.
The wordmark uses accessible Inter text. H1/H2 use actual Playfair Display;
feature H3s use Inter Semibold as shown in the board. The page presents
management software, so the reference's directory search, listings, testimonial
and growth statistics are intentionally absent. Lower homepage sections and
other routes still show the earlier presentation pending review.

## Behavior and data boundaries

`WorkspaceCTA` and `SignInCTA` preserve Clerk loading guards, signed-in/out
destinations and consent-aware event tracking. Selected-plan continuation and
`publicBillingPlans()` are unchanged. The summary's 12 students, 8 occupied seats
and 4 available seats are labelled example data and make no API calls.
Authentication, authorization, localization, tenancy, billing, provider order,
business services and authenticated UI have not changed in this correction.

No package versions, database schema, migrations, seeds or saved environment
configuration changed. Public verification uses development Clerk, blank
provider credentials and an unreachable loopback database. No shared or
Production database was accessed. Rollback consists of reverting this narrow
presentation change; there is no data migration or rollout procedure.

## Validation and screenshots

The old screenshot baselines capture the rejected design; they remain unchanged
and are explicitly excluded from this preview's functional run. See
[browser scope](brand-reference-test-review.md). These commands ran from the
repository root:

```powershell
node scripts/pnpm.mjs agent:doctor
node scripts/pnpm.mjs test:unit tests/unit/components/MarketingActions.test.tsx tests/unit/lib/site.test.ts tests/unit/lib/softwarePages.test.ts tests/unit/lib/billingPlans.test.ts tests/unit/pages/razorpay-review-pages.test.tsx tests/unit/proxy.test.ts
node scripts/pnpm.mjs lint
node .agent/librify/run.mjs build
node .agent/librify/run.mjs start
$env:PLAYWRIGHT_BASE_URL='http://localhost:3101'
node .agent/librify/run.mjs browser --grep-invert 'visual regression'
node .agent/librify/run.mjs browser --project mobile-chromium --grep 'standalone pages link setup navigation' --repeat-each 3
$env:REFERENCE_PREVIEW_URL='http://localhost:3101'
node .agent/brand-reference/inspect.mjs
node .agent/brand-reference/anchor.mjs
git diff --check
```

- Readiness check passed. Unit tests: **73 passed in 6 files**.
- Lint: **exit 0**, with two existing unused-disable warnings in generated
  `app/.well-known/workflow/v1/flow/route.js` and `coverage/block-navigation.js`.
- Production build: **exit 0**, TypeScript passed, 45 static pages generated,
  both import Workflow manifests verified. The isolated built preview is left
  running at `http://localhost:3101/`.
- Initial browser run: **53 passed, 1 failed**. The mobile context reached
  `/#how-it-works` from Pricing but remained at the top of the page. The identical
  targeted test then passed **3/3** with no source or assertion changes. Three
  separately instrumented fresh mobile contexts also placed the target about
  100px below the viewport top; no application scroll calls were observed.
  The initial failure's cause is not established; it is not claimed fixed.
- Final broader browser rerun: **54 passed in 2.1 minutes**, across desktop
  Chromium and mobile Chromium. No assertions were weakened. The two rejected
  visual-baseline comparisons were explicitly excluded; all 54 selected
  functional/accessibility cases ran and passed.
- Screenshot inspection: desktop **1440px**, mobile **390px** and narrow phone
  **320px** all returned HTTP 200, loaded actual Playfair Display, had no
  horizontal overflow and logged **zero page errors** in the built preview.
  An earlier development-server inspection logged one invalid-token error;
  it did not recur in the final built renders. This is not an application fix
  for that development-server observation.
- `git diff --check`: **exit 0**. Referenced source/document paths exist; logo
  XML was validated and both standalone artwork assets were visually inspected.

Rendered milestone screenshots, inspected against the actual original board:

- [Desktop: header, hero and full first feature section](../../.agent/brand-reference/desktop.png)
- [Mobile: header, hero and full first feature section](../../.agent/brand-reference/mobile.png)
- [320px narrow-phone render](../../.agent/brand-reference/narrow.png)

The screenshots are local review artifacts under ignored `.agent/`; they are
not approved regression baselines. Installed Playwright was used because the
agent-browser CLI was unavailable. No application account or customer data was
created for these checks. Integration/database tests are unnecessary for this
presentation-only milestone and were not run.

Visual approval remains a human review decision, separate from passing tests.
