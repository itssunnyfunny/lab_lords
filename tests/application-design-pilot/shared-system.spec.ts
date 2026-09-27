import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("the newest roster query wins when an earlier response arrives late", async ({ page }) => {
    const releases: Array<() => void> = [];
    let held = false;
    await page.route("**/api/branches/pilot/students?**", async route => {
        if (new URL(route.request().url()).searchParams.get("q") === "Aarav") {
            const response = await route.fetch(); held = true;
            await new Promise<void>(resolve => { releases.push(resolve); });
            await route.fulfill({ response });
        } else await route.continue();
    });
    await page.goto("/branch/pilot/students?mode=after&lang=en");
    const search = page.getByLabel("Search students by name or phone");
    await search.fill("Aarav"); await expect.poll(() => held).toBe(true);
    await search.fill("Nisha");
    await expect(page.locator("p:visible").filter({ hasText: /^Nisha Verma$/ })).toBeVisible();
    const late = page.waitForResponse(response => new URL(response.url()).searchParams.get("q") === "Aarav");
    releases.forEach(release => release()); await late;
    await expect(page.locator("[data-record-list]")).not.toContainText("Aarav Mehta");
    await expect(search).toHaveValue("Nisha");
});

test("failed edits retain input, language and allocation context until a successful retry", async ({ page }) => {
    let fail = true;
    await page.route("**/api/branches/pilot/students", route => route.request().method() === "PATCH" && fail ? route.fulfill({ status: 503, json: { error: "Failed to update" } }) : route.continue());
    await page.goto("/branch/pilot/students?mode=after&lang=en");
    await page.getByLabel("Search students by name or phone").fill("Aarav");
    await expect(page.locator('[data-record-list] [aria-busy="true"]')).toHaveCount(0);
    await expect(page.getByText("Showing 1 of 1 active students", { exact: true })).toBeVisible();
    await page.locator('button[aria-label="Actions"]:visible').first().click();
    await page.getByRole("menuitem", { name: /Edit Details/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Full Name *").fill("Aarav Retained Draft");
    await dialog.getByRole("button", { name: "Save Changes" }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await dialog.getByLabel("Interface language", { exact: true }).selectOption("hinglish");
    await expect(dialog.locator("#edit-student-name")).toHaveValue("Aarav Retained Draft");
    fail = false;
    await dialog.getByRole("button", { name: /Save|save/i }).filter({ hasNotText: /Cancel/ }).last().click();
    await expect(dialog).toHaveCount(0);
    const records = page.locator("[data-record-list]");
    await expect(records).toContainText("Aarav Retained Draft");
    await expect(records).toContainText("A1"); await expect(records).toContainText("Morning");
});

test("background supporting-data refresh keeps the nested fee workflow mounted", async ({ page }) => {
    await page.goto("/branch/pilot/students?mode=after&lang=en");
    const trigger = page.locator('button[aria-label="Actions"]:visible').first();
    await trigger.click(); await page.getByRole("menuitem", { name: /View Fees/ }).click();
    const parent = page.getByRole("dialog", { name: "Aarav Mehta" });
    await parent.getByRole("button", { name: "Collect fee", exact: true }).click();
    const child = page.getByRole("dialog", { name: "Collect fee", exact: true });
    await child.getByLabel("Amount received (whole ₹)").fill("700");
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(child.getByLabel("Amount received (whole ₹)")).toHaveValue("700");
    expect(await parent.evaluate(element => !!element.closest("[inert]"))).toBe(true);
    await page.keyboard.press("Escape"); await expect(child).toHaveCount(0);
    await expect(parent.getByRole("button", { name: "Collect fee", exact: true })).toBeFocused();
    await page.keyboard.press("Escape"); await expect(parent).toHaveCount(0);
    await expect(trigger).toBeFocused();
});

test("list retry and clear filters use the real roster read", async ({ page }) => {
    let fail = true;
    await page.route("**/api/branches/pilot/students?**", route => fail ? route.fulfill({ status: 503, json: { error: "Synthetic student list failure" } }) : route.continue());
    await page.goto("/branch/pilot/students?mode=after&lang=en");
    const error = page.getByRole("alert"); await expect(error).toBeVisible();
    await expect(page.getByRole("button", { name: "Active", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Inactive", exact: true })).toBeVisible();
    fail = false; await error.getByRole("button", { name: "Try again" }).click();
    await expect(page.locator("[data-record-list]")).toContainText("Aarav Mehta");
    await page.getByLabel("Search students by name or phone").fill("Absent fixture");
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByLabel("Search students by name or phone")).toHaveValue("");
    await expect(page.locator("[data-record-list]")).toContainText("Nisha Verma");
});

test("failed supporting reads hide fee figures and export without discarding an open collection", async ({ page }) => {
    let fail = true;
    await page.route("**/api/branches/pilot/payments?**", route => fail ? route.fulfill({ status: 503, json: { error: "Synthetic payment read failure" } }) : route.continue());
    await page.goto("/branch/pilot/students?mode=after&lang=en");
    await expect(page.getByRole("heading", { name: "Something went wrong" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Export", exact: true })).toBeDisabled();
    await expect(page.locator("[data-record-list]")).not.toContainText("Due: ₹0");
    fail = false;
    await page.getByRole("alert").getByRole("button", { name: "Try again" }).click();
    await expect(page.locator("[data-record-list]")).toContainText("Due: ₹2,400");
    await expect(page.getByRole("button", { name: "Export", exact: true })).toBeEnabled();
    await page.locator('button[aria-label="Actions"]:visible').first().click();
    await page.getByRole("menuitem", { name: "View Fees", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Collect fee", exact: true }).click();
    const collection = page.getByRole("dialog", { name: "Collect fee", exact: true });
    await collection.getByLabel("Amount received (whole ₹)").fill("700");
    fail = true;
    const failedRead = page.waitForResponse(response => response.url().includes("/payments?") && response.status() === 503);
    await page.evaluate(() => window.dispatchEvent(new Event("focus"))); await failedRead;
    await expect(collection.getByLabel("Amount received (whole ₹)")).toHaveValue("700");
});

test("gallery renders real controls, invalid fields and nested focus behavior", async ({ page }) => {
    await page.goto("/branch/pilot/gallery?mode=after&lang=en");
    await expect(page.getByRole("heading", { name: "Shared component gallery" })).toBeVisible();
    await page.getByRole("button", { name: "Edit student", exact: true }).first().click();
    const parent = page.getByRole("dialog", { name: "Edit student" });
    await parent.getByRole("button", { name: "Save Changes" }).click();
    await expect(parent.getByLabel("Full Name")).toHaveAttribute("aria-invalid", "true");
    await parent.getByRole("button", { name: "View Fees" }).click();
    const nested = page.getByRole("dialog", { name: "Payment history" }); await expect(nested).toBeVisible();
    await page.keyboard.press("Escape"); await expect(nested).toHaveCount(0);
    await expect(parent.getByRole("button", { name: "View Fees" })).toBeFocused();
    await page.keyboard.press("Escape"); await expect(parent).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.filter(item => ["serious", "critical"].includes(item.impact!))).toEqual([]);
});

test("admission validation preserves entered values and loaded bulk consent stays scoped", async ({ page }) => {
    await page.goto("/branch/pilot/students?mode=after&lang=en");
    await page.getByRole("button", { name: "Add student", exact: true }).click();
    const admission = page.getByRole("dialog");
    await admission.getByRole("textbox", { name: /^Full Name/ }).fill("Synthetic Draft Student");
    await admission.getByRole("button", { name: "Add Student", exact: true }).click();
    await expect(admission.locator("[aria-invalid='true']").first()).toBeVisible();
    await admission.getByLabel("Interface language", { exact: true }).selectOption("hi");
    await expect(admission.locator("#add-student-name")).toHaveValue("Synthetic Draft Student");
    await page.keyboard.press("Escape"); await expect(admission).toHaveCount(0);
    await page.getByLabel("स्क्रीन की भाषा", { exact: true }).selectOption("en");
    await page.getByLabel("Search students by name or phone").fill("Aarav");
    await expect(page.getByText("Showing 1 of 1 active students", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Bulk WhatsApp consent", exact: true }).click();
    const bulk = page.getByRole("dialog", { name: "Bulk WhatsApp operational consent" });
    await expect(bulk).toContainText("Aarav Mehta");
    await expect(bulk).not.toContainText("Nisha Verma");
    await expect(bulk).not.toContainText("Meera Singh");
});

test("status resolution retains its canonical command while attendance opens its existing drawer", async ({ page }) => {
    let command: Record<string, unknown> | null = null;
    await page.route("**/api/branches/pilot/students", async route => {
        if (route.request().method() === "PATCH") command = route.request().postDataJSON();
        await route.continue();
    });
    await page.goto("/branch/pilot/students?mode=after&lang=en");
    await page.locator('button[aria-label="Actions"]:visible').first().click();
    await page.getByRole("menuitem", { name: /Deactivate/ }).click();
    const status = page.getByRole("alertdialog");
    await status.getByRole("radio", { name: /Keep as Due/ }).check();
    await status.getByRole("button", { name: "Confirm deactivate" }).click();
    await expect(status).toHaveCount(0);
    expect(command).toMatchObject({ id: "student-aarav", status: "INACTIVE", dueResolution: "KEEP" });
    await page.locator('button[aria-label="Actions"]:visible').first().click();
    await page.getByRole("menuitem", { name: /Attendance/ }).click();
    const attendance = page.getByRole("dialog");
    await expect(attendance).toBeVisible();
    await expect(attendance.getByRole("heading", { name: "Attendance history & QR" })).toBeVisible();
    await page.keyboard.press("Escape"); await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("branch and account navigation remove old records and drafts", async ({ page }) => {
    await page.goto("/branch/pilot/students?mode=after&lang=en");
    await page.locator('button[aria-label="Actions"]:visible').first().click();
    await page.getByRole("menuitem", { name: /Edit Details/ }).click();
    await page.getByRole("dialog").getByLabel("Full Name *").fill("Old identity draft");
    await page.evaluate(() => { history.pushState({}, "", "/branch/pilot/students?mode=after&lang=en&identity=second-synthetic-owner&state=empty"); window.dispatchEvent(new Event("pilot:navigation")); });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("No students in this view yet.")).toBeVisible();
    await expect(page.locator("[data-record-list]")).not.toContainText("Aarav Mehta");
    await page.evaluate(() => { history.pushState({}, "", "/branch/another-synthetic-branch/students?mode=after&lang=en&identity=second-synthetic-owner"); window.dispatchEvent(new Event("pilot:navigation")); });
    await expect(page.getByRole("heading", { name: "No access", exact: true })).toBeVisible();
    await expect(page.locator("main")).not.toContainText("Aarav Mehta");
    await expect(page.locator("main")).not.toContainText("Old identity draft");
});
