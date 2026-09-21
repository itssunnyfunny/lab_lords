# Public, interface and document languages

English (`en`), Hindi (`hi`) and Hinglish (`hinglish`) are personal presentation
preferences. New and existing users default to English. The labels in the
selector are **English**, **हिंदी** and **Hinglish**.

`User.interfaceLanguage` controls application-owned screen copy.
`User.documentLanguage` independently controls fee receipt screens, summaries,
PDFs and the existing printable/downloadable AI report template. Both are
validated by the existing authenticated `/api/users/me` preference API and by
database check constraints. Language controls are available in personal settings,
the application shell and dialogs, including when a branch is read-only.

Communication preferences, approved provider templates, consent and delivery
settings retain their existing semantics. In particular, the legacy AI drafting
path interprets `MessageLanguage.hi` as Roman Hindi, while the manual-reminder
path's `HI` produces Devanagari Hindi. The shared legacy default is labelled and
explained accordingly; interface changes never write it. WhatsApp's managed
template language values retain their separate provider meanings.

The standalone AI Messages page and its generation-only controls are excluded
from this change because retirement is planned separately. No AI code or stored
drafts are removed. AI reports and import assistance remain supported.

## Translation boundaries

Feature catalogs live in `lib/i18n`. English source messages are typed keys;
Hindi and Hinglish entries use matching named placeholders. `useTranslation()`
selects interface copy, while `useTranslation("document")` selects output copy.
Use `t.owned()` only for known application labels and enum display values. Never
pass names, notes, identifiers, references, uploaded cells or stored AI prose to
it. Interpolation inserts a value once, without interpreting braces inside it.

Errors are classified and retried using their original codes/messages. The
rendering boundary recognizes catalogued errors and bounded validation patterns;
unknown exceptions receive a safe localized fallback. Collection and attendance
uncertainty retain their explicit same-request recovery messages and commands.
Missing application labels fall back to English rather than a raw internal key.

The Clerk identity keys the preference provider. A language change does not key
or remount forms. Preference update events carry their originating identity, and
late fetches or saves cannot apply another user's preferences. Date, number and
timezone formatters do not depend on display language. HTML language tags are
`en-IN`, `hi-IN` and `hi-Latn-IN`; the value `hinglish` is never passed to Intl.

Receipt output uses the original immutable snapshot and the existing canvas/jsPDF
renderer. It never creates a receipt, recalculates historical balances or changes
VOID status. Noto Sans Devanagari is bundled through the existing Next font setup;
canvas waits for fonts and wraps at grapheme boundaries. Downloaded HTML reports
retain their existing system-font fallback. Stored AI prose remains in the
language in which it was generated. Clerk/Razorpay-hosted screens are still
provider-controlled; this does not claim hosted Hinglish support.

## Starting glossary

| English | Hindi | Hinglish |
| --- | --- | --- |
| Pending fee | बकाया फीस | Pending fee |
| Collect fee | फीस दर्ज करें | Payment record karein |
| Amount received | मिले हुए पैसे | Mile hue paise |
| Remaining balance | बाकी फीस | Baaki fee |
| Next fee date | अगली फीस की तारीख | Agli fee ki date |
| Send reminder | रिमाइंडर भेजें | Reminder bhejein |
| Save follow-up | अगली बातचीत की जानकारी सेव करें | Follow-up save karein |
| Attendance | हाजिरी | Attendance |
| Mark Present | हाजिरी लगाएँ | Present mark karein |
| Not marked | अभी दर्ज नहीं | Abhi mark nahi hua |
| Download receipt | रसीद डाउनलोड करें | Receipt download karein |
| Try again | फिर कोशिश करें | Dobara try karein |

## Verification surfaces

See [implementation and verification results](localization-verification.md) for
commands, outcomes, browser evidence and release status.

- `tests/unit/lib/localization.test.ts`: catalog parameters, supported languages,
  safe error rendering, user-content preservation and immutable receipt facts.
- `tests/integration/services/user.test.ts`: persisted defaults, independent users
  and language purposes, unrelated profile updates and database constraints.
- `playwright.localization.config.ts` and `tests/localization-browser`: real
  admission, collection, renewal and attendance components rendered in an
  isolated browser fixture with intercepted APIs and synthetic data. This does
  not bypass Clerk or claim a live authenticated Next route was exercised.
- Existing accounting, attendance, import, settings and WhatsApp regressions are
  run against a fresh disposable local PostgreSQL container when available.

The authenticated localization release uses the normal migration-before-application
process described in `docs/production-runbook.md`. The public localization below
adds no migration, environment variables, provider messages or regeneration jobs.

## Public website languages

Public language is determined only by the URL. Existing unprefixed pages remain
English; `/hi` and `/hinglish` prefix the 13 current marketing destinations in
`lib/public-i18n/routes.ts`. There is no `/en` duplicate, automatic detection,
language cookie or account-setting write. The five policies remain English-only,
with explicit notices and link labels. The two retired solution notices remain
English and non-indexable. Neither group has translated copies or alternates.

The proxy retains Clerk protection and overwrites the internal public-language
and public-path request headers from that allowlist. Server-rendered pages and
the root HTML language use this sanitized request context. The localized route
reuses the existing page renderers, with a finite generated parameter list and
`dynamicParams = false`; unknown translated routes cannot render another page.
Request-scoped dictionary loading does not add a database or account lookup.

The former root loading boundary is scoped to application, invite, onboarding
and authentication segments, reusing `components/ui/RouteLoading.tsx`. Public
content can finish server rendering before the response starts, so it remains
readable without JavaScript and invalid localized paths return HTTP 404 instead
of a streamed 404 body with status 200. Private loading visuals are unchanged.

`UserPreferencesBoundary` passes the route locale into the existing preference
provider. Its single HTML-language effect uses that public locale when present,
otherwise the account's `interfaceLanguage`. Late profile reads and identity
changes cannot override a public URL. Protected application copy, document
language, communication language and formatting preferences keep their existing
owners. Both initial and hydrated markup use `en-IN`, `hi-IN` or `hi-Latn-IN`.
Only Hindi uses Noto Sans Devanagari styling; Hinglish retains the Latin fonts.

`lib/public-i18n/catalog.ts` contains prepared translations keyed by approved
English source text. The server loads only the requested language. Interactive
boundaries receive common control strings plus the home or support messages
needed by that route, rather than the complete catalog. The persistent consent
interface has a separate small catalog and selects it from the public URL; its
choices and storage behavior are unchanged. There is no translation service.

Public links use the shared route map. Language links retain equivalent paths,
stable fragment IDs and the existing `billingPlan=BASIC|PRO` selection, dropping
unknown, redirect and personal query parameters. Auth, billing, API, assets,
external and mailto destinations are never prefixed. Public Support drafts live
in the root `PublicDraftProvider` only in memory across client navigation; they
are never saved to browser storage, cookies or URLs. Email drafts translate owned
labels while preserving entered text, and still require the visitor to send the
email. Refreshing or closing the tab clears an unsent in-memory draft.

## Maintaining public translations

1. Change approved English only when a factual correction or requested feature
   requires it. Translate complete sentences, using typed named placeholders for
   dynamic values and `publicRich` for React elements; never interpolate HTML.
2. Add both translations and the required-key entry. Keep interactive messages
   in the applicable `ui-keys.ts` group, and add source/behavior coverage where
   a new content source or interaction needs it. Required keys may not fall back;
   unexpected runtime messages defensively retain readable English.
3. Keep prices, plan IDs/inclusions and proof amounts in their existing source
   catalogs. Do not translate names, visitor content or stored AI text. Original
   approved quotes retain their own language annotation.
4. Add a translated destination to the central map only after its content is
   complete. The map owns route validation, links, HTML language alternates and
   the sitemap. Policies and retired URLs must not be multiplied automatically.
5. Preserve self-referencing canonicals and reciprocal `en-IN`, `hi-IN`,
   `hi-Latn-IN`, `x-default` HTML alternates. This is the only alternate-link
   strategy; the sitemap lists URLs without duplicating alternate metadata.
   Locale-specific sharing images use the approved brand template in
   `public/public-social`; inspect Hindi glyphs and the built HTML metadata after
   any change, because file-based Next metadata can take precedence.
6. Run public catalog/site/proof/action tests, account-localization fixtures,
   multilingual built-preview browser tests, lint and a production build. Review
   desktop and narrow-phone screenshots before accepting visual baseline updates.

See [the public localization report](redesign/public-localization.md) for the
route matrix, translations, evidence, commands and human-review status. Current
[Google alternate-language guidance](https://developers.google.com/search/docs/specialty/international/localized-versions)
permits an ISO 15924 script subtag with a regional subtag; `hi-Latn-IN` identifies
the Latin-script Hindi version without conflating it with `hi-IN`.
