# Independent branch plan browser evidence

On 25 November 2026, the branch workspace, billing and navigation components ran against synthetic local API responses. Provider verification has its own [Test-mode evidence record](branch-subscriptions-razorpay-test-2026-11-25.md).

## Overdue payment recovery

On 26 November, six Chromium cases passed on desktop (1440 px) and phones (390 and 320 px). Each case started recovery on a halted branch, left the simulated hosted page without a callback, and advanced the browser clock by 16 minutes. Account Billing opened the fresh hosted URL for the original receipt. The processing page opened embedded card recovery on the same subscription. Each case issued exactly one start and one resume request.

```sh
pnpm exec playwright test --config tests/billing-verification/playwright.config.ts --grep "resumes payment recovery" --workers=1
```

## Previous subscription cancellation and trial charge dates

On 26 November, all nine focused Chromium cases passed at 1440, 390 and 320 px using the local synthetic billing fixture.

| Scenario | Observed behavior |
| --- | --- |
| Owner billing overview | A newer receipt existed, but **Check cancellation status** sent one request for the original replacement and its selected branch. The owner saw the outstanding cancellation before the request. Undo remained unavailable after its deadline. |
| Billing processing page | An older replacement receipt marked scheduled still displayed the unresolved source cancellation. Checking it once adopted the recovered receipt and displayed the scheduled confirmation. Both recovery screens opened zero checkout windows. |
| Authorized trial close to its first debit | With no provider-confirmed next charge date, the dialog showed the original planned debit on 22 January, the replacement's planned first charge on 22 February and the 20 February Undo deadline. All three screens fit each tested viewport. |

```powershell
pnpm.cmd exec playwright test --config tests/billing-verification/playwright.config.ts billing.spec.ts --workers=1 --grep "source cancellation recovery|pre-start trial quote"
```

## Real Clerk owner smoke

On 26 November 2026, the signed-in owner opened the selected branch in Account Billing in desktop Chromium and mobile Chromium. Both tests passed against the local production build at `localhost:4371` and a freshly migrated, dedicated PostgreSQL 15 database. Each browser refreshed the real Clerk session, opened the branch URL and found the Billing and plans heading and the Plans section. [Authenticated owner smoke](../../tests/browser/authenticated-billing.spec.ts)

The five retained reviewer sessions had expired or been removed. The repository helpers verified the matching Clerk Test tenant and an existing synthetic owner, then used a temporary Test ticket to sign in. Clerk confirmed revocation of the new session after the run. Billing provider writes were disabled and the database contained zero provider actions, subscriptions or billing changes after the tests.

```powershell
pnpm.cmd exec playwright test tests/browser/authenticated-billing.spec.ts --workers=1 --output=test-results/branch-product-owner-smoke --reporter=list
```

## Default branch billing verification

On 26 November 2026, `pnpm exec playwright test --config tests/billing-verification/playwright.config.ts --workers=1` passed all 90 cases in 9.2 minutes on Node 20.19.6 and pnpm 9.15.9. All 30 cases passed at each of 1440, 390 and 320 px, with zero skips or retries. The local fixture rendered the application and supplied synthetic owner access, billing API responses and Razorpay Checkout callbacks.

The 14 owner journeys cover navigation to the selected branch, one-branch trial pricing and authorization, payer defaults, session-only trial reminders, critical warnings, dismissal, decline and retry, technical and unknown payment failures, signed callback forwarding, explicit processing retries, UPI replacement and eMandate cutover. The success check held the verification response until it confirmed the browser had withheld the success message. The eMandate case verified that Basic billing stayed at ₹99 per month while the authorized upgrade granted Standard access.

The 25 November run used Node 20.19.6, pnpm 9 and Playwright Chromium. All 56 browser cases passed with one worker per suite.

| Suite | Result | Observed behavior |
| --- | --- | --- |
| Billing | 42/42 at 1440, 390 and 320 px | All three languages, branch-scoped processing and recovery, replacement checkout, separate plan history, invoice pagination and cancellation confirmation. |
| Branch navigation and settings | 12/12 at 1440 and 390 px | Basic, Standard and Pro contributed ₹897 in monthly commitments across three separate debit dates. The selected branch’s plan confirmation displayed the existing renewal, planned first charge on the replacement and Undo deadline. Switching, a failed access refresh and a Pro downgrade preserved dirty core settings and a pending save. |
| Basic pending operations | 2/2 at 1440 and 390 px | A pending write blocked navigation. Clearing an uncertain operation preserved the draft and sent no duplicate write. |

```powershell
pnpm.cmd exec playwright test --config tests/billing-verification/playwright.config.ts --workers=1
node tests/navigation-restoration/run-browser.mjs --project desktop-1440 --project mobile-390 --grep "independent branch" --workers=1
pnpm.cmd exec playwright test --config test-results/branch-product-browser/pending.config.ts --project desktop-1440 --project mobile-390 --grep "Basic pending operations block navigation" --workers=1
```

The third command used the repository’s visual consistency configuration with a fresh Vite fixture on loopback port 4194 and Playwright’s Chromium channel. Port 4193 was reserved for the separate provider checkout verification. With 4193 available, use `tests/visual-consistency/playwright.config.ts` for the same tests. Local font setup appears below.

The final UI unit run passed all 88 tests in nine files, covering public pricing and localization, branch-scoped navigation and API requests, billing confirmations, and the distinction between a current billed plan and temporary access during replacement.

```powershell
pnpm.cmd exec vitest run --config vitest.unit.safe.config.ts --pool=threads --maxWorkers=1 tests/unit/components/BillingPriceSummary.test.tsx tests/unit/components/AccountBillingNavigation.test.tsx tests/unit/components/CheckoutConfirmationDialog.test.ts tests/unit/components/OrganizationBillingContent.test.tsx tests/unit/lib/billingApi.test.ts tests/unit/lib/billingInvoiceApi.test.ts tests/unit/pages/public-site.test.tsx tests/unit/lib/public-localization.test.ts tests/unit/pages/account-billing.test.tsx
```

A second run of `tests/unit/lib/public-localization.test.ts` and `tests/unit/pages/public-site.test.tsx` with the same command options passed all 21 tests. Each of the ten shared branch pricing and FAQ messages has a prepared Hindi and Hinglish translation. The catalogue plan names Basic, Standard and Pro appear in all three languages.

The remaining sections retain the earlier PR verification and its retry history.

## Fixture prerequisites

Run the commands from the repository root with its installed pnpm dependencies and Playwright Chromium. The local fixtures load the application's self-hosted fonts. The default source is `.next/static` after a local Next build. A retained copy containing the same `chunks` and `media` directories also works. This run used the following relative location.

```powershell
$env:PILOT_FONT_STATIC_ROOT = 'test-results/whatsapp-audit-2026-11-13/fonts'
```

The browser fixtures start local Vite servers and intercept the listed billing and access responses. They require no provider account or database.

## UI unit tests

All 146 tests in 11 files passed. Coverage includes branch-scoped billing requests and retry identity, navigation with missing or stale access data, safe returns, read-only destinations, checkout confirmation, and carried paid coverage that overlaps a lower owner trial. The overlap case verifies both dates and the effective paid plan.

```powershell
pnpm.cmd exec vitest run --config vitest.unit.safe.config.ts tests/unit/components/BranchWorkspaceShell.test.tsx tests/unit/components/WorkspaceSwitcher.test.tsx tests/unit/pages/account-billing.test.tsx tests/unit/components/AccountBillingNavigation.test.tsx tests/unit/components/OrganizationBillingContent.test.tsx tests/unit/components/BillingPriceSummary.test.tsx tests/unit/lib/basicNavigation.test.ts tests/unit/lib/branchBillingClient.test.ts tests/unit/lib/workspacePresentation.test.ts tests/unit/lib/accountNavigation.test.ts tests/unit/lib/billingState.test.ts
```

## Switching, plan changes and recovery

All eight cases passed in one run, covering four scenarios at 1440 px and 390 px.

```powershell
node tests/navigation-restoration/run-browser.mjs --project desktop-1440 --project mobile-390 --grep "independent branch" --workers=2
```

| Scenario | Observed behavior |
| --- | --- |
| Switch from Pro analytics to Basic | The destination waited for its branch access response, explained the fallback to overview and showed import in the Basic shell. A later 403 removed the import screen. |
| Review mixed branch subscriptions | The directory showed three next charges and ₹897 in confirmed monthly commitments. Opening the Standard branch's Pro confirmation showed its name, added WhatsApp features and the quoted effective date. Every recorded billing overview request included the selected branch. |
| Preserve an unfinished settings edit | Cancelling a branch switch retained the current route. After a simulated 503 during access refresh, Retry restored the same draft. |
| Change Pro to Standard while in settings | The branch kept its full settings workspace and stopped requesting WhatsApp assignment data. Direct access distinguished a disabled integration, a missing Pro plan and an insufficient role. |

The [navigation scenarios](../../tests/navigation-restoration/navigation.spec.ts) exercise the application's workspace components.

## Billing regression suite

The 13 scenarios ran at 1440 px, 390 px and 320 px. They cover billing navigation in three languages, overflow, card replacement and simulated checkout, retry and revocation, trial cancellation, plan history, invoice pagination, Pro conditions and downgrade choices. The aggregate run passed 38 of 39 cases. During the 320 px legacy billing link case, the page reached the account route but the Basic plan confirmation dialog did not appear within the ten-second assertion. The same test passed on its own with the same viewport and assertion.

```powershell
pnpm.cmd exec playwright test --config tests/billing-verification/playwright.config.ts --workers=3
pnpm.cmd exec playwright test --config tests/billing-verification/playwright.config.ts --project mobile-320 --grep "owner navigation and legacy billing links"
```

The [billing scenarios](../../tests/billing-verification/billing.spec.ts) simulate checkout and inspect the resulting browser state.

## Pending operations in the Basic workspace

The first run of the existing pending-operation scenario received HTTP 403 when opening the local fixture at both viewports.

```powershell
pnpm.cmd exec playwright test --config tests/visual-consistency/playwright.config.ts --project desktop-1440 --project mobile-390 --grep "Basic pending operations block navigation" --workers=2
```

A fresh local fixture server and Playwright's bundled Chromium ran the same scenario and assertions. Both viewports passed. The test blocks navigation during a save, simulates an uncertain response and checks that clearing recovery preserves the draft without repeating the write. The run used the following temporary override at `test-results/independent-branch-pending-operations/playwright.local.config.ts`.

```ts
import { defineConfig } from "@playwright/test";
import existing from "../../tests/visual-consistency/playwright.config";

export default defineConfig({
  ...existing,
  use: { ...existing.use, channel: "chromium" },
  webServer: { ...existing.webServer as { command: string; cwd: string; url: string }, reuseExistingServer: false },
});
```

```powershell
$env:VISUAL_AUDIT_RUN_ROOT = 'test-results/independent-branch-pending-operations'
pnpm.cmd exec playwright test --config test-results/independent-branch-pending-operations/playwright.local.config.ts --project desktop-1440 --project mobile-390 --grep "Basic pending operations block navigation" --workers=2
```

The [Basic pending-operation scenario](../../tests/visual-consistency/visual-consistency.spec.ts) checks the request count and the recovery state.
