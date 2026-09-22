# Application design pilot

Status: **implemented locally; shared design approval pending**. Do not extend this design to other route families until the owner explicitly approves it.

## Baseline and working scope

- Approved starting point: `main` at `a3c6ed1337907e936a3ae2d77537ccb2e33415f0`.
- Task branch: `codex/application-design-pilot`.
- The working tree was clean before the task branch and had no inherited files.
- Pilot commits:
  - `2cc4e0b` — scoped botanical application theme, shell mark, branch navigation grouping, portal theme seam, and route/contrast tests.
  - `9a332ac` — dashboard, Students, allocation-link, collection, and receipt workflow refinements.
- No public route, public copy, pricing, metadata, schema, migration, package, environment, provider, or server-side authorization change is in scope.
- Public Home, Features, Pricing, FAQ, and multilingual pages remain unchanged. No marketing copy update is needed because this is an authenticated application pilot.

Baseline checks:

- `pnpm lint` passed before implementation.
- The focused baseline set (BranchSidebar, WorkspaceSwitcher, dashboard loader, seat view state, and localization) passed: 5 files / 22 tests.
- A mistaken `pnpm test -- <files>` invocation caused Vitest to discover the broad suite instead of the requested files. Integration setup loaded the configured local `.env.test` database and 67 integration tests failed. That run is not treated as a valid baseline or validation result. It was not repeated because the exact database was not independently proven disposable; subsequent checks use direct, explicit Vitest file paths only.

## Pilot boundary

The production theme marker is allowlisted to:

- `/branch/:branchId` — branch dashboard;
- `/branch/:branchId/students` — Students list and its existing overlays;
- `/branch/:branchId/seats` — seat map and allocation overlay;
- `CollectFeeDialog` — an explicitly themed body portal wherever the shared collection workflow is opened.

Every other application route keeps the existing dark theme. The collection overlay has its own class because dialogs portal to `document.body`; moving the portal would break the existing inert/focus contract. The public site is not a selector target.

## Current inventory and representative states

| Surface | Existing workflow and overlays | Pilot states exercised |
| --- | --- | --- |
| Dashboard | authorized all-settled reads; source-specific unavailable panels; overdue selection; quick actions | populated, source error, restricted/read-only action |
| Students | cursor roster; local search and shift filter; table/grid; row menu; edit, attendance, fee drawer, WhatsApp, status dialogs | populated, empty, failed load, restricted staff, read-only, details/edit return context |
| Seats | cursor seats; primary/multi-shift selection; loaded-record versus exact branch-wide labels; details and allocation dialogs | available, occupied/blocked, selected shift, allocation interaction |
| Collection | selected recorded dues; whole-rupee partial payment; stable request in `sessionStorage`; receipt/PDF actions | partial, uncertain lost response, same-request retry, Hindi receipt |

Shell conditions retained: organization-owner return path, staff-only authorized workspaces, permission filtering, plan locks, activation gate, billing/read-only banners, workspace switching, contextual back links, route titles, direct links, focus return, Escape handling, scroll lock, and safe-area padding.

## Presentation, interaction, and domain behavior

Presentation changes:

- Warm paper background, solid white/cream working surfaces, forest hierarchy, the approved botanical shell mark, serif only for major headings, and sans/mono for controls, tables, and figures.
- Task-oriented branch navigation groups: Daily work; Seats and shifts; Fees; Reports; Setup and access.
- Dense content stays operational: small semantic indicators replace neon washes and large glass effects.
- Desktop and mobile navigation are no longer mounted simultaneously, avoiding a hidden focusable copy and overlapping branch-access reads.
- Controls use 150–160 ms transitions and retain the global reduced-motion rule.

Interaction changes:

- Dashboard Add student is checked with `studentsManage`, opens the real Add Student dialog through the non-sensitive `?action=add` state, and remains visibly disabled in read-only mode.
- Students search/filter state remains mounted while details and edit overlays open. A scalar edit response is merged into the loaded relation-rich row, so seat/shift context no longer disappears until refresh.
- Add Student success refreshes both the roster and its payment/shift supporting truth.
- Students-to-allocation links contain only branch/student IDs. The authorized destination resolves the display name; names are no longer written into query strings.
- Collection review separates due selection from payment details, shows oldest-first allocation, and derives an expected whole-student balance before confirmation. It does not change debt until the server confirms.
- Receipt content is grouped for scanning while the immutable snapshot, historical logo/PDF selector, document language, and action failure behavior remain intact.

Domain behavior is deliberately unchanged. Server-side tenant scope, permissions, entitlements, writable branch state, allocation overlap/capacity, fee arithmetic, stable idempotency, oldest-first allocation, immutable receipt snapshots, owner-only voiding, and provider behavior remain authoritative.

## Task steps: before and pilot

| Task | Before | Pilot |
| --- | --- | --- |
| Add a student from dashboard | Add student opened the Students list; read-only users could still see an apparently actionable CTA. | One capability-aware CTA opens the existing form; read-only state is explicit and no mutation is attempted. |
| Find and edit a student | Search, open row menu, edit in place; the successful scalar response could remove loaded seat/shift relations until reload. | Same compact flow and list context; successful edits merge scalar fields and retain allocation context. |
| Start allocation from a student | Student ID and name were placed in the allocation URL. | Only IDs travel in the URL; authorized branch data supplies the display name. |
| Check a seat and allocate | Choose shift, inspect availability, choose Assign, select student, confirm. | Same domain steps and validation, with clearer surface hierarchy and neutral occupied/blocked treatment. |
| Record a partial fee | Scan a single long form, infer distribution, confirm, then retrieve the receipt. | Select dues on the left, review amount/method and projected balance on the right, confirm once, then use the structured receipt. |
| Recover an uncertain collection | The locked warning and same-request retry existed but were visually mixed into the form. | The persistent uncertainty banner and locked fields are prominent; retry still sends the identical stored request and retrieves one receipt. |

## Secondary color decisions

The pilot adopts only restrained semantic pairs:

- information `#285D7D` on `#EAF3F9`;
- success `#21653F` on `#EAF4ED`;
- attention `#7A4B0D` on `#FFF4D6`;
- danger `#923B3B` on `#FBEDEC`;
- insight `#665092` on `#F2EDF8`;
- neutral `#53635B` on `#EFF2F0`.

They are used for small indicators, borders, badges, icons, and confirmations. Occupied is not rendered as danger, pending fees are not rendered as failed transactions, and every status keeps text or an icon. Automated token tests require normal-text contrast for these pairs.

## Trust boundaries and acceptance checks

- The preview harness mounts the production shell and four production surfaces, but replaces Clerk and `/api` with an in-memory synthetic adapter. It never adds a Next.js route or production auth bypass and never contacts PostgreSQL, Razorpay, messaging, AI, or customer data.
- Synthetic evidence is visibly labelled. Fixture names, phone numbers, receipts, amounts, access decisions, and errors are invented.
- Public URL language ownership, saved interface language, and independent document language are unchanged. English, Hindi, and Hinglish are selected through the application preference layer; changing language does not key or remount the collection workflow.
- Receipt/PDF failures do not issue another collection. The receipt keeps the legacy `data-fee-receipt-logo` contract so PDF output does not silently switch marks.
- No schema, migration, seed, environment, deployment, provider, or production-data work is required.

Focused acceptance evidence is recorded in the
[harness README](../../tests/application-design-pilot/README.md). The committed
[review matrix](application-design-pilot-evidence/review/) contains 53 PNGs:
24 pinned pre-pilot baseline images, 24 matched after images, and five additional
after-state images. The four viewports are 1440 px desktop, 834 px tablet, and
390 px and 320 px phones.

The pinned baseline was rendered from a temporary detached checkout at
`a3c6ed1337907e936a3ae2d77537ccb2e33415f0`, not from a theme toggle on the
modified component tree. That checkout was verified clean and removed after the
capture. The after set was rendered from this branch after the responsive,
language, permission, focus-return, contrast, and uncertain-retry fixes.

Representative evidence:

- [desktop dashboard before](application-design-pilot-evidence/review/desktop-1440/baseline-dashboard-en.png) and [after](application-design-pilot-evidence/review/desktop-1440/after-dashboard-en.png);
- [desktop Hindi Students before](application-design-pilot-evidence/review/desktop-1440/baseline-students-hi.png) and [after](application-design-pilot-evidence/review/desktop-1440/after-students-hi.png);
- [390 px Hindi navigation](application-design-pilot-evidence/review/mobile-390/after-mobile-navigation-hi.png);
- [390 px uncertain collection](application-design-pilot-evidence/review/mobile-390/after-collection-uncertain-en.png).

Agent visual review covered the 320 px header, 390 px Hindi drawer and loaded
read-only dashboard, tablet Seats and payment overlays, desktop error and
restricted states, and the mobile uncertainty recovery. Automated checks cover
serious/critical accessibility findings, keyboard focus return, dialog scroll
locking, compact-header overlap, language changes without workflow remount, and
byte-identical uncertain-request retry. This is synthetic component evidence;
it is not customer validation or connected Clerk/database/provider evidence.

## Validation record

| Check | Result |
| --- | --- |
| Dedicated Playwright pilot matrix | 34 passed; 10 intentional viewport-specific skips |
| Compact-navigation follow-up | 3 compact viewports passed; 1 desktop skip; settings footer inside viewport |
| Focused Vitest set | 10 files / 58 tests passed |
| ESLint | passed with 0 errors and 2 unrelated generated-file warnings |
| Production build | Next.js compile, TypeScript, 74-page generation, and two-workflow manifest verification passed |
| Evidence | 53 PNGs; all 24 before/after pairs present, non-empty, and distinct |
| Whitespace | `git diff --check` passed; only Git line-ending notices were emitted |

The optional agent-browser CLI was unavailable in this workspace, so Playwright
was used as the browser driver. One intermediate run experienced a browser
session close during navigation; that exact case passed immediately in isolated
retry, and the final post-fix full matrix completed cleanly at 34 passes / 10
intentional skips.

## Local review script

1. Run `pnpm exec node tests/application-design-pilot/server.mjs`.
2. Review dashboard at `http://127.0.0.1:4187/branch/pilot?mode=after&lang=en`.
3. Review Students at `http://127.0.0.1:4187/branch/pilot/students?mode=after&lang=hi`.
4. Review Seats at `http://127.0.0.1:4187/branch/pilot/seats?mode=after&lang=hinglish`.
5. Review partial/uncertain collection at `http://127.0.0.1:4187/branch/pilot/payments?mode=after&surface=collection&scenario=uncertain&lang=en`.
6. Add `role=restricted`, `role=readonly`, or `state=empty|error` to inspect conditional states. `mode=baseline` is a quick current-tree theme-off comparison; use the committed pinned-baseline screenshots for the historical before state.

## Approval and rollback

Approval requested at this gate covers the shared application design: shell/navigation, hierarchy, surface density, semantic color, operational typography, overlays, and restrained motion. It does not approve a business-policy or domain change.

Until explicit approval, remaining organization, payments, renewals, attendance, imports, AI, staff, settings, account, and billing route families are intentionally unchanged.

Rollback is local and commit-scoped: revert `9a332ac` for workflow composition and `2cc4e0b` for the scoped theme/shell. Neither rollback touches the completed public website/localization or migration history.
