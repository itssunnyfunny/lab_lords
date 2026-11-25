# Independent branch plan browser evidence

On 25 November 2026, the branch workspace, billing and navigation components ran against synthetic local API responses. The four new branch scenarios passed on desktop and mobile. The billing regression suite exercised all 39 desktop and mobile cases, with one mobile case passing on a separate retry. Provider verification has its own [Test-mode evidence record](branch-subscriptions-razorpay-test-2026-11-25.md).

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
