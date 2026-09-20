# Lab Lords public design rollout — September 20, 2026

## Completed scope

The original-reference design now covers all 17 public routes: the complete
homepage, Features, Pricing, Contact, Support, five policy pages and seven
software pages. Work remains on `codex/librify-aligned-redesign`. The user's
instruction to retain sentences was applied to the wording in the current
preview before this rollout; the before/after content audit confirms it.

The design uses the supplied forest, leaf, sage, paper, bark, peach and mist
palette, plus sky blue sampled from the actual image. Playfair Display supplies
H1/H2 typography; Inter supplies body copy, feature headings and controls. The
book/leaf identity is shared by public navigation and the footer. New transparent
botanical and book illustrations replace the earlier outline-only decorations.

## Reports and visual evidence

- [Sentence and control preservation](public-copy-report.md)
- [Commands, tests, accessibility and limitations](public-validation-report.md)
- [Palette and logo evidence](brand-reference-evidence.md)
- [Artwork prompts, provenance and asset differences](brand-artwork.md)
- [Desktop/mobile screenshot gallery](../../.agent/brand-rollout/gallery.html)
- [Machine-readable copy comparison](../../.agent/brand-rollout/copy-report.json)
- [Machine-readable rendered route checks](../../.agent/brand-rollout/render-results.json)

The downloadable report bundle includes these reports, machine results and
screenshots. The gallery supports desktop/mobile review of every public route
and separate homepage section views. Screenshots are local review evidence,
not an automatic declaration of visual approval.

The Markdown reports are versioned with the feature. Links into `.agent/` refer
to ignored local review artifacts supplied in the downloadable report bundle;
those gallery and machine-evidence files are not included in a Git clone.

## Second review: design consistency

A second visual review compared desktop and mobile screenshots of Features,
Pricing, Contact, Support, Privacy and a representative software page with the
homepage. These pages share the same palette, heading/body typography, book/leaf
identity, navigation, footer, rounded surfaces and action styles. They use one
brand system; their page layouts are not identical.

The legal document sheet and software highlights hero adapt the layout to the
content. Homepage FAQs use separate rounded rows, while other pages group them
inside one accordion surface. Closing sections also vary their alignment, and
secondary pages hide decorative botanical accents on narrow screens. These are
intentional presentation differences rather than a different visual identity.

The review did identify a responsive inconsistency: the Features page's Staff,
Reports and AI assistance groups retained two narrow columns while its other
feature groups stacked. A more specific two-item CSS selector overrode the
narrow-screen rule. The follow-up correction reduces that selector's precedence
so these groups also stack when the responsive rule applies. A geometric check
of the previous build reproduced all three unstacked groups at 390px.

Live computed-style inspection also found that native button controls inherited
the application's Manrope font while link-shaped actions used Inter. Public
buttons, inputs, textareas and selects now explicitly inherit the public Inter
font. The browser assertions check that each control's font family starts with
Inter, rather than accepting Inter only as a later fallback. These two corrections
change no sentences, actions, domain behavior, schema or saved environment
configuration.

Follow-up measurements are recorded separately in the
[consistency audit](../../.agent/brand-rollout/consistency/results.json). This
review finding does not itself establish a new build or test result; those
results belong in the [validation report](public-validation-report.md).

## Files changed in this rollout

| Files | Purpose |
| --- | --- |
| `components/landing/MarketingShell.tsx`, `lib/publicMarketingFonts.ts` | Share public fonts, tokens, styles and original-reference navigation across routes. |
| `components/landing/PublicBrandLockup.tsx`, `ReferenceNavbar.tsx`, `LandingFooter.tsx` | Reuse the public book/leaf lockup and update the footer presentation. |
| `components/landing/HomeReferencePreview.tsx`, `app/page.tsx` | Inherit shared typography and scope the remaining homepage sections for styling. |
| `components/landing/NatureDetail.tsx` | Render the finished decorative illustrations separately from real text and controls. |
| `styles/marketing.css`, `styles/brand-reference.css`, `styles/public-pages-reference.css` | Extend the approved palette, type, cards, form surfaces, spacing and responsive layouts. |
| `app/features/page.tsx`, `app/pricing/page.tsx`, `app/contact/page.tsx`, `app/support/page.tsx` | Add presentation wrappers/classes without rewriting sentences or actions. |
| `components/legal/LegalPage.tsx`, `components/software/SoftwareLandingPage.tsx` | Apply the same design to all policies and seven software pages. |
| `public/brand-reference/botanical-accent.webp`, `books-and-leaves.webp` | Add two optimized, genuinely transparent illustrations. |
| `tests/browser/public-billing.spec.ts` | Add all-route font/logo/palette checks and 320px/400% reflow coverage. |
| `tests/unit/pages/razorpay-review-pages.test.tsx` | Mock only Next's build-time font function for static component tests. Real compiled fonts are checked in the browser. |
| `docs/ai/current-state.md`, `docs/redesign/` | Record current scope, copy preservation, validation and asset provenance. |

Existing unrelated local tooling, CI, package and runbook changes predate this
rollout and were preserved. No package version was changed by the design work.

## Behavior retained

All 39,421 normalized main-text characters and 759 semantic content blocks are
unchanged. All 17 titles and 737 control label/destination records match. Policy
dates, closed FAQ answers, plan inclusions, Basic/Standard pricing, internal
plan identifiers and continuation URLs remain unchanged. The footer's old logo
wordmark is replaced with `LabLords.in`; following sentences are identical.

Authentication/loading guards, billing authority, server authorization, tenancy,
consent-aware analytics, localization preferences and authenticated screens keep
their existing implementation. The support form still prepares an email draft;
the verification did not send messages, create users, charge providers or access
tenant data. Interactive library examples remain labelled synthetic data.

## Requirements, rollback and limits

No database schema, migration, seed, saved environment or deployment changes are
required. No shared, Preview or Production database was accessed. The local
server uses development Clerk credentials, blank provider credentials and an
unreachable loopback database. At the owner's request, the design, tests and
reports are saved as focused local commits on the feature branch. Nothing was
pushed or deployed. Unrelated tooling and CI changes remain uncommitted.

Rollback is limited to these presentation components/styles/assets and their
documentation/tests. Runtime domain and provider behavior needs no rollback.
The generated illustrations are new compositions and the SVG is a simplified
redraw, not exact copies of the reference's artwork. Reference directory-search
and unsupported growth/testimonial claims are not introduced.

Local verification encountered intermittent redirect loops before some screenshot
navigations. Those observations are recorded in the validation report; the auth
stack was not changed to hide them. The functional run excluded the old visual
baselines during review. After the owner's acceptance and request to save this
version, the two tracked PNG baselines were refreshed and verified separately
without snapshot updates. Their capture waits for all visible artwork to load.
