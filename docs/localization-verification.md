# Localization implementation and verification — 2026-09-12

## Delivered locally

English, Hindi and Hinglish personal interface preferences, plus an independent
receipt/report language preference, use the existing authenticated user settings
API. Both new profile fields default to English. Language controls are available
in account settings, the shell and dialogs; branch writability does not gate
personal preferences. Formatting and communication preferences remain separate.

Translated areas include navigation, admission/student editing, seats, shifts,
allocations, staff, payments and collection corrections, receipt actions,
renewals/follow-ups, attendance/QR/history, analytics, imports, branch/organization
settings, subscription outcomes, WhatsApp automation/consent/delivery/reminders,
manual copy/share controls and application-owned auth/invite wrappers.

The standalone AI Messages page and generation-only controls are excluded. No
AI code or stored drafts were removed. AI reports and import assistance remain
in scope. Provider templates, communication language mappings and stored AI
prose are unchanged. Clerk/Razorpay hosted screens remain provider-controlled;
this implementation does not claim hosted Hinglish support. Signed-out users
receive English defaults rather than another user's cached preference.

## Main files

- `lib/i18n/`: typed, feature-grouped catalogs and presentation/error helpers.
- `components/settings/{UserPreferencesApplier,UserPreferencesBoundary,LanguageControls,LocalizedText}.tsx`:
  identity-scoped preference loading, saving, language selection and rendering.
- `services/user.service.ts`, `types/settings.ts`, `prisma/schema.prisma` and
  `prisma/migrations/20260912120000_user_display_languages/migration.sql`:
  validated additive user preferences; no financial or message history changes.
- `app/layout.tsx`, `app/globals.css`, application pages and shared UI components:
  provider placement, valid language tags, Devanagari font, wrapping and labels.
- `components/{payments,renewals,attendance,whatsapp,billing,layout}/`, operational
  pages under `app/{account,branch,org,onboarding,invite}/`, and auth wrappers:
  translated controls, complete messages and safe display errors. Business
  commands, access checks and payload meanings retain their existing behavior.
- `lib/feeReceiptPdf.ts` and `app/branch/[branchId]/ai/reports/page.tsx`:
  explicit output language; original receipt snapshots and stored report prose.
- `lib/branchNotifications.ts`, dashboard and chart components: translated
  structured descriptions while preserving notification identity and links.
- `tests/unit/lib/localization.test.ts`, `tests/unit/lib/branchNotifications.test.ts`,
  `tests/integration/services/user.test.ts`, `tests/localization-browser/`,
  `playwright.localization.config.ts`, `vitest.config.ts`: verification below.
- `docs/localization.md`, `docs/domain-invariants.md`, `docs/ai/current-state.md`,
  `docs/production-runbook.md`: glossary, boundaries, current state and release.

Existing uncommitted documentation/reset artifacts were preserved. Temporary
translation-authoring scripts were removed. Dependencies and environment files
were not changed.

## Commands and results

Commands ran from the repository root. Direct tool entry points below are
equivalent to the repository pnpm scripts and avoid this Windows installation's
intermittent executable-shim failures.

| Command | Result |
| --- | --- |
| `pnpm exec node node_modules/prisma/build/index.js generate` | Passed, Prisma client generated. |
| `pnpm exec node node_modules/prisma/build/index.js migrate deploy` | Passed; all 52 migrations applied to a new disposable local database, including display languages. |
| `pnpm exec node node_modules/vitest/vitest.mjs run --coverage --reporter=dot` | Full unit/integration suite and coverage thresholds passed. Lines 72.81%, functions 82.8%, statements 69.81%, branches 63.07%. |
| `pnpm exec node node_modules/vitest/vitest.mjs run tests/integration/services/user.test.ts` | 4 passed, including the 2 new preference persistence/constraint cases. |
| `pnpm exec node node_modules/vitest/vitest.mjs run tests/unit/lib/localization.test.ts tests/unit/lib/branchNotifications.test.ts tests/unit/components/whatsapp-collections-ui.test.tsx tests/unit/components/AppSelect.test.tsx tests/unit/components/MainChart.test.ts tests/unit/components/CheckoutConfirmationDialog.test.ts` | 30 passed across 6 files. |
| `pnpm exec node node_modules/@playwright/test/cli.js test --config playwright.localization.config.ts` | 12 passed: 6 scenarios on desktop and mobile. |
| `pnpm exec node node_modules/vitest/vitest.mjs run --config vitest.workflow.config.ts` | 1 workflow test passed. |
| `pnpm exec tsc --noEmit` | Passed. |
| `pnpm lint` | Passed, 0 errors; existing unused-disable warning in generated workflow route. |
| `pnpm build` | Passed, including static generation and verification of 2 import workflows. |
| `git -c core.safecrlf=false diff --check` | Passed. |

The full suite was run with coverage enabled, which executes the same tests as
`pnpm test` and also enforces the repository's coverage thresholds. Earlier
checks found missing English plural/validation copy, one missing conjunction
and a React compiler dependency issue; these were corrected and affected checks
rerun successfully.

Database commands used a newly created PostgreSQL 15 container on
`127.0.0.1:55487/localization_test`, with an explicit matching reset confirmation
and tmpfs storage. The container was stopped and automatically removed after
verification. No shared, Preview or Production database was used. Builds
used a deliberately unreachable loopback database URL and an empty process-only
Accelerate override; no environment files changed. The build needed sandbox
escalation for the existing workflow bundler's parent-directory access.

## Browser and visual evidence

The browser fixture renders the real admission, collection, renewal and attendance
components with synthetic API responses. It does not bypass Clerk and is not a
claim of authenticated Next-route end-to-end testing.

The 12 checks cover:

- A late preference save arriving after switching users, including refresh.
- Independent per-user screen/document choices and unchanged message defaults.
- Hindi admission validation, then Hinglish submission with entered values intact.
- Full collection and partial collection, preserving the uncertain request's
  payload/idempotency key and recording one collection across retry.
- Follow-up and attendance notes surviving a language change, including the
  attendance same-command retry.
- Independent Hindi receipt selection and PDF download without another collection.

Desktop/mobile collection, attendance and follow-up screenshots were inspected.
The generated Hindi PDF was rendered with Poppler and inspected: Devanagari is
readable, amounts/references/names/notes are preserved, and combined characters
are not split. Unit tests also preserve VOID and immutable receipt facts in all
three document languages. Evidence is in ignored `test-results/`; rerunning
Playwright regenerates it.

## Release status and limits

### Release review — 2026-09-12

Review confirmed personal identity scoping, independent message/document choices,
immutable receipt facts and unchanged retry payloads. Vitest only excludes the
new Playwright fixture directory; existing test discovery and coverage thresholds
are unchanged. The Hindi/Hinglish review preserves pending/expected/waived fees,
payment correction versus refund, and Present versus recorded open visits.

Fixed an initial-profile loading race: a screen-language save no longer discards
the other preferences returned by an older in-flight GET. The browser regression
asserts the saved screen choice and the fetched document/locale/timezone/date
settings all survive. Also localized account-load failures and missing-name/phone
fallbacks, and clarified that an open attendance visit means checkout has not
been recorded. The focused browser suite now passes 14 desktop/mobile checks.

`prisma/preflight/display-languages.sql` provides the aggregate-only read-only
pre/post migration inventory. Dispatch the existing protected migration workflow
at the reviewed feature ref before merging to automatically deployed main.
Verify the two default-English columns/checks and unchanged retained record
fingerprints. No new Preview database or deployment setting is required.

The following paragraph records initial implementation status; the release task
reports subsequent commit, CI, migration, deployment and real-session smoke
evidence separately.

This is an uncommitted local implementation. No branch, commit, push, PR or
deployment was created. Apply the additive display-language migration through
the normal migration-before-application release process. No new environment
variables, flags, service, cron or provider-template changes are required.
Rollback can restore the previous application while retaining both additive
columns and saved preferences; do not delete historical financial or messaging
records.

Browser coverage uses real components with mocked transport, not a signed-in
staging deployment. Public marketing/legal content, provider-hosted UI, names,
notes, uploaded content and existing AI prose intentionally retain their own
language. Downloaded standalone HTML reports retain their system-font fallback.
