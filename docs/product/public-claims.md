# Public wording and feature claims

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
| Attendance / owner-confirmed and deployment-verified | `services/attendance.service.ts`, `components/attendance/AttendanceScanner.tsx`, `docs/ai/basic-attendance.md` | Student permission; correction also needs branch-management permission; writable branch; both plans. Staff accounts require Standard | Owner baseline + attendance deployment + current revision | Mark daily attendance and record check-in and check-out, with staff-assisted QR scanning. | Home, Features, Pricing, FAQ, setup |
| Languages / deployment-verified | `services/user.service.ts`, `lib/i18n/`, `docs/localization.md` | Personal interface/document choices; both plans. Report access retains its own plan/permissions | Current production deployment includes `c4af748` and owns customer aliases | Choose your interface language, and set the receipt and report language separately. | Home, Features, Pricing, FAQ, setup |
| Branches / release-verified | `services/branch.service.ts`, public billing catalogue | Authorized branch scope; per-billable-branch pricing | Current production revision | Manage your branches from one account, with separate records for each. | Home, Features, Pricing, FAQ, setup, relevant solutions |
| Staff / release-verified | `services/accessPolicy.service.ts`, `lib/branchCapabilities.ts` | Standard; permissions still checked per operation | Current production revision | Add your team and choose what each person can view or change. | Home, Features, Pricing, FAQ |
| Reports and AI assistance / implemented in deployed code | `lib/billingPlans.ts`, AI report page/service and branch capability policy | Standard; analytics and payment-view permission; advisory output | Current production revision; no provider generation executed here | Read summaries of recorded figures and review them alongside your library's records. | Features, Pricing, FAQ |
| Imports / implemented, gated; current enablement unknown | `lib/importFeature.ts`, `importing/`, import routes | Student permission, writable branch, Import V2 flag and mutation limit; AI mapping retains its rules | Source and existing local verification only; target enablement unconfirmed | Existing narrow reviewed-student-list wording retained. No new claim for PDF beta, OCR, every format or whole-file rollback | Existing Home/Features/FAQ/setup copy |
| WhatsApp / implemented, independently gated; commercial availability unknown | `lib/whatsappFeature.ts`, `services/whatsapp*.ts`, public catalogue filtering | Separate permissions, entitlement, flags, mode/canaries, consent and templates | No fresh gate/provider/delivery evidence | No new public delivery/automation promise. An AI draft is not evidence of delivery | Existing draft-specific explanation only |
| Standalone AI Messages / retirement-planned, still implemented | `docs/localization.md`, branch navigation and AI messages page | Standard and existing AI permissions | Code remains in current deployed revision; removal not evidenced | Existing accurate drafting descriptions retained; no new central selling point | Features, FAQ, fee-reminder solution |

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

For a customer-visible feature change, check Home, Features, Pricing, FAQ and the
relevant solution/setup content. Record the exact phrase changed and the factual
reason, or explicitly record **No marketing change needed**. Preserve accurate
approved wording. Update evidence status without inventing availability, a launch
date, inclusion or an Accepted architectural decision. See the
[wording change record](../redesign/library-only-content-refresh.md).
