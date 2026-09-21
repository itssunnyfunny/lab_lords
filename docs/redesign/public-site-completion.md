# Public site completion — 2026-09-21

## Scope and baseline

Working branch: `codex/botanical-public-pages`. Existing uncommitted botanical
work and unrelated tooling changes were retained. No branch switch, provider
operation, database access or deployment is part of this task. The owner
subsequently authorized small local commits; unrelated tooling changes remain
uncommitted.

The approved baseline is the **local branch**, not the deployed website.
Before screenshots and route observations are in `.agent/public-site/before/`
(local review artifacts, deliberately not committed). Forest `#164D38`, leaf
`#16835E`, sage `#A7C957`, paper `#FFFBF4`, bark, peach and mist remain in
`styles/brand-reference.css`. Playfair Display / Inter, `PublicBrandLockup`,
`NatureDetail`, botanical-accent.webp, the existing cards/buttons and reduced
motion rules are retained. New styling is limited to navigation and content
layout using this system.

## Observed route inventory, before changes

Live observations below are rendered browser visits, not cached search results.
The homepage still has the earlier design and anchor navigation. Its actual
footer supplied the seven solution routes and legal/support destinations.
`/features` and `/pricing` returned rendered Next 404 pages. The live sitemap
could not be retrieved: browser blocked the XML response and the web fetch
was inaccessible. That does **not** establish a missing sitemap. Local source
defines 17 sitemap routes before this task.

| Route | Live / local before | Purpose and existing content | Action |
| --- | --- | --- | --- |
| `/` | Both present, different designs | Product overview, examples, setup, full plan catalogue | Keep substantial overview; shorten pricing; dedicated next links |
| `/features` | Rendered live 404 / local present | Eight feature groups, brief detail cards | Expand practical examples, plan links, related questions |
| `/pricing` | Rendered live 404 / local present | Catalogue cards, branch note, generic FAQ | Add comparison, trial lifecycle, cancellation and pricing FAQ |
| `/how-it-works` | Live not verified / no existing local route | Homepage setup section only | Create actual onboarding walkthrough |
| `/faq` | Live not verified / no existing local route | Five homepage questions | Create grouped FAQ with shared answers |
| `/about` | Live not verified / no existing local route | Product context on home | Create factual product/audience page |
| `/contact` | Both present | Email/address plus billing/bug guidance | Separate prospective-customer questions; honest email-draft action |
| `/support` | Both present | Email topics and mailto bug form | Practical help, billing policies, safe report guidance |
| `/software/study-hall-management` | Both present | Shift/seat/student workflow | Keep identity; concrete example and feature links |
| `/software/library-management` | Both present | Reading-room records | Keep reading-space scope; example and feature links |
| `/software/seat-management` | Both present | Shift-specific availability/allocations | Keep identity; example and feature links |
| `/software/student-fee-management` | Both present | Fee records and dues | Keep student fees distinct from SaaS billing |
| `/software/fee-reminder` | Both present | Fee follow-up and review | No new automated-delivery promise |
| `/software/coaching-management` | Both present | Students/fees/branches | No academic ERP promise |
| `/software/tuition-management` | Both present | Student and fee administration | No exams or teaching-management promise |
| `/privacy`, `/terms`, `/refund-policy`, `/shipping-delivery-policy`, `/cookies` | All rendered live; all local routes present | Legal terms and dates | Preserve substance and dates; maintain links |

## Reference audit and adaptation

Rendered visits to all seven user-specified Librify URLs succeeded. Actual
header links are Home, Features, About, Blog, Tutorials, Pricing, Contact and
Get Started; footer also exposes Guides, policies and articles. `/faq` is a
supplied accessible route, not a top-level link observed in that header.
Some pages include large SEO Q&A/comparison blocks before/after the visual
page. Heading geometry and the rendered feature screenshot distinguish these
from the visible hero and main sections; those blocks are not the layout model.

| Observed Librify pattern / visitor question | Lab Lords equivalent | Adaptation |
| --- | --- | --- |
| [Home](https://www.librify.in/): product hero → metrics → feature grid → benefits → four setup steps → reviews → FAQ → signup; how does this help? | Complete overview on `/` | Preserve labelled synthetic examples; no borrowed metrics/reviews; detailed feature/pricing destinations |
| [Features](https://www.librify.in/features): introduction and signup/pricing → nine detailed capability groups with subfeatures and plan badges → feature FAQ → guides → signup | `/features` | Use public Lab Lords capabilities, examples and source-derived plan notes; setup and solution crosslinks replace absent video guides |
| [Pricing](https://www.librify.in/pricing): intro → billing switch and plan cards → premium feature explanations → FAQ → comparison → signup/contact | `/pricing` | Basic/Standard monthly per-branch catalogue, comparison, lifecycle and policy links; no seat pricing, free plan or annual discounts |
| [About](https://www.librify.in/about-us): product purpose → adoption metrics → mission/goal → founders → trial | `/about` | Product purpose and audiences only; no invented biography, staff, adoption or uptime |
| [Contact](https://www.librify.in/contact-us): welcoming intro → enquiry form → trial/contact CTA | `/contact` plus separate `/support` | Configured email draft, visible address and fallback; no fictitious form delivery |
| [FAQ](https://www.librify.in/faq): topic jump links → grouped accordions → support/trial | `/faq` | Six useful groups, shared factual answers and next links; no repetitive local SEO questions |
| [Tutorials](https://www.librify.in/tutorials): intro/language options → substantial video cards with detail/watch links → signup | `/how-it-works` and support | Written walkthrough matching real onboarding; no invented videos or claim of an equivalent Librify standalone setup route |

This is a structural observation, not evidence of conversion performance or
access to Librify strategy. No reference prices, copy, assets or claims are reused.

## Claims and boundaries

| Claim | Evidence and publication decision |
| --- | --- |
| Public Basic/Standard amounts and inclusions | `lib/billingPlans.ts`, `publicBillingPlans()`; active visible public catalogue is reused at render time. Internal `PRO` remains Standard. Hidden plans and WhatsApp entitlement are not advertised. |
| 30-day Standard trial, once per eligible owner; shared deadline | `services/ownerTrial.service.ts`, `services/onboarding.service.ts`, `docs/domain-invariants.md`; begins on completed first setup, not merely signup. No card during onboarding. |
| Plan selection does not charge; owner separately authorizes subscription | `app/onboarding/page.tsx` steps 3–4, existing billing routing helpers and services; no checkout behavior changed. |
| Trial end without subscription means read-only access | `lib/billingState.ts`, domain invariants; avoid guaranteeing feature availability after paid access ends. |
| Each billable branch contributes to monthly cost | Public catalogue and billing service; estimates explicitly exclude tax and are not checkout quotes. No claim of immediate proration/archival credits. |
| Cancellation, refund window and activation support | Existing Terms, Refund and Shipping/Delivery policy pages. Preserve their exact substance/dates; links point to authoritative terms. One-business-day normal response applies to documented billing/activation issues, not an invented general SLA. |
| Onboarding order | `app/onboarding/page.tsx`: organization → first branch with seats/shifts → plan → import/clean starting point and confirmation. Student import follows setup. |
| Students, shift allocations, basic fee records, staff, analytics, AI drafts | Public catalogue, existing live public product descriptions and corresponding protected routes/services. AI remains advisory and reviewable, not delivery or autonomous financial action. |
| New receipts, renewals follow-up and attendance | `docs/ai/current-state.md` explicitly records local implementation, not deployment evidence. Do not expand public promises from that code alone. Existing broad fee-record descriptions retained; newer modules omitted pending release confirmation. |
| Interface languages | `lib/i18n/language.ts` has English, Hindi and Hinglish; current-state says local implementation only. Public FAQ directs visitors to confirm their language needs without claiming universal release or full translation. |
| Email contact/report | `siteConfig`, `BugReportForm`; opens a draft in the visitor's email app. No message sent by website, no ticket creation. No messages submitted in verification. |
| Privacy and synthetic evidence | Existing privacy policy is linked, no added backup/encryption/compliance guarantees. Existing sample dashboards remain labelled and never read tenant records. |

Only public presentation, content, metadata and navigation are affected. No
authorization, tenancy, billing entitlement, financial history or service
mutation changes. Validation uses isolated unit fixtures, browser checks of
public pages and development Clerk keys; the preview helper replaces database
URLs with an unreachable local target and disables provider secrets.

## Verification and handoff

### Final route map

| Before | After |
| --- | --- |
| 17 local public sitemap routes | 20 public routes, all observed HTTP 200 at desktop and mobile widths |
| Home with full plan inclusions | Substantial Home with six feature links, benefits, two labelled examples, setup summary, concise plan introduction and shared FAQ subset |
| `/features` with short groups | Eight groups with specific daily-work examples, source-derived plan notes, setup/solution links and feature FAQ |
| `/pricing` with cards and generic FAQ | Catalogue cards, comparison table, branch-cost estimate, trial lifecycle, cancellation/activation links and pricing FAQ |
| Setup and FAQ on Home only | `/how-it-works` and grouped `/faq`, linked from primary navigation/resources/footer |
| No About route | `/about` with factual product focus and four audiences |
| Overlapping Contact/Support | `/contact` for fit/plans/setup; `/support` for existing users, practical help and honest email-draft reporting |
| Seven solution routes | Same seven canonical routes and SEO titles, each with a distinct illustrative example and relevant crosslinks |
| Five policy routes | Same wording and dates; added page-specific Open Graph/Twitter metadata |

Legacy Home fragments `#features`, `#platform`, `#pricing`, `#workflow`,
`#how-it-works`, `#product-tour`, `#faqs`, `#get-started` and `#software` remain.
No replacement route family or redirect is necessary.

### Files and factual corrections

- Added `app/about/page.tsx`, `app/faq/page.tsx`, `app/how-it-works/page.tsx`.
- Expanded `app/page.tsx`, `app/features/page.tsx`, `app/pricing/page.tsx`,
  `app/contact/page.tsx`, `app/support/page.tsx`; added sitemap entries.
- Added `lib/publicFaqs.ts`, `lib/publicMetadata.ts`,
  `components/landing/PublicFaqList.tsx` and `PublicPageSections.tsx`.
- Updated `ReferenceNavbar`, `LandingFooter`, `LandingPricing`,
  `SoftwareLandingPage`, `lib/softwarePages.ts` and the two existing public
  presentation stylesheets. Added native required/length validation to the
  existing `BugReportForm`; email draft semantics and localization remain.
- Policy pages gained sharing metadata only. Root search keywords now describe
  library management rather than implying a full education ERP.
- Explicitly separated student fees from software billing; corrected trial
  start/end and separate paid authorization messaging; retained `PRO` internally
  as public Standard. Removed newer follow-up note/date promises without public
  release evidence. No fabricated proof or automated-message-delivery claims.
- Added `tests/unit/pages/public-site.test.tsx`,
  `tests/unit/components/BugReportForm.test.tsx` and
  `tests/browser/public-site.spec.ts`; updated existing public route tests and
  two reviewed homepage screenshots.

### Exact validation commands and results

The local ignored `botanical-run.mjs` helper calls the documented
`scripts/pnpm.mjs` launcher with test Clerk credentials, disabled provider
secrets and unreachable local database URLs. No saved environment file changed.

```powershell
node scripts/pnpm.mjs agent:doctor
node scripts/pnpm.mjs test:unit tests/unit/components/MarketingActions.test.tsx tests/unit/components/BugReportForm.test.tsx tests/unit/lib/billingPlans.test.ts tests/unit/lib/site.test.ts tests/unit/lib/softwarePages.test.ts tests/unit/pages/razorpay-review-pages.test.tsx tests/unit/pages/public-site.test.tsx tests/unit/proxy.test.ts
node scripts/pnpm.mjs lint
node .agent/botanical-run.mjs build
node .agent/botanical-run.mjs start --hostname localhost --port 3101
$env:BOTANICAL_PREVIEW_URL='http://localhost:3101'
node .agent/botanical-run.mjs exec playwright test tests/browser/public-billing.spec.ts tests/browser/public-site.spec.ts --grep-invert 'public landing visual regression'
node .agent/botanical-run.mjs exec playwright test tests/browser/public-site.spec.ts --grep 'every public destination' --output .agent/public-site/metadata-recheck
node .agent/botanical-run.mjs exec playwright test tests/browser/public-billing.spec.ts --project mobile-chromium --grep '/features stays accessible' --output .agent/public-site/mobile-recheck
node .agent/botanical-run.mjs exec playwright test tests/browser/public-billing.spec.ts --grep 'public landing visual regression' --update-snapshots --output .agent/public-site/visual-review
node .agent/botanical-run.mjs exec playwright test tests/browser/public-billing.spec.ts --grep 'public landing visual regression' --output .agent/public-site/visual-recheck
node .agent/public-site-capture.mjs before
node .agent/public-site-capture.mjs after http://localhost:3101
node .agent/check-public-scope.mjs
git -c core.safecrlf=false diff --check
```

- Doctor: ready; existing dirty checkout noted, no Docker required.
- Unit: **79 passed, 8 files**; no database integration setup.
- Lint: **0 errors**, two existing unused-disable warnings in generated workflow
  output and `coverage/block-navigation.js`. Initial new native-fragment-link
  lint errors were fixed with a narrowly documented exception.
- Build: **passed**, 48 generated static pages and both import workflow manifests
  verified. All three new marketing pages are statically rendered.
- Main browser run: **114 passed / 116**, with two resolved failures. One new
  metadata assertion did not normalize the homepage's optional trailing slash;
  both desktop/mobile metadata reruns passed after fixing the assertion. One
  mobile Features navigation received `ERR_NETWORK_IO_SUSPENDED`; its isolated
  rerun passed unchanged. Thus all **116 functional/accessibility cases** have
  passing evidence. No application change was required for either failure.
- Two visual snapshots refreshed **after visual comparison**, then checked in
  a normal run without updates. They document intended composition changes,
  not an assumption of renewed design approval.
- Capture: 34 before observations and 40 after observations, **no non-200 routes
  or horizontal overflow**. Final captures cover all 20 pages at 1440px and 390px.
- Scope hash check: locked homepage stylesheet, font definition, logo and
  botanical image match the pre-edit baseline byte-for-byte. All five policy
  files also match after removing only the added sharing metadata.
- Diff check: **passed**. No service, Prisma, billing catalogue/flow or proxy diffs.

Browser coverage includes keyboard disclosures/accordions, active links,
outside-click and Escape dismissal, history, cross-page sticky-header fragments,
320px reflow and 400% browser-style zoom, reduced motion, font/image loading,
serious/critical Axe checks, distinct metadata, all internal destinations,
signed-out signup/selected-plan continuation, auth protection and honest
email-draft validation. Signed-in routing uses isolated unit fixtures. No real
account created, contact message sent or payment attempted. Development pages
were also inspected in the browser without runtime errors or error overlays.

### Screenshots

Local full-page review artifacts (not committed binaries except the two existing
homepage test snapshots):

| Page | Desktop | Mobile |
| --- | --- | --- |
| Home | [1440px](../../.agent/public-site/after/home-1440.png) | [390px](../../.agent/public-site/after/home-390.png) |
| Features | [1440px](../../.agent/public-site/after/-features-1440.png) | [390px](../../.agent/public-site/after/-features-390.png) |
| Pricing | [1440px](../../.agent/public-site/after/-pricing-1440.png) | [390px](../../.agent/public-site/after/-pricing-390.png) |
| How it works | [1440px](../../.agent/public-site/after/-how-it-works-1440.png) | [390px](../../.agent/public-site/after/-how-it-works-390.png) |
| About | [1440px](../../.agent/public-site/after/-about-1440.png) | [390px](../../.agent/public-site/after/-about-390.png) |
| FAQ | [1440px](../../.agent/public-site/after/-faq-1440.png) | [390px](../../.agent/public-site/after/-faq-390.png) |
| Contact | [1440px](../../.agent/public-site/after/-contact-1440.png) | [390px](../../.agent/public-site/after/-contact-390.png) |
| Support | [1440px](../../.agent/public-site/after/-support-1440.png) | [390px](../../.agent/public-site/after/-support-390.png) |
| Study halls | [1440px](../../.agent/public-site/after/-software-study-hall-management-1440.png) | [390px](../../.agent/public-site/after/-software-study-hall-management-390.png) |
| Reading libraries | [1440px](../../.agent/public-site/after/-software-library-management-1440.png) | [390px](../../.agent/public-site/after/-software-library-management-390.png) |
| Seats | [1440px](../../.agent/public-site/after/-software-seat-management-1440.png) | [390px](../../.agent/public-site/after/-software-seat-management-390.png) |
| Student fees | [1440px](../../.agent/public-site/after/-software-student-fee-management-1440.png) | [390px](../../.agent/public-site/after/-software-student-fee-management-390.png) |
| Fee follow-up | [1440px](../../.agent/public-site/after/-software-fee-reminder-1440.png) | [390px](../../.agent/public-site/after/-software-fee-reminder-390.png) |
| Coaching | [1440px](../../.agent/public-site/after/-software-coaching-management-1440.png) | [390px](../../.agent/public-site/after/-software-coaching-management-390.png) |
| Tuition | [1440px](../../.agent/public-site/after/-software-tuition-management-1440.png) | [390px](../../.agent/public-site/after/-software-tuition-management-390.png) |

[Mobile menu](../../.agent/public-site/after/mobile-menu-390.png),
[before Home desktop](../../.agent/public-site/before/home-1440.png),
[before Home mobile](../../.agent/public-site/before/home-390.png),
[final route observations](../../.agent/public-site/after/inventory.json),
[policy/asset hash verification](../../.agent/public-site/scope-check.json).

### Remaining evidence gaps and unchanged areas

Live sitemap XML remained inaccessible to the audit tools. Public release
confirmation is still needed before promoting attendance, newer receipt/renewal
modules, WhatsApp delivery or complete language availability. No verified
customer proof or owner biography was supplied, so none was invented. The
configured address fallback remains "Business address available on request".
Email delivery depends on the visitor's email app and sending the draft; a
visible address and manual-copy fallback are provided.

No policy substance/date, app redesign, business service, entitlement,
authorization/tenancy boundary, schema, migration, provider configuration,
dependency version or saved environment change. Local commits were authorized
separately; no push or deployment.
The built local preview is available at `http://localhost:3101/`.

Rollback is limited to this task's public routes, content, navigation, metadata,
presentation and associated tests. Do not reset the working tree: it includes
approved earlier design work and unrelated user tooling changes.
