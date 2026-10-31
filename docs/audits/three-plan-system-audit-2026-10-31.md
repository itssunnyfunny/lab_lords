# Three plan system audit

Date: 31 October 2026. Initial audit baseline: `a6b6770`, plus the initial verification changes listed below. The local fixes requested afterward are recorded in the follow-up at the end. Scope: production services and a locally served production build. Production data, deployments and Live provider configuration were not accessed.

The implemented separation matches Basic ₹99, Standard ₹299 and Pro ₹499 **per billable branch per month**. Basic uses its separate simple workspace. Standard and Pro share the full workspace; only Pro receives WhatsApp entitlement. The initial audit passed all 3,060 unit/integration tests across 360 files, 77 browser checks and three migration cases, plus lint and the guarded production build. The two public presentation gaps are now fixed locally as described below; commercial/release conditions remain separate from local implementation.

## Initial findings and remaining decisions

### Resolved locally: two untranslated public capability labels

The initial public catalogue lacked entries for `Spreadsheet import` and `Organization-wide plan, priced per active branch`. Hindi and Hinglish public pricing fell back to those English source strings. Both entries now have public translations, and a regression check covers dynamic catalogue labels and availability notes.

Initial evidence: [billing capability labels](../../lib/billingPlans.ts), [public catalogue](../../lib/public-i18n/catalog.ts), [fallback implementation](../../lib/public-i18n/translate.ts), and the initial local `public-copy-results.json` probe. That retained probe records the original two missing entries; the follow-up evidence records their resolution.

### Resolved locally: homepage now displays all three price cards

Home now displays Basic ₹99, Standard ₹299 and Pro ₹499 summary cards through the shared pricing component. Each card has a direct plan-selection action. The new section owns `/#pricing`, and its comparison link opens `/pricing`, which retains the full inclusion matrix and Pro's setup/usage conditions.

Evidence: [homepage](../../app/page.tsx), [shared pricing component](../../components/landing/LandingPricing.tsx), and [updated homepage contract](../../tests/unit/pages/public-site.test.tsx). The existing hero and public style owners are reused; the footer retains its ordinary Pricing link without duplicating the section ID.

### Existing staff retain core access after a Basic downgrade

The staff-management entitlement gates invitations, acceptance and permission controls. It does not revoke existing branch memberships. Existing staff can continue permitted student/seat/fee work under Basic. The narrow public wording describes invitations and permission controls, but older documentation records the broader staff-access wording discrepancy.

This is tested current policy, not an authorization bypass to silently remove during an audit. If Basic is intended to be owner-only, an explicit policy change and membership/access treatment are still needed. Evidence: [Basic downgrade integration test](../../tests/integration/services/basic-workspace.test.ts), [access policy](../../services/accessPolicy.service.ts), and [public-claims guidance](../product/public-claims.md).

### Paid enforcement depends on the billing model and rollout

Workspace V2 becomes read-only Basic without a valid trial, trusted paid period or explicit bounded replacement grant. Legacy organizations intentionally retain writable Basic fallback without paid evidence. New-owner V2 onboarding is controlled by `WORKSPACE_BRANCH_BILLING_V2_ENABLED`; it is held by default. A local three-plan catalogue alone does not prove every deployed organization is under paid V2 enforcement.

Evidence: [entitlement service](../../services/entitlement.service.ts), [legacy compatibility](../../services/legacyCommercialCompatibility.ts), [billing feature gates](../../lib/billingFeature.ts), and [onboarding service](../../services/onboarding.service.ts). Verify intended organization promotion and deployment switches under the existing release procedure; do not change the legacy contract implicitly.

### Release readiness remains conditional

- The catalogue migration intentionally rejects any legacy billing/webhook ledger rows. A populated ledger needs the separately reviewed, history-preserving transition described in the [cutover runbook](../billing/three-plan-cutover.md). Never delete evidence to pass the guard. Old internal `PRO` meant the previous public Standard; the migration prevents silently reclassifying it as new WhatsApp Pro.
- Live v2 Razorpay mappings, merchant capabilities, actual Checkout settlement, publicly reachable verified webhooks and subsequent renewal/cutover need authorized deployment evidence. This audit used synthetic payment providers; historical Razorpay Test evidence is not a new Live check.
- [Eight cron schedules](../../vercel.json) remain configured. The runbook records a hosting hold and an owner-managed hosting upgrade plan. Current account tier, deployed registration and execution were not inspected, so the old hold must not be assumed resolved or still active solely from its date.
- WhatsApp Pro entitlement requires setup, feature flags/canaries, sender readiness, approved Utility templates, recipient consent, budgets and operation-specific permissions. Real onboarding and delivery availability were not established here.

These are release gates and policy conditions, not proof that a deployed payment or WhatsApp service is currently broken.

## Expected plan contract

| Capability | Basic ₹99 | Standard ₹299 | Pro ₹499 |
| --- | --- | --- | --- |
| Workspace | Separate simple interface | Full interface | Same full interface |
| Students, seats, shifts and fee records | Included | Included | Included |
| Partial collections, receipts and retained history | Included | Included | Included |
| Imports, attendance, tasks, follow-ups and reports | Excluded | Included | Included |
| Staff invitations/permission management | Excluded | Included | Included |
| Advanced branch/organization analytics and AI reports | Excluded | Included | Included |
| WhatsApp entitlement | Excluded | Excluded | Included, subject to readiness |

One organization plan applies across its branches. There is no independently selectable plan for each branch. Prices multiply by billable quantity: two branches cost ₹198, ₹598 or ₹998 before any applicable checkout treatment. Student fees are separate operational records.

Eligible owners get one 30-day **Standard** trial. Selecting Basic or Pro during signup does not choose the effective workspace, start paid access or grant WhatsApp. Standard trial access can keep the full workspace visible after Basic is selected. Effective server access, rather than the URL or selected-plan field, chooses the presentation.

## Initial audit checks and evidence

| Area | Checks performed and result |
| --- | --- |
| Catalogue | Exact three identities/prices, INR subunits, monthly cadence, unlimited branch count policy, Standard/Pro entitlement difference and v2 mode-scoped provider keys checked. |
| Public plan selection | All Basic/Standard/Pro signed-out continuations from Home via Pricing and directly from Pricing passed on desktop/mobile. Standard now explicitly asserts `STANDARD`, Pro asserts `PRO`. |
| Public pages | Home, Features, Pricing and FAQ source wording inspected. Public layout/language journeys passed in English/Hindi/Hinglish at 320, 390 and 1440px. Translation completeness has the two-label finding above. |
| Basic/full UI boundary | Production-build connected tests verified Basic forms, desktop/mobile navigation, excluded direct APIs, organization entry, transitions to Standard/Pro, unsaved drafts and record preservation. |
| Server feature separation | Basic rejects attendance/import/full-workspace/report capabilities; Standard and Pro permit the full workspace. Staff, AI, analytics and WhatsApp retain their own entitlement/permission checks. Selected plans do not authorize access. |
| Initial checkout | Owner scope, exact unit price times quantity, authoritative provider terms, mode isolation, once-only provisioning, failed/dismissed checkout reuse and lost-response recovery exercised. |
| All six plan changes | Basic→Standard, Basic→Pro, Standard→Basic, Standard→Pro, Pro→Basic and Pro→Standard tested through billing services. Exact target price/quantity, source preservation, idempotent replay and replacement-only dispatch asserted. |
| Upgrade/downgrade timing | Fresh recurring authorization is required for supported mandate changes. The safe boundary has at least seven days' lead and may be a later renewal. Downgrades do not remove features early. Exact replacement grants, revocation, a three-day bank-confirmation grace and the 72-hour undo cutoff are covered. |
| Paid access | Browser success, `AUTHENTICATED`, `ACTIVE` or a future raw `paidThrough` cannot substitute for exact paid evidence. Invoice/payment/intent identity, amount, quantity, plan, currency, period and mode must agree. |
| Failure and recovery | Invalid/missing/duplicate settlement evidence, lost callback/create responses, expired leases, concurrent changes, stale workers, retry ordering, manual review and no automatic duplicate provider mutation exercised. |
| Webhooks | Signature-before-parse, bounded raw body, event-ID/body collision protection, atomic claim/lease ownership, replay, retries and provider-fetched reconciliation covered. No public Live webhook delivery claim is made. |
| Cancellation and undo | Paid-period preservation, trial cancellation confirmation, candidate/source cancellation ambiguity, scheduled undo, recovery and subsequent plan changes covered. Cancellation does not manufacture a refund. |
| Branch quantity | Activation, addition, removal, archive/reactivation and unresolved charges preserve confirmed quantity/access until their appropriate boundary. |
| Trial/expiry | One-owner trial scope, Standard trial versus selected plan, independently paid Pro, expiry/read-only enforcement, and exact read-only receipt recovery covered. |
| WhatsApp downgrade | Dispatcher tests suppress messages queued before downgrade to both Basic and Standard without calling the injected provider. Consent/template/readiness/budget and claim/idempotency controls remain active. |
| Authorization/tenancy | Billing owner checks, generic foreign/nonexistent organization responses, direct feature API restrictions, branch permission revocation and stale/foreign submissions covered. |
| Records/history | Connected Basic admission, edit, multi-shift moves, partial payments, receipt/PDF dates, corrections and lost-response recovery preserve history; billing history keeps Standard and Pro distinct. |
| Migration | Three fresh-database cases passed: populated legacy billing evidence rejected unchanged; obsolete selection rejected unchanged; empty-ledger conversion preserved user/organization/branch counts and changed only old selected PRO to STANDARD. |
| Engineering checks | Prisma regeneration, lint and guarded production build completed. Full-suite final result is recorded below. |

## Initial audit verification commands

All payment integrations were synthetic or held. Connected browser checks used the existing verified Clerk Test identity. Fresh suite/browser/migration databases were independent, loopback-only targets; retained fixture databases were not reset. Evidence is local and ignored under `test-results/three-plan-audit-2026-10-31/`.

| Command | Result | Evidence |
| --- | --- | --- |
| `pnpm prisma generate` | Passed; generated client now matches the checked-in enum | `prisma-generate.log` |
| `pnpm lint` | Passed; zero errors, two existing generated-artifact warnings | `lint.log` |
| `node tests/billing-verification/run-build.mjs` | Passed; invokes guarded `pnpm build`, with read-only local database and external providers held; two import Workflow manifests verified | `build-final.log` |
| `node test-results/three-plan-audit-2026-10-31/run-disposable.mjs` | 3,060 passed across 360 files; zero failed, skipped or pending; exit 0 | `full-suite-final.log`, `full-suite.json` |
| `pnpm exec playwright test --config tests/billing-verification/playwright.config.ts` | 39 passed, zero skipped/failed/flaky | `billing-browser.log`, `billing-browser-results.json` |
| `node test-results/three-plan-audit-2026-10-31/basic-runner.mjs test --max-failures=1` | 18 passed, zero skipped/failed/flaky, against the locally served production build | `basic-browser-built.log`, `basic-browser-results.json` |
| `node test-results/three-plan-audit-2026-10-31/basic-runner.mjs public tests/browser/public-billing.spec.ts --grep 'public pricing exposes\|preserves the signed-out selected-plan continuation' --reporter=list,json --output=test-results/three-plan-audit-2026-10-31/public-browser-artifacts` | 14 passed, zero skipped/failed/flaky | `public-browser-built.log`, `public-browser-results.json` |
| `node test-results/three-plan-audit-2026-10-31/basic-runner.mjs public tests/browser/public-localization.spec.ts --grep 'home examples, pricing' --reporter=list --output=test-results/three-plan-audit-2026-10-31/public-localization-artifacts` | 6 passed | `public-localization.log` |
| `node test-results/three-plan-audit-2026-10-31/cutover-probe.mjs` | 3 cases passed, 54 preceding migrations applied to a fresh rehearsal database | `cutover.log`, `cutover-results.json` |
| `pnpm exec tsx test-results/three-plan-audit-2026-10-31/public-copy-probe.ts` | Probe completed; found two missing public translation entries | `public-copy.log`, `public-copy-results.json` |
| `pnpm exec eslint tests/billing-verification/billing.spec.ts tests/browser/public-billing.spec.ts tests/browser/public-localization.spec.ts` | Passed | `changed-tests-lint-final.log` |
| `git diff --check` | Passed | Command output |

The temporary helpers are task-local verification artifacts, not production entry points. `run-disposable.mjs` runs the general Vitest suite using `--pool=threads --hookTimeout=60000` after applying repository migrations to a newly empty, memory-backed PostgreSQL container. `basic-runner.mjs prepare` creates a separate newly empty browser database and invokes the existing synthetic seed; `basic-runner.mjs server` serves the guarded production build. Every helper verifies exact local container/database identity before using it. None changes an application environment file. The general Vitest configuration excludes the dedicated Workflow-engine and browser runners; the affected browser checks were run separately as listed above. No Workflow implementation changed.

Earlier attempts are excluded from pass counts: the initial sandboxed default-fork unit run and slow on-disk full run were stopped; the initial build failed because the ignored generated Prisma client still had the old enum; the first development-server Basic journey timed out in loading before a route finished compiling. Regenerating the client and using the completed production build resolved the latter checks. An intermediate public-pricing selector also matched a description; it was narrowed to feature-list rows before the final 14-case pass.

After verification, the temporary browser server and both task-created memory-backed containers were stopped. The retained disposable container was restored to its original stopped state. The task-created active Basic fixture pointer was removed after an exact evidence copy; original authentication state was unchanged. Cleanup is recorded in `cleanup.json`. All 19 report source links resolve, and the report has no pending placeholders or trailing whitespace.

## Initial audit changes

- [Billing component browser tests](../../tests/billing-verification/billing.spec.ts): replace stale Basic copy/combined-import expectations with the current localized description and explicit import exclusion.
- [Public pricing/selection browser tests](../../tests/browser/public-billing.spec.ts): assert all three prices and cards, Basic/Standard exclusions, Pro conditions, and the correct three selected-plan IDs from both public entry points.
- [Public localization browser tests](../../tests/browser/public-localization.spec.ts): include ₹99 alongside ₹299 and ₹499.
- This audit report and ignored local verification artifacts.

Application behavior, public copy, plan prices, entitlement policy, staff membership policy, billing state machines and provider dispatch were intentionally unchanged. No dependency, schema, migration history, application seed, production environment, deployment, branch, commit, push or PR change was made. No new deployment or rollback requirement is introduced by the test/report changes; the existing cutover and rollout requirements remain applicable.

## Local fixes requested after the audit

The follow-up adds all three plan cards directly to Home and completes the missing public Hindi/Hinglish labels. `LandingPricing summary` reuses the shared catalogue, existing `PlanCTA`, per-billable-branch wording, eligible-owner Standard trial and conditional WhatsApp note. The full comparison remains on `/pricing`. Public plan prices and billing behavior are unchanged.

The tests now cover direct homepage selection, one `#pricing` section, keyboard navigation to the comparison, translated labels without English fallback, and all three plan IDs from both public routes in every language. A remaining stale localization test had mapped Standard to the old internal PRO identity; it now explicitly asserts STANDARD and separately covers Pro.

The first complete public run passed 150 cases and found four real homepage reflow failures at 400% zoom. `LandingPricing` used a viewport breakpoint to force three columns even when the zoomed content was much narrower. Its shared grid now uses the existing available-width pattern (`auto-fit` with a shrinking minimum), preserving normal desktop/mobile geometry while stacking zoomed cards. All eight focused rechecks passed, including the four failing cases, unchanged normal-view screenshots and fully visible plan buttons at 400% zoom. The React checklist review found no new hooks, client fetching, mutable request state or authorization path; the change remains in shared server-rendered presentation.

Follow-up implementation: [Home](../../app/page.tsx), [public dictionary](../../lib/public-i18n/catalog.ts), [required keys](../../lib/public-i18n/required-keys.json), [public localization unit contracts](../../tests/unit/lib/public-localization.test.ts), [homepage unit contract](../../tests/unit/pages/public-site.test.tsx), and the two public browser specs linked above. The desktop/mobile homepage screenshot baselines were refreshed and the individual plan cards were visually inspected. Canonical current-state, public-claims and page-family notes record the local change without adding release or visual-approval claims. The public-claims matrix now reflects all-three-plan core access, Standard/Pro operational features, and the retained-member staff policy; this corrects documentation without changing enforcement or historical release evidence.

### Follow-up verification

Evidence is kept separately under `test-results/three-plan-local-fixes-2026-10-31/` so the initial audit reports remain intact. Public browsers used the locally served production build, a verified loopback database forced read-only, and existing Clerk Test authentication. Full regression tests used a newly empty temporary PostgreSQL container with repository migrations and synthetic payment providers.

| Command | Result | Evidence |
| --- | --- | --- |
| `pnpm exec vitest run --config vitest.unit.safe.config.ts --pool=threads public-site public-localization billingPlans billingFlow --reporter=default --reporter=json --outputFile=test-results/three-plan-local-fixes-2026-10-31/targeted-unit.json` | 36 passed | `targeted-unit.log`, `targeted-unit.json` |
| `node test-results/three-plan-local-fixes-2026-10-31/run-disposable.mjs` | 3,061 passed across 360 files; zero failed/pending; completed before the final grid-only correction, which was followed by the affected checks below | `full-suite.log`, `full-suite.json` |
| `node tests/billing-verification/run-build.mjs` | Passed before and after the grid correction; guarded `pnpm build`, TypeScript and two Workflow manifests | `build.log`, `build-layout-fixed.log` |
| `pnpm lint` | Passed before and after the grid correction; zero errors, two existing generated-file warnings | `lint.log`, `lint-layout-fixed.log` |
| `node test-results/three-plan-local-fixes-2026-10-31/run-public.mjs test tests/browser/public-billing.spec.ts --grep 'public landing visual regression\|homepage shows all three' --update-snapshots --reporter=list,json --output=test-results/three-plan-local-fixes-2026-10-31/homepage-visual` | 4 passed; refreshed only the two requested homepage baselines | `homepage-visual.log`, `homepage-visual-results.json` |
| `pnpm exec vitest run --config vitest.unit.safe.config.ts --pool=threads public-site public-localization billingPlans billingFlow theme-contract application-pilot-theme --reporter=default --reporter=json --outputFile=test-results/three-plan-local-fixes-2026-10-31/layout-unit.json` | 50 affected unit/theme checks passed after the grid correction | `layout-unit.log`, `layout-unit.json` |
| `node test-results/three-plan-local-fixes-2026-10-31/run-public.mjs test tests/browser/public-billing.spec.ts --grep 'public landing reflows\|/ shares the botanical public brand\|public landing visual regression\|homepage shows all three' --max-failures=1 --reporter=list,json --output=test-results/three-plan-local-fixes-2026-10-31/zoom-recheck` | 8 passed after the grid correction | `zoom-recheck.log`, `zoom-recheck-results.json` |
| `node test-results/three-plan-local-fixes-2026-10-31/run-public.mjs test tests/browser/public-billing.spec.ts tests/browser/public-localization.spec.ts tests/browser/public-site.spec.ts --workers=2 --max-failures=5 --reporter=list,json --output=test-results/three-plan-local-fixes-2026-10-31/public-browser-layout-fixed` | 153 passed; one mobile Contact navigation timed out before form assertions; the serial group recheck below passed | `public-browser-layout-fixed.log`, `public-browser-layout-fixed-results.json` |
| `node test-results/three-plan-local-fixes-2026-10-31/run-public.mjs test tests/browser/public-site.spec.ts --workers=1 --max-failures=1 --reporter=list,json --output=test-results/three-plan-local-fixes-2026-10-31/public-site-serial` | All 14 passed, including desktop/mobile Contact; no code or assertion changes for this rerun | `public-site-serial.log`, `public-site-serial-results.json` |
| `pnpm exec playwright test --config tests/billing-verification/playwright.config.ts --reporter=list,json --output=test-results/three-plan-local-fixes-2026-10-31/billing-browser` | 39 passed; zero skipped/failed/flaky | `billing-browser.log`, `billing-browser-results.json` |
| `pnpm exec tsx test-results/three-plan-local-fixes-2026-10-31/public-copy-probe.ts` | All 13 capability labels have public translations; zero missing entries | `public-copy.log`, `public-copy-results.json` |
| `pnpm exec eslint app/page.tsx components/landing/LandingPricing.tsx lib/public-i18n/catalog.ts tests/unit/lib/public-localization.test.ts tests/unit/pages/public-site.test.tsx tests/browser/public-billing.spec.ts tests/browser/public-localization.spec.ts` | Passed after the grid correction | `layout-lint.log` |
| `git diff --check` | Passed | Command output |

The named JSON reporter output paths were supplied in process environment; no environment file was changed. One initial harness attempt stopped during PostgreSQL initialization before tests began; the readiness check now waits for TCP acceptance, and the fresh run above completed. An early public attempt found an older assertion requiring no homepage plan buttons; it was corrected to require all three before the complete run that identified the zoom issue. The final public rerun uses two independent browser workers against a read-only database; the database-mutating general suite remains sequential. Screenshot-refresh and focused zoom cases overlap the final public suite and are not additional distinct browser cases.

The corrected full public run had one navigation timeout at `/contact` while waiting for page load; the entire public-page group passed when rerun serially. The cause of that one parallel navigation timeout was not established, and it is not counted as a single all-green 154-case invocation. Matching file/title/project identities across the corrected full run and serial recheck verifies **154 distinct public cases**, plus **39 billing cases**, for **193 distinct browser cases** with a passing result. `final-summary.json` validates these counts and retains the failed-run statistics. No local functional failure remains in the checked flows; the observed navigation timeout remains recorded as an execution limitation.

No billing/access policy, schema, migration history, dependency, application seed, environment file, cron, production data or deployment was changed. Reverting the local presentation requires only the homepage composition, dictionary and associated verification artifacts; it does not require a data rollback. Existing catalogue cutover, hosting, Live payment/webhook and WhatsApp readiness conditions remain applicable. No production access or deployment is authorized or performed.

Follow-up cleanup stopped the temporary public server and both task-created regression containers, and restored the retained read-only test container to its stopped state. Authentication state and saved application environment files were unchanged. `cleanup.json` records the resource checks; the evidence files and updated local working tree remain available for review.
