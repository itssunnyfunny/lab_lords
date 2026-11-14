import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { installSettingsRouteFixture } from "../application-design-pilot/settings-route-closeout-fixture";
import type { WhatsAppBranchSettings, WhatsAppSenderSummary } from "../../lib/api/whatsapp";

const sender: WhatsAppSenderSummary = {
  id: "sender-pilot", providerMode: "TEST", displayPhoneNumber: "+91 ••••••3210",
  verifiedName: "Fixture study hall", qualityRating: "GREEN", accountMode: "SANDBOX", status: "ACTIVE",
  phoneRegisteredAt: "2026-11-13T06:00:00Z", webhookSubscribedAt: "2026-11-13T06:00:00Z",
  lastHealthCheckAt: null, lastTemplateSyncAt: null,
  templateCounts: { approved: 2, pending: 0, rejected: 0, other: 0, total: 2 }, assignedBranches: [],
};

async function fixture(page: Page, input: { enabled?: boolean; failSenders?: boolean } = {}) {
  await installSettingsRouteFixture(page);
  const settings: WhatsAppBranchSettings = {
    branchId: "pilot", enabled: input.enabled ?? false, automationEnabled: false, automationEnabledAt: null,
    defaultLanguage: "en_IN", defaultTone: "polite", sendTimeLocal: "10:00", dailyAutomaticMessageLimit: 20,
    maxAutomaticCollectionMessagesPerCycle: 3, configurationRevision: 1, monthlyBudgetMinor: 10000,
    timeZone: "Asia/Kolkata", sender,
    rules: [{ stage: "FEE_DUE_TODAY", enabled: true }],
    templateHealth: ["FEE_RENEWAL_POLITE", "MULTI_STUDENT_COLLECTION_SUMMARY"].map(managedKey => ({
      managedKey, active: true, template: { providerStatus: "APPROVED", category: "UTILITY", staleAt: null },
    })),
    budget: { month: "2026-11", ceilingMicros: "100000000", reservedMicros: "0", committedMicros: "0", reservedAndCommittedMicros: "0", remainingMicros: "100000000" },
    consentCoverage: { activeStudents: 2, missingPhone: 0, associated: 2, optedIn: 2, optedOut: 0, stale: 0, recipientStatusCounts: { ACTIVE: 2 } },
    deliveryHealth: {}, deliveryHealthWindowDays: 30, lastWebhookReceivedAt: null, lastPlannedAt: null, lastPlannerErrorCode: null,
  };
  const commands: { method: string; path: string }[] = [];
  let failSenders = input.failSenders;
  await page.route(/\/api\/(?:branches|organizations)\/.*\/whatsapp(?:\/|$)/, async route => {
    const request = route.request(), method = request.method(), path = new URL(request.url()).pathname;
    if (method !== "GET") commands.push({ method, path });
    if (path.endsWith("/config")) return route.fulfill({ json: { enabled: true, providerMode: "TEST", appId: null, embeddedSignupConfigId: null, graphApiVersion: null, connectionAvailability: "DISABLED", safeReason: "Fixture connection held." } });
    if (path.endsWith("/senders")) {
      if (failSenders) { failSenders = false; return route.fulfill({ status: 503, json: { error: "Unavailable" } }); }
      return route.fulfill({ json: { enabled: true, canManage: true, operationsUiEnabled: false, safeReason: null, senders: [sender] } });
    }
    if (path.endsWith("/managed-templates/install")) return route.fulfill({ json: { installation: { catalogVersion: 1, languages: [], templates: [] } } });
    if (path.endsWith("/branch-assignments")) {
      if (method === "DELETE") { settings.sender = null; settings.enabled = false; settings.automationEnabled = false; }
      return route.fulfill({ json: { enabled: true, canManage: true, operationsUiEnabled: false, serviceNoticesEnabled: false, safeReason: null, assignment: { branchId: "pilot", sender: settings.sender, defaultLanguage: "en_IN", defaultTone: "polite", automationEnabled: false }, availableSenders: [sender] } });
    }
    if (path.endsWith("/settings")) {
      if (method === "PATCH") Object.assign(settings, request.postDataJSON());
      return route.fulfill({ json: method === "PATCH" ? { updated: true } : settings });
    }
    if (/\/delivery\/(enable|disable)$/.test(path)) {
      settings.enabled = path.endsWith("/enable"); settings.automationEnabled = false;
      return route.fulfill({ json: { enabled: settings.enabled } });
    }
    if (/\/automation\/(enable|disable)$/.test(path)) {
      settings.automationEnabled = path.endsWith("/enable");
      return route.fulfill({ json: { enabled: settings.automationEnabled } });
    }
    if (path.endsWith("/report-subscription")) return route.fulfill({ json: { operationsUiEnabled: false, subscription: null } });
    if (path.endsWith("/messages")) return route.fulfill({ json: { items: [], nextCursor: null } });
    // No unhandled operation can reach a DB, auth service or messaging provider.
    return route.fulfill({ status: 404, json: { error: "Fixture route unavailable" } });
  });
  return { commands, settings };
}

test.beforeEach(async ({ context }) => {
  await context.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
});

test("drafts must be saved or discarded before activation", async ({ page }, info) => {
  const { commands } = await fixture(page);
  await page.goto("/branch/pilot/settings?mode=after&lang=en");
  const panel = page.locator("#whatsapp"), budget = panel.getByLabel("Monthly estimated usage budget in INR");
  const enable = panel.getByRole("button", { name: "Enable branch delivery", exact: true });
  await expect(enable).toBeEnabled();
  await budget.fill("120");
  await expect(enable).toBeDisabled();
  await expect(panel.getByRole("status").filter({ hasText: "unsaved WhatsApp settings" })).toBeVisible();
  await panel.getByRole("button", { name: "Discard changes", exact: true }).click();
  await expect(budget).toHaveValue("100");
  await expect(enable).toBeEnabled();
  await budget.fill("120");
  await panel.getByRole("button", { name: "Save WhatsApp settings", exact: true }).click();
  await expect(panel.getByText("WhatsApp settings are saved.", { exact: true })).toBeVisible();
  await expect(budget).toHaveValue("120");
  await enable.click();
  await expect(panel.getByRole("button", { name: "Disable branch delivery", exact: true })).toBeEnabled();
  await panel.getByRole("checkbox", { name: /I understand messages may incur charges/ }).check();
  await expect(panel.getByRole("button", { name: "Enable prospective automation", exact: true })).toBeEnabled();
  await budget.fill("130");
  await expect(panel.getByRole("button", { name: "Enable prospective automation", exact: true })).toBeDisabled();
  expect(commands.map(command => command.path)).toEqual(["/api/branches/pilot/whatsapp/settings", "/api/branches/pilot/whatsapp/delivery/enable"]);
  expect((await new AxeBuilder({ page }).include("#whatsapp").analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await panel.getByRole("button", { name: "Discard changes", exact: true }).evaluate(button => button.scrollIntoView({ block: "center" }));
  await page.screenshot({ path: info.outputPath("branch-controls.png"), animations: "disabled" });
});

test("invalid drafts show field errors while stop controls preserve the draft", async ({ page }) => {
  const { commands } = await fixture(page, { enabled: true });
  await page.goto("/branch/pilot/settings?mode=after&lang=en");
  const panel = page.locator("#whatsapp"), daily = panel.getByLabel("Daily automatic limit", { exact: true });
  await daily.fill("201");
  await panel.getByLabel("Collection messages per cycle", { exact: true }).fill("0");
  await panel.getByLabel("Send time", { exact: true }).fill("");
  await expect(daily).toHaveAttribute("aria-invalid", "true");
  await expect(panel.getByText("Enter a whole number from 1 to 200.")).toBeVisible();
  await expect(panel.getByText("Enter a whole number from 1 to 4.")).toBeVisible();
  await expect(panel.getByText("Choose a valid local send time.")).toBeVisible();
  await expect(panel.getByRole("button", { name: "Save WhatsApp settings", exact: true })).toBeDisabled();
  await panel.getByRole("button", { name: "Disable branch delivery", exact: true }).click();
  await expect(panel.getByRole("button", { name: "Enable branch delivery", exact: true })).toBeDisabled();
  await expect(daily).toHaveValue("201");
  expect(commands.map(command => command.path)).toEqual(["/api/branches/pilot/whatsapp/delivery/disable"]);
});

test("unassignment requires confirmation and cancellation preserves the sender", async ({ page }) => {
  const { commands } = await fixture(page);
  await page.goto("/branch/pilot/settings?mode=after&lang=en");
  const unassign = page.locator("#whatsapp").getByRole("button", { name: "Unassign sender", exact: true });
  await unassign.click();
  const dialog = page.getByRole("alertdialog", { name: "Unassign this branch’s sender?" });
  await expect(dialog).toContainText("Report recipients will need confirmation again");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(commands).toEqual([]);
  await unassign.click();
  await dialog.getByRole("button", { name: "Unassign sender", exact: true }).click();
  await expect(unassign).toHaveCount(0);
  expect(commands).toEqual([{ method: "DELETE", path: "/api/organizations/org-pilot/whatsapp/branch-assignments" }]);
});

test("failed sender loading offers retry and never claims the sender list is empty", async ({ page }) => {
  const { commands } = await fixture(page, { failSenders: true });
  await page.goto("/org/org-pilot/settings?mode=after&lang=en");
  const panel = page.locator("#whatsapp");
  await expect(panel.getByText("Connected senders could not be loaded. Retry to check the connection before making changes.")).toBeVisible();
  await expect(panel.getByText("No customer-owned WhatsApp senders are connected yet.")).toHaveCount(0);
  await panel.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(panel.getByText(sender.verifiedName!, { exact: true })).toBeVisible();
  expect(commands).toEqual([]);
});

for (const [language, unsaved, invalidLimit] of [
  ["hi", "WhatsApp सेटिंग्स के बदलाव सेव नहीं हुए हैं।", "1 से 200 के बीच पूरी संख्या डालें।"],
  ["hinglish", "WhatsApp settings ke changes save nahi hue.", "1 se 200 ke beech whole number daalein."],
] as const) {
  test(`control feedback stays translated and usable in ${language}`, async ({ page }, info) => {
    await fixture(page);
    await page.goto(`/branch/pilot/settings?mode=after&lang=${language}`);
    const panel = page.locator("#whatsapp");
    await panel.locator('input[inputmode="decimal"]').fill("120");
    await expect(panel.getByRole("status").filter({ hasText: unsaved })).toBeVisible();
    await panel.locator('input[type="number"]').first().fill("201");
    await expect(panel.getByText(invalidLimit, { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`branch-controls-${language}.png`), animations: "disabled" });
  });
}
