# Public redesign implementation — 2026-09-20

> Historical first-pass record. The owner rejected this pass's visual direction.
> The subsequent [original-brand preview](brand-reference-preview.md) replaces
> only the homepage header, hero and first feature section for visual review.
> Results below describe the earlier pass, not approval of either design.
> The [completed public rollout](public-rollout-report.md) is the current record.

## Scope and authority

Implemented from the supplied Lab Lords Librify-aligned V2 handoff. Its original
replacement copy and section order guide presentation; current code and domain
contracts determine product facts. Attached instructions to commit, publish or
change application behavior do not provide separate authorization.

The new branch is `codex/librify-aligned-redesign`. Existing tooling, CI and
architecture-document work was present before this task and is preserved.
No commit, push, pull request or deployment is part of this change.

## Public behavior

- Homepage: broad library-management hero, audience strip, nine feature links,
  four benefits, four setup steps, user-controlled example views, seven native
  FAQ disclosures, closing action and full policy footer.
- `/features` groups capabilities and derives plan inclusion from the catalogue.
- `/pricing` preserves every public capability, availability, price and internal
  plan identifier from `publicBillingPlans()`; Standard remains internal `PRO`.
- All seven `/software/` paths retain their SEO identities with shorter copy.
- Contact/support retain configured email actions. The bug form still opens an
  email draft for review, and creates no support ticket or automatic delivery.
- Policy text and dates remain unchanged; only the shared layout and readable
  type/measure change.
- `#platform`, `#features`, `#workflow`, `#how-it-works`, `#product-tour`,
  `#software` and `#pricing` remain addressable. The pricing anchor is a signpost
  to the dedicated page.

## Implementation and boundaries

`MarketingShell` server-composes static content. `MarketingActions` keeps
Clerk-loading, signed-in/out and selected-plan routing in small client islands.
The selected plan reaches sign-up, onboarding or the owner's existing billing
screen through existing helpers; marketing actions do not charge a provider.
`LibraryExample` changes only local display state with semantic keyboard tabs.
Examples are synthetic, explicitly labelled and perform no product writes.

`styles/marketing.css` scopes its palette to `data-brand="reading-grove"`.
Existing Manrope/Inter fonts and the logo remain. Authenticated screens, Clerk
appearance, provider order, consent, language preferences, branch permissions,
trial rules, billing authority and business services are unchanged.

Motion uses finite CSS entrances and user-triggered view changes. Text is
present before animation and complete with reduced motion. No animation or
runtime dependency was added. The original handoff's unused implementation
notes and duplicate page registries are not included in runtime copy.

No schema, migration, seed, package-version or saved environment changes are
required. Rollback is the public code/styles/metadata change only. Production
was not accessed. Internal application-theme rollout is outside this public
slice and remains a separate review decision.

## Validation record

Validation commands, screenshots and final results are recorded here when the
local check/fix loop completes. Browser execution uses development Clerk and
an unreachable loopback database; authenticated tenant data is not exercised.
The ignored `.agent/librify/run.mjs` helper launches this isolated public
preview on `http://localhost:3100` and wraps the repository pnpm launcher.

## Changed files

- Public entry/pages: `app/page.tsx`, new `app/features/page.tsx`, new
  `app/pricing/page.tsx`, `app/contact/page.tsx`, `app/support/page.tsx`,
  `app/sitemap.ts`.
- Shared presentation: landing navbar, footer and pricing; new MarketingShell,
  MarketingActions, LibraryExample, LibraryPreview and NatureDetail components;
  `styles/marketing.css`; `components/legal/LegalPage.tsx`;
  `components/software/SoftwareLandingPage.tsx`.
- Copy: `lib/marketingCopy.json`, `lib/softwarePages.ts`.
- Tests: public-billing browser spec and two screenshot baselines; new
  MarketingActions unit suite; site, public review-page and proxy unit assertions.
- Documentation: this record and the public-site section of
  `docs/ai/current-state.md` (preserving earlier owner changes).

## Reviewed screenshots

The complete [desktop homepage](../../tests/browser/public-billing.spec.ts-snapshots/landing-1440-chromium-win32.png)
and [mobile homepage](../../tests/browser/public-billing.spec.ts-snapshots/landing-390-mobile-chromium-win32.png)
are retained as visual baselines after inspection. Additional local screenshots
in `.agent/librify` cover Features, Pricing, Contact, Support and all seven
solution routes at 1440px and 390px. All 22 route/viewport combinations returned
HTTP 200, exactly one H1, no error overlays and no horizontal overflow.
Keyboard feature anchors, pricing disclosure, support anchor and form-button
focus were checked without sending email.

## Limits and retained behavior

This verifies public presentation and existing routing contracts. Signed-in
organization selection is covered by mocked unit tests; no authenticated tenant
workflow, customer record, real payment, live provider, external message or
Production deployment was exercised. The preview deliberately has no usable
database. Owner approval of the final design and a normal release process are
separate from these local checks.

During concurrent development/build activity, isolated browser probes observed
an intermittent `SyntaxError: Invalid or unexpected token`; a later probe with
source/error capture on the affected pages returned no page errors, console
errors or failed requests. The original cause was not established. Development
Clerk also occasionally produced a transient anonymous redirect loop, while the
selected-plan and protected-route checks completed successfully. These are
reported as local-tooling observations, not evidence of Production behavior.

## Commands and observed results

- `node scripts/pnpm.mjs agent:doctor` — passed; identified the existing 14
  changed paths. No Docker was needed for this public-only change.
- `node scripts/pnpm.mjs test:unit tests/unit/components/MarketingActions.test.tsx tests/unit/lib/site.test.ts tests/unit/lib/softwarePages.test.ts tests/unit/lib/billingPlans.test.ts tests/unit/pages/razorpay-review-pages.test.tsx tests/unit/proxy.test.ts`
  — **73 passed in 6 files**, including 13 new account/selected-plan action cases.
- `node .agent/librify/run.mjs dev` — starts
  `node scripts/pnpm.mjs dev --hostname localhost --port 3100` with isolated,
  process-only configuration. Sandbox filesystem access blocked the initial
  Workflow compilation; the same bounded command succeeded through approval.
- `node .agent/librify/inspect.mjs` — homepage HTTP 200, expected H1/section
  headings, zero page errors/overlays, no 390px horizontal overflow. Full
  desktop/mobile screenshots inspected.
- `node .agent/librify/run.mjs browser --grep-invert 'visual regression'`
  — first execution could not load an ESM JSON import; fixed the test import
  attribute. The next run passed 46/50 and exposed zoom overflow and cross-page
  fragment-scroll defects. Those were fixed, without loosening assertions.
- `node .agent/librify/run.mjs browser --grep 'reflows at 320px|standalone pages|reduced motion'`
  — **6 passed**, desktop and mobile, after fixes. One earlier reduced-motion
  interaction was interrupted by development navigation while source changed.
- `node .agent/librify/run.mjs browser --grep 'visual regression' --update-snapshots`
  — 2 snapshots refreshed after full-page visual review. Screenshot readiness
  now additionally waits for configured Clerk loading to settle.
- `git diff --check` — passed (Windows line-ending advisories only).

The final lint/build/browser outcome below supersedes intermediate failures;
intermediate failures are retained here to distinguish fixes from skipped checks.

### Final verification

- `node scripts/pnpm.mjs lint` — **passed**, zero errors. Two existing/generated
  unused-eslint-disable warnings remain in the Workflow-generated route and
  local coverage output; neither is application-source lint failure.
- `node .agent/librify/run.mjs build` — **passed** on final source: optimized
  compilation, TypeScript, 45 static pages and both import Workflow manifests.
  This invokes the unchanged repository `build` script with development Clerk,
  no live provider credentials and an unreachable local database.
- `node scripts/pnpm.mjs test:unit tests/unit/pages/razorpay-review-pages.test.tsx`
  — **5 passed** again after the final Contact readability adjustment.
- `node .agent/librify/run.mjs start` — built local app on localhost:3101.
- With `PLAYWRIGHT_BASE_URL=http://localhost:3101`,
  `node .agent/librify/run.mjs browser --update-snapshots` — **52 passed** across
  desktop and mobile in 1.8 minutes. The settled desktop baseline was refreshed;
  the mobile baseline matched. This stable built-app run includes both signup
  continuations, protected routes, canonical/sitemap checks, keyboard controls,
  mobile reflow, 400% zoom, accessibility and reduced motion.
- Documentation screenshot links resolve, and `git diff --check` passes.

The earlier full development run was 50/52: its desktop image retained the
loading state, and one Basic navigation attempt stalled during development
activity. The final built-app run above passed both. No business logic or
security checks were bypassed to make those checks pass.

Preview endpoints: development at `http://localhost:3100`; the verified built
preview at `http://localhost:3101`. Both use isolated process configuration and
cannot load tenant records from a real database. Saved environment files were
not modified.

Final visual confirmation: with `PLAYWRIGHT_BASE_URL=http://localhost:3101`,
`node .agent/librify/run.mjs browser --grep 'visual regression'` passed **2/2**
without updating snapshots. Desktop and mobile baselines are stable after
sign-in loading settles.
