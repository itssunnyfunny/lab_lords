# Lab Lords three-plan billing audit — 2026-10-23

Implementation and local verification are complete on **codex/billing-recovery**, in the isolated worktree. This includes the recovery and dedicated Billing work from [the 2026-10-22 audit](billing-recovery-2026-10-22.md). Main was not edited by this task.

**Release status:** packaged as focused review commits on `codex/billing-recovery`, based on `60760aa74be27b23deaa31460ff1e4b8c582816a`. Not merged or deployed; commit hashes and PR status are recorded in Git/GitHub. The new migration was applied only to fresh disposable local databases. Production was not accessed. Production inventory, Live mappings and deployment smoke verification remain required. The supplied migration refuses any populated legacy billing/webhook ledger; it is not a populated-ledger migration.

## Implemented behavior

| Plan | INR / active branch / month | Access |
| --- | ---: | --- |
| Basic | 99 | Existing core operations; no staff management, advanced analytics, AI or WhatsApp |
| Standard | 299 | Core plus staff/permissions, advanced branch/organization analytics and AI reports/drafts |
| Pro | 499 | Standard plus WhatsApp entitlement, subject to setup, rollout and usage conditions |

All branches share the organization plan and existing billable-quantity lifecycle. There are no new student, seat, branch or usage limits. Basic still uses the existing operational screens; its simple interface is deferred.

The normal once-per-owner trial remains 30 days and now resolves explicitly to Standard. Selecting or authorizing Pro does not create paid access. Exact recorded replacement grants remain separate from billed-plan facts. A lower-tier replacement grant cannot reduce the remaining Standard trial or paid access, and an independently paid Pro period survives an overlapping Standard trial.

The existing replacement-mandate policy is retained for card plan/quantity changes. All six tier directions use a shared rank. Downgrades wait for the applicable confirmed boundary and preserve records. Signed callback verification, invoice/payment binding, fully refunded authorization-token handling, provider-mode isolation, immutable commercial intent, provider-action leases, uncertain-outcome holds, replay safety, recovery and subsequent mutations remain in place.

The dedicated `/org/[orgId]/billing` section includes current/billed access, all three plan cards, authorization/recovery, scheduled changes and undo, cancellation, invoices and history. Old Settings billing links forward to it. Onboarding, public Home/Features/Pricing/FAQ and relevant solution wording use the same catalogue; English, Hindi and Hinglish carry the new plan facts. Pro copy discloses setup/rollout and messaging terms; it does not promise unlimited usage or delivery readiness.

## Code and schema scope

- `lib/billingPlans.ts`, `lib/billingState.ts`, `services/billingExperience.service.ts`, `types/billingExperience.ts`: explicit identities, prices, capability matrix, Standard trial and truthful access projection.
- `services/billing.service.ts`, `services/billingReplacement.service.ts`: rank-based lifecycle classification while retaining the prior recovery fixes.
- `services/razorpayPlanCatalog.service.ts`: mode-scoped v2 immutable keys and adoption of pre-created provider plans on the first local provisioning attempt.
- `prisma/schema.prisma` and `prisma/migrations/20261023090000_three_plan_catalogue/migration.sql`: BASIC/STANDARD/PRO enum and transactional guarded conversion. No old migration, seed or package version changed.
- Dedicated Billing components, onboarding and its API/service validation, feature upgrade links, branch billing projection, public pricing components/content and owned dictionaries.
- Regression files in `tests/unit`, `tests/integration/services`, and `tests/billing-verification`; the factory now creates exact paid evidence for all three tiers.
- Canonical domain/security/current-state/public-claims/runbook and page-family release evidence updated. [Cutover runbook](../billing/three-plan-cutover.md) contains the complete decision, environment names, operator inventory, ordering, rollback and forward-repair procedure.

## Verification results

| Verification | Final evidence |
| --- | --- |
| Affected units, including public localization, onboarding and WhatsApp | **1,113 passed**, zero failed |
| Billing/branch/entitlement/WhatsApp integration cases | **259 distinct cases passed across the broad run and focused corrected reruns**; not a claim of one all-green 259-case invocation |
| Production billing components in browser fixtures | **36 passed**: 1440px desktop, 390px mobile and 320px mobile, with English/Hindi/Hinglish |
| Prisma client generation and TypeScript | Passed |
| Full lint | Passed, zero errors; one existing unused eslint-disable warning in generated Workflow code |
| Focused final lint | Passed |
| Guarded production build | Passed; 74 static pages generated and 2 import Workflow manifests verified |
| Migration rehearsal | Populated old evidence rejected unchanged; clean conversion preserved 1 user, 1 organization and 1 branch, and converted selected old public Standard to STANDARD |
| Actual Razorpay Test plan provisioning | Three plans created, exact terms fetched and verified; second lookup reused each identity |
| Actual Razorpay Test discovery with no local mappings | All three existing v2 plans adopted; **zero new plan, subscription or payment writes** |
| Git whitespace check | Passed |

Integration evidence is transparent: the initial eight-file run passed 250/256, with six obsolete two-plan expectations and a test's asynchronously observed rejection. Those test expectations and promise ordering were corrected. The affected two-file run passed 92/95; its only failures were new assertions that incorrectly expected the payload's unit `amount` to contain the total. The existing contract was preserved: unit paise in `amount`, quantity on the subscription and multiplied rupee total in the summary. The three corrected quantity cases passed. A final three-plan HTTP route check also passed. There are no unresolved failing assertions from these runs.

The verified two-branch totals are Basic INR 198, Standard INR 598 and Pro INR 998 per month. Tests assert exact immutable plan unit paise, subscription quantity 2, estimated total/fee, duplicate checkout reuse and no fabricated paidThrough.

Coverage includes all six replacement directions; canonical source preservation; duplicate callbacks/webhooks; lost provider responses and read-only recovery; a subsequent owner plan change after recovered undo; cancellation/undo races; branch activation/removal; explicit trial/grant tiers and all-six-direction access boundaries. Direct staff HTTP requests use the actual route and database-backed policy with an injected authenticated test session: Basic is denied, Standard/Pro allowed. WhatsApp owner/service checks deny Basic/Standard, and the actual dispatcher suppresses work queued before downgrade without calling the synthetic provider. Existing Pro dispatch remains allowed only with readiness/consent/template/budget gates.

### Commands actually run

All commands ran in the isolated worktree with pnpm. The integration runner independently checks the Docker identity/image/loopback binding, creates a new empty database from schema only, proves the target is empty and applies the new migration before test resets. It never resets the source fixture or a shared database.

```text
pnpm prisma generate
pnpm exec tsc --noEmit --pretty false
pnpm exec vitest run --config vitest.unit.safe.config.ts --pool=threads --no-cache billing razorpay subscription entitlement public-site public-localization onboarding whatsapp --reporter=json --outputFile=test-results/billing-verification/three-plan-unit-final.json
pnpm exec node tests/billing-verification/run-integration.mjs
pnpm exec node tests/billing-verification/run-integration.mjs billing.test.ts entitlement.test.ts
pnpm exec node tests/billing-verification/run-integration.mjs billing.test.ts
pnpm exec node tests/billing-verification/run-integration.mjs entitlement.test.ts
pnpm exec playwright test --config tests/billing-verification/playwright.config.ts --max-failures=1
pnpm lint --ignore-pattern 'test-results/**'
pnpm exec node tests/billing-verification/check-three-plan-cutover.mjs
pnpm exec tsx tests/billing-verification/prepare-three-plan-test.ts
pnpm exec tsx tests/billing-verification/prepare-three-plan-test.ts --verify-discovery
pnpm exec node tests/billing-verification/run-build.mjs
git -c core.safecrlf=false diff --check
```

The last two integration invocations used `BILLING_TEST_NAME_PATTERN` values `exact unit price times two active branches` and `server access independently`, respectively. Report filenames were supplied via `BILLING_REPORT_NAME`. The build wrapper invokes the report-backed `tests/dashboard-connected/start-local.mjs build`, loads only existing Clerk development keys in memory and disables external providers. No environment file was modified. A focused eslint command covered the final onboarding/catalogue/scripts/tests changes after full lint.

Local ignored evidence under `test-results/billing-verification/`: `three-plan-unit-final.json`, `three-plan-integration.json`, `three-plan-integration-final.json`, `three-plan-checkout-quantity.json`, `three-plan-direct-api.json`, `browser-results.json`, `three-plan-cutover.json`, `three-plan-test-mappings.json`, `three-plan-test-discovery.json`, and per-run database proofs. Build log: `test-results/dashboard-build.log`.

## Cutover findings and release prerequisites

The old provider-linked local Test fixture is populated: 6 subscriptions, 9 changes, 3 invoices, 14 history rows, 7 provider actions, 17 audit rows, 2 mappings and 2 provisioning rows. Two changes remain scheduled; one confirmation-timeout and one manual-review failure are retained. It was read only and remains on its original schema. New plans have separate v2 keys. Old internal PRO and old invoice amounts were not relabeled or repriced.

The migration locks and refuses all ten legacy billing/webhook tables when any row exists. It converts only non-commercial selected PRO to STANDARD in an otherwise empty ledger. `scripts/billing-three-plan-inventory.sql` supplies exact affected IDs and counts for an authorized operator. Do not remove historical rows or force unknown provider actions to make migration pass.

Production obligations were not inspected because repository instructions prohibit Production access. An authorized operator must establish both local and provider scope. If any live/historical billing obligations exist, the release must remain held for the finite, separately reviewed history-preserving transition described in the cutover runbook. That conditional populated-ledger migration is **not implemented by this change**. This is the material remaining release limitation.

Live plan mappings and deployment configuration have not been changed. Test plan IDs in the local journal are verification evidence, not Live mappings. No new secret or environment variable is required; the cutover runbook lists the existing mode/key/webhook/write/canary flags and deployment order.

## Actual-provider limits and intentionally unchanged behavior

Actual new-provider evidence covers Test **plan creation, exact readback, replay reuse, discovery, all three initial paid checkouts and three replacement authorizations**, followed by recovery re-entry and exact-key plan-change replay. Recurring settlement, future cutover/renewal, public webhook delivery and Live payments were not executed. Prior actual Test checkouts/recovery/replacement authorizations belong to the old catalogue and remain documented separately in the 2026-10-22 audit. Deterministic service/browser tests must not be confused with those actual events.

No real WhatsApp message was sent; commercial readiness is independent of Pro entitlement. No student fee-generation, anniversary, unpaid-dues, core operational record, refund, tax, authentication or tenant policy was intentionally changed. No mixed branch plans, usage cap, annual interval, new WhatsApp implementation or minimalist Basic interface was added. Basic's interface redesign is the next phase after this billing release is reviewed, migrated and deployed.

## Actual Razorpay Test checkout follow-up — verified 2026-10-23

All work remains isolated on `codex/billing-recovery`. Main and Production
were untouched. No application billing behavior changed in this follow-up.
Only the isolated Test harness, resume guards, focused guard tests and this
audit changed.

The user completed three initial card checkouts and three replacement mandate
authorizations on port 4191. The production callback service verified the
responses. A subsequent independent GET-only Razorpay inspection confirmed:

| Initial paid plan | Paid INR | Actual replacement authorization | Current effective access |
| --- | ---: | --- | --- |
| Basic | 99 | Basic → Standard, authenticated and scheduled | Standard via the explicit temporary upgrade grant |
| Standard | 299 | Standard → Pro, authenticated and scheduled | Pro via the explicit temporary upgrade grant |
| Pro | 499 | Pro → Basic, authenticated and scheduled | Pro retained through the existing paid period |

Each source has quantity **1**, one paid invoice, and provider `paid_count=1`.
Each candidate has provider `paid_count=0`; mandate authorization was not
recorded as a new paid period. The scheduled boundary is
**2026-11-23 00:00 Asia/Kolkata** (2026-11-22 18:30 UTC).
The existing current subscription and paid-through timestamp were preserved.

Saved phases immediately after each initial payment verify Basic denies staff,
advanced analytics, AI and WhatsApp; Standard enables the first three and
denies WhatsApp; Pro enables all four entitlements. Production server entitlement
assertions were repeated against the final actual fixtures. WhatsApp entitlement
does not imply configured integration readiness or successful message delivery.

The guarded completed-checkout verifier re-entered recovery twice for each
existing scheduled change, reconciled it, then replayed its original plan-change
idempotency key. All three remained SCHEDULED with the same candidate and no
failure category. Each organization retained exactly two subscription rows,
one invoice and two provider actions. No new subscription, invoice or provider
action was created. Every provider write was blocked **before network dispatch**;
the verifier first proved this guard with an intercepted POST.

This verifies recovery **re-entry** and same-key changes after recovery for these
completed authorizations. It does not claim a fresh post-undo mandate, a newly
injected lost-response failure, or all six directions as actual provider events.
The other three directions and injected-failure recovery remain covered by the
previous deterministic tests; the earlier real lost-response evidence belongs
to the old catalogue. Future renewal/cutover, public webhook delivery and Live
mode remain unverified. No further checkout was requested during verification.

Commands and evidence:

- `pnpm exec node tests/billing-verification/run-real-test.mjs --inspect` — passed; 21 provider reads, zero writes; six subscriptions inspected.
- `pnpm exec node tests/billing-verification/run-real-test.mjs --verify-completed` — passed; three paid checkouts, three replacement authorizations, initial/final feature gates, six recovery re-entries and three same-key plan-change replays.
- Focused eslint for `verify-completed-checkouts.ts`, `run-real-test.mjs` and `real-test-server.ts` — passed.
- `git -c core.safecrlf=false diff --check` — passed.
- Earlier harness-only additions: three catalogue-v2 isolation tests passed; ten existing cases skipped. The completed broad unit, integration, browser and build checks were not repeated.

Evidence is saved under `test-results/billing-verification/`:
`three-plan-real-test-provider-inspection.json`,
`three-plan-real-test-completed.json`,
`three-plan-real-test-phases-{basic,standard,pro}.json`, and
`three-plan-real-test-database-proof.json`.
These are synthetic Test fixtures in a fresh disposable local database.
Old fixtures, payments and evidence remain preserved. The initially prepared
unseeded database proof is also retained; it generated no provider actions.

Automatic approval review initially rejected the verifier because it could not
establish the provider-write block. No verifier ran in that rejected attempt.
The pre-network guard was inspected and an explicit guard probe added; the
subsequent guarded run was approved and passed. No approval block remains for
the completed checks. Production inventory, populated-ledger transition if
needed, Live mappings and deployment prerequisites remain unchanged.

## PR #284 review follow-up — 2026-10-23

Review at `8637d53` found a real next-reconciliation defect: completed immediate
source retirement has no cycle-end cancellation flag, so its old admission
could wrongly revoke an activated replacement branch. The fix recognizes
terminal immediate retirement only with a confirmation/recovery audit scoped
to the organization, change and its source subscription. Explicit unresolved
source failures remain held. No paid period is inferred or provider write added.

The CARD/UPI/eMandate integration cases reproduced REVOKE before the fix. After
correction, the next access reconciliation returns NONE and retains ACTIVE,
SCHEDULED and no access revocation. A negative case confirms terminal source
state without a confirmation record still fails closed.

CI run [39907871234](https://github.com/itssunnyfunny/lab_lords/actions/runs/39907871234)
reported 2,964 passing tests, two assertion failures and a Playwright suite
collected by Vitest. The fixes exclude the dedicated billing Playwright folder
from general Vitest discovery, include the dedicated Billing route in theme
expectations, and use the three-plan onboarding validation message. The browser
suite remains available through its dedicated Playwright config.

Three WhatsApp sender/connection responses now require Pro, matching existing
entitlement enforcement. The cutover guide's obsolete plan-only Test-evidence
wording was updated to reflect the completed payment verification.

Validation for these changes:

- `pnpm exec vitest run --config vitest.unit.safe.config.ts --pool=threads --no-cache billingReplacement whatsappSenderAvailability whatsappConnection application-pilot-theme`: **115 passed**.
- Guarded `run-integration.mjs onboarding.test.ts`: **19 passed**.
- Guarded `run-integration.mjs billing-mutation.test.ts`: **97 passed**, four cases failed on an intermediate invalid audit field. That filter and fixture were corrected; focused `retires an uncharged pre-start|terminal source state without` rerun: **4 passed**, 97 skipped. This is 101 distinct mutation cases across runs, not one all-green invocation.
- Focused lint and final diff check passed.
- Guarded `run-build.mjs` passed after the audit relation correction: TypeScript, 74 static pages and the two-workflow manifest.
- No Razorpay checkouts or earlier browser suite were repeated for this review.

The PR remains draft. Fresh GitHub CI on the pushed fixes must pass before release.
The Vercel Git integration's automatic preview attempt failed before build:
the account's Hobby plan rejects the hourly billing cron. Schedules and account
billing were not changed; supported hosting or an approved scheduler design is
required. Production inventory/ledger transition, Live mappings and actual
future settlement/webhook/deployment checks remain release prerequisites.
No merge, manual deployment, production access or schema change occurred in this follow-up.


## Release preparation and remaining capability copy � 2026-10-23

The subsequent complete GitHub CI run [39910456939](https://github.com/itssunnyfunny/lab_lords/actions/runs/39910456939)
passed at `605c75a`: 351 files / 2,967 tests, lint, build and coverage (74.94%
lines, 84.19% functions). This supersedes the earlier pending-CI note above.

`lib/branchCapabilities.ts` now distinguishes Pro-only WhatsApp from Standard
staff, analytics and AI in both owner and staff recovery guidance. Hindi and
Hinglish translations retain the same distinction. Tests cover every entitled
capability, both viewer roles and recovery-link visibility. Permissions and
server entitlement enforcement are unchanged.

The read-only cutover inventory now emits a consistent aggregate summary and
explicit stop reasons; it never grants release approval or claims provider
obligations were verified. The seven-case verifier creates a fresh synthetic
DB in the identity-checked loopback-only Docker container. It exercises empty
legacy state, old Standard selection, preserved billing history, obsolete
selection, unfinished migration, unexpected schema and v2 already present.
It makes no provider call and does not rerun completed payment/migration checks.

The [cutover handoff](../billing/three-plan-cutover.md#release-preparation-follow-up--2026-10-23)
records all five incompatible cron frequencies, the same-project Pro
path, alternative-scheduler requirements, operator inventory stop
conditions and an evidence/responsibility matrix. The owner selected a Pro
upgrade after approximately one week; the Hobby cron failure is an intentional
release hold and schedules remain unchanged. Hosting upgrade,
Production/provider inventory, conditional populated-ledger work, Live mappings
and authorized deployment/renewal/webhook checks remain unresolved.

Validation:

- `pnpm exec vitest run --config vitest.unit.safe.config.ts --pool=threads --no-cache branch-capabilities localization`: **38 passed**.
- `pnpm exec node tests/billing-verification/check-cutover-inventory.mjs`: **7 passed**.
- Focused `pnpm exec eslint` for the helper, translations, capability tests and inventory verifier: **passed**.
- Guarded `pnpm exec node tests/billing-verification/run-build.mjs`: **passed**, including TypeScript, 74 static pages and the two-workflow manifest.
- `git -c core.safecrlf=false diff --check` and new documentation path/anchor validation: **passed**.

 No schema, migration history, package, environment or cron schedule
was changed. No merge, deployment, provider payment or Production access occurred.
