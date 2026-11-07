import { defineConfig } from "vitest/config";
import shared from "../shared-system/vitest.config";
// Explicit unit allowlist: no root setup, database, provider calls or truncation.
export default defineConfig({...shared,test:{...shared.test,fileParallelism:false,include:[...shared.test!.include!,
"tests/unit/api/imports-daily-cron.route.test.ts","tests/unit/lib/branch-capabilities.test.ts","tests/unit/lib/accountNavigation.test.ts","tests/unit/pages/account-billing.test.tsx","tests/unit/components/AccountSidebar.test.tsx","tests/unit/components/ProfileSecurity.test.tsx","tests/unit/components/AccountBillingNavigation.test.tsx",
"tests/unit/lib/billing*.test.ts","tests/unit/components/Billing*.test.ts*","tests/unit/components/OrganizationBillingContent.test.tsx","tests/unit/components/RazorpayCheckoutLauncher.test.ts","tests/unit/components/MarketingActions.test.tsx",
"tests/unit/lib/contextual-navigation.test.ts","tests/unit/lib/basicNavigation.test.ts","tests/unit/lib/workspace-navigation-guard.test.ts","tests/unit/lib/application-design-pilot.test.ts",
"tests/unit/services/billing*.test.ts","tests/unit/api/billing-change-conflict-routes.test.ts"
]}});
