# Organization and branch preview — updated 2026-10-29

The owner approved the narrowed Basic design and requested its connection to the
organization. This change completes that **synthetic preview** on
`codex/basic-workspace`, now based on merged main `22d1d09` (PR #284, including
the earlier navigation and audit-closeout changes from PRs #285/#286). The new organization journey awaits
visual review; production integration, merge and deployment remain separate.

## Reconciliation with merged main — 2026-10-29

The complete 98-file uncommitted checkpoint was saved before fast-forwarding
this isolated branch from c63fb1f to 22d1d09. All checkpoint paths were restored;
the recoverable stash remains. Five conflicts in AppShell, translations and the
three architecture/design records were reconciled. No Basic commit or push was
made, and the original checkout was not switched or edited.

Design decisions:

- Keep Basic's approved cream/forest design, independent forms, numbered seats
  and four primary areas. Keep the merged full Standard/Pro screens.
- Adopt main's personal Account separation: no organization sidebar or branch
  picker there, and a scoped return to the originating branch and area. External
  and foreign return hints fall back to a permitted workspace.
- Retain main's newer workspace controls, translations, restored dashboard
  cards, complete Billing history, retired AI Messages and one-owned-organization
  rule. The preview shim no longer imports retired WorkspaceSwitcher exports.
- Supply recent students and a read-only renewals projection from the same
  selected-branch fixture records for the restored dashboard cards. Fees are
  due on the frozen preview day, so an empty overdue card is correct. Unknown
  operations still fail closed and no provider is contacted.

Existing earlier application scaffolding is preserved, not represented as
integration of the approved Basic prototype. Real billing is still organization-wide.

## Open and review

Entry: <http://127.0.0.1:4187/org/org-pilot?journey=org>.

Open Saraswati Library (Basic), use Students → Add student → Save & choose seat
→ Assign seat → Record fee payment. Return to the organization, open Central
Study Hall (Standard), switch to Riverside Reading Room (Pro), choose Manage
plan and return to the originating workspace. Standard/Pro mount the existing
full shell and operational components; Basic retains its own approved forms.

The organization area stays shared. Account, organization settings, branch
Library setup, student Fees and subscription Billing are separate destinations.
The same branch selector appears in each workspace. Desktop/mobile navigation,
including a setup shortcut on small screens, is available.

Billing clearly marks the mixed-plan model as a simulation. Billed plan,
effective access, selected future plan and scheduled change are separate. Every
choice/confirmation names its branch. “Preview effective date” changes only
that branch's simulated access; there is no Razorpay request or charge.

## Context and fixture safety

The Vite-only `organization-preview/` model/store/transport supplies three
independent sample branches. Records live once per branch and remain the same
objects through plan changes. Dashboard summaries, full student lists and Basic
fees project the same fixture records. Tab session storage preserves them on
refresh and partitions them by synthetic identity, role and scenario. Reset
affects only the current sample namespace.

Routing carries language/role/scenario/identity through links, including plain
anchors. Switching retains common destinations, maps Fees ↔ Payments and
Library setup ↔ Settings, drops record IDs and falls back to overview for
unavailable destinations. Billing accepts only a return path belonging to the
selected branch. Legacy Basic Account/Subscription links redirect centrally.

Trees reset on branch/effective-access/identity changes. Requests capture their
originating branch and identity; late responses cannot populate a new branch
tree. Unsaved forms prompt before navigation; pending sample payments block
navigation, retain their originating branch and check the fresh balance before
recording one receipt. Browser Back/Forward uses the same guard.

Expand Preview scenarios for owner/restricted-staff, single/empty organization,
trial/grant/expired/pending/archived/scheduled, loading/error or slow responses.
Staff sees only its two assigned branches and permitted destinations; foreign
branches and organization Billing fail closed. Read-only access never enables
Basic write controls. English/Hindi/Hinglish controls also synchronize the
existing full workspace's preference provider.

No production route, authentication bypass, database API or provider call was
added. Unknown fixture operations return an explicit unsupported error. Full
Standard/Pro modules are existing presentation components, not a comprehensive
simulation of all their mutations. The new Billing cards do not establish live
subscription support or production authorization.

## Screenshots

- [Organization desktop](organization-branch-evidence/organization-desktop.png)
- [Basic desktop and selector](organization-branch-evidence/basic-desktop.png)
- [Standard transition](organization-branch-evidence/standard-desktop.png)
- [Pro transition](organization-branch-evidence/pro-desktop.png)
- [Central Billing](organization-branch-evidence/billing-desktop.png)
- [Basic mobile](organization-branch-evidence/basic-mobile.png)
- [Hindi mobile](organization-branch-evidence/basic-hindi-mobile.png)
- [Organization mobile](organization-branch-evidence/organization-mobile.png)

A preview-scoped header placement correction keeps the existing full dashboard
aligned at intermediate desktop widths; no Standard/Pro component was redesigned.

## Validation after main reconciliation — 2026-10-29

Commands run from the isolated worktree. Logs are in ignored
`test-results/basic-main-sync-*.log`; earlier screenshots above remain the
28 October visual evidence, not newly captured screenshots.

| Command | Actual result |
| --- | --- |
| `pnpm exec prisma generate` | Passed; generated the local client, with no database connection. |
| `pnpm exec node node_modules/vitest/vitest.mjs run --config tests/application-design-pilot/organization-preview/vitest.config.ts` | 8 files, 63 tests passed. Includes fixture/account-return contracts and actual merged workspace controls, route boundaries and appearance components; no database setup. |
| `pnpm exec playwright test --config tests/application-design-pilot/organization-preview/playwright.config.ts` | 22 passed: all 11 journeys on desktop and mobile, including the new Account return check. |
| Same Playwright command with `--grep 'restored dashboard' --reporter=list` | 2 passed after the fixture compatibility fix: selected-branch recent students and accurate empty overdue state, switching Standard to Pro. Passed journeys were not rerun. |
| `pnpm exec tsc --noEmit --pretty false` | Initial merged-tree check passed. Final fixture-only check found a widened string literal in the renewal projection; an explicit RenewalRow map return type corrected it; final recheck passed. |
| `pnpm lint` | Passed: 0 errors, 1 existing generated workflow route warning (unused eslint-disable). |
| `pnpm exec eslint tests/application-design-pilot/organization-preview/transport.ts tests/application-design-pilot/organization-preview/journey.spec.ts` | Passed, 0 errors/warnings; the final invocation used a separate log after an overlapping output-file lock. |
| Guarded invocation of `node tests/dashboard-connected/build.mjs` → `pnpm build` | Passed: compile and TypeScript checks, 74 pages generated, 2 workflow manifest entries verified. The later preview-only projection was checked separately. |
| `git diff --check` and `git ls-files --unmerged` | Passed; no unresolved merge entries. All 30 relative links across the review/compatibility reports resolve. |

The guarded build used the separately verified disposable PR-sync Docker test
database. Container identity, loopback port, database name and read-only mode
were checked first. Only the two existing Clerk Test credentials were passed
in memory; credentials were neither printed nor copied to environment files.
The Vite preview remains synthetic, without a database or real sign-in.

The final in-app browser control connection closed while attempting fresh
screenshots. The local preview server is running; the completed Playwright
checks are the current browser evidence. No new screenshot is claimed.
No Razorpay flows or previously passed billing integration suites were rerun.
Mock checks do not verify live subscriptions, tenancy or provider recovery.

## Implementation boundary

This iteration changes the Vite entry, navigation/Clerk shims, aliases, the
Basic prototype and its new organization fixture modules/tests. Documentation
records the approved Basic design, new review status and billing discrepancy.
Earlier uncommitted application changes are preserved; they are not claimed as
production integration of this prototype.

The real application already has organizations, branch-scoped operational
records and membership checks, authoritative access projections and central
Billing. **Its commercial plan and grants remain organization-wide.**
See the [focused compatibility brief](../billing/branch-plan-compatibility.md)
for concrete schema/service evidence, migration implications and acceptance gates.

No schema/migration/seed/environment-file change is required for this preview.
No merge, deployment, provider action or hosting/cron change occurred. Marketing
pages remain unchanged because neither mixed branch plans nor this prototype is
released. Production integration must preserve the documented billing and
student-fee invariants.
