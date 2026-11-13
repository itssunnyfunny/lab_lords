import { reviewEvidencePath } from "../browser/helpers/review-evidence";
import fs from "node:fs";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const evidence = reviewEvidencePath("docs/redesign/application-rollout-evidence/guided");
const sessionPath = "/branch/pilot/onboarding/import/session-pilot";
const selectedCaptures = new Set([
    "onboarding-entry:desktop-1440",
    "onboarding-entry:mobile-390",
    "onboarding-review:mobile-390",
    "onboarding-hi:mobile-320",
    "invite-review:mobile-390",
    "import-assistant:desktop-1440",
    "import-assistant:mobile-390",
    "import-review:mobile-390",
]);

function expectNoHorizontalOverflow(page: Page) {
    return expect(page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth + 1)).resolves.toBe(true);
}

async function capture(page: Page, info: TestInfo, name: string) {
    if (!selectedCaptures.has(`${name}:${info.project.name}`)) return;
    fs.mkdirSync(evidence, { recursive: true });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${evidence}/${name}-${info.project.name}.png`, animations: "disabled" });
}

const session = {
    id: "session-pilot",
    status: "ANALYZED",
    goal: "STUDENTS",
    sourceType: "PASTED_TABLE",
    draftRevision: 1,
    activeEvaluationRevision: 1,
    fileName: "Pasted table",
    mapping: {
        entityTypesDetected: ["STUDENT"],
        columnMappings: [{ sourceColumn: "Name", targetField: "student.name", confidence: 100, source: "MANUAL", autoApplied: true, needsReview: false }],
        importOptions: {},
        analysis: { sourceProfile: { rowCount: 1, columnCount: 1, emptyCellRate: 0, columns: [], highSignalColumns: [], lowSignalColumns: [] }, attention: [] },
    },
    summary: {
        totalRows: 1, readyRows: 1, needsReviewRows: 0, blockedRows: 0, warningRows: 0,
        duplicateRows: 0, conflictRows: 0, skippedRows: 0, readinessScore: 100,
        detectedEntityCounts: { STUDENT: 1 }, attention: [],
    },
    rows: [],
    rowPage: { filter: "attention", issueCode: null, limit: 120, cursor: null, nextCursor: null, hasMore: false, totalRows: 1, filteredRows: 0, returnedRows: 0 },
    questions: [],
    commits: [],
    latestRun: null,
};

type ImportFixture = {
    historyFails: boolean;
    detailFails: boolean;
    createFails: boolean;
    creates: Array<{ method: string; body: Record<string, unknown> }>;
};

async function installImportFixtures(page: Page): Promise<ImportFixture> {
    const fixture: ImportFixture = { historyFails: false, detailFails: false, createFails: false, creates: [] };
    await page.route(/\/api\/branches\/pilot\/import-sessions(?:\?.*)?$/, async route => {
        if (route.request().method() === "GET") {
            await route.fulfill(fixture.historyFails
                ? { status: 503, json: { error: "Synthetic import history failure" } }
                : { json: [{
                    id: "session-pilot", branchId: "pilot", sourceType: "PASTED_TABLE", fileName: "Pasted table",
                    status: "ANALYZED", engineVersion: 2, goal: "STUDENTS", draftRevision: 1,
                    activeEvaluationRevision: 1, archivedAt: null, summary: session.summary,
                    createdAt: "2026-09-28T06:00:00.000Z", updatedAt: "2026-09-28T06:00:00.000Z",
                }] });
            return;
        }
        if (route.request().method() === "POST") {
            fixture.creates.push({ method: "POST", body: route.request().postDataJSON() as Record<string, unknown> });
            await route.fulfill(fixture.createFails
                ? { status: 503, json: { error: "Synthetic staging failure" } }
                : { json: { sessionId: "session-pilot", runId: null, status: "ANALYZED" } });
            return;
        }
        await route.fulfill({ status: 405, json: { error: "Fixture method not allowed" } });
    });
    await page.route(/\/api\/branches\/pilot\/import-sessions\/session-pilot(?:\?.*)?$/, async route => {
        await route.fulfill(fixture.detailFails
            ? { status: 503, json: { error: "Synthetic session read failure" } }
            : { json: session });
    });
    return fixture;
}

test("onboarding keeps four-step validation and staged trial request identity", async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const requests: Array<Record<string, unknown>> = [];
    await page.route(/\/api\/onboarding(?:\?.*)?$/, async route => {
        requests.push(route.request().postDataJSON() as Record<string, unknown>);
        await route.fulfill({ status: 503, json: { error: "Synthetic setup failure" } });
    });
    await page.goto("/onboarding?mode=after&lang=en");
    await expect(page.getByRole("heading", { level: 1, name: "Set up Lab Lords" })).toBeVisible();
    await expect(page.locator('[data-app-design-pilot="workspace"]').first()).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Tell us about your business" })).toBeVisible();
    await capture(page, info, "onboarding-entry");
    await expectNoHorizontalOverflow(page);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.locator("#setup-business-error")).toBeVisible();
    await page.getByLabel("Library / centre name", { exact: true }).fill("Shanti Study Library");
    await page.getByLabel("Owner phone", { exact: true }).fill("9876543210");
    await page.locator("summary").filter({ hasText: "Workspace name (optional)" }).click();
    await page.getByLabel("Workspace name", { exact: true }).fill("Shanti Learning Spaces");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Make room for your students" })).toBeVisible();
    await page.getByLabel("How many physical seats are here?", { exact: true }).fill("8");
    await page.getByLabel("Student monthly fee (₹)", { exact: true }).fill("600");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Try the plan that fits your work" })).toBeVisible();
    await page.getByRole("button").filter({ has: page.getByText("Standard", { exact: true }) }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByRole("heading", { level: 2, name: "A good start, your way" })).toBeVisible();
    await page.getByRole("button", { name: /Import existing records/ }).click();
    await capture(page, info, "onboarding-review");
    expect(requests).toHaveLength(0);
    await page.getByRole("button", { name: "Create my workspace", exact: true }).click();
    await expect.poll(() => requests.length).toBe(1);
    expect(requests[0]).toMatchObject({
        orgName: "Shanti Learning Spaces", branchName: "Shanti Study Library", seatCount: 8,
        trialPlan: "STANDARD", selectedPostTrialPlan: "STANDARD", multiShifts: [],
        shifts: [{ name: "Daily session", startTime: "06:00", endTime: "22:00", price: 600 }],
    });
    await expect(page.getByText("Something went wrong. Try again.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Recover your saved setup" })).toBeVisible();
    await page.getByRole("button", { name: "Retry saved setup", exact: true }).click();
    await expect.poll(() => requests.length).toBe(2);
    expect(requests[1]).toEqual(requests[0]);
    expect(errors).toEqual([]);
});

test("guided entry stays localized at Hindi, Hinglish and 320px", async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    for (const [lang, htmlLang] of [["hi", "hi-IN"], ["hinglish", "hi-Latn-IN"]] as const) {
        await page.goto(`/onboarding?mode=after&lang=${lang}`);
        await expect(page.locator("html")).toHaveAttribute("lang", htmlLang);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(page.getByRole("heading", { level: 2 })).toBeVisible();
        await expectNoHorizontalOverflow(page);
        if (info.project.name === "mobile-320" && lang === "hi") await capture(page, info, "onboarding-hi");
    }
    expect(errors).toEqual([]);
});

test("invite preview keeps accept, signed-out and invalid states distinct", async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    let attempts = 0;
    await page.route(/\/api\/invites\/invite-pilot\/accept$/, async route => {
        attempts++;
        await route.fulfill(attempts === 1
            ? { status: 503, json: { error: "Synthetic invite failure" } }
            : { json: { branchId: "pilot" } });
    });
    await page.goto("/invite/invalid?mode=after&lang=en");
    await expect(page.getByRole("heading", { level: 1, name: "Invite not found" })).toBeVisible();
    await expect(page.locator('[data-app-design-pilot="workspace"]').first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Return to workspaces" })).toHaveAttribute("href", "/app");
    await expectNoHorizontalOverflow(page);
    if (info.project.name !== "mobile-320") {
        const { violations } = await new AxeBuilder({ page }).analyze();
        expect(violations.filter(item => ["serious", "critical"].includes(item.impact!))).toEqual([]);
    }
    await page.goto("/invite/signed-out?mode=after&lang=en");
    await expect(page.getByRole("link", { name: "Sign in to join" })).toHaveAttribute("href", /redirect_url=%2Finvite%2Finvite-pilot/);
    await expect(page.getByRole("link", { name: "Create account" })).toBeVisible();
    await page.goto("/invite/empty-email?mode=after&lang=en");
    await expect(page.getByRole("button", { name: "Accept invite" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in to join" })).toHaveCount(0);
    await page.goto("/invite/invite-pilot?mode=after&lang=en");
    await expect(page.getByRole("heading", { level: 1, name: "Join Shanti Study Library" })).toBeVisible();
    await expect(page.getByText("staff@example.test")).toBeVisible();
    await expect(page.getByRole("button", { name: "Accept invite" })).toBeVisible();
    await capture(page, info, "invite-review");
    await page.getByRole("button", { name: "Accept invite" }).focus();
    await expect(page.getByRole("button", { name: "Accept invite" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("alert")).toContainText("Something went wrong. Try again.");
    await page.getByRole("button", { name: "Accept invite" }).click();
    await expect.poll(() => attempts).toBe(2);
    await expect(page).toHaveURL(/\/app$/);
    expect(errors).toEqual([]);
});

test("import assistant recovers history and preserves pasted staging request", async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const fixture = await installImportFixtures(page);
    fixture.historyFails = true;
    await page.goto("/branch/pilot/onboarding/import?mode=after&lang=en");
    await expect(page.getByRole("heading", { level: 1, name: "Import assistant" })).toBeVisible();
    await expect(page.locator('[data-app-design-pilot="workspace"]').first()).toBeVisible();
    await expect(page.getByText("Nothing is created until the final review.", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry history" })).toBeVisible();
    fixture.historyFails = false;
    await page.getByRole("button", { name: "Retry history" }).click();
    await expect(page.getByRole("button", { name: "Resume Pasted table" })).toBeVisible();
    await page.locator("#main-content").evaluate(async element => {
        element.scrollTop = 0;
        await new Promise(requestAnimationFrame);
    });
    await capture(page, info, "import-assistant");
    await page.getByRole("button", { name: "Paste table" }).click();
    await page.getByRole("textbox", { name: "Paste rows with a header" }).fill("Name\tMobile\nAarav Mehta\t9876543210");
    fixture.createFails = true;
    await page.getByRole("button", { name: "Prepare my records", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Something went wrong. Try again.");
    expect(fixture.creates[0]).toMatchObject({ method: "POST", body: { goal: "FULL", experience: "GUIDED_SETUP_V2", fileName: "Pasted table", pastedTable: "Name\tMobile\nAarav Mehta\t9876543210" } });
    fixture.createFails = false;
    await page.getByRole("button", { name: "Prepare my records", exact: true }).click();
    await expect(page).toHaveURL(/\/onboarding\/import\/session-pilot\?goal=FULL/);
    await expect.poll(() => fixture.creates.length).toBe(2);
    await expectNoHorizontalOverflow(page);
    expect(errors).toEqual([]);
});

test("import review handles load failure and read-only staged data", async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const fixture = await installImportFixtures(page);
    fixture.detailFails = true;
    await page.goto(`${sessionPath}?mode=after&lang=en`);
    await expect(page.getByRole("heading", { level: 1, name: "Import review" })).toBeVisible();
    await expect(page.locator('[data-app-design-pilot="workspace"]').first()).toBeVisible();
    await expect(page.getByRole("alert")).toContainText("Something went wrong. Try again.");
    fixture.detailFails = false;
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Column meanings" })).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Import readiness" })).toHaveAttribute("aria-valuenow", "100");
    await capture(page, info, "import-review");
    await expectNoHorizontalOverflow(page);
    await page.goto(`${sessionPath}?mode=after&lang=en&role=readonly`);
    await expect(page.getByText("Import changes are disabled.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm columns" })).toBeDisabled();
    const history = info.project.name.startsWith("mobile")
        ? page.getByRole("link", { name: "Back to import history", exact: true })
        : page.getByRole("button", { name: "All imports", exact: true });
    await expect(history).toBeEnabled();
    await history.click();
    await expect(page).toHaveURL(/\/branch\/pilot\/onboarding\/import$/);
    expect(errors).toEqual([]);
});
