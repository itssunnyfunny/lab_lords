# Public proof, brand and metadata — 2026-09-21

Baseline: `4a51ff6` on `codex/botanical-public-pages`. This is a local website
change, not a deployment or a search-index update. The approved page copy, design,
release decisions and product behaviour remain the reference.

## Homepage evidence and wording

The homepage plan introduction is replaced, in the same position, by **See how
it works in your library**. `/pricing`, its catalogue and selected-plan actions
are unchanged. `/#pricing` now targets the footer's Pricing link to `/pricing`.

No approved customer aggregate, quote, attribution permission or customer logo
was found in the supplied material or current public content sources. The
production databases were not accessed. The published fallback uses explicitly
labelled sample data: fee due ₹1,200, payment recorded ₹700, left to pay ₹500.
These are an illustrative payment record, not adoption figures or a real receipt.

The two explanatory sentences reuse the existing approved partial-payment and
receipt wording. Their implementation and release evidence remains in
[public claims](../product/public-claims.md). The sample reiterates that recording
a payment does not transfer money or verify a bank transaction. It links to the
existing How It Works page; it adds no payment or receipt action.

`lib/publicProof.ts` contains only approved public display fields and currently
has empty metrics/feedback arrays. Its component renders a product example when
both are empty. Synthetic quote/metric/logo fixtures exist only in the unit test;
they are not imported by application code. No ratings or Review/AggregateRating
schema are introduced.

Before adding customer proof, record the following in a reviewed evidence record:

- Metrics: owner approval, aggregate source, exact definition, as-of date,
  organisation versus branch scope, and exclusions for signups, trials and test
  accounts. Preserve the approved value; do not invent rounding or a plus sign.
- Feedback: authentic original quote, permission for its displayed attribution,
  and any editing/translation approval. Publish only approved names/library details.
- Logos: owner/customer permission for public use and approved artwork.

Private contact details and consent records must stay outside the public registry.
The static layout follows the compact figures/feedback pattern inspected on
[Librify](https://www.librify.in/); no competitor content or identity is reused.

## Validation and release record

Final metadata audit, screenshots, commands and release checks are recorded below
after the production build has been inspected.
