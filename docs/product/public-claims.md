# Public wording and feature claims

Audit closeout, 25 October 2026: Home, Features, Pricing, FAQ and fee-reminder
solution copy stopped advertising the retired AI Messages capability. Plan text
“AI reports and message drafting” is now “AI reports”; draft preview labels now
describe follow-up notes, and AI assistance describes reports/advisory suggestions.
Terms remove the obsolete capability name; Privacy explicitly retains historical
draft records. No policy expansion, new plan, launch, historical-ledger,
GA/provider-verification or import-rollout claim is added. English/Hindi/Hinglish
copy follows the same factual correction. See the [closeout record](../audits/audit-closeout-2026-10-25.md).
Recovery, term correction/cancellation and older billing-history browsing extend
the existing management workflows. Home, Features, Pricing and FAQ need no
additional promise for those fixes; no new plan or entitlement is introduced.

## Three-plan catalogue — working tree, 2026-10-23

Home, Features, Pricing, FAQ, relevant solution pages, onboarding and dedicated Billing use the shared three-plan catalogue: Basic ₹99, Standard ₹299, Pro ₹499 per active/billable branch per month. Standard and Pro include staff, advanced analytics and AI; only Pro includes WhatsApp entitlement. The public copy explicitly requires WhatsApp setup/rollout availability and applies messaging charges/usage terms without promising unlimited usage. English, Hindi and Hinglish preserve the same facts. The normal trial remains 30 days of Standard. Basic has an owner-approved design prototype for students, seats and basic fees; its earlier shared-form design was superseded. Its organization-connected extension awaits review. Neither design is released.

These are working-tree release claims, not a statement of production deployment. See [cutover status](../billing/three-plan-cutover.md). The [2026-10-22 recovery report](../audits/billing-recovery-2026-10-22.md) records the prior two-plan prices and actual Test events; it is historical evidence, not the current catalogue.

The observed domestic-card update restriction changes the authorization flow,
not the advertised plan price or features. Billing now explains that a plan
change needs a new recurring authorization and that recurring charges change
at a safe-cycle boundary. Do not promise that every existing card mandate can
be changed in place, that a downgrade always starts at the next immediate
renewal, or that opening Checkout grants paid access. All stored cards use the
replacement flow until provider-supported capability can be proven separately.
Home, Features, Pricing and FAQ need no new payment-method or gateway guarantee;
the customer-facing confirmation carries the specific authorization/timing copy.

The 2026-10-23 shared Renewals/Overdue capability wording correction names Pro
for WhatsApp while retaining Standard for staff/AI/analytics. Home, Features,
Pricing and FAQ keep the existing three-plan facts; no marketing promise,
feature availability or pricing change is introduced by this correction.

## Organization navigation preview — 2026-10-28

Home, Features, Pricing and FAQ need no copy changes for this synthetic
navigation task. Independent branch plans are an intended product requirement,
not a current backend capability or released claim. The preview labels that
limitation explicitly; per-branch pricing must not be presented as proof of
independent subscriptions. See [compatibility evidence](../billing/branch-plan-compatibility.md).

## Narrowed Basic prototype copy review — 2026-10-28

Home, Features, Pricing and FAQ remain unchanged in this prototype iteration.
The narrowed scope is not integrated or released and must not be advertised as
shipped. The hero is the visual reference, not an authorization or billing rule.
Reconcile the four-area scope with public claims when integration is approved
and verified. See the [current packet](../redesign/basic-prototype-review.md).

## Earlier Basic workspace copy review — superseded design, 2026-10-28

**No marketing change needed for this unreleased presentation implementation.**
Home, Features, Pricing and FAQ retain the three-plan catalogue and existing
workflow claims; the public hero itself is unchanged. Existing Billing gains
illustrative Simple/Full previews and accurate downgrade/record-retention copy,
including English, Hindi and Hinglish. See the [review packet](../redesign/basic-workspace-review.md).

One existing policy/copy discrepancy remains for owner resolution: the broad
phrase “Staff access requires Standard or Pro” is stronger than the current
server rule. Existing members keep permitted core operations after downgrade;
new invitation acceptance and staff management require the premium entitlement.
This task preserves and tests that behavior. Downgrade copy therefore says
“Staff invitations and permission controls”; do not infer that membership is
revoked or silently change authorization to match the broad marketing phrase.

## Approved public baseline

Reviewed 2026-09-21 at implementation revision `804b133`, with regression coverage
in `3c27e4b`; approved wording baseline is `cd20304`.
The implemented public site is the wording reference. Preserve accurate headings,
descriptions, feature names and CTA labels; change only the smallest phrase needed
for an audience correction, verified behaviour or a missing released capability.
The repository establishes product facts, not a new marketing tone.

## Availability evidence

- **Owner-confirmed:** in this task the owner reported that production baseline
  `c9a13d13189a612de746f174d842328ffcde4808` contained collections/receipts,
  renewals/follow-ups and attendance. This is owner-reported availability, not an
  independent production exercise.
- **Independently checked deployment metadata:** read-only Vercel
  `list_deployments` and `get_deployment` returned deployment
  `dpl_H4CYeLti9bHU4voCBvwRKcVmzAvb`, `READY`, target `production`, commit
  `3007db3f7db5dfc0dbf0073de6ad5683a6c3d9da`, with aliases `lablords.in` and
  `www.lablords.in`. The commit merges localization PR #278. Local ancestry
  confirms localization commit `c4af748` is included. The corresponding services,
  language catalogues, attendance scanner, fee-balance and access-capability code
  have no diff between that release and this branch's pre-edit HEAD.
  [Deployment record](https://vercel.com/shani-yadavs-projects/lab-lords/H4CYeLti9bHU4voCBvwRKcVmzAvb).
- The deployment listing separately identifies the ready production releases for
  renewals (`28b1e43`, PR #275), collections (`468f67b`, PR #276) and attendance
  (`c9a13d1`, PR #277). This corroborates deployment, not a fresh customer-session
  or database check. No production data, saved environment or provider state was
  read or changed by this content task.
- **Still unconfirmed:** current Import V2 enablement and the independent
  WhatsApp delivery/automation/report/notice gates and commercial rollout. Do not
  expand their public promises or label them unavailable/coming soon. Physical
  camera/printer behaviour and native device sharing were not exercised here.
- The GitHub CLI was unauthenticated, GitHub search returned no results, and
  Vercel project-detail lookup returned `INVALID_ARGUMENT`. The successful
  deployment listing/detail calls above are the evidence used; a merge alone was
  not treated as proof of customer deployment.

## Feature-to-claim matrix

All rows last reviewed at `804b133`; product-source comparison
revision is `3007db3`. Prices, plan IDs and inclusions remain sourced from
`lib/billingPlans.ts`; this document is not a second commercial catalogue.

| Feature / status | Implementation evidence | Access / plan rule | Release evidence | Approved public wording | Pages |
| --- | --- | --- | --- | --- | --- |
| Students / release-verified | `services/student.service.ts`, `lib/branchCapabilities.ts` | Student permission; branch writability for changes; core public plans | Current production revision above | Keep student details, seat assignments and fee records together. | Home, Features, relevant solutions |
| Seats and shifts / release-verified | `services/seatAllocation.service.ts`, `services/shift.service.ts`, `services/multiShift.service.ts` | Allocation permission; same-branch overlap checks; core public plans | Current production revision | See available seats and assign them to students for the right shift. | Home, Features, setup, relevant solutions |
| Partial payments / owner-confirmed and deployment-verified | `services/feeCollection.service.ts`, `lib/feeBalance.ts`; `docs/ai/fee-collections.md` | `paymentsRecord`: payment-view/record permission and writable branch; both plans | Owner baseline + collections deployment + current revision | Record full or partial payments and check how much each student has left to pay. | Home, Features, Pricing, FAQ, setup, student-fee solution |
| Receipts / owner-confirmed and deployment-verified | Collection snapshot/history readers; `docs/ai/fee-collections.md` | Payment-view permission; no public receipt links; both plans | Same as collections | Download a receipt for a recorded payment and find it again in the student's collection history. | Home, Features, Pricing, FAQ, setup, student-fee solution |
| Renewals/follow-ups / owner-confirmed and deployment-verified | `services/renewals.service.ts`, `lib/renewals.ts` | View payments to read; `paymentsRecord` to save; both plans | Owner baseline + renewals deployment + current revision | See today's fees, upcoming fee dates and pending amounts. Save a note, contact outcome and the next date to follow up. | Features, Pricing, FAQ, setup, fee-reminder solution |
| Attendance / owner-confirmed and deployment-verified | `services/attendance.service.ts`, `components/attendance/AttendanceScanner.tsx`, `docs/ai/basic-attendance.md` | Student permission; correction also needs branch-management permission; writable branch; all three plans. Staff accounts require Standard or Pro | Owner baseline + attendance deployment + current revision | Mark daily attendance and record check-in and check-out, with staff-assisted QR scanning. | Home, Features, Pricing, FAQ, setup |
| Languages / deployment-verified | `services/user.service.ts`, `lib/i18n/`, `docs/localization.md` | Personal interface/document choices; both plans. Report access retains its own plan/permissions | Current production deployment includes `c4af748` and owns customer aliases | Choose your interface language, and set the receipt and report language separately. | Home, Features, Pricing, FAQ, setup |
| Branches / release-verified | `services/branch.service.ts`, public billing catalogue | Authorized branch scope; per-billable-branch pricing | Current production revision | Manage your branches from one account, with separate records for each. | Home, Features, Pricing, FAQ, setup, relevant solutions |
| Staff / release-verified | `services/accessPolicy.service.ts`, `lib/branchCapabilities.ts` | Standard or Pro; permissions still checked per operation | Current production revision | Add your team and choose what each person can view or change. | Home, Features, Pricing, FAQ |
| Reports and AI assistance / implemented in deployed code | `lib/billingPlans.ts`, AI report page/service and branch capability policy | Standard or Pro; analytics and payment-view permission; advisory output | Current production revision; no provider generation executed here | Read summaries of recorded figures and review them alongside your library's records. | Features, Pricing, FAQ |
| Imports / implemented, gated; current enablement unknown | `lib/importFeature.ts`, `importing/`, import routes | Student permission, writable branch, Import V2 flag and mutation limit; AI mapping retains its rules | Source and existing local verification only; target enablement unconfirmed | Existing narrow reviewed-student-list wording retained. No new claim for PDF beta, OCR, every format or whole-file rollback | Existing Home/Features/FAQ/setup copy |

| WhatsApp / implemented, independently gated; commercial availability unknown | `lib/whatsappFeature.ts`, `services/whatsapp*.ts`, public catalogue filtering | Pro entitlement plus separate permissions, flags, mode/canaries, consent and templates | No fresh gate/provider/delivery evidence | Pro includes conditional integration/automation entitlement; setup/rollout and usage terms apply. No unlimited messages or delivery guarantee | Pricing and conditional Pro plan description |
| Standalone AI Messages / retired in current branch | Authenticated 410 routes; AI draft generation removed; historical drafts retained | AI Reports remain available to Standard and Pro with existing permissions | Local implementation, not release evidence | Home, Features, Pricing, FAQ and fee-reminder copy describe AI reports only; no message drafting claim | Features, Pricing, FAQ, Terms and fee-reminder solution |

## Meaning to preserve

- Recording UPI does not transfer money or verify a bank transaction. Collections
  apply actual received amounts to selected dues for one student, oldest due
  first. Fee balances and subscription billing remain separate.
- Receipts describe recorded collections. Historical imported resolutions do not
  generate new receipts. Native sharing is device-dependent and not delivery proof.
- Expected fees are distinct from recorded debt. Follow-up dates do not change fee
  dates, extend membership or release seats.
- QR scanning is staff-supervised and explicitly confirmed. It is not biometric
  verification, unattended check-in or proof against proxy attendance. Unmarked
  days are not automatically absent; attendance does not alter fees or seats.
- Language choices do not translate saved names/notes, stored AI prose or
  provider-hosted screens. WhatsApp language is independent.

## Audience and old URLs

Promote self-study libraries, study halls, reading rooms and study rooms in India.
Keep the product term **students**. Existing accurate library headings and CTAs
remain unchanged. Do not create synonym solution pages.

`/software/coaching-management` and `/software/tuition-management` keep HTTP 200
and self-canonicals for existing bookmarks, with explicit library-focus notices,
`noindex, follow`, and relevant library/contact links. They have no product/FAQ
structured data and are omitted from promotional links and the sitemap. The
older registry content remains unrendered; it is not current promoted wording.
No blind redirects, silent 404s or edits to legal commitments are introduced.

## Keeping claims current

**22 October 2026 — No marketing change needed.** Home, Features, Pricing and
FAQ wording was checked against the restored navigation and controls. The change
exposes supported workflows and repairs their destinations; plan inclusion,
provider rollout, AI advisory behavior, reminder consent, recorded payment facts,
and one-trial-per-owner rules stay unchanged. Branch billing removal retains its
existing cycle-boundary/provider confirmation rules and does not delete history.
The [local restoration review](../redesign/navigation-restoration-review.md)
records implementation and verification, without a new availability or release claim.

For a customer-visible feature change, check Home, Features, Pricing, FAQ and the
relevant solution/setup content. Record the exact phrase changed and the factual
reason, or explicitly record **No marketing change needed**. Preserve accurate
approved wording. Update evidence status without inventing availability, a launch
date, inclusion or an Accepted architectural decision. See the
[wording change record](../redesign/library-only-content-refresh.md).

**29 October 2026 — No marketing change needed for Basic reconciliation.**
The isolated organization/Basic preview now incorporates merged main's navigation
and Account behavior. It is still a synthetic, unreleased review surface.
Home, Features, Pricing and FAQ acquire no new availability claim from this
change; independent per-branch plans must not be advertised as implemented.
The three-plan catalogue and the merged AI-report-only wording remain intact.

**29 October 2026 — Narrow Basic integration (unreleased).** This supersedes the
preview-only no-copy-change note above. Basic is students, seats and student fees,
including partial payments and receipts. Home's import/attendance cards now say
Standard/Pro; Features distinguishes student records from spreadsheet import and
qualifies follow-ups; Pricing names the narrow Basic scope and organization-wide
plan; FAQ answers qualify attendance/import/follow-ups. The prepared Hindi and
Hinglish catalogue and required-key manifest include these exact phrases.

Prices remain Basic ₹99, Standard ₹299 and Pro ₹499 per billable branch/month.
The normal Standard trial and existing WhatsApp setup/rollout qualifications are
unchanged. Central Billing says the organization's plan applies to its branches
and distinguishes subscription charges from student fees. Independent branch
plans and deployment availability are not claimed. See the
[local integration evidence](../redesign/basic-integration-review.md).

**29 October 2026 — No marketing change needed for PR #287 review fixes.**
Home, Features, Pricing and FAQ continue to describe student records, seats and
student fees for Basic. Restoring the existing student status action, honestly
reviewing uncertain admissions and correcting receipt calendar dates complete that
scope without new modules, plan inclusion, prices or availability claims. These
changes remain unreleased; see the [review-fix report](../redesign/basic-pr-287-review-fixes.md).
