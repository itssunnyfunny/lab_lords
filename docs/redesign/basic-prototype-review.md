# Basic prototype review — 2026-10-28

Status: the owner approved this narrowed design on 2026-10-28. The subsequent
[organization-connected preview](organization-branch-preview-review.md) is the
current review entry on the isolated codex/basic-workspace branch. No integration, merge, deployment, production
access or provider action is part of this iteration.

This packet records the earlier standalone snapshot; current persistence,
language, navigation and validation are documented in the linked organization
review packet.

## Scope and design

The owner's narrower request supersedes the earlier requirement to retain every
core capability in Basic. The four primary areas are **Overview, Students, Seats
and Fees**. Library setup, account and subscription access are secondary.

All four screens and their forms use the landing hero's cream, sage and forest
palette, Inter/Playfair typography and simple seat map. Student creation/edit,
allocation, fee recording and receipts are dedicated prototype interfaces; they
do not mount Standard's pages, business forms or dialogs. Standard/Pro retain
their existing full workspace. Link/Image preview shims and icon primitives
are shared; no domain implementation is replaced.

## Review it

Open <http://127.0.0.1:4187/branch/pilot?plan=BASIC>.
Use **Students → Add student → Save & choose seat → select a shift and available
seat → Assign seat → Record fee payment**. The receipt links back to the student's
seat, remaining fee and payment history. Fees also supports recording a partial
payment for an existing student. Setup can edit the sample library and shifts.

Desktop and mobile preview tabs are open. Each tab has its own sample state;
refresh resets it. This English visual prototype uses invented students and
October 2026 fees. It makes no API, database, sign-in or payment-provider calls,
and records no real payment. It is not a production ledger, billing policy,
entitlement change or localized release.

## Implementation and evidence

Owners: tests/application-design-pilot/basic-prototype/ (BasicPrototype.tsx,
Dialogs.tsx, SeatMap.tsx, sample.ts and basic-prototype.css).
main.tsx selects the new prototype for plan=BASIC. The former component harness
is explicit at plan=BASIC&legacy=1; its historical regression suite uses that
flag. preview-location.ts preserves the selected fixture in links.

- Desktop 1440 × 1000: added a ₹900 student, assigned Seat 30, recorded the full
  ₹900, viewed the receipt, student detail and updated fee totals.
- Mobile 370 × 668: added a student, blocked assignment to an occupied seat,
  assigned an available seat and recorded a partial payment. On final code,
  a ₹700 entry against ₹600 outstanding was rejected; ₹200 was accepted with
  ₹400 remaining. The add form opens focused on Student name.
- No horizontal page overflow in either viewport. This is manual visual and
  interaction verification, not a complete accessibility audit.
- Standard and Pro Students previews still mount the full workspace and do not
  mount the Basic prototype.
- pnpm exec eslint tests/application-design-pilot/basic-prototype tests/application-design-pilot/main.tsx tests/application-design-pilot/preview-location.ts tests/application-design-pilot/basic-workspace.spec.ts — passed, zero warnings.
- pnpm exec tsc --noEmit --pretty false — passed during implementation.
- No new automated test suite: this reversible design prototype was exercised
  in-browser. Earlier database/provider tests were not repeated and are not
  evidence for this design. No production build is claimed for this iteration;
  changes are limited to the Vite preview and review documentation.

## Saved views

| Desktop | Mobile |
| --- | --- |
| [Overview](basic-prototype-evidence/desktop-overview.png) | [Students](basic-prototype-evidence/mobile-students.png) |
| [Add student](basic-prototype-evidence/desktop-add-student.png) | [Add student](basic-prototype-evidence/mobile-add-student.png) |
| [Seat assignment](basic-prototype-evidence/desktop-seat-assignment.png) | [Record fee](basic-prototype-evidence/mobile-record-fee.png) |
| [Fees](basic-prototype-evidence/desktop-fees.png) | [Receipt](basic-prototype-evidence/mobile-receipt.png) |
| [Student detail](basic-prototype-evidence/desktop-student-detail.png) | |

## Approval and integration boundary

The earlier shared-form Basic implementation remains uncommitted historical
work, not the approved design. Its [older report](basic-workspace-review.md) must
not be read as approval or release readiness. After owner visual review, connect
approved interfaces to existing domain services with server authorization,
tenancy, writability and entitlement checks intact. No schema, migration,
environment, pricing or billing infrastructure changes were made in this iteration.
Home, Features, Pricing and FAQ stay unchanged until the reviewed scope is
implemented and verified; do not advertise this prototype as shipped.
