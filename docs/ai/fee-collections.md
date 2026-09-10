# Student fee collection and receipt contract

Implemented in the current Next.js application. This document is implementation
and verification guidance, not evidence of a commit, migration or deployment.

`Payment.amount` is the original billed fee in whole INR rupees. New
`FeeCollection` records describe actual money received; immutable allocations
apply it only to selected dues of one student and branch, oldest due first.
`Payment.collectedAmount` and `waivedAmount` are transactional balance counters.
`ledgerBacked` distinguishes new ledger accounting from historical records.
The remaining collectible balance is original amount minus these counters;
partially collected fees stay DUE. Fully collected fees become PAID. No projected
renewal, anniversary, admission identity, seat, membership or SaaS billing rule
changes.

The collection stores a branch-unique server receipt number, original branch
contact/student/actor facts, allocation periods, method, reference, note and
student balance immediately after receipt. It is immutable, apart from the
one-way VOID evidence. Printing, downloading and sharing use that snapshot.
PDF generation is browser-side after commit, using lazy-loaded jsPDF and browser
Unicode font rendering; this supports Indian names without public file storage.
The PDF contains raster text and is not text-searchable. Print opens the PDF
viewer. File sharing uses the device API when available; download and summary
copy remain available. No authenticated receipt link is represented as public,
and sharing does not establish message delivery.

## Writes and historical compatibility

Every collection rechecks `paymentsRecord`, branch writability and same-branch
student/payment ownership inside the transaction. All interactive fee writers
lock the student before fee rows. An advisory transaction lock serializes each
branch/idempotency key; a canonical request hash rejects changed input. Stable
same-key retries return the existing collection, including a subsequently voided
record. Browser session storage preserves an uncertain request across dialog
close/reload until a definitive response. Financial writes, allocations, receipt
facts and audit evidence commit together. No PDF or provider call runs there.

Full-payment compatibility callers use the same collection service and default
to Cash when the old call supplies no method. The inactivation dialog labels
this explicitly; operators should use Collect fee before inactivation for other
methods or partial receipts. These older callers retain their payment audit
action and inactivation provenance. They settle only the remaining balance and
use a deterministic per-fee retry key; subsequent instalments/corrections use the
new collection flow. Repeating a legacy full-payment action after its collection
was voided is rejected; it cannot report success while the balance remains due.

Imports remain historical resolution operations with their existing reviewed
cycle checks and atomic import success marker. They cannot overwrite a fee
with collection history. Newly imported paid rows have no inferred `paidAt` and
no generated receipt. Existing imported rows and resolution events are not
rewritten. Dated collection reports exclude imported resolutions and unknown
collection dates; legacy evidence with a known collection date remains usable.
Fee history retains all PAID/WAIVED records, clearly labelled when there is no
generated receipt. New receipts are never backfilled from fee amount/status.

## Waivers and corrections

For a ledger-backed fee, waiver forgives only its remaining debt. It preserves
money received and every receipt. A fully collected fee has nothing to waive;
repeating the waiver or full-payment action does not create money or events.
Historical non-ledger PAID-to-WAIVED evidence remains readable and the historical
waiver operation is retained. An interactive waived-to-paid action cannot invent
a new collectible balance. This deliberately replaces the old blanket transition
semantics for new collections.

Only the owner can void a new collection, with a nonempty reason and current
payment permission/writability. The original allocations and receipt remain;
void actor/time/reason are retained and the number is never reused. Each
allocation is reversed once. Waived rupees remain waived: after receiving 700
and waiving 500 of a 1,200 fee, voiding the 700 reopens 700 due, leaving 500 waived.
This is an application correction, not a cash or provider refund. Historical
records have no automatic void action.

## Readers and reminders

Renewals, outstanding/overdue analytics, student fee summaries, fee displays and
reminder source fingerprints use the remaining collectible balance. Collection
reports sum actual collections by collection time, excluding voids, plus
compatible legacy evidence. They never add a fee's full amount again on its
final instalment. Original billed amount remains distinct. Existing as-of
outstanding analytics still project mutable current fee state; this feature does
not rebuild a historical accounting system.

Each balance mutation invalidates manual follow-up drafts and reconciles the
existing local WhatsApp outbox. Send-time checks still rederive current amounts.
Final-payment resolution acknowledgements carry only that instalment's allocated
amount; the planner and dispatcher reject voided collection evidence, including
after the same fee is collected again. A partial receipt is immediately available
in the UI; the existing resolution-based automatic acknowledgement stage remains
triggered on full resolution. Provider gates, consent, UNKNOWN handling, delivery
budgets and approved templates remain unchanged.

## Exercise the feature

1. Open Payments → Due → Collect fee, Renewals → Collect fee on a recorded due,
   or the student's fee drawer → Collect fee. Select one or several periods.
2. For a 1,200 fee enter 700, Cash, and confirm. Inspect the receipt and the 500
   remaining balance. History should show the 700 receipt while the fee is DUE.
3. Collect the remaining 500 by UPI. Inspect its different receipt number and
   the PAID fee. Actual collected totals should now be 1,200.
4. Retry an uncertain request from the same dialog; it retrieves the same
   receipt. A failed PDF/share action offers receipt retry after the successful
   collection. Reopen Collections & receipts to retrieve it later.
5. As owner, Correct / void → reason preserves the receipt as VOID and reopens
   only the corresponding unwaived balance. Repeating the correction is safe.

See the fee-collection section of the production runbook for expansion order and
rollback restrictions. Verification results are recorded in the completion
report; repository tests do not establish Production deployment or delivery.
