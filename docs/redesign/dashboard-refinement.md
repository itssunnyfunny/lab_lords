# Dashboard visual correction

## 2026-09-25 component reconstruction (current local pilot)

The owner asked to keep the established grid and reconstruct individual
components against the **original** 1491 × 1055 reference. The
[frozen component specification](dashboard-component-spec.md) records the
data-backed decision for each panel before implementation. The photo and
quotation stay absent. The work is limited to the dashboard pilot and its
synthetic harness; branding, other app routes, public pages, existing reads,
authorizations and payment recovery have not been expanded or propagated.
Home, Features, Pricing and FAQ copy needs no change because this is an
unapproved authenticated pilot presentation, not a customer-visible feature
or public claim.

The Action Center is now one full-width section with two equal, shallow cards
for the only complete priority groups; zero groups still render the calm,
restricted or unknown state. Four distinct summaries use reference-like value,
icon and padding hierarchy. Collections has an outlined 14/7-day control,
framed single-series bars, grid and legend; seven days filters the **same real
14-day observations**. Its billed, collected and outstanding values are
independent facts, not a stacked monthly total. Seating now uses eight scaled
share tiles per current shift with exact allocated/capacity counts; a
zero-capacity shift shows no availability tiles. Attendance is separately
labelled, and missing shift detail remains unavailable.

Upcoming fees and Follow-ups now use compact semantic desktop tables rather
than multiline record cards. They retain meaningful fee type/date/amount/state
and due/remaining/contact/action fields; mobile reflows the same table DOM
without hiding those fields. Follow-ups keeps selection, full-queue access and
the exact-payment action. Short desktop contact labels disclose the full
recorded outcome/next date by keyboard; mobile shows it directly. Activity
uses 32px icons and concise title/detail/time rows from actual events. Quick
Actions is a two-column grid containing only Assign seat and Review shifts,
subject to the existing capability decisions.

[Native-scale component pairs and measurements](dashboard-component-evidence/README.md)
are the primary visual evidence. The final [desktop busy
view](dashboard-correction-evidence/desktop-1440/busy-full.png), [390px mobile
busy view](dashboard-correction-evidence/mobile-390/busy-full.png), [320px mobile
busy view](dashboard-correction-evidence/mobile-320/busy-full.png), [Hindi
mobile view](dashboard-correction-evidence/mobile-390/dashboard-hi-operations.png),
[small-library view](dashboard-correction-evidence/desktop-1440/dashboard-en.png),
and [empty view](dashboard-correction-evidence/desktop-1440/empty.png) show
responsive and low-count behavior. Crops and page captures are synthetic, not
production data. The synthetic ribbon is measured separately from app geometry.

Deliberate differences from the illustration: two genuine priorities instead
of five, four independent summaries instead of six, no photo/quotes, no
historical weekday occupancy, no collection-rate line or pending stack, no
membership-expiry or scheduled-contact claims, no invented alerts/events,
four real rows and selection/payment controls in Follow-ups, and two permitted
Quick Actions instead of six. The Follow-ups panel is consequently taller than
the illustration. The existing dashboard shell still gives the content about
15px less horizontal space at 1440px than the proportionally displayed
reference. No "reference matched" claim is made from passing tests or similar
colour alone. Visual approval is still pending; no push, PR or deployment.

Current validation (safe synthetic fixture only):

- `node node_modules/@playwright/test/cli.js test dashboard.spec.ts --config=tests/application-design-pilot/playwright.config.ts`: 54 passed, 6 desktop-only skips across four viewports. After the final zero-capacity and keyboard-contact fixes, the focused cross-viewport rerun passed 5 with 3 intentional skips; the full desktop pilot suite passed 27 with 2 intentional skips. Final 390px busy/Hindi/calm/empty captures and 320px busy capture also passed.
- `node node_modules/@playwright/test/cli.js test dashboard-components.spec.ts --config=tests/application-design-pilot/playwright.config.ts --project=desktop-1440`: 1 passed. The original-resolution comparison generator completed successfully.
- `node node_modules/vitest/vitest.mjs run tests/unit/lib/dashboard-presentation.test.ts tests/unit/lib/branch-dashboard.test.ts tests/unit/lib/overdue-queue.test.ts tests/unit/lib/localization.test.ts tests/unit/lib/application-design-pilot.test.ts`: 33 passed in five files; no database test ran.
- `node node_modules/eslint/bin/eslint.js .`: zero errors, two pre-existing warnings in the generated Workflow route and coverage file.
- `node node_modules/next/dist/bin/next build`: passed TypeScript and 74 static pages with escalated filesystem permission after the sandboxed attempt could not read the workflow bundler parent path. `node scripts/verify-import-workflow-manifest.mjs`: verified two import workflows. No schema, migration, environment, provider or production-data operation ran.

## 2026-09-25 earlier grid correction

Status: implemented locally on `codex/application-design-pilot`; design approval
is still pending. No other application route family or public page was changed.

The supplied target is 1491 × 1055. The latest browser captures use a native
1440 × 1024 viewport and include the synthetic preview's 21px ribbon. The
comparison presents both dashboards at the same 1440px width, scales the target
proportionally without cropping, and labels the different illustrative and
coherent synthetic data. It is a visual review, not a pixel-difference score.

The dashboard now has a dashboard-only 232px desktop sidebar, 22px workspace
padding, 12px main gaps, and an explicit 2 : 1.35 : 1 collections / seating /
activity grid. Collections is the widest panel; activity is the narrowest. Two
worklists occupy the row below the left and middle panels. On phones, attention
and summaries lead, then the record worklists precede the chart and activity.

Browser-measured busy-state geometry at 1440px: Action Center 585 × 157px,
summary row 1164 × 83px, collections 524px wide, seating 354px, activity 262px,
and worklists starting at y=836px. These are rendered bounds, not CSS estimates;
[the measurements](dashboard-correction-evidence/desktop-1440/busy-geometry.json)
are committed with the capture. Compact priority and summary cards, restrained
serif section headings, wider top search, tighter activity rows, and earlier
record-level work replace the prior explanatory layout. The seating panel shows
the exact current allocated/total shift slots, accurate per-shift fill, and a
separate attendance section. If a snapshot omits shift-slot detail, the panel
shows it as unavailable instead of relabelling physical seats as shift slots.
All fee and activity figures still come from the existing authorized sources
described below. At compact widths, keyed panels change DOM order to follow the
visible reading and keyboard order without discarding a selected fee record.

Review evidence:

- [Reference beside current populated dashboard](dashboard-correction-evidence/target-current-desktop.png)
- [Before beside current small-library dashboard](dashboard-correction-evidence/before-after-desktop.png)
- [Full populated view with both worklists](dashboard-correction-evidence/desktop-1440/busy-full.png)
- [Current small-library view](dashboard-correction-evidence/desktop-1440/dashboard-en.png) and [empty view](dashboard-correction-evidence/desktop-1440/empty.png)
- [390px English](dashboard-correction-evidence/mobile-390/dashboard-en.png) and [390px Hindi operations](dashboard-correction-evidence/mobile-390/dashboard-hi-operations.png)

Remaining deliberate differences: the owner excluded the reference photo and
quotations; only two priority groups and four distinct summary metrics have
complete, reliable sources; the chart is real 14-day daily collections rather
than invented stacked or comparison series; seating shows current shift slots
rather than unsupported historical occupancy; and Quick Actions contains the
two authorized secondary actions. The generated Tasks, membership expiry,
optimization, inferred absence, and extra export controls remain unsupported.
The two priority cards deliberately form a short strip, not half-width banners;
the open horizontal area is not filled with fabricated alerts. This is a visible
departure from the target's five-card Action Center.

## 2026-09-25 validation

The safe synthetic browser suite passed all 48 dashboard cases across 1440px,
834px, 390px and 320px viewports. Two additional desktop checks passed for
selection persistence across the responsive reordering and an absent
shift-slot breakdown. The broader pilot desktop suite passed 10 cases with
one intentional mobile-only skip. The allowlisted unit suite passed 44 tests
in eight files. `pnpm lint` passed with zero errors and two existing warnings;
targeted changed-file lint passed without warnings. The production build passed,
including TypeScript, 74 static pages and verification of both import workflow
manifests. The first sandboxed build attempt could not read a workflow bundler
path; rerunning the same command with filesystem permission passed. No database
suite, production data, provider operation or deployment was involved.

Direct `pnpm exec tsc --noEmit` still reports the pre-existing, unchanged
`tests/browser/public-localization.spec.ts:60` argument-type error. The
production build's TypeScript step passed. The comparison generator completed
and preserved the target's aspect ratio at an equal displayed 1440px width.
The dashboard remains unapproved for wider rollout.

## 2026-09-23 initial correction

Status: implemented locally on `codex/application-design-pilot`; explicit design
approval is still required before extending this direction to other route families.
This is not a deployment or connected-production acceptance test.

## What changed

The supplied generated image guided the composition, not the product facts.
The first refinement drifted into tall explanatory cards and was rejected.
This correction restores the requested hierarchy: compact heading and attention
strip, four concise summaries, a roughly 5/4/3 collections/seating/activity grid,
then upcoming fees and follow-ups below the left and middle columns.

- Removed the previous dashboard's oversized progress/chart treatment, fabricated
  overdue activity, low-utilization warning, and repeated priority totals.
- Omitted the reference's library photo, quotes and decorative welcome panels.
  The existing small botanical brand mark remains.
- Made inactive sidebar rows quiet and the selected row forest green. The
  dashboard sidebar displays Lab Lords instead of repeating the branch title.
- Separated collections, billed fees and outstanding balances; replaced the
  misleading collection-rate presentation with labelled figures.
- Restored a real daily-collections chart using the existing authorized trend
  endpoint. No new backend or fabricated daily distribution is involved.
- Moved longer definitions into keyboard-accessible details disclosures. Expected
  fee badges, action restrictions and failures remain visible.
- Combined recorded dues and actual contact outcomes in one oldest-first queue.
  Upcoming fee dates and real recorded activity have separate purposes.
- Kept Add student and Review payments in the heading, collection beside each
  due record, and just two secondary shortcuts: Assign seat and Review shifts.
- Preserved the existing collection dialog, same-request recovery and receipt.
  Successful collection refreshes dashboard reads without remounting the dialog.

The React review checklist informed derived refresh state, parallel independent
reads, and explicit branch/user reset boundaries. Styling is dashboard-scoped;
Students, Seats, other routes and shared collection behavior are not redesigned.

## Sources and meanings

All reads use existing server-authorized endpoints. No server calculation,
authorization policy, schema, provider or entitlement was changed. In the table,
`{branch}` means the current branch ID, and amounts are INR.

| Visible information | Existing source | Meaning and limits |
| --- | --- | --- |
| Action Center: recorded overdue fees, priority 1 | `/api/branches/{branch}/payments/overdue?all=true` | Sum of remaining balances on recorded DUE fee periods beyond the existing seven-day grace boundary. Count is fee periods, not unique students. Full queue goes to `/overdue`. |
| Action Center: fees due today, priority 2 | `/api/branches/{branch}/renewals?filter=UPCOMING&days=7&search=&limit=4`, `counts.TODAY` | Branch-wide service count, independent of the returned four-row page. Includes expected fees, which must be reviewed before collecting. Opens the existing full `/renewals` queue; it does not claim to preselect a filter. |
| Collected this month | Monthly analytics snapshot, `paidAmount` | Non-void collections by `collectedAt`, plus eligible legacy paid records by `paidAt`, within the service's current calendar month. Can settle older fee periods. Existing import/legacy accounting rules remain authoritative. |
| Active students | Snapshot `activeStudents`; authorized complete student list fallback | Student profiles with ACTIVE status, not visits, allocations or new enrollments. |
| Shift slot utilization | Snapshot `occupancyRate`, `assignedSeats`, `totalSeats` | Allocated slots divided by total shift capacity. These fields represent shift slots despite their legacy names; they are not a physical-seat or attendance percentage. Low utilization is neutral information. |
| Present today | `/api/branches/{branch}/attendance?limit=1`, `counts.attended` | Service-wide student count with a PRESENT mark or a valid recorded visit on the service's local attendance date. Never derived from the single returned roster row. |
| Billed this month | Snapshot `monthlyRevenue` | Existing billed-fee aggregate by due date in the current month, preserving its waiver/ledger rules. It is not cash received. |
| Outstanding today | Snapshot `dueAmount` | Remaining recorded DUE balances through the as-of day, including older periods. Includes dues still inside the grace period, unlike the overdue priority. |
| Daily collections, last 14 days | Existing `/api/analytics/branch/{branch}/trends?type=payment&period=all&from=...&to=...` | Fifteen consecutive all-time cumulative Collected observations yield fourteen daily differences. The graph has its own explicit date range, not the monthly summary's population. Missing/invalid intervals are not filled. Actual daily amounts are available in an accessible table. |
| Per-shift slot meters | Snapshot `seatDetails.shifts` | Allocated slots / capacity for each shift. One physical seat can contribute a slot to multiple shifts. No invented utilization history or heatmap. |
| Not marked / marked absent / open visits | Attendance `counts.notMarked`, `absent`, `open` | Not marked is not an absence. Absent requires an explicit mark. Open is a visit count across dates, not today's present-student count. The panel shows the service's attendance date and timezone. |
| Follow-ups | Complete overdue list, first four shown; `/renewals?filter=OVERDUE&days=7&search=&limit=6` | Oldest overdue fee periods first. Actual latest contact outcome and next-contact date appear when returned for that payment. Missing contact details direct to the full fee queue instead of claiming nobody contacted the student. Selection, exact-payment collection and full-queue links remain. |
| Upcoming fee dates | Same UPCOMING renewal page, first four rows | Earliest fee dates in the next seven days, excluding today. Recorded and expected fees are explicitly distinguished. Expected amounts are estimates, not debt or membership expiry. A continuation count appears when paginated. |
| Recent activity | `/collections` first 50, authorized student list, active allocation list | Newest five available non-void collections, student profile creations and active allocation creations, using actual `collectedAt`/`createdAt`. Missing/invalid timestamps are omitted, not replaced with refresh time. This bounded composition is not a complete audit log. |

Snapshot endpoint: `/api/analytics/branch/{branch}/snapshot?period=month`.
Analytics also respects the existing analytics capability/plan gate. Student,
allocation, attendance and fee reads are skipped when their permissions are absent.
The client presentation is not an authorization boundary; existing server checks
remain authoritative for every read and action.

### Priority and completeness rules

Only positive, successfully loaded groups appear, in the order above. There is
no score and no forced minimum number of alerts. An empty successful result is
calm; a failed source is explicitly unknown; restricted fee access is labelled.

There is no existing complete branch-wide aggregate of **scheduled contacts due
today**. The renewal endpoint pages by fee date, not next-contact date. Therefore
this dashboard does not relabel its sample as a complete follow-up queue or invent
a follow-up-due count. The full existing fee queue remains reachable.

The existing trend source was inspected through `AnalyticsAccessService`,
`analytics/trends/payment.trends.ts` and `getPaymentPeriodStats`. Its month mode
uses month-end totals at every as-of point, so it must not be labelled daily
income. The correction uses all-time cumulative mode, whose cutoff advances by
day, and takes consecutive differences. It requests only 15 points (within the
31-point limit). Historical reconstruction follows current ledger/void rules;
it is not an immutable historical accounting export. These existing rules and
the endpoint's serial query cost were not changed.

The displayed money is intentionally not a stacked monthly total: collections
can settle old fees, while outstanding spans periods. No subtraction, comparison
percentage or trend is invented. Analytics and renewal boundaries continue to
use their existing service definitions; this pass does not normalize them to the
attendance timezone.

Unsupported reference concepts omitted: Tasks, AI priority scores, automatic
absence detection, seat optimization, membership-expiry plans, export actions,
combined revenue/collection curves, utilization heatmaps and period-over-period changes.
No new backend capability, polling, WebSocket, push permission or reminder service
was introduced.

## Refresh, isolation and workflows

- All independent reads settle together, retaining per-source status. A failed
  source does not turn successful sources into zeros or erase their meaning.
- Refresh is explicit and also occurs when returning to the window, except while
  a collection dialog is active. Initial loading and refresh completion time are
  visible. Partial failure is named at the affected section.
- Confirmed collection refreshes relevant reads and uses the existing toast once
  per saved action. Receipt and same-request recovery stay mounted.
- A branch/user key resets private values, selections and dialogs. Effect cleanup
  prevents an old request from publishing into a new scope. Language changes do
  not reset selection or remount a payment workflow.
- Read-only banners, permission filtering, plan gates, exact payment links,
  bulk-selection routes, profile links, focus restoration and preferences remain.
- No approval was inferred for rollout, commit history rewriting, push, PR or deploy.

## Rendered evidence and preview

Start the isolated harness from the repository root:

```powershell
pnpm exec node tests/application-design-pilot/server.mjs
```

[Open synthetic dashboard](http://127.0.0.1:4187/branch/pilot?mode=after&lang=en).
This uses real components with an in-memory adapter, no Clerk session, database or
external provider. Every screen is labelled synthetic. Full-route destinations
outside the existing preview surfaces show an explicit preview-boundary page,
not a fabricated implementation.

Preview controls: `lang=en|hi|hinglish`, `role=restricted|readonly`,
`state=busy|calm|empty|loading|error|attendance-error|trend-error`, and
`scenario=dashboard-collection` for a confirmed partial collection with refreshed
figures. `scenario=uncertain` retains the earlier same-request-recovery exercise.
The default populated state remains the small-library fixture. Busy adds records
only inside the isolated adapter; production has no synthetic fallback.

Fixture reconciliation (as of 23 September 2026):

| State | Active students | Allocated shift slots | Present / absent / not marked | Collected this month | Billed this month | Outstanding | Last 14 days collected |
| --- | ---: | --- | --- | ---: | ---: | ---: | ---: |
| Small | 3 | 2 / 16 | 2 / 0 / 1 | ₹1,900 | ₹1,500 | ₹2,400 | ₹400 |
| Busy | 11 | 10 / 16 | 9 / 1 / 1 | ₹6,900 | ₹9,500 | ₹5,400 | ₹5,400 |
| Empty | 0 | 0 / 0 | 0 / 0 / 0 | ₹0 | ₹0 | ₹0 | ₹0 |

Busy contains eight additional ₹1,000 fee records, ₹5,000 in dated collections
and ₹3,000 remaining. Those records also drive the chart/activity/overdue queue.
Two shifts each have five distinct allocated seats. Upcoming displays four of
six expected dates. Small and empty states preserve the same layout without
adding filler alerts or bars.

The harness serves the actual self-hosted fonts from a successful local `.next`
build. Run `pnpm build` first if those assets are missing. The new evidence is
captured after `document.fonts.ready` and Chromium's actual-glyph font inspection,
not from a font shim or only a computed CSS font-family value. Verified families
are Playfair Display for English/Hinglish major headings, Inter for figures,
Manrope for controls/section headings, and Noto Sans Devanagari for Hindi.

Evidence lives in [dashboard-correction-evidence](dashboard-correction-evidence/):
four viewport directories, each with 17 PNGs and three actual-font JSON records.
Top, operations and lower views cover all three languages; additional captures
cover calm, empty, loading, source-error, restricted, read-only and busy states.
These are real viewport captures of the scrollable application workspace, not
stitched mockups. The full busy capture increases only the capture viewport's
height to show all record rows; production cards have no forced viewport height.
The before/after comparison uses the same 1440px small-library viewport and
fixture on both sides. Earlier interim captures are not acceptance evidence.

- [Before / after desktop comparison](dashboard-correction-evidence/before-after-desktop.png)
- [Target / corrected desktop comparison](dashboard-correction-evidence/target-after-desktop.png)
- [Busy desktop](dashboard-correction-evidence/desktop-1440/busy.png)
- [Full view with work queues](dashboard-correction-evidence/desktop-1440/busy-full.png)
- [Small-library desktop](dashboard-correction-evidence/desktop-1440/dashboard-en.png)
- [Tablet, Hindi](dashboard-correction-evidence/tablet-834/dashboard-hi.png)
- [390px, English](dashboard-correction-evidence/mobile-390/dashboard-en.png)
- [320px, Hindi](dashboard-correction-evidence/mobile-320/dashboard-hi.png)
- [Empty desktop](dashboard-correction-evidence/desktop-1440/empty.png)
- [Desktop font evidence](dashboard-correction-evidence/desktop-1440/fonts-en.json)

Direct comparison with the reference: both have a quiet left navigation rail,
compact branch context, a leading priority panel, restrained semantic cards and
practical detail panels. This version intentionally gives up decorative imagery,
five simultaneous alerts and unsupported comparison/heatmap data. The collections
column is widest, activity is narrowest, worklists begin within the first desktop
viewport, and mobile puts follow-ups/upcoming fees before supporting visualizations.
Manual review found no unintended overlap or horizontal clipping in
the inspected desktop/tablet/phone views. Small screens scroll vertically rather
than compressing the whole dashboard above the fold.

Deliberate differences from the target:

- Two real priority groups and four distinct summaries, not five manufactured
  alerts or duplicate totals.
- A single daily-collection bar series, not mixed-population stacked totals or
  unsupported comparison percentages.
- Current shift breakdowns, not historical occupancy heatmaps or inferred absence.
- Longer record rows and natural scrolling preserve selection, collection actions,
  contact dates and wrapping Hindi text.
- No photo, quotes, Tasks, membership-expiry or optimization/export controls.

## Validation

No database-backed test suite was invoked. The explicit Vitest config has eight allowlisted unit
files and no database setup or `.env.test` loading.

```powershell
pnpm exec node node_modules/vitest/vitest.mjs run --config tests/application-design-pilot/vitest.config.ts
pnpm exec node node_modules/@playwright/test/cli.js test --config tests/application-design-pilot/playwright.config.ts tests/application-design-pilot/dashboard.spec.ts tests/application-design-pilot/pilot.spec.ts
pnpm exec node node_modules/@playwright/test/cli.js test --config tests/application-design-pilot/playwright.config.ts tests/application-design-pilot/dashboard.spec.ts
pnpm exec node node_modules/@playwright/test/cli.js test --config tests/application-design-pilot/playwright.config.ts tests/application-design-pilot/dashboard.spec.ts tests/application-design-pilot/pilot.spec.ts --project=desktop-1440 --grep 'partial collection|partial collection retains|busy library|seat scope'
pnpm lint
pnpm exec node node_modules/eslint/bin/eslint.js tests/application-design-pilot/synthetic-api.ts tests/unit/lib/dashboard-fixture.test.ts tests/application-design-pilot/dashboard.spec.ts tests/application-design-pilot/compare-dashboard.mjs
pnpm build
git diff --check
```

Results:

| Check | Observed result |
| --- | --- |
| Final allowlisted unit run | 8 files, 44 tests passed. Includes in-process synthetic-record reconciliation; no HTTP server or DB needed for that unit test. |
| Initial combined browser matrix | 77 passed, 10 intentional viewport skips, 1 tablet loading-test timeout while the production build was running. All 34 existing pilot scenarios passed. |
| Final dashboard-only browser matrix | All 44 passed across desktop, tablet, 390px and 320px. Loading now uses an explicitly held/released response instead of a wall-clock race. |
| Final harness consistency follow-up | All 4 targeted desktop scenarios passed after fixture seat maps and reopened due balances were aligned with dashboard records. |
| Repository lint | Passed, 0 errors; 2 pre-existing unused-disable warnings in generated workflow code and coverage output. |
| Final changed-harness lint | Passed, no warnings or errors. |
| Production build | Passed, including TypeScript, 74 static pages and verification of both import workflow manifests. Production sources were unchanged afterward. |
| Whitespace / patch check | Passed. |

An earlier direct TypeScript invocation also encountered the existing
`tests/browser/public-localization.spec.ts:60` argument-type issue. The production
build's TypeScript step passed; the unrelated test file was not changed.

The browser matrix also asserts the desktop panel-width ordering and worklist
position, mobile work-before-chart order, the busy fixture's totals and daily
table sum, and a failed trend source alongside a successful snapshot.
The browser matrix checks source meanings and amounts, all three languages, real
font use, overflow, calm/error/loading/access states, actual link destinations,
Add student's existing dialog, partial collection refresh/receipt/selection,
keyboard/focus, reduced motion, late branch responses and user-scope reset. Axe
checks serious/critical violations on the English dashboard at every viewport;
the earlier pilot checks retain representative Students, Seats and collection
coverage. Automated checks do not replace full assistive-technology review.

## Scope and release requirements

Production files: dashboard page/panels/queue/activity, dashboard-only sidebar
marker, dashboard presentation/loader, additive localization and scoped CSS.
Supporting changes: unit tests, synthetic harness/fixtures/fonts, browser tests,
review evidence and architecture documentation.

Home, Features, Pricing and FAQ were checked against the public-claims guidance.
No marketing-copy change is needed: this is an internal presentation pilot, with
no new public feature or availability claim. Public pages remain unchanged.

No schema, migration, seed, dependency version, environment configuration, server
authorization, provider, financial calculation or production-data change is
required. Normal build/runtime assumptions remain. Verification is local and
synthetic; connected auth/data/provider behavior was deliberately not exercised.
The existing all-record dashboard reads remain a scalability limit; this pass
does not add an aggregate API or claim an exhaustive activity/follow-up feed.

Implementation commit: `482b27c` — dashboard composition, actual collections and
compact worklists, with focused unit checks. The separate preview/evidence commit
is reported with the final handoff. No push, PR or deployment was performed.
Await explicit design approval before any wider rollout.
