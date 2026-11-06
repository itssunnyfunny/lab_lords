import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { translateOwnedText } from "@/lib/i18n";
import type { InterfaceLanguage } from "@/lib/i18n/language";
import { basicImportAccess } from "./basic-access";

type Submission = { body: Record<string, unknown>; key: string | undefined; account: string | undefined };
async function prepare(page: Page, language: InterfaceLanguage = "en") {
    const submissions: Submission[] = [], errors: string[] = [];
    let currentLanguage = language;
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/api/users/me", async route => {
        if (route.request().method() === "PATCH") currentLanguage = route.request().postDataJSON().interfaceLanguage ?? currentLanguage;
        await route.fulfill({ json: { interfaceLanguage: currentLanguage, documentLanguage: "en", name: "Fixture owner" } });
    });
    await page.route("**/api/onboarding", async route => {
        const request = route.request();
        submissions.push({ body: request.postDataJSON(), key: request.headers()["idempotency-key"], account: request.headers()["x-onboarding-account"] });
        await route.fulfill({ status: 201, json: { org: { id: "fixture-org" }, branch: { id: "fixture-branch" } } });
    });
    await page.goto("/");
    const tr = (key: string) => translateOwnedText(language, key);
    await expect(page.getByRole("heading", { name: tr("Tell us about your business") })).toBeVisible();
    return { submissions, errors, tr };
}
async function business(page: Page, language: InterfaceLanguage = "en") {
    const t = (key: string) => translateOwnedText(language, key);
    await page.getByLabel(t("Library / centre name"), { exact: true }).fill("Saraswati Library");
    await page.getByLabel(t("Owner phone"), { exact: true }).fill("9876543210");
    await expect(page.getByLabel(t("Library / centre name"), { exact: true })).toHaveValue("Saraswati Library");
    await page.getByRole("button", { name: t("Continue"), exact: true }).click();
    await expect(page.getByRole("heading", { name: t("Make room for your students") })).toBeVisible();
}
async function singleSession(page: Page, language: InterfaceLanguage = "en") {
    const t = (key: string) => translateOwnedText(language, key);
    await page.getByLabel(t("How many physical seats are here?"), { exact: true }).fill("12");
    await page.getByLabel(t("Student monthly fee (₹)"), { exact: true }).fill("600");
    await page.getByRole("button", { name: t("Continue"), exact: true }).click();
}
async function choosePlan(page: Page, plan: string) {
    await page.getByRole("button").filter({ has: page.getByText(plan, { exact: true }) }).click();
}

for (const plan of ["Basic", "Standard", "Pro"]) test(`single-session ${plan} setup has explicit fees and no unwanted combinations`, async ({ page }, testInfo) => {
    const { submissions, errors } = await prepare(page);
    const capture = async (step: string) => {
        if (plan === "Basic") await page.locator('[data-app-design-pilot="workspace"]').screenshot({ path: testInfo.outputPath(`${step}.png`) });
    };
    await capture("business");
    await expect(page.getByText("Business Type", { exact: true })).toHaveCount(0);
    await business(page);
    await expect(page.getByLabel("Combination name", { exact: true })).toHaveCount(0);
    await page.getByLabel("How many physical seats are here?", { exact: true }).fill("12");
    await page.getByLabel("Student monthly fee (₹)", { exact: true }).fill("600");
    await capture("seats-timings");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await choosePlan(page, plan);
    await capture("trial");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByText("12", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: /Add students manually/ }).click();
    await capture("review");
    expect(submissions).toHaveLength(0);
    await page.getByRole("button", { name: "Create my workspace", exact: true }).click();
    await expect(page.getByTestId("destination")).toHaveText("/branch/fixture-branch");
    expect(submissions).toHaveLength(1);
    expect(submissions[0]).toMatchObject({ account: "onboarding-owner-A", body: { trialPlan: plan.toUpperCase(), selectedPostTrialPlan: plan.toUpperCase(), multiShifts: [] } });
    expect(submissions[0].key).toMatch(/^[a-f0-9-]{36}$/);
    expect(submissions[0].body.shifts).toEqual([{ name: "Daily session", startTime: "06:00", endTime: "22:00", price: 600 }]);
    expect(errors).toEqual([]);
});

test("adding an unfinished combination stays quiet, then validates beside its fields", async ({ page }) => {
    const { errors } = await prepare(page);
    await business(page);
    await page.getByLabel("How many physical seats are here?", { exact: true }).fill("8");
    await page.getByRole("button", { name: "Use morning, afternoon & evening", exact: true }).click();
    await page.getByLabel("Same monthly fee for every time slot?", { exact: true }).fill("500");
    await page.getByRole("button", { name: "Apply to all time slots", exact: true }).click();
    await page.getByText("Combined access (optional)", { exact: true }).click();
    await page.getByRole("button", { name: "Add a combination", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByText("Enter a combination name of up to 50 characters.", { exact: true })).toBeVisible();
    await expect(page.getByText("Choose at least two existing time slots for this combination.", { exact: true })).toBeVisible();
    await expect(page.getByText(/Something went wrong/)).toHaveCount(0);
    await page.getByLabel("Combination name", { exact: true }).fill("Full day");
    const combination = page.getByRole("region", { name: "Combination 1", exact: true });
    await combination.getByRole("checkbox", { name: /Morning/ }).check();
    await combination.getByRole("checkbox", { name: /Afternoon/ }).check();
    await page.getByRole("button", { name: "Use this total", exact: true }).click();
    await expect(page.getByLabel("Combined monthly fee (₹)", { exact: true })).toHaveValue("1000");
    await page.getByRole("button", { name: "Remove time slot 1", exact: true }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByText("Choose at least two existing time slots for this combination.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Remove combination 1", exact: true }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Try the plan that fits your work", exact: true })).toBeVisible();
    expect(errors).toEqual([]);
});

test("overlap feedback appears beside the affected time inputs and supports correction", async ({ page }) => {
    await prepare(page); await business(page);
    await page.getByLabel("How many physical seats are here?", { exact: true }).fill("8");
    await page.getByRole("button", { name: "Use morning, afternoon & evening", exact: true }).click();
    await page.getByLabel("Same monthly fee for every time slot?", { exact: true }).fill("0");
    await page.getByRole("button", { name: "Apply to all time slots", exact: true }).click();
    await page.getByLabel("Ends at", { exact: true }).nth(0).fill("11:00");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByLabel("Ends at", { exact: true }).nth(0)).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Starts at", { exact: true }).nth(1)).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("These times overlap another time slot. Adjust the start or end time.", { exact: true })).toHaveCount(4);
    await page.getByLabel("Ends at", { exact: true }).nth(0).fill("10:00");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Try the plan that fits your work", exact: true })).toBeVisible();
});

test("custom seat labels validate their count and survive back navigation", async ({ page }) => {
    const { submissions } = await prepare(page); await business(page);
    await page.getByLabel("How many physical seats are here?", { exact: true }).fill("8");
    await page.getByRole("button", { name: "Use custom seat labels, such as A1 or B1", exact: true }).click();
    await page.getByRole("button", { name: "Custom ranges", exact: true }).click();
    await page.getByLabel("Range 1 end", { exact: true }).fill("7");
    await page.getByLabel("Student monthly fee (₹)", { exact: true }).fill("0");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByRole("alert").getByText("Seat labels total 7, but physical seats is 8.", { exact: true })).toBeVisible();
    await page.getByLabel("Range 1 end", { exact: true }).fill("8");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page.getByLabel("Range 1 end", { exact: true })).toHaveValue("8");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await choosePlan(page, "Basic");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: /Add students manually/ }).click();
    await page.getByRole("button", { name: "Create my workspace", exact: true }).click();
    await expect(page.getByTestId("destination")).toHaveText("/branch/fixture-branch");
    expect(submissions[0].body.seatNumbering).toMatchObject({ mode: "RANGE", ranges: [{ prefix: "A", start: 1, end: 8 }] });
});

test("combinations can share slots, keep explicitly chosen fees, and submit without stale references", async ({ page }) => {
    const { submissions } = await prepare(page); await business(page);
    await page.getByLabel("How many physical seats are here?", { exact: true }).fill("8");
    await page.getByRole("button", { name: "Use morning, afternoon & evening", exact: true }).click();
    await page.getByLabel("Same monthly fee for every time slot?", { exact: true }).fill("500");
    await page.getByRole("button", { name: "Apply to all time slots", exact: true }).click();
    await page.getByText("Combined access (optional)", { exact: true }).click();
    for (const [index, components] of [[0, ["Morning", "Afternoon"]], [1, ["Afternoon", "Evening"]]] as const) {
        await page.getByRole("button", { name: "Add a combination", exact: true }).click();
        const row = page.getByRole("region", { name: `Combination ${index + 1}`, exact: true });
        await row.getByLabel("Combination name", { exact: true }).fill(`Bundle ${index + 1}`);
        for (const component of components) await row.getByRole("checkbox", { name: new RegExp(component) }).check();
        await row.getByRole("button", { name: "Use this total", exact: true }).click();
    }
    await page.getByLabel("Time slot name", { exact: true }).nth(1).fill("Midday");
    await page.getByLabel("Student monthly fee (₹)", { exact: true }).nth(1).fill("700");
    await expect(page.getByLabel("Combined monthly fee (₹)", { exact: true }).nth(0)).toHaveValue("1000");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await choosePlan(page, "Standard");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: /Import existing records/ }).click();
    await page.getByRole("button", { name: "Create my workspace", exact: true }).click();
    await expect(page.getByTestId("destination")).toHaveText("/branch/fixture-branch/onboarding/import");
    expect(submissions[0].body.multiShifts).toEqual([
        { name: "Bundle 1", price: 1000, componentShiftNames: ["Morning", "Midday"] },
        { name: "Bundle 2", price: 1000, componentShiftNames: ["Midday", "Evening"] },
    ]);
});

test("replacing edited timings requires an explicit choice", async ({ page }) => {
    await prepare(page); await business(page);
    await page.getByLabel("Student monthly fee (₹)", { exact: true }).fill("600");
    await page.getByRole("button", { name: "Use morning, afternoon & evening", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Keep my timings", exact: true }).click();
    await expect(page.getByLabel("Student monthly fee (₹)", { exact: true })).toHaveValue("600");
    await page.getByRole("button", { name: "Use morning, afternoon & evening", exact: true }).click();
    await page.getByRole("button", { name: "Use suggested timings", exact: true }).click();
    await expect(page.getByLabel("Student monthly fee (₹)", { exact: true })).toHaveCount(3);
    for (const input of await page.getByLabel("Student monthly fee (₹)", { exact: true }).all()) await expect(input).toHaveValue("");
    await expect(page.getByLabel("Combination name", { exact: true })).toHaveCount(0);
});

for (const language of ["hi", "hinglish"] as const) test(`${language} setup validates specifically and keeps entered data on back navigation`, async ({ page }) => {
    const { tr } = await prepare(page, language);
    await business(page, language);
    await page.getByRole("button", { name: tr("Continue"), exact: true }).click();
    await expect(page.getByText(tr("Enter a monthly fee, or enter 0 for no fee."), { exact: true })).toBeVisible();
    await singleSession(page, language);
    await choosePlan(page, "Basic");
    await page.getByRole("button", { name: tr("Back"), exact: true }).click();
    await expect(page.getByLabel(tr("Student monthly fee (₹)"), { exact: true })).toHaveValue("600");
    await page.getByRole("button", { name: tr("Continue"), exact: true }).click();
    await page.getByRole("button", { name: tr("Continue"), exact: true }).click();
    await page.getByRole("button", { name: new RegExp(tr("Import existing records")) }).click();
    await page.getByRole("button", { name: tr("Create my workspace"), exact: true }).click();
    await expect(page.getByTestId("destination")).toHaveText("/branch/fixture-branch/onboarding/import");
});

test("language changes preserve drafts and keyboard navigation reaches labelled inputs", async ({ page }) => {
    await prepare(page);
    await page.getByLabel("Library / centre name", { exact: true }).focus();
    await page.keyboard.type("My Library");
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Owner phone", { exact: true })).toBeFocused();
    await page.getByRole("combobox", { name: "Interface language", exact: true }).selectOption("hi");
    await expect(page.getByLabel(translateOwnedText("hi", "Library / centre name"), { exact: true })).toHaveValue("My Library");
    await expect(page.locator("html")).toHaveAttribute("lang", "hi-IN");
});

test("account switches do not reuse another owner's unsubmitted business details", async ({ page }) => {
    await prepare(page);
    await page.getByLabel("Library / centre name", { exact: true }).fill("Private draft A");
    await page.getByRole("button", { name: "Switch fixture account", exact: true }).click();
    await expect(page.getByLabel("Library / centre name", { exact: true })).toHaveValue("");
    await expect(page.getByRole("heading", { name: "Tell us about your business", exact: true })).toBeVisible();
});

test("uncertain submission recovers the same key and survives reload without duplicate work", async ({ page }) => {
    const { submissions } = await prepare(page); let attempts = 0;
    await page.unroute("**/api/onboarding");
    await page.route("**/api/onboarding", async route => {
        submissions.push({ body: route.request().postDataJSON(), key: route.request().headers()["idempotency-key"], account: route.request().headers()["x-onboarding-account"] });
        if (++attempts === 1) await route.abort();
        else await route.fulfill({ status: 201, json: { org: { id: "fixture-org" }, branch: { id: "fixture-branch" } } });
    });
    await business(page); await singleSession(page); await choosePlan(page, "Basic");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: /Import existing records/ }).click();
    await page.getByRole("button", { name: "Create my workspace", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Recover your saved setup", exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Recover your saved setup", exact: true })).toBeVisible();
    expect(submissions).toHaveLength(1);
    await page.getByRole("button", { name: "Retry saved setup", exact: true }).click();
    await expect(page.getByTestId("destination")).toHaveText("/branch/fixture-branch/onboarding/import");
    expect(submissions[0]).toEqual(submissions[1]);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Your workspace is ready", exact: true })).toBeVisible();
    expect(submissions).toHaveLength(2);
});

test("the starting form has no accessibility violations or horizontal overflow", async ({ page }) => {
    await prepare(page);
    expect((await new AxeBuilder({ page }).include('[data-app-design-pilot="workspace"]').withTags(["wcag2a", "wcag2aa"]).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

async function prepareBasicImport(page: Page, scenario = "paid") {
    const submissions: unknown[] = [], errors: string[] = [];
    const access = basicImportAccess(scenario);
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/api/**", async route => {
        const path = new URL(route.request().url()).pathname;
        if (!path.startsWith("/api/")) { await route.continue(); return; }
        let json: unknown = [];
        if (path === "/api/users/me") json = { interfaceLanguage: "en", documentLanguage: "en", name: "Fixture owner" };
        else if (path.endsWith("/access")) json = access;
        else if (path === "/api/workspaces") json = { organizations: [], staffBranches: [] };
        else if (path === "/api/branches/fixture-branch") json = { id: "fixture-branch", name: "Main location", defaultFee: 500 };
        else if (path.endsWith("/basic-overview")) json = { branchId: "fixture-branch", today: "2026-11-02", activeStudents: 0, money: { collectedThisMonth: 0, pendingDues: 0 } };
        else if (/\/(students|payments)$/.test(path)) json = { items: [], nextCursor: null };
        else if (path.endsWith("/import-sessions") && route.request().method() === "POST") {
            submissions.push(route.request().postDataJSON()); json = { sessionId: "fixture-import", engineVersion: 2 };
        }
        await route.fulfill({ json });
    });
    await page.goto(`/branch/fixture-branch/onboarding/import?scenario=${scenario}`);
    return { submissions, errors };
}

test("Basic import remains reachable from Students after the trial and uploads without an upgrade gate", async ({ page }) => {
    const { submissions, errors } = await prepareBasicImport(page);
    await expect(page.getByRole("heading", { name: "Import assistant", exact: true })).toBeVisible();
    await expect(page.getByText(/This feature requires the Standard plan/)).toHaveCount(0);
    await page.getByRole("button", { name: "Paste table", exact: true }).click();
    await page.getByRole("textbox", { name: /Paste rows with a header/ }).fill("Name\tMobile\tFee\nFixture Student\t9876543210\t500");
    await page.getByRole("button", { name: "Prepare my records", exact: true }).click();
    await expect(page.getByTestId("destination")).toHaveText("/branch/fixture-branch/onboarding/import/fixture-import?goal=FULL");
    expect(submissions).toEqual([{ pastedTable: "Name\tMobile\tFee\nFixture Student\t9876543210\t500", fileName: "Pasted table", goal: "FULL", experience: "GUIDED_SETUP_V2" }]);
    await page.goto("/branch/fixture-branch/students");
    await expect(page.getByRole("heading", { name: "Your students", exact: true })).toBeVisible();
    const returnLink = page.locator("main").getByRole("link", { name: "Import students", exact: true });
    await expect(returnLink).toHaveAttribute("href", "/branch/fixture-branch/onboarding/import");
    await returnLink.click();
    await expect(page.getByRole("heading", { name: "Import assistant", exact: true })).toBeVisible();
    expect(errors).toEqual([]);
});

test("Basic import keeps expired access read-only", async ({ page }) => {
    const { submissions } = await prepareBasicImport(page, "expired");
    await expect(page.getByRole("heading", { name: "Import assistant", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Prepare my records", exact: true })).toBeDisabled();
    expect(submissions).toEqual([]);
});

test("Basic import keeps student permission checks", async ({ page }) => {
    const { submissions } = await prepareBasicImport(page, "denied");
    await expect(page.getByRole("heading", { name: "Import assistant", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Import students", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Back to overview", exact: true })).toBeVisible();
    expect(submissions).toEqual([]);
});

test("Basic import does not unlock the premium analytics route", async ({ page }) => {
    await prepareBasicImport(page);
    await page.goto("/branch/fixture-branch/analytics");
    await expect(page.getByRole("heading", { name: "Import assistant", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Back to overview", exact: true })).toBeVisible();
});
