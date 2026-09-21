# Original brand reference: browser verification scope

> Historical first-milestone record. The completed public rollout, consistency
> corrections and refreshed visual baselines are documented in the
> [current validation report](public-validation-report.md).

The September 20, 2026 preview changes the homepage header, hero and first
feature section. Passing automated checks establishes functional and
accessibility evidence; it does not establish visual approval.

## Acceptance coverage

`tests/browser/public-billing.spec.ts` checks the revised homepage headings
and the existing nine supported feature titles. The reference preview adds
checks that its Playfair Display and Inter font faces load, the botanical
hero illustration and open-book/leaf logo load visibly, and the home link
remains accessible.

The hero trial button is exercised with the keyboard and must retain its
signed-out `/sign-up` destination. The existing mobile menu test also checks
Escape closes the menu and restores focus to its summary. This complements
the shared action component's unit tests, including its signed-in routing
and loading guard; browser verification does not create an account or
access a database.

Existing coverage remains for serious and critical axe violations
(including readable contrast), 320px and 400% reflow, primary navigation,
tablet sign-in, selected-plan continuation, public trust links, example
tabs, FAQ disclosure controls, legacy anchors, metadata, and protected
application routes. The reduced-motion check now also requires the new
reference scopes to have no running or pending animations.

## Visual review and the previous baselines

The two existing `landing-*.png` baselines capture the explicitly rejected
visual direction. They are retained unchanged. The visual-regression test
itself remains intact: it is not skipped in source and no replacement
baseline is accepted automatically.

For this preview, run the functional browser suite with an explicit
`--grep-invert "visual regression"` filter. With the repository's isolated
local preview helper, the command is:

```powershell
node .agent/librify/run.mjs browser --grep-invert "visual regression"
```

That wrapper invokes the installed Playwright through the repository pnpm
wrapper and runs `tests/browser/public-billing.spec.ts`. It deliberately
does not compare the preview to the rejected images. Separate desktop and
mobile screenshots must be inspected against the supplied brand image and
shown to the owner for the requested single visual review. Only after that
review should new visual baselines be considered.

## Execution status

This document describes the acceptance coverage and the intentional
baseline exclusion. It does not claim that the final preview passed.
Exact commands, pass/fail results, rendered screenshots, and remaining
visual differences belong in the completed preview report after the
production build and browser run.
