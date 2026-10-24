import { defineConfig } from "vitest/config";
import reference from "../reference-dashboard/vitest.config";

// Inherit only the explicit no-I/O unit configuration, never the root integration setup.
export default defineConfig({ ...reference, test: { ...reference.test, fileParallelism: false,
    include: [...reference.test!.include!,
        "tests/unit/lib/contextual-navigation.test.ts", "tests/unit/components/RouteBoundaries.test.tsx",
        "tests/unit/components/dashboard-setup-pagination.test.tsx", "tests/unit/services/dashboard-setup-pagination.test.ts",
        "tests/unit/api/dashboard-setup.route.test.ts", "tests/unit/pages/payments-request-order.test.tsx",
        "tests/unit/api/import-recipes.route.test.ts", "tests/unit/importing/import-recipe.service.test.ts",
        "tests/unit/api/billing-change-conflict-routes.test.ts", "tests/unit/api/organization-settings.route.test.ts",
        "tests/unit/components/whatsapp-foundation.test.tsx", "tests/unit/components/whatsapp-reports-ui.test.tsx",
        "tests/unit/components/whatsapp-collections-ui.test.tsx",
    ],
} });
