# Library-only content refresh — 2026-09-21

Baseline: `cd20304`, branch `codex/botanical-public-pages`. The current implemented
site supplies wording and design; the supplied refresh brief supplies topics to
verify. The owner's later instruction to preserve accurate wording takes priority
over any suggestion in the brief to broadly rewrite it. Small local commits are
authorized; no push or deployment is authorized or performed.

Implementation commits: `fe7e78a` (audience and old URLs), `804b133` (released
feature content), `3c27e4b` (regression coverage). The documentation commit follows
these; unrelated owner tooling remains outside all four commits.

## Evidence and boundaries

- **Owner-confirmed availability:** collections/receipts, renewals/follow-ups and
  attendance at production baseline `c9a13d1`, as reported in this task.
- **Independent deployment evidence:** read-only Vercel metadata identifies
  `3007db3`, including localization `c4af748`, as a ready production deployment
  assigned to `lablords.in` and `www.lablords.in`. Earlier ready production records
  corroborate the three feature releases. This does not claim fresh authenticated
  production use, database inspection or a physical-device smoke test.
- **Remaining confirmation:** current Import V2 enablement and WhatsApp's separate
  delivery, automation, reports, notices and commercial rollout. No new promises
  or unavailable/coming-soon labels are published for those unresolved items.

See the [feature-to-claim matrix](../product/public-claims.md) for source files,
access rules, wording, pages, reviewed revisions and deployment evidence.

## Changed wording and factual reasons

Existing hero, section headings, CTA labels, original feature names and accurate
descriptions are retained except for the corrections listed here. New capability
cards and details use the existing section components. “Added” means the old page
did not explain that capability; it does not replace an accurate existing title.

| Where | Before → after / addition | Factual reason |
| --- | --- | --- |
| Home audience strip | “Reading libraries” → “Self-study libraries”; “Coaching centres” → “Reading rooms”; “Tuition centres” → “Study rooms” | Owner's current four target audiences; descriptions, icons and strip structure retained |
| Home audience line | “For study libraries, study halls, coaching and tuition centres.” → “For self-study libraries, study halls, reading rooms and study rooms.” | Same audience correction |
| Shared audience FAQ | “reading libraries, study halls, coaching centres and tuition centres” → “self-study libraries, study halls, reading rooms and study rooms” | Only audience names change; the rest of the answer stays intact |
| Site description / inherited SEO | “study halls, libraries, coaching centres, and tuition centres” → “self-study libraries, study halls, reading rooms, and study rooms” | Current audience; existing capability list retained |
| About metadata | “library, study-hall, coaching and tuition owners” → “self-study library, study-hall, reading-room and study-room owners” | Current audience; remaining sentence retained |
| About introduction | “libraries, study halls, coaching centres and tuition centres” → “self-study libraries, study halls, reading rooms and study rooms” | Current audience; heading and sentence structure retained |
| About cards | Same audience-title changes as Home; “as your centre grows” → “as your study room grows” | Remove outdated market labels without rewriting the descriptions; links reuse existing relevant routes |
| Contact | “a reading library, study hall, coaching centre or tuition centre” → “a self-study library, study hall, reading room or study room” | Current audience; question and rest of sentence retained |
| Features reports link | “For centres with branch records” → “For libraries with branch records” | Stop promoting an old audience route; example paragraph unchanged |
| Seat solution metadata | “study halls, reading rooms and coaching centres” → “study halls, reading rooms and study rooms” | Current audience only |
| Fee solution metadata | “study halls, libraries and coaching branches” → “study halls, libraries and reading rooms” | Current audience only |
| Reminder solution metadata | “study halls, libraries, coaching and tuition centres” → “study halls, libraries, reading rooms and study rooms” | Current audience only |
| Home Fees & dues | “Record payments and check how much each student has left to pay.” → “Record full or partial payments and check how much each student has left to pay.” | Verified partial collections; smallest added phrase |
| Features Record payments | “Enter received payments and check the remaining fee balance.” → “Enter a full or partial payment and check the remaining fee balance.” | Actual partial-payment behaviour; title retained |
| Student-fee solution Payment records | “Record received payments and their payment details.” → “Record full or partial payments and their payment details.” | Same verified collection behaviour |
| Home Receipts card — added | “Download a receipt for a recorded payment and find it again in the student's collection history.” | Immutable collection receipts and history retrieval were missing from the overview |
| Features Receipts — added | “Download or print a receipt for a recorded payment, and find it again in the student's collection history. Historical imported payments do not get a new receipt.” | Retrieval/printing supported; historical import resolutions do not generate receipt snapshots |
| Student-fee solution Payment history — extended | Added “Find its receipt again to download or print.” | Receipt retrieval; original title and sentence retained |
| Features Upcoming fees and follow-ups — added | “See today's fees, upcoming fee dates and pending amounts. Save a note, contact outcome and the next date to follow up. Expected fees stay separate from amounts already due; a follow-up date does not change the fee date.” | Verified renewal queue and saved follow-ups; projected amounts are not recorded debt |
| Reminder solution — extended | Added “Save a note, contact outcome and the next date to follow up.” and “Check upcoming fee dates separately from recorded dues.” | Expose saved follow-ups and expected/recorded distinction without replacing the headings |
| Home/Features Attendance — added | “Mark daily attendance and record check-in and check-out, with staff-assisted QR scanning.” | Owner-confirmed deployed attendance; scanner resolves a student, then requires explicit confirmation |
| Features attendance details — added | “Mark students present or absent, record check-in and check-out, and review their attendance history. A day without a mark stays unmarked.” / “Staff scan a student's QR code, check the displayed name and confirm check-in or check-out. If the camera is unavailable, find the student and record attendance manually.” | Mark/visit semantics, supervised confirmation and manual camera fallback |
| Features Corrections — added | “An owner or staff member with the required permission can correct a mark or visit with a reason. The history keeps the original record and the change.” | Corrections require branch-management permission and preserve audited originals |
| Attendance example — added | Student arrives; staff find/scan, check the name and confirm check-in; check-out on leaving; fees and seats unchanged | Simple illustration of verified workflow, not unattended self-check-in |
| Home/Features English, Hindi & Hinglish — added | “Choose your interface language, and set the receipt and report language separately.” | Independently verified localization deployment and separate saved preferences |
| Features language details — added | “Use the interface in English, Hindi or Hinglish. Each person chooses their own language, without changing saved names or notes.” / “Choose the language for receipt and report labels separately. Existing AI-written text and provider-hosted screens keep their own language; WhatsApp message language is a separate setting.” | Personal preferences and actual localization exclusions; no claim to translate everything |
| Language example — added | Hindi screen with English receipt labels, or Hinglish for both; other people's preferences and saved student details unchanged | Demonstrates independent interface/document choices |
| Existing language FAQ answer — corrected | “Tell us which language your team needs… confirm the current availability…” → “Use the interface in English, Hindi or Hinglish, and choose receipt and report language separately.” Plus personal/saved-content/provider/WhatsApp boundaries | Current customer deployment is now independently evidenced; question retained |
| Partial-payment FAQ — added | Choose the student's dues, enter received amount, record the rest later; “Choosing UPI as the payment method records how you received the money; it does not transfer or verify a bank payment.” | Collection allocation and no provider money movement |
| Receipt FAQ — added | Reopen collection history, download/print again; sharing depends on device and is not delivery proof; historical imports get no new receipt | Actual history and device-sharing boundaries |
| Follow-up FAQ — added | Today/upcoming/pending amounts, 3/7-day lookahead, notes/outcomes/next date; expected versus recorded dues; no fee-date or seat renewal | Verified renewal filters and advisory follow-up state |
| QR FAQ — added | Staff scan, check displayed name, confirm; “not unattended self-check-in or identity verification”; manual fallback; fees/seats unchanged | Exact scanner/service semantics |
| Pricing catalogue — added labels | “Full or partial payments and receipts”; “Upcoming fees and follow-up notes”; “Attendance and staff-assisted QR”; “English, Hindi and Hinglish preferences” | Existing capabilities have no additional premium entitlement; presentation matrix extended, runtime entitlements unchanged |
| Pricing explanation — added | “Both plans include full or partial payments, receipts, fee follow-ups, attendance and language preferences. Staff access still requires Standard, with the permissions needed for each task. Report language preferences do not add access to reports outside your plan.” | Avoid implying Basic grants staff accounts or that a language choice grants reports |
| How It Works daily step — extended | Added “Record full or partial payments, retrieve receipts, mark attendance and save the next date to follow up on fees.” / “Choose English, Hindi or Hinglish for your interface, and set receipt and report language separately.” | First useful released daily tasks; all six step headings and earlier wording retained |
| Old audience URLs — notice | “Looking for software for coaching centres?” / “…tuition centres?”; “Lab Lords now focuses on self-study libraries, study halls, reading rooms and study rooms in India.”; saved-link explanation and specific library/contact links | Intentional retirement from promotion; no false product promise or unrelated redirect |
| README / AGENTS / current-state purpose | Old coaching/tuition market descriptions → self-study libraries, study halls, reading rooms and study rooms | Current engineering orientation; historical records and engineering/security rules retained |

## Routing, scope and files

The two legacy audience routes remain HTTP 200 with self-canonicals and
`noindex, follow`; they no longer emit SoftwareApplication/FAQ structured data.
Footer and related-solution links use the five active solution routes. The sitemap
contains 18 destinations. All approved active page identities and fragments remain.
The existing social images contain no coaching/tuition claims and are retained.
Unused older landing components are not currently rendered and were not refactored.

Content changes are in `lib/marketingCopy.json`, `lib/publicFaqs.ts`, `lib/site.ts`,
`lib/softwarePages.ts`, HomeReferencePreview, About, Contact, Features, Pricing and
How It Works. The public display matrix is in `lib/billingPlans.ts`. Legacy routing
uses `app/software/[slug]/page.tsx`, `LegacyAudiencePage`, LandingFooter and sitemap.
Regression updates cover public-site/unit/browser checks, billing display and site
metadata. Documentation changes are README, AGENTS, current-state and these two
claims/change records. Unrelated owner tooling edits remain uncommitted.

No theme/style/font/artwork files, policy substance, service logic, schema,
migrations, environment files, provider settings or dependency versions changed.
No production operation, contact submission or message delivery was performed.
No migration or environment setting is required. Rollback is a revert of these
public-content commits; no data reversal is needed.

## Validation

- `node scripts/pnpm.mjs agent:doctor`: passed; existing dirty tooling reported,
  no Docker/database work needed.
- `node scripts/pnpm.mjs test:unit tests/unit/components/MarketingActions.test.tsx tests/unit/components/BugReportForm.test.tsx tests/unit/lib/billingPlans.test.ts tests/unit/lib/site.test.ts tests/unit/lib/softwarePages.test.ts tests/unit/pages/razorpay-review-pages.test.tsx tests/unit/pages/public-site.test.tsx tests/unit/proxy.test.ts`:
  **82 tests in 8 files passed**, using the isolated unreachable unit-test URL.
- `node scripts/pnpm.mjs lint`: **0 errors**; the two existing generated-file
  warnings plus an unused local capture-script binding. That new binding was
  removed; targeted ESLint on changed scripts/components/tests then passed.
- `node .agent/botanical-run.mjs build`: **passed**, including TypeScript,
  48 static pages and both import workflow manifests. The ignored wrapper uses
  development Clerk keys, unreachable loopback database URLs and disabled
  provider credentials; no saved environment change.
- `git -c core.safecrlf=false diff --check`: **passed**.
- `git diff --name-only -- services prisma styles public lib/billingFlow.ts lib/branchCapabilities.ts lib/publicMarketingFonts.ts app/privacy app/terms app/cookies app/refund-policy app/shipping-delivery-policy`:
  **empty**, confirming no changes to these business/design/policy surfaces.
- With `$env:BOTANICAL_PREVIEW_URL='http://localhost:3101'`, browser verification
  uses `node .agent/botanical-run.mjs exec playwright test` and the existing public
  test files. Initial functional run and the corrected-count rerun are recorded
  in the final validation note below. No application workaround was needed.
- `node .agent/content-refresh-capture.mjs before` / `after`, then
  `node .agent/content-refresh-review.mjs`: **12 desktop/mobile observations**
  retain identical main headings, font families, colours and backgrounds;
  all HTTP 200 with no horizontal overflow. Initial sandbox browser access was
  denied; the scoped localhost retry succeeded. The agent-browser CLI was not
  installed; verification used the repository's Playwright browser tooling.
- New unit/browser assertions cover audience positioning, partial-payment/QR/
  language boundaries, legacy 200/noindex handling, canonical/sitemap decisions,
  stable hero copy and canonical pricing. Existing navigation, accessibility,
  consent, selected-plan, authentication and reflow checks remain in use.

Screenshots are local review artifacts, not additional committed assets:

- [Before desktop Home](../../.agent/content-refresh/before/home-1440.png) /
  [after desktop Home](../../.agent/content-refresh/after/home-1440.png).
- [Mobile first screen](../../.agent/content-refresh/after/home-first-screen-390.png)
  and [new cards](../../.agent/content-refresh/after/home-cards-390.png).
- [Mobile attendance](../../.agent/content-refresh/after/attendance-390.png),
  [language details](../../.agent/content-refresh/after/languages-390.png), and
  [old audience URL](../../.agent/content-refresh/after/legacy-390.png).
- Full before/after Features, Pricing, About, FAQ and How It Works captures at
  1440px and 390px are beside those files. Only the existing two homepage visual
  baselines are refreshed in Git to include the approved new cards and labels.

No production or database-backed integration test was run for this content task.
Exact feature behaviour was checked against the unchanged deployed source and
its existing verification contracts, not re-exercised against customer records.

Final browser commands and outcomes (same `BOTANICAL_PREVIEW_URL` above):

1. `node .agent/botanical-run.mjs exec playwright test tests/browser/public-billing.spec.ts tests/browser/public-site.spec.ts --grep-invert 'public landing visual regression'`:
   **116 passed, 2 failed**. Both failures were the old eight-feature-group
   assertion; adding attendance and languages correctly produces ten groups.
2. After correcting only those count expectations,
   `node .agent/botanical-run.mjs exec playwright test tests/browser/public-billing.spec.ts --grep 'feature groups keep|public landing visual regression' --update-snapshots`:
   **4 passed** (both corrected layout checks plus both reviewed snapshots).
3. `node .agent/botanical-run.mjs exec playwright test tests/browser/public-billing.spec.ts --grep 'public landing visual regression'`:
   **2 passed** without snapshot-update mode.

All **118 functional/accessibility browser cases** therefore have passing
evidence, plus **2 visual regressions**. Initial failed checks are disclosed above;
the whole suite was not unnecessarily repeated after a test-only count update.

The initial AGENTS edit was blocked by automatic approval review because it
mistook the change as outside scope and the claims pointer did not yet exist.
After creating the record and providing the attached brief's explicit requests
at lines 64 and 142, the narrow edit was approved. The first approved attempt
stopped at its line-ending precondition without writing; the corrected bounded
attempt succeeded. Existing owner tooling hunks are excluded from these commits.
