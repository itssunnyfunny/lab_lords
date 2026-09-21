# Public proof, brand and metadata — 2026-09-21

Baseline: `4a51ff6` on `codex/botanical-public-pages`. This is a local website
change, not a deployment or a search-index update. The approved page copy, design,
release decisions and product behaviour remain the reference.

## Homepage evidence and wording

The homepage plan introduction is replaced, in the same position, by **See how
it works in your library**. `/pricing`, its catalogue and selected-plan actions
are unchanged. `/#pricing` now targets the footer's Pricing link to `/pricing`.

No approved customer aggregate, quote, attribution permission or customer logo
was found in the supplied material or current public content sources. The
production databases were not accessed. The published fallback uses explicitly
labelled sample data: fee due ₹1,200, payment recorded ₹700, left to pay ₹500.
These are an illustrative payment record, not adoption figures or a real receipt.

The two explanatory sentences reuse the existing approved partial-payment and
receipt wording. Their implementation and release evidence remains in
[public claims](../product/public-claims.md). The sample reiterates that recording
a payment does not transfer money or verify a bank transaction. It links to the
existing How It Works page; it adds no payment or receipt action.

`lib/publicProof.ts` contains only approved public display fields and currently
has empty metrics/feedback arrays. Its component renders a product example when
both are empty. Synthetic quote/metric/logo fixtures exist only in the unit test;
they are not imported by application code. No ratings or Review/AggregateRating
schema are introduced.

Before adding customer proof, record the following in a reviewed evidence record:

- Metrics: owner approval, aggregate source, exact definition, as-of date,
  organisation versus branch scope, and exclusions for signups, trials and test
  accounts. Preserve the approved value; do not invent rounding or a plus sign.
- Feedback: authentic original quote, permission for its displayed attribution,
  and any editing/translation approval. Publish only approved names/library details.
- Logos: owner/customer permission for public use and approved artwork.

Private contact details and consent records must stay outside the public registry.
The static layout follows the compact figures/feedback pattern inspected on
[Librify](https://www.librify.in/); no competitor content or identity is reused.

## Public wording and identity changes

| Before | After | Reason |
| --- | --- | --- |
| Home's **Choose what your library needs.** plan introduction | **See how it works in your library**, with the existing partial-payment/receipt sentences and labelled sample | Requested removal of homepage pricing; no approved customer evidence is available |
| Public **LabLords.in** wordmarks | **Lab Lords** | Requested visible brand name; domain and email strings are unchanged |
| Home search title **Lab Lords — Study Hall & Library Management Software** | **Lab Lords — Library & Study Hall Management Software** | Requested search title; visible hero stays unchanged |
| Home meta description repeats the hero | **Manage students, seats, attendance and fees for your self-study library. Keep payments, receipts and upcoming fee dates organised with Lab Lords.** | Requested description includes already verified attendance, receipt and renewal capabilities |
| **Pricing for Library Management Software \| Lab Lords** | **Plans & Pricing \| Lab Lords** | Requested page title; no plan copy, price or action changes |
| **How It Works \| Lab Lords** | **How Lab Lords Works \| Library Setup Guide** | Requested page title; explicit absolute title avoids template duplication |
| **Fee Reminder Software for Education Centres** | **Fee Reminder Software for Study Libraries** | Small audience correction in metadata only |
| Solution breadcrumb **Software** | **For your library** | Matches the existing footer section at the same `/#software` URL |
| Old cyan LL icons and preview artwork | Approved book-and-leaf symbol, **Lab Lords**, approved hero phrase and **lablords.in** | Removes obsolete visual identity without redrawing the approved symbol |

All other accurate page headings, descriptions, feature names, CTA labels and
page structure remain. The Features and Contact titles already matched the
requested values. Policy substance and historical documentation are unchanged.
The shared public lockup also appears on sign-in/up; authenticated app and receipt
logos were not edited. No new dependency or runtime data source was added.

Icons were deterministically exported from the unchanged
`public/brand-reference/open-book-leaf.svg`. The 1200×630 previews use the existing
public Inter/Playfair fonts and palette. Next.js file metadata now emits the three
icon links without duplicate manual declarations. There is no web manifest.

The full [route-by-route audit and screenshots](public-metadata-audit.md) record
the rendered before/after values for all 18 current destinations and two retired
URLs. Shared metadata fixes missing images/site names/alt text while preserving
each page's canonical, title and description. Home gains one WebSite node; no
review/rating claim is added. These choices follow Google's guidance on
[consistent site names](https://developers.google.com/search/docs/appearance/site-names),
[descriptive title links](https://developers.google.com/search/docs/appearance/title-link)
and [page-specific snippets](https://developers.google.com/search/docs/appearance/snippet).

## Validation and release record

The existing `scripts/pnpm.mjs` launcher was used. The ignored local preview
wrapper forwards to that launcher, uses existing development Clerk configuration,
disables billing/AI provider credentials and uses an unreachable loopback database.
No production database or production customer session was used. The
agent-browser CLI was unavailable, so browser verification used the repository's
installed Playwright tooling; no dependency was installed.

| Command | Result |
| --- | --- |
| `node scripts/pnpm.mjs agent:doctor` | Pass; installed runtime/dependencies ready; existing unrelated worktree changes noted |
| `node scripts/pnpm.mjs test:unit tests/unit/components/PublicProofSection.test.tsx tests/unit/pages/public-site.test.tsx tests/unit/components/MarketingActions.test.tsx` | Initial homepage batch: 24 passed |
| `node scripts/pnpm.mjs test:unit tests/unit/pages/public-site.test.tsx tests/unit/lib/site.test.ts tests/unit/components/PublicProofSection.test.tsx tests/unit/components/MarketingActions.test.tsx tests/unit/pages/razorpay-review-pages.test.tsx` | Final affected page/component/metadata suite: 32 passed |
| `node scripts/pnpm.mjs test:unit tests/unit/lib/softwarePages.test.ts tests/unit/lib/billingPlans.test.ts tests/unit/lib/billingFlow.test.ts tests/unit/lib/contextual-navigation.test.ts` | 14 passed; total final unique unit cases: 46 |
| `node scripts/pnpm.mjs lint` | Pass, zero errors; two existing generated-file unused-disable warnings in the Workflow route and coverage output |
| `node scripts/pnpm.mjs exec eslint tests/browser/public-site.spec.ts tests/unit/pages/public-site.test.tsx` | Pass after the final test adjustments |
| `node .agent/botanical-run.mjs build` | Pass: TypeScript, 48 static pages and both import workflow manifests. Initial export exposed an ICO PNG-channel format error; exporting its payload as RGBA fixed it before the successful build |
| `node .agent/botanical-run.mjs start --port 3101` | Local production preview running on port 3101 |
| `node .agent/botanical-run.mjs test:browser tests/browser/public-billing.spec.ts tests/browser/public-site.spec.ts --grep-invert 'visual regression'` | 118 passed; four new metadata assertions initially failed due to equivalent root-URL formatting and favicon hash queries, not application regressions |
| `node .agent/botanical-run.mjs test:browser tests/browser/public-site.spec.ts --grep 'every public destination\|homepage site identity'` | All four corrected cases passed on desktop/mobile; 122 unique functional cases pass across the run and targeted rerun |
| `node .agent/botanical-run.mjs test:browser tests/browser/public-billing.spec.ts --grep 'visual regression' --update-snapshots` | Two baselines updated after manually reviewing before/after images, section placement and phone reflow; thresholds and tests were not relaxed |
| `node .agent/botanical-run.mjs test:browser tests/browser/public-billing.spec.ts --grep 'visual regression'` | Two passed without snapshot updates |
| `node .agent/public-proof-capture.mjs before` / `after` | Captured all 20 rendered heads and desktop/mobile homepage screenshots; final images wait for loaded fonts, controls and illustrations |
| `git diff --check` | Pass |

Browser commands used the process-only PowerShell setting
`$env:BOTANICAL_PREVIEW_URL = 'http://localhost:3101'`. This does not change saved
environment files. Tests inspect both rendered values and the initial HTML head
with a crawler user-agent, exercise the homepage-to-Pricing selected-plan journey,
and retain authentication, navigation, reduced-motion, accessibility and reflow
checks. Serious/critical accessibility violations: none in the tested pages.

The React review kept the proof component on the server, with static data, stable
keys, semantic headings/figures and no new effects, fetches or client dependency.
Existing billing/analytics-consent components remain in place.

Changed files are limited to Home/footer wiring, the proof registry/component and
its scoped styling, public wordmarks, metadata declarations/helpers, icons and
sharing assets, related tests, two visual baselines and these evidence documents.
`lib/billingPlans.ts`, pricing content/actions, authentication/tenancy services,
receipts, localization and protected layouts/proxy were not changed.

## Release and Search Console checklist

After the normal approved release (not performed in this task):

1. Check the live source/rendered head on Home, Features, Pricing, How It Works,
   Contact and the five current solution routes against the metadata audit.
   Confirm canonical/OG URLs use the configured customer origin.
2. Fetch the live favicon, PNG/Apple icons and both sharing images; inspect the
   embedded wording and alt text, including in the relevant social preview tools.
   Existing social caches may need refreshing.
3. Validate the homepage WebSite node, check the sitemap's 18 entries, and confirm
   the two retired URLs retain their notices, self-canonicals and `noindex, follow`.
   Check protected URLs remain protected and excluded from indexing.
4. In the verified Search Console property, use URL Inspection / Test Live URL
   for the changed public pages, review the selected canonical and request indexing
   for those pages after confirming the release. Do not request indexing of the
   retired or protected URLs. Check sitemap processing and indexing reports later.

Google chooses displayed titles, snippets and site names and recrawls on its own
schedule; a passing local build does not prove any search result has changed.
The remaining customer-proof gap is explicit public-use approval and provenance
for actual aggregates, quotes/attribution and logos. No production data query is
needed to finish the authorised fallback.

No schema, migration, environment or provider changes are required. Rollback is
limited to these homepage, public brand, metadata, assets, tests and documentation
commits. Do not revert the unrelated local tooling changes left in the worktree.
