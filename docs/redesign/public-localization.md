# Public website localization

Implementation and local verification, 21 September 2026. Work began on
`codex/botanical-public-pages` at `22bdb52`. After that website PR merged, the
owner authorized focused commits and a separate PR on
`codex/public-website-languages`, based on `main` at `831bd8c` (the same source
tree as `22bdb52`). This report describes local verification, not a deployment
or independent human translation review.

### Language dropdown follow-up

The public header now has one 44px circular language control on desktop and
mobile. It opens English, हिंदी and Hinglish with the current language checked.
It supports Tab, Enter, Escape and outside-click dismissal, and opening it closes
the other header menu. Existing wording, language URLs, plan choices, anchors,
support drafts and account preferences retain their previous behavior.

This replaces the extra desktop language row and the language links inside the
mobile navigation. Header height is back to 98px desktop / 76px mobile, so the
temporary 160px desktop anchor offset was removed. The screenshot evidence and
41px height increase described below refer to the earlier inline-link version.
The existing two homepage regression baselines now show the circular control.
Current open-dropdown screenshots: [desktop](public-localization-evidence/language-dropdown-desktop.png)
and [mobile](public-localization-evidence/language-dropdown-mobile.png).

Changed files: `PublicLanguageLinks.tsx`, `ReferenceNavbar.tsx`,
`styles/public-languages.css`, the existing browser language-link helper, the
two homepage screenshot baselines and this note. No copy, schema, migrations,
dependencies, saved environments or deployment settings changed.

Follow-up validation:

- `node .agent/botanical-run.mjs build`: passed, including TypeScript and both
  import-workflow manifest checks.
- `node scripts/pnpm.mjs lint`: passed with the same two existing warnings.
- `node .agent/botanical-run.mjs test:browser tests/browser/public-localization.spec.ts tests/browser/public-site.spec.ts tests/browser/public-billing.spec.ts --grep 'language links preserve|desktop Resources|mobile landing navigation|FAQ topics|tablet navigation'`:
  10 passed against `BOTANICAL_PREVIEW_URL=http://localhost:3101`.
- `node .agent/language-dropdown-check.mjs`: all three languages passed at
  320, 390, 1024 and 1440px, including keyboard, menu dismissal and overflow
  checks. Open-header Axe checks at 390/1440px found no serious or critical
  violations; no browser runtime errors occurred.
- `node .agent/botanical-run.mjs test:browser tests/browser/public-billing.spec.ts --grep 'visual regression'`:
  2 passed after the reviewed baseline update, without `--update-snapshots`.
- `git -c core.safecrlf=false diff --check`: passed.

## Result and boundaries

The approved website uses the same renderers in English, Hindi and Hinglish.
The URL selects its language, including the initial HTML. Public language links
do not save account, document or communication preferences. Navigation stays in
the selected language, with equivalent-page language links and stable anchors.
Existing `billingPlan=BASIC|PRO` choices survive switching; unrelated query
parameters do not. Signup and billing destinations keep their existing URLs.

All 13 active marketing pages have prepared translations, including pricing,
FAQ answers, solution pages, example labels, accessible controls, consent labels
and support validation. Public support drafts survive client language navigation
in memory. Email actions still open a draft for the visitor to review and send.
Names and entered content are not translated or stored by the language controls.

The existing Basic/Standard catalogue supplies plan prices and inclusion facts.
The proof example still means ₹1,200 due, ₹700 recorded and ₹500 remaining; no
transfer or bank-verification claim is added. The homepage has no pricing section,
and its existing `#pricing` bookmark still reaches the footer Pricing link.

Five policies remain English, with clearly labelled links and an English-only
notice. Their wording, dates and meaning are unchanged. The two retired solution
notices remain English and non-indexable, without new alternates or sitemap URLs.

## Complete route matrix

All paths below have their own canonical and reciprocal `en-IN`, `hi-IN`,
`hi-Latn-IN` and `x-default` HTML alternates. `x-default` points to the equivalent
English page. The canonical origin remains `https://lablords.in`.

| Page | English | Hindi | Hinglish |
| --- | --- | --- | --- |
| Home | `/` | `/hi` | `/hinglish` |
| Features | `/features` | `/hi/features` | `/hinglish/features` |
| Pricing | `/pricing` | `/hi/pricing` | `/hinglish/pricing` |
| How it works | `/how-it-works` | `/hi/how-it-works` | `/hinglish/how-it-works` |
| About | `/about` | `/hi/about` | `/hinglish/about` |
| FAQ | `/faq` | `/hi/faq` | `/hinglish/faq` |
| Contact | `/contact` | `/hi/contact` | `/hinglish/contact` |
| Support | `/support` | `/hi/support` | `/hinglish/support` |
| Study halls | `/software/study-hall-management` | `/hi/software/study-hall-management` | `/hinglish/software/study-hall-management` |
| Libraries | `/software/library-management` | `/hi/software/library-management` | `/hinglish/software/library-management` |
| Seats | `/software/seat-management` | `/hi/software/seat-management` | `/hinglish/software/seat-management` |
| Student fees | `/software/student-fee-management` | `/hi/software/student-fee-management` | `/hinglish/software/student-fee-management` |
| Fee reminders | `/software/fee-reminder` | `/hi/software/fee-reminder` | `/hinglish/software/fee-reminder` |

English-only indexable policies: `/privacy`, `/terms`, `/refund-policy`,
`/shipping-delivery-policy`, `/cookies`. The sitemap contains 39 translated
marketing destinations plus these five policies: **44 URLs**.

Retired, non-indexable English notices: `/software/coaching-management` and
`/software/tuition-management`. No `/en`, translated policy, translated retired
page or localized application/auth/API route is generated. Unknown localized
paths return HTTP 404.

## Translation samples and glossary

These samples come from the implemented catalog, not a separate proposed rewrite.

| Context | Approved English | Hindi | Hinglish |
| --- | --- | --- | --- |
| Hero | A simpler way to manage your library. | अपनी लाइब्रेरी चलाने का आसान तरीका। | Apni library manage karne ka aasaan tareeka. |
| Student feature | Keep student details, seat assignments and fee records together. | स्टूडेंट की जानकारी, तय सीट और फीस रिकॉर्ड साथ रखें। | Student ki jaankaari, assigned seats aur fee records saath rakhein. |
| Pricing/trial | Start with a 30-day Standard trial. Then choose the plan that fits your everyday work. | 30 दिन के Standard ट्रायल से शुरू करें। फिर रोज़ के काम के हिसाब से प्लान चुनें। | 30 din ke Standard trial se shuru karein. Phir roz ke kaam ke hisaab se plan chunein. |
| Card requirement | No card needed | कार्ड की ज़रूरत नहीं | Card ki zaroorat nahi |
| Contact action | Open email | ईमेल खोलें | Email kholein |
| Contact explanation | This opens a draft in your email app. Review it and send it yourself. If no email app opens, copy {email} into your preferred email service. | यह आपके ईमेल ऐप में ड्राफ्ट खोलता है। उसे जाँचकर खुद भेजें। ईमेल ऐप न खुले तो {email} को अपनी पसंद की ईमेल सेवा में कॉपी करें। | Yeh aapke email app mein draft kholta hai. Use check karke khud bhejein. Email app na khule to {email} ko apni pasand ki email service mein copy karein. |

| Recurring term | Hindi | Hinglish |
| --- | --- | --- |
| Library | लाइब्रेरी | library |
| Student management | स्टूडेंट मैनेजमेंट | Student management |
| Seats & shifts | सीट और शिफ्ट | Seats aur shifts |
| Fees & dues | फीस और बकाया | Fees aur bakaaya |
| Receipts | रसीदें | Receipts |
| Attendance | हाजिरी | Attendance |
| Remaining balance | बाकी फीस | Baaki fees |
| Reading rooms | रीडिंग रूम | Reading rooms |

Basic, Standard, Lab Lords, configured contact details, sample names, amounts and
identifiers are retained. Hindi uses the existing Noto Sans Devanagari font;
English and Hinglish retain the approved Latin fonts. Familiar product loanwords
remain in Hinglish. No customer quotes were fabricated or translated; the
approved production proof registry is still empty.

## Existing English wording changed

Only one existing factual clause was changed, in the language FAQ:

| Before | After | Reason |
| --- | --- | --- |
| “the public website is in English.” | “the public website has its own English, Hindi and Hinglish language links.” | The new public URL language choices make the old English-only statement inaccurate. The rest of the answer is preserved. |

New language-feature text consists of the selector's `Website language` accessible
label and `English / हिंदी / Hinglish` links; the notice `This policy is available
in English.`; translated `(English)` policy-link annotations; and explicit public
form validation messages (`Enter a short summary.`, `Enter at least 10 characters
describing the issue.`, `Enter a valid email address.`) so the selected website
language controls those messages instead of the browser's language.

Existing headings, descriptions, CTA labels, metadata, policy substance, product
claims and commercial rules otherwise retain their approved English wording.
React wrappers and named placeholders change how sentences are assembled, not
their English output. The root loading screen is reused unchanged on private and
authentication segments; public content no longer sits behind that JavaScript
dependent loading boundary.

## Files and maintenance

| Area | Files |
| --- | --- |
| Central public language map, prepared translations, typed placeholders and server context | `lib/public-i18n/{routes,translate,rich,server,catalog,ui-keys,consent,content,metadata}.ts(x)`, `required-keys.json` |
| Localized entry point | `app/[locale]/[[...path]]/page.tsx` reuses existing English page renderers |
| Existing pages | `app/page.tsx`, `app/{features,pricing,how-it-works,about,faq,contact,support}/page.tsx`, `app/software/[slug]/page.tsx` |
| Shared presentation and controls | `components/landing/{MarketingShell,ReferenceNavbar,PublicLanguageLinks,PublicLanguageProvider,PublicDraftProvider,MarketingActions,HomeReferencePreview,BotanicalDashboard,LandingFooter,LandingPricing,LibraryExample,LibraryPreview,PublicFaqList,PublicPageSections,PublicProofSection}.tsx`, `components/software/SoftwareLandingPage.tsx` |
| Forms, consent and policies | `components/feedback/BugReportForm.tsx`, `components/analytics/AnalyticsProvider.tsx`, `components/legal/LegalPage.tsx` |
| URL/account boundary and initial HTML | `proxy.ts`, `app/layout.tsx`, `components/settings/{UserPreferencesBoundary,UserPreferencesApplier}.tsx` |
| Loading boundary | Root `app/loading.tsx` moved into shared `components/ui/RouteLoading.tsx`, re-exported by loading files in account, app, branch, org, onboarding, invite, sign-in and sign-up segments |
| Styling | `styles/public-languages.css`, narrow Hindi-language-tag correction in `app/globals.css` |
| Discovery and copy | `lib/publicMetadata.ts`, `lib/publicFaqs.ts`, `app/sitemap.ts`, `public/public-social/{hi,hinglish}.png` |
| Verification | New public catalog/consent/browser tests and async render helper; existing public site/proof/action/bug-form tests and account-localization browser fixture updates; reviewed desktop/mobile homepage baselines |
| Documentation | `docs/localization.md`, appended public section in `docs/ai/current-state.md`, this report and screenshot evidence |

The existing working-tree tooling, workflow, runbook, package and agent-guidance
edits were preserved. They are not part of this localization implementation.
See [localization maintenance rules](../localization.md) for the single HTML-lang
owner, dictionary updates, safe navigation and metadata strategy.

## Screenshots and visual review

Built preview evidence uses 1440px desktop and 390px mobile widths, plus 320px
pricing/support and expanded Hindi FAQs. The images retain the approved layout,
illustrations, color palette and section order. Long translated text wraps;
Hindi shaping uses the bundled font. The Hindi hero underline was moved upward
within its existing decoration to avoid touching the next line.

| Language | Desktop | Mobile | Mobile menu |
| --- | --- | --- | --- |
| English | [Full page](public-localization-evidence/en-desktop.png) · [First screen](public-localization-evidence/en-desktop-first.png) | [Full page](public-localization-evidence/en-mobile.png) · [First screen](public-localization-evidence/en-mobile-first.png) | [Menu](public-localization-evidence/en-menu.png) |
| Hindi | [Full page](public-localization-evidence/hi-desktop.png) · [First screen](public-localization-evidence/hi-desktop-first.png) | [Full page](public-localization-evidence/hi-mobile.png) · [First screen](public-localization-evidence/hi-mobile-first.png) | [Menu](public-localization-evidence/hi-menu.png) |
| Hinglish | [Full page](public-localization-evidence/hinglish-desktop.png) · [First screen](public-localization-evidence/hinglish-desktop-first.png) | [Full page](public-localization-evidence/hinglish-mobile.png) · [First screen](public-localization-evidence/hinglish-mobile-first.png) | [Menu](public-localization-evidence/hinglish-menu.png) |

Additional evidence: [Hindi pricing at 320px](public-localization-evidence/hi-pricing-320.png),
[Hinglish pricing at 320px](public-localization-evidence/hinglish-pricing-320.png),
[Hindi support at 320px](public-localization-evidence/hi-support-320.png),
[expanded Hindi FAQs](public-localization-evidence/hi-faq-390.png),
[400% zoom checks](public-localization-evidence/visual-checks.json).
Localized sharing images use the existing approved template and readable fonts:
[Hindi](../../public/public-social/hi.png), [Hinglish](../../public/public-social/hinglish.png).

## Validation

| Command | Result |
| --- | --- |
| `node scripts/pnpm.mjs agent:doctor` | Passed: pinned Node 24.18.0, pnpm 10.34.5, CLI dependencies and Windows PATH. Dirty-checkout warning acknowledged; Docker intentionally not needed. |
| Focused unit command below | **103 passed**, 9 files. Includes 768-key/placeholder completeness, active solution and FAQ coverage, route/query rules, metadata/sitemap, proof facts, action routes, public email drafts, consent and existing localization regressions. |
| `node scripts/pnpm.mjs exec playwright test --config playwright.localization.config.ts` | **16 passed**, desktop/mobile isolated account fixtures. Includes delayed reads, identity changes, independent document/interface settings, retained drafts and existing collection/attendance retry semantics. |
| `node scripts/pnpm.mjs lint` | Passed, 0 errors. Two existing generated/coverage-file unused-disable warnings remain (`app/.well-known/workflow/v1/flow/route.js`, `coverage/block-navigation.js`). |
| `node .agent/botanical-run.mjs build` | Final production build passed, including TypeScript, 74 generated pages and the two import-workflow manifest checks. Marketing HTML is rendered on request. |
| `node .agent/botanical-run.mjs start --port 3101` | Built local preview running at `http://localhost:3101`. |
| Broad public browser command below | Initial broad run: **145 passed, 1 failed**, out of 146. The only failure was desktop anchor clearance beneath the new language row. Fixed in scoped CSS and verified by the final run below. All 108 existing nonvisual billing/brand/auth browser cases passed in this broad run. |
| `node .agent/botanical-run.mjs test:browser tests/browser/public-localization.spec.ts tests/browser/public-site.spec.ts` | Final build: **38 passed**, desktop/mobile. Includes all 39 initial-HTML/metadata URLs, 39 no-JavaScript destinations per browser project, URL/account boundaries, protected/unknown paths, draft retention, selected plans, 320/390/1440 layouts, keyboard tabs, form errors, Axe checks and corrected anchor clearance in all three languages. |
| Visual/metadata command below, without snapshot update | **4 passed**: two visual regressions and two expanded full-matrix Open Graph/Twitter checks. Both existing screenshot baselines were reviewed before the targeted update; no tolerance or overflow assertion was relaxed. Desktop height grows by 41px for language links; mobile full-page height is unchanged. |
| `node .agent/botanical-run.mjs test:browser tests/browser/public-billing.spec.ts --grep 'legacy homepage anchors\|old pricing bookmark' --output .agent/public-anchor-results` | **4 passed** on the final build: existing homepage section bookmarks and footer `#pricing` keyboard access, desktop/mobile. |
| `node .agent/public-capture.mjs` | Desktop/mobile evidence captured for all three languages, with no horizontal overflow in 15 representative 400% zoom checks or the three open mobile menus. Narrow pricing/support and expanded FAQ evidence also captured. |
| `git diff --check` | Passed. Git reports only repository line-ending normalization notices, without whitespace errors. |
| Local documentation-link check | Passed: 25 local links resolve. |

Focused unit command:

```powershell
node scripts/pnpm.mjs test:unit tests/unit/pages/public-site.test.tsx tests/unit/components/PublicProofSection.test.tsx tests/unit/components/MarketingActions.test.tsx tests/unit/components/BugReportForm.test.tsx tests/unit/components/PublicConsent.test.tsx tests/unit/proxy.test.ts tests/unit/lib/localization.test.ts tests/unit/lib/public-localization.test.ts tests/unit/theme-contract.test.ts
```

All built-preview browser commands use this child-process target (no saved
environment file was changed):

```powershell
$env:BOTANICAL_PREVIEW_URL='http://localhost:3101'
node .agent/botanical-run.mjs test:browser tests/browser/public-site.spec.ts tests/browser/public-billing.spec.ts tests/browser/public-localization.spec.ts --grep-invert 'visual regression'
node .agent/botanical-run.mjs test:browser tests/browser/public-billing.spec.ts tests/browser/public-localization.spec.ts --grep 'visual regression|all 39 language pages' --output .agent/public-final-results
```

The preview uses the existing ignored `.agent/botanical-run.mjs` wrapper, inspected
before use. It accepts only development Clerk keys, disables payment/messaging/AI
and analytics credentials for its child process, and targets an unreachable
loopback preview database. The unit launcher uses its unreachable disposable
unit-test URL. Account regression fixtures intercept APIs with synthetic data.
No real email, payment, provider message, production data access or account
preference mutation was performed during public-language switching.

The development Clerk preview logged refresh-loop warnings during rapid
anonymous navigation. The exercised sign-in/up forms, selected-plan continuations
and protected-route redirects passed. No Clerk keys or settings were changed.
Signed-in preference races were verified in isolated fixtures, not customer
sessions; the build and these local tests do not establish a production release.

Observed failures corrected during validation: missing interactive `Fees`
translation; a stale English-only destination assumption in the link checker;
root loading boundary producing hidden no-JavaScript content and streamed 200
responses for invalid paths; Hindi underline placement; and desktop anchor
spacing below the added language links. The metadata test
normalizes the equivalent existing homepage origin with/without a trailing slash,
preserving the existing canonical convention. No checks were weakened to accept
untranslated content, overflow or private-route exposure.

## Review, release and rollback

No required page is left with an empty dictionary or untranslated paragraph.
Automated key/placeholder checks and rendered-copy checks cover the route matrix.
Translations received an agent content/visual review, **not independent human
review**. Owner or fluent-speaker review of preferred everyday terminology is
still welcome; no deployment or public availability claim is made by this report.

This update requires no schema, migration, package-version, provider or saved
environment change. A later authorized release uses the existing deployment
process. Rollback is limited to the public dictionaries/routes/components,
metadata/assets/tests, and the necessary HTML-language/loading-boundary changes.
It must preserve the existing authenticated localization and approved redesign,
as well as unrelated changes already present in the working tree.
