import fs from "node:fs";
import { expect, test } from "@playwright/test";
import { refreshDevelopmentSession } from "./helpers/development-session";

const reviewerState = process.env.PLAYWRIGHT_OWNER_AUTH_STATE ?? process.env.PLAYWRIGHT_AUTH_STATE;
const organizationId = process.env.PLAYWRIGHT_OWNER_ORG_ID;
const branchId = process.env.PLAYWRIGHT_OWNER_BRANCH_ID;
const hasSession = Boolean(reviewerState && fs.existsSync(reviewerState));

test.use({ storageState: hasSession ? reviewerState : { cookies: [], origins: [] } });

test("signed-in owner can open the selected branch in Account Billing", async ({ page }) => {
  test.skip(!hasSession || !organizationId || !branchId, "Requires the isolated owner session, organization and branch.");
  await refreshDevelopmentSession(page);
  const query = new URLSearchParams({ organizationId: organizationId!, branchId: branchId! });
  await page.goto("/account/billing?" + query);
  await expect(page.getByRole("heading", { name: "Billing and plans", exact: true })).toBeVisible();
  await expect(page.locator("#plans")).toBeVisible();
  await expect(page).toHaveURL(new RegExp("branchId=" + encodeURIComponent(branchId!)));
});
