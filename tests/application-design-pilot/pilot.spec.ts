import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function openPilot(page: Page, path: string, query: Record<string, string> = {}) {
    const params = new URLSearchParams({ mode: "after", lang: "en", ...query });
    await page.goto(`${path}?${params.toString()}`);
    await expect(page.getByTestId("synthetic-pilot-label")).toBeVisible();
}

test("baseline and after modes use the same real shell with isolated theme activation", async ({ page }, testInfo) => {
    await openPilot(page, "/branch/pilot", { mode: "baseline" });
    await expect(page.locator("[data-app-design-pilot]")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Shanti Study Library" })).toBeVisible();

    await openPilot(page, "/branch/pilot", { mode: "after" });
    await expect(page.locator('[data-app-design-pilot="workspace"]')).toBeVisible();
    if (!testInfo.project.name.startsWith("desktop")) {
        await expect(page.getByLabel("Open navigation")).toBeVisible();
    } else {
        await expect(page.getByLabel("Branch navigation")).toBeVisible();
    }
});

test("student search, details, and edit keep the active roster context", async ({ page }) => {
    await openPilot(page, "/branch/pilot/students");
    const search = page.getByLabel("Search students by name or phone");
    await search.fill("Aarav");
    await expect(page.locator("p:visible").filter({ hasText: /^Aarav Mehta$/ }).first()).toBeVisible();
    await expect(page.getByText("Meera Singh", { exact: true })).toHaveCount(0);

    await page.locator('button[aria-label="Actions"]:visible').first().click();
    await page.getByRole("menuitem", { name: /Edit Details/ }).click();
    const editDialog = page.getByRole("dialog", { name: "Edit student" });
    await editDialog.getByLabel("Full Name *").fill("Aarav Mehta Updated");
    await editDialog.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.locator("p:visible").filter({ hasText: /^Aarav Mehta Updated$/ }).first()).toBeVisible();
    await expect(search).toHaveValue("Aarav");

    await page.locator('button[aria-label="Actions"]:visible').first().click();
    await page.getByRole("menuitem", { name: /View Fees/ }).click();
    await expect(page.getByRole("dialog", { name: "Aarav Mehta Updated" })).toBeVisible();
    await expect(page.getByText("Payment history", { exact: true })).toBeVisible();
});

test("seat scope exposes availability and completes a synthetic allocation interaction", async ({ page }) => {
    await openPilot(page, "/branch/pilot/seats");
    await expect(page.getByRole("heading", { name: "Seats" })).toBeVisible();
    await page.getByRole("button", { name: /Morning/ }).first().click();

    const availableSeat = page.getByRole("article", { name: "Seat A3" });
    await expect(availableSeat.getByText("Available", { exact: true }).first()).toBeVisible();
    await availableSeat.getByRole("button", { name: "Assign" }).click();

    const allocationDialog = page.getByRole("dialog", { name: "Allocate seat" });
    await allocationDialog.getByRole("button", { name: /Meera Singh/ }).click();
    await expect(allocationDialog.getByText(/1 shift(?:\(s\))? selected/)).toBeVisible();
    await allocationDialog.getByRole("button", { name: /^Confirm/ }).click();
    await expect(allocationDialog).toHaveCount(0);
});

test("partial collection retains one request through uncertainty and returns a receipt", async ({ page }) => {
    await openPilot(page, "/branch/pilot/payments", { surface: "collection", scenario: "uncertain" });
    let dialog = page.getByRole("dialog");
    await expect(dialog).toHaveAccessibleName("Collect fee");
    await dialog.getByLabel("Amount received (whole ₹)").fill("700");
    await dialog.getByLabel("Reference (optional)").fill("PILOT-UPI-700");
    await dialog.getByLabel("Note (shown on receipt, optional)").fill("Synthetic partial payment");
    await dialog.getByRole("button", { name: "Confirm collection", exact: true }).click();

    await expect(dialog.getByRole("button", { name: "Retry same collection" })).toBeVisible();
    const uncertainAlert = dialog.getByRole("alert");
    await expect(uncertainAlert).toBeVisible();
    await expect(dialog.getByText(/may already be recorded/i)).toBeVisible();
    expect(await uncertainAlert.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.top >= 0 && bounds.bottom <= window.innerHeight;
    })).toBe(true);
    const pendingRequest = await page.evaluate(
        () => sessionStorage.getItem("fee-collection:pilot:student-aarav")
    );
    expect(pendingRequest).toBeTruthy();

    await openPilot(page, "/branch/pilot");
    await openPilot(page, "/branch/pilot/payments", { surface: "collection", scenario: "uncertain" });
    dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Retry same collection" })).toBeVisible();
    await expect(dialog.getByText(/may already be recorded/i)).toBeVisible();
    await expect(dialog.getByLabel("Amount received (whole ₹)")).toBeDisabled();
    expect(await page.evaluate(
        () => sessionStorage.getItem("fee-collection:pilot:student-aarav")
    )).toBe(pendingRequest);

    await dialog.getByLabel("Interface language").selectOption("hinglish");
    await dialog.getByRole("button", { name: "Usi payment ko dobara confirm karein" }).click();

    await expect(dialog.getByRole("heading", { name: "Payment record ho gaya" })).toBeVisible();
    await expect(dialog.getByText(/Received: ₹700/i)).toBeVisible();
    await expect(dialog.getByText(/Remaining ₹300/i)).toBeVisible();
    await dialog.getByLabel("Receipt aur report ki language").selectOption("hi");
    await expect(dialog.getByRole("heading", { name: "फीस की रसीद" })).toBeVisible();
});

test("onboarding recovers one saved command after response loss, reload, and account switch", async ({ page }, info) => {
    test.skip(!["desktop-1440", "mobile-390"].includes(info.project.name), "One desktop and one mobile viewport cover the shared recovery flow");
    const attempts: Array<{ account: string | undefined; key: string | undefined; body: string | null; saved: string | null }> = [];
    const committed = new Map<string, string>();
    const result = { org: { id: "org-pilot" }, branch: { id: "pilot" } };
    await page.route("**/api/onboarding", async route => {
        const request = route.request();
        const account = request.headers()["x-onboarding-account"];
        const key = request.headers()["idempotency-key"];
        const body = request.postData();
        attempts.push({
            account, key, body,
            saved: await page.evaluate(id => localStorage.getItem(`lab-lords:onboarding:v1:${encodeURIComponent(id)}`), account ?? ""),
        });
        const receiptKey = `${account}:${key}`;
        const originalBody = committed.get(receiptKey);
        if (originalBody && originalBody !== body) return route.fulfill({ status: 409, json: { code: "ONBOARDING_KEY_CONFLICT" } });
        if (!originalBody) committed.set(receiptKey, body ?? "");
        // The first synthetic setup commits, but its HTTP response is lost.
        if (attempts.length === 1) return route.abort("failed");
        return route.fulfill({ status: 201, json: result });
    });

    await openPilot(page, "/onboarding", { identity: "pilot-owner" });
    expect(await page.evaluate(() => typeof navigator.locks?.request)).toBe("function");
    await page.locator('input[name="orgName"]').fill("Synthetic Recovery Library");
    await page.locator('input[name="ownerPhone"]').fill("9876543210");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.locator('input[name="branchName"]').fill("Synthetic Main Branch");
    await page.locator('input[name="seatCount"]').fill("8");
    await page.getByRole("button", { name: "Choose plan" }).click();
    await page.getByRole("button", { name: /^Standard\b/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: /Begin with a clean workspace/ }).click();
    await page.getByRole("button", { name: "Start Standard trial" }).click();

    await expect(page.getByRole("heading", { name: "Recover your saved setup" })).toBeVisible();
    expect(attempts).toHaveLength(1);
    expect(attempts[0].account).toBe("pilot-owner");
    expect(attempts[0].key).toMatch(/^[0-9a-f-]{36}$/i);
    expect(JSON.parse(attempts[0].saved!)).toMatchObject({
        accountId: "pilot-owner", pending: { commandId: attempts[0].key, body: attempts[0].body },
    });

    await page.reload();
    await expect(page.getByRole("heading", { name: "Recover your saved setup" })).toBeVisible();
    expect(attempts).toHaveLength(1); // Reload never dispatches on its own.
    await page.goto("/onboarding?mode=after&lang=en&identity=other-owner");
    await expect(page.getByRole("heading", { name: "Organization details" })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("lab-lords:onboarding:v1:other-owner"))).toBeNull();
    expect(attempts).toHaveLength(1);

    await page.goto("/onboarding?mode=after&lang=en&identity=pilot-owner");
    await expect(page.getByRole("button", { name: "Retry saved setup" })).toBeVisible();
    await page.getByRole("button", { name: "Retry saved setup" }).click();
    await expect(page).toHaveURL(/\/branch\/pilot$/);
    expect(attempts).toHaveLength(2);
    expect(committed.size).toBe(1);
    expect(attempts[1]).toMatchObject({ account: "pilot-owner", key: attempts[0].key, body: attempts[0].body });
    expect(JSON.parse(attempts[1].saved!)).toMatchObject({ pending: { commandId: attempts[0].key } });
    expect(JSON.parse((await page.evaluate(() => localStorage.getItem("lab-lords:onboarding:v1:pilot-owner")))!)).toMatchObject({
        pending: null, completed: [{ commandId: attempts[0].key, result }],
    });
});

test("empty, no-results, failed, restricted, and read-only fixture states stay distinct", async ({ page }) => {
    await openPilot(page, "/branch/pilot/students", { state: "empty" });
    await expect(page.getByText("No students in this view yet.").filter({ visible: true }).first()).toBeVisible();

    await openPilot(page, "/branch/pilot/students");
    await page.getByLabel("Search students by name or phone").fill("Definitely missing");
    await expect(page.getByText("No students match this search or shift filter.").filter({ visible: true }).first()).toBeVisible();

    await openPilot(page, "/branch/pilot/students", { state: "error" });
    await expect(page.getByRole("heading", { name: "Something went wrong" })).toBeVisible();

    await openPilot(page, "/branch/pilot/students", { role: "restricted" });
    await expect(page.getByText(/Fee details are hidden/)).toBeVisible();
    await expect(page.getByText(/Seat assignment actions are disabled/)).toBeVisible();

    await openPilot(page, "/branch/pilot/students", { role: "readonly" });
    await expect(page.getByText("Workspace is read-only", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add student" })).toBeDisabled();
});

test("English, Hindi, and Hinglish are selected by app preference rather than browser locale", async ({ page }, testInfo) => {
    for (const [language, htmlLanguage] of [["en", "en-IN"], ["hi", "hi-IN"], ["hinglish", "hi-Latn-IN"]] as const) {
        await openPilot(page, "/branch/pilot/students", { lang: language });
        await expect(page.locator("html")).toHaveAttribute("lang", htmlLanguage);
        await expect(page.getByLabel(/Interface language|स्क्रीन की भाषा|Screen ki language/)).toHaveValue(language);
        if (language === "hi") {
            await expect(page.getByLabel("शिफ्ट के हिसाब से छात्र देखें")).toContainText("सभी शिफ्ट");
            await expect(page.getByText("सक्रिय", { exact: true }).filter({ visible: true }).first()).toBeVisible();
            if (!testInfo.project.name.startsWith("desktop")) {
                await expect(page.getByRole("link", { name: "ब्रांच डैशबोर्ड पर वापस जाएँ" })).toBeVisible();
            }
        }
    }
});

test("compact shell mounts one reachable navigation drawer", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.startsWith("desktop"), "Compact-shell-only assertion");
    await openPilot(page, "/branch/pilot");
    const trigger = page.getByRole("button", { name: /Open navigation|नेविगेशन खोलें|Navigation kholein/ });
    const organization = page.getByRole("combobox", { name: "Switch organization", exact: true });
    const switcher = page.getByRole("combobox", { name: "Switch branch", exact: true });
    const search = page.getByRole("button", { name: "Search current branch" });
    const [triggerBox, switcherBox, searchBox] = await Promise.all([
        trigger.boundingBox(),
        switcher.boundingBox(),
        search.boundingBox(),
    ]);
    expect(triggerBox).not.toBeNull();
    expect(switcherBox).not.toBeNull();
    expect(searchBox).not.toBeNull();
    await expect(organization).toBeVisible();
    expect(switcherBox!.width).toBeGreaterThanOrEqual(85);
    expect(triggerBox!.x + triggerBox!.width).toBeLessThanOrEqual(switcherBox!.x);
    expect(switcherBox!.x + switcherBox!.width).toBeLessThanOrEqual(searchBox!.x);
    await search.click();
    const searchDialog = page.getByRole("dialog", { name: "Search this branch" });
    await expect(searchDialog).toBeVisible();
    await expect(searchDialog.getByRole("combobox", { name: "Search current branch" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(searchDialog).toHaveCount(0);
    await expect(search).toBeFocused();
    await trigger.click();
    const drawer = page.getByRole("dialog", { name: /Workspace navigation|वर्कस्पेस मेन्यू|Workspace navigation/ });
    await expect(drawer).toBeVisible();
    await expect(page.getByLabel("Branch navigation")).toHaveCount(1);
    const settings = drawer.getByRole("link", { name: "Branch Settings" });
    // The full navigation has more destinations than fit on a phone: verify
    // its scroll region can expose the lower links without moving the dialog.
    await settings.scrollIntoViewIfNeeded();
    await expect(settings).toBeVisible();
    const settingsBox = await settings.boundingBox();
    expect(settingsBox).not.toBeNull();
    expect(settingsBox!.y).toBeGreaterThanOrEqual(0);
    expect(settingsBox!.y + settingsBox!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
});

test("collection baseline and after modes use different scoped overlay themes", async ({ page }) => {
    await openPilot(page, "/branch/pilot/payments", { mode: "baseline", surface: "collection" });
    await expect(page.locator('[data-dialog-overlay="true"]')).not.toHaveClass(/app-design-pilot-overlay/);

    await openPilot(page, "/branch/pilot/payments", { mode: "after", surface: "collection" });
    await expect(page.locator('[data-dialog-overlay="true"]')).toHaveClass(/app-design-pilot-overlay/);
});

test("keyboard row action restores focus after its dialog closes", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("desktop"), "One keyboard check covers the shared row action primitive");
    await openPilot(page, "/branch/pilot/students");
    const trigger = page.getByRole("button", { name: "Actions" }).first();
    await trigger.focus();
    await trigger.press("Enter");
    const editAction = page.getByRole("menuitem", { name: /Edit Details/ });
    await editAction.focus();
    await editAction.press("Enter");

    const dialog = page.getByRole("dialog", { name: "Edit student" });
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe("hidden");
});

test("representative pilot surfaces have no serious automated accessibility violations", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("desktop"), "One desktop scan covers the shared component states");

    for (const path of [
        "/branch/pilot",
        "/branch/pilot/students?lang=hi",
        "/branch/pilot/seats?lang=hinglish",
        "/branch/pilot/payments?surface=collection&scenario=uncertain",
    ]) {
        const separator = path.includes("?") ? "&" : "?";
        await page.goto(`${path}${separator}mode=after`);
        await expect(page.getByTestId("synthetic-pilot-label")).toBeVisible();
        await expect(page.locator("main h1:visible, [role='dialog'] h2:visible").first()).toBeVisible();
        const { violations } = await new AxeBuilder({ page }).analyze();
        expect(
            violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical"),
            `Serious accessibility findings on ${path}`
        ).toEqual([]);
    }
});

test("desktop content stays operable at a 200 percent equivalent CSS viewport", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("desktop"), "Desktop zoom-equivalent assertion");
    await page.setViewportSize({ width: 720, height: 800 });
    await openPilot(page, "/branch/pilot/students", { lang: "hi" });
    await expect(page.getByRole("button", { name: "मेन्यू खोलें" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "छात्र" })).toBeVisible();
    const hasPageOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasPageOverflow).toBe(false);
});
