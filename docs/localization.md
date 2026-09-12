# Interface and document languages

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

No runtime translation service, language routes, new environment variables,
provider messages or regeneration jobs are introduced. Release uses the normal
migration-before-application process described in `docs/production-runbook.md`.
