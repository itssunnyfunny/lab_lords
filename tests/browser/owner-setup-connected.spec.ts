import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { Client } from "pg";
import { refreshDevelopmentSession } from "./helpers/development-session";
import { assertDisposableTestDatabaseTarget } from "../setup/testDatabaseSafety";
import { translateOwnedText } from "../../lib/i18n";

const target = assertDisposableTestDatabaseTarget(process.env.TEST_DATABASE_URL, process.env);
if (target.databaseName !== (process.env.OWNER_SETUP_CORRECTION === "1" ? "lab_lords_correction_browser_test" : "lab_lords_owner_setup_browser_test")) throw new Error("Wrong isolated owner-setup database");
const db = new Client({ connectionString: process.env.TEST_DATABASE_URL });
let branchId: string, orgId: string;
const evidence = "test-results/owner-setup/evidence";
const table = (rows: string) => `Name\tJoined Date\tMonthly Fee\tShift\tSeat\n${rows}`;
async function capture(page: Page, name: string) {
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `${evidence}/${name}.png`, fullPage: true });
}
async function upload(page: Page, text: string) {
    await page.goto(`/branch/${branchId}/onboarding/import`);
    await expect(page.locator("[data-shared-import-shell]")).toBeVisible();
    if ((page.viewportSize()?.width ?? 1440) < 500) await page.locator('input[type="file"]').setInputFiles({ name: "students.csv", mimeType: "text/csv", buffer: Buffer.from(text.replaceAll("\t", ",")) });
    else {
        await page.getByRole("button", { name: "Paste table", exact: true }).click();
        await page.getByRole("textbox", { name: "Paste rows with a header" }).fill(text);
    }
    await page.getByRole("button", { name: "Prepare my records", exact: true }).click();
    await expect(page).toHaveURL(/\/import\/[^/?]+/);
    await expect(page.getByRole("navigation", { name: "Import steps", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Timings", exact: true })).toBeEnabled({ timeout: 90_000 });
}
async function step(page: Page, name: string) {
    await page.getByRole("navigation", { name: "Import steps", exact: true }).getByRole("button", { name, exact: true }).click();
}
async function save(page: Page) {
    if (!await page.getByRole("heading", { name: "Students and their assignments" }).isVisible()) await step(page, "Review and import");
    await expect(page.getByRole("heading", { name: "Students and their assignments" })).toBeVisible();
    const approval = page.getByRole("checkbox", { name: "Create these reviewed additions with the import", exact: true });
    if (await approval.count()) { await approval.click(); await expect(approval).toBeChecked({ timeout: 15_000 }); }
    await expect(page.getByRole("button", { name: "Confirm and save", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Confirm and save", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Confirm import", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Your students are saved", exact: true })).toBeVisible({ timeout: 120_000 });
}

test.describe.serial("real authenticated owner setup and shared import", () => {
    test.beforeAll(async () => {
        mkdirSync(evidence, { recursive: true }); await db.connect();
        expect((await db.query("SELECT current_database() AS name")).rows[0].name).toBe(target.databaseName);
        // Explicitly isolated fixture reset: never infer safety from a test substring.
        const tables = (await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'")).rows;
        await db.query(`TRUNCATE ${tables.map(row => `"public"."${row.tablename.replaceAll('"', '""')}"`).join(",")} CASCADE`);
    });
    test.afterAll(async () => { await db.end(); });

    test("new owner names the branch once, edits normally and recovers the same committed setup", async ({ page }) => {
        await refreshDevelopmentSession(page); await page.goto("/onboarding");
        const name = page.getByLabel("Library / centre name", { exact: true });
        await expect(name).toHaveValue(""); await expect(name).toHaveAttribute("placeholder", "Saraswati Library");
        await name.pressSequentially("Temporary name"); await name.fill(""); await name.pressSequentially("Saraswati");
        await name.selectText(); await page.keyboard.insertText("Saraswati Library");
        // Exercise Chromium's actual address autofill command, then replace it.
        const cdp = await page.context().newCDPSession(page);
        await cdp.send("Autofill.enable");
        const { root } = await cdp.send("DOM.getDocument");
        const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: "#setup-business" });
        const { node } = await cdp.send("DOM.describeNode", { nodeId });
        await cdp.send("Autofill.trigger", { fieldId: node.backendNodeId, address: { fields: [{ name: "COMPANY_NAME", value: "Autofilled centre" }] } });
        await expect(name).toHaveValue("Autofilled centre"); await name.fill("Saraswati Library"); await cdp.detach();
        await page.getByLabel("Owner phone", { exact: true }).fill("9876543210");
        await page.getByText(/^Workspace name \(optional\):/).click();
        const suggestedWorkspace = await page.getByLabel("Workspace name", { exact: true }).getAttribute("placeholder");
        expect(suggestedWorkspace).toBeTruthy();
        await capture(page, "onboarding-name");
        await page.getByRole("button", { name: "Continue", exact: true }).click();
        await page.getByRole("button", { name: "Back", exact: true }).click(); await expect(name).toHaveValue("Saraswati Library");
        await page.getByRole("button", { name: "Continue", exact: true }).click();
        await page.getByLabel("How many physical seats are here?", { exact: true }).fill("12");
        await page.getByLabel("Time slot name", { exact: true }).fill("Morning");
        await page.getByLabel("Ends at", { exact: true }).fill("12:00");
        await page.getByLabel("Student monthly fee (₹)", { exact: true }).fill("700");
        await capture(page, "onboarding-seats-timings");
        await page.getByRole("button", { name: "Continue", exact: true }).click();
        await page.getByRole("button").filter({ has: page.getByText("Basic", { exact: true }) }).click();
        await page.getByRole("button", { name: "Continue", exact: true }).click();
        await page.getByRole("button", { name: /Import existing records/ }).click();
        await capture(page, "onboarding-review");
        const submissions: { body: string | null; key: string | undefined }[] = [];
        await page.route("**/api/onboarding", async route => {
            submissions.push({ body: route.request().postData(), key: route.request().headers()["idempotency-key"] });
            const response = await route.fetch(); expect(response.ok()).toBe(true);
            if (submissions.length === 1) await route.abort("failed"); else await route.fulfill({ response });
        });
        await page.getByRole("button", { name: "Create my workspace", exact: true }).click();
        await page.getByRole("button", { name: "Retry saved setup", exact: true }).click();
        await expect(page).toHaveURL(/\/branch\/[^/]+\/onboarding\/import$/);
        expect(submissions).toHaveLength(2); expect(submissions[1]).toEqual(submissions[0]);
        const persisted = (await db.query('SELECT b.id, b.name, o.id AS "orgId", o.name AS workspace FROM "Branch" b JOIN "Organization" o ON b."organizationId"=o.id')).rows;
        expect(persisted).toHaveLength(1); expect(persisted[0]).toMatchObject({ name: "Saraswati Library", workspace: suggestedWorkspace });
        branchId = persisted[0].id; orgId = persisted[0].orgId;
        for (const entity of ["OnboardingRequest", "OwnerTrialGrant"]) expect((await db.query(`SELECT count(*)::int AS count FROM "${entity}"`)).rows[0].count).toBe(1);
        expect((await db.query('SELECT count(*)::int AS count FROM "BillingProviderAction"')).rows[0].count).toBe(0);
        await expect(page.getByLabel("Switch branch", { exact: true })).toContainText("Saraswati Library");
        await capture(page, "onboarding-import-handoff");
    });

    for (const [index, plan] of ["BASIC", "STANDARD", "PRO"].entries()) {
        for (const width of [1440, 390]) test(`${plan} at ${width}px has complete shared setup, review and saved outcomes`, async ({ page }) => {
            await db.query('UPDATE "OwnerTrialGrant" SET "trialPlan"=$1::"SaasPlan" WHERE "organizationId"=$2', [plan, orgId]);
            await page.setViewportSize({ width, height: 950 }); await refreshDevelopmentSession(page);
            const label = `${plan} ${width}`, seat = String(index * 4 + (width === 1440 ? 1 : 3));
            await upload(page, table(`Synthetic ${label} due\t2026-01-01\t500\tMorning\t${seat}\nSynthetic ${label} future\t2026-01-28\t650\tMorning\t${Number(seat) + 1}`));
            const access = await page.request.get(`/api/branches/${branchId}/access`); expect((await access.json()).effectivePlan).toBe(plan);
            await expect(page.getByRole("article").first()).toContainText("Morning");
            await step(page, "Timings"); await expect(page.getByRole("heading", { name: "Your branch timings" })).toBeVisible();
            await expect(page.getByText("06:00–12:00 · ₹700", { exact: true })).toBeVisible();
            await capture(page, `${plan}-${width}-timings`);
            await step(page, "Seats and assignments");
            await expect(page.getByRole("heading", { name: "Seating is complete for the remaining students", exact: true })).toBeVisible();
            await expect(page.getByRole("button", { name: "Edit assignment", exact: true })).toHaveCount(0);
            await page.getByRole("button", { name: "Review or change student assignments", exact: true }).click();
            await expect(page.getByRole("button", { name: "Edit assignment", exact: true })).toHaveCount(2);
            await page.getByRole("button", { name: "Edit assignment", exact: true }).first().click();
            await expect(page.getByRole("dialog")).toBeVisible();
            await capture(page, `${plan}-${width}-assignment`);
            const violations = (await new AxeBuilder({ page }).include('[role="dialog"]').withTags(["wcag2a", "wcag2aa"]).analyze()).violations;
            expect(violations.map(v => ({ id: v.id, nodes: v.nodes.length }))).toEqual([]);
            await page.keyboard.press("Escape"); await expect(page.getByRole("dialog")).toHaveCount(0);
            await step(page, "Review and import"); await expect(page.getByRole("heading", { name: "Students and their assignments" })).toBeVisible(); await capture(page, `${plan}-${width}-review`);
            await save(page); await capture(page, `${plan}-${width}-result`);
            const students = (await db.query('SELECT id,name,"monthlyFee","joinedAt" AT TIME ZONE \'UTC\' AS "joinedAt","billingStartAt" AT TIME ZONE \'UTC\' AS "billingStartAt" FROM "Student" WHERE "branchId"=$1 AND name LIKE $2 ORDER BY name', [branchId, `Synthetic ${label}%`])).rows;
            expect(students).toHaveLength(2); expect(students.map(s => s.monthlyFee)).toEqual([500, 650]);
            const ids = students.map(s => s.id);
            expect((await db.query('SELECT count(*)::int AS count FROM "SeatAllocation" WHERE "studentId"=ANY($1)', [ids])).rows[0].count).toBe(2);
            expect((await db.query('SELECT count(*)::int AS count FROM "Payment" WHERE "studentId"=ANY($1)', [ids])).rows[0].count).toBe(1);
            const reviewed = (await db.query('SELECT item->\'payload\' AS payload FROM "ImportPlan", jsonb_array_elements(snapshot->\'items\') item WHERE item->>\'kind\'=\'STUDENT\' AND item->\'payload\'->\'student\'->>\'name\' LIKE $1', [`Synthetic ${label}%`])).rows;
            for (const student of students) {
                expect(student.joinedAt.getUTCMonth()).toBe(0);
                expect(student.billingStartAt.toISOString()).toBe(reviewed.find(r => r.payload.student.name === student.name)!.payload.billingStartAt);
            }
            await page.getByRole("link", { name: "View saved students", exact: true }).click();
            await expect(page.getByText(`Synthetic ${label} due`, { exact: true }).filter({ visible: true }).first()).toBeVisible();
            await capture(page, `${plan}-${width}-workspace`);
        });
    }
    test("prepares missing timings, combined access and seats; resolves a repeated meaning; explicitly defers a group", async ({ page }) => {
        await refreshDevelopmentSession(page); await page.setViewportSize({ width: 390, height: 950 });
        await upload(page, table("Synthetic new early\t2026-01-01\t500\tEvening\tB1\nSynthetic new combined\t2026-01-28\t600\tFD\tB2\nSynthetic new combined two\t2026-01-28\t650\tFD\tB3\nSynthetic later\t2026-01-28\t400\t\t\nSynthetic later two\t2026-01-28\t400\t\t"));
        await step(page, "Timings");
        await page.getByRole("button", { name: "Prepare a missing timing or combination", exact: true }).click();
        await page.getByLabel("Timing name", { exact: true }).fill("Evening");
        await page.getByLabel("Standard monthly fee (₹)", { exact: true }).fill("900");
        await page.getByLabel("Start time", { exact: true }).fill("12:00"); await page.getByLabel("End time", { exact: true }).fill("20:00");
        await page.getByRole("button", { name: "Keep in import draft", exact: true }).click();
        await expect(page.getByRole("button", { name: "Prepare a missing timing or combination", exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Prepare a missing timing or combination", exact: true }).click();
        await page.getByLabel("Type of access", { exact: true }).selectOption("combination");
        await page.getByLabel("Timing name", { exact: true }).fill("Full day");
        await page.getByLabel("Standard monthly fee (₹)", { exact: true }).fill("1500");
        await page.getByRole("checkbox", { name: /Morning ·/ }).check(); await page.getByRole("checkbox", { name: /Evening ·/ }).check();
        await page.getByRole("button", { name: "Keep in import draft", exact: true }).click();
        await expect(page.getByRole("button", { name: "Prepare a missing timing or combination", exact: true })).toBeVisible();
        const group = page.getByText("FD · Students: 2", { exact: true }).locator("..");
        await group.getByRole("combobox", { name: "Use for this group" }).selectOption({ label: "Full day" });
        await group.getByRole("button", { name: "Apply to matching students", exact: true }).click();
        await page.getByText("Review or correct matched values · 2", { exact: true }).click();
        await expect(page.getByText("Full day · Students: 2", { exact: true })).toBeVisible();
        await capture(page, "proposed-timings-and-group-answer");
        await step(page, "Seats and assignments");
        await page.getByRole("button", { name: "Prepare missing seats", exact: true }).click();
        await page.getByLabel("Seat labels, separated by commas", { exact: true }).fill("B1, B2, B3");
        await page.getByRole("button", { name: "Keep in import draft", exact: true }).click();
        await expect(page.getByRole("button", { name: "Prepare missing seats", exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Leave unresolved seating for later", exact: true }).click();
        await expect(page.getByRole("button", { name: "Leave unresolved seating for later", exact: true })).toHaveCount(0);
        await page.getByRole("button", { name: "Review or change student assignments", exact: true }).click();
        await expect(page.getByRole("article").filter({ hasText: "Synthetic later two" })).toContainText("Intentionally left for later");
        expect((await db.query('SELECT count(*)::int AS count FROM "Shift" WHERE "branchId"=$1', [branchId])).rows[0].count).toBe(1);
        expect((await db.query('SELECT count(*)::int AS count FROM "Seat" WHERE "branchId"=$1', [branchId])).rows[0].count).toBe(12);
        await step(page, "Review and import");
        await expect(page.getByRole("heading", { name: "Students and their assignments" })).toBeVisible();
        await expect(page.getByText("New physical seats: B1, B2, B3", { exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "Confirm and save", exact: true })).toBeDisabled();
        await page.getByRole("heading", { name: "Timings and seats to prepare", exact: true }).evaluate(element => element.scrollIntoView({ block: "start" }));
        await capture(page, "proposed-setup-final-review");
        await page.getByRole("heading", { name: "This month's fees", exact: true }).evaluate(element => element.scrollIntoView({ block: "start" }));
        await capture(page, "proposed-setup-fee-review"); await save(page);
        expect((await db.query('SELECT price FROM "Shift" WHERE "branchId"=$1 AND name=$2', [branchId, "Evening"])).rows[0].price).toBe(900);
        expect((await db.query('SELECT count(*)::int AS count FROM "MultiShiftComponent" c JOIN "MultiShift" s ON c."multiShiftId"=s.id WHERE s."branchId"=$1', [branchId])).rows[0].count).toBe(2);
        const persisted = (await db.query('SELECT s.name,s."monthlyFee",count(a.id)::int AS assignments FROM "Student" s LEFT JOIN "SeatAllocation" a ON a."studentId"=s.id WHERE s."branchId"=$1 AND (s.name LIKE $2 OR s.name LIKE $3) GROUP BY s.id ORDER BY s.name', [branchId, "Synthetic new%", "Synthetic later%"])).rows;
        expect(persisted.map(r => r.assignments)).toEqual([0, 0, 2, 2, 1]);
        expect(persisted.map(r => r.monthlyFee)).toEqual([400, 400, 600, 650, 500]);
        await capture(page, "proposed-setup-saved-result");
        await page.getByRole("link", { name: "View seats and timings", exact: true }).click();
        await expect(page.getByRole("main")).toContainText("Evening"); await capture(page, "resulting-seat-workspace");
    });
    test("mixed register progresses through visible decisions, lost-response recovery, configuration corrections and saved records", async ({ page }) => {
        test.setTimeout(300_000);
        await refreshDevelopmentSession(page); await page.setViewportSize({ width: 1440, height: 1000 });
        const header = "Name\tPhone\tJoined Date\tMonthly Fee\tShift\tSeat\tPayment Status\tPayment Method\tPaid Amount";
        await upload(page, ["November mixed register", header,
            "Synthetic mixed due\t\t01/01/2026\tRs. 500.00\tmorning\tB1\t\t\t",
            "Synthetic mixed selected\t\t2026-01-01\t600\t\t\t\t\t", header,
            "Synthetic mixed questions\t\t\t\t\t\t\t\t",
            "Synthetic mixed future\t\t28/01/26\t₹700\t\t\t\t\t",
            "Synthetic mixed source\t\t2026-01-01\t800\t\t\tPaid\tCash\t800",
            "Synthetic mixed combined / 9876543211\t\t2026-01-01\t900\t\t\tprobably paid\t\t",
        ].join("\n"));
        const sessionId = new URL(page.url()).pathname.split("/").at(-1)!;
        expect((await db.query('SELECT count(*)::int AS count FROM "ImportRow" WHERE "importSessionId"=$1', [sessionId])).rows[0].count).toBe(8);
        await page.getByRole("button", { name: "Review title and header rows", exact: true }).click();
        await expect(page.getByRole("article")).toHaveCount(2);
        await page.getByRole("button", { name: "These are not students — leave them out", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Check title and repeated header rows" })).toHaveCount(0);
        await step(page, "Seats and assignments");
        // One supported match remains; five missing assignments require explicit deferral.
        await page.getByRole("button", { name: "Leave unresolved seating for later", exact: true }).click();
        await expect(page.getByRole("button", { name: "Leave unresolved seating for later", exact: true })).toHaveCount(0);
        await page.getByRole("button", { name: "Rename existing seats", exact: true }).click();
        await page.getByLabel("Rename seat B1 to", { exact: true }).fill("C1");
        await page.getByRole("button", { name: "Preview affected records", exact: true }).click();
        await expect(page.getByText(/allocation history records and/)).toContainText("1 rows");
        await page.getByRole("button", { name: "Confirm correction to existing setup", exact: true }).click();
        await expect(page.getByRole("button", { name: "Rename existing seats", exact: true })).toBeVisible();
        await step(page, "Records");
        const questionCard = page.getByRole("article").filter({ has: page.getByRole("button", { name: "Synthetic mixed questions", exact: true }) });
        await questionCard.getByRole("button", { name: "Confirm joining date", exact: true }).click();
        await page.getByRole("dialog").getByLabel("Joined date", { exact: true }).fill("2026-01-01");
        await page.getByRole("dialog").getByRole("button", { name: "Save draft", exact: true }).click();
        await expect(page.getByRole("dialog")).toContainText("saved to draft, not imported");
        await expect(page.getByRole("dialog")).toContainText("This student still needs your help");
        await expect(page.getByRole("dialog")).toContainText("Confirm the student's monthly fee");
        await expect(page.getByRole("dialog")).toContainText("Phone is missing. The student can still be imported");
        await expect(page.getByRole("dialog")).not.toContainText("Something went wrong");
        await capture(page, "mixed-partial-correction");
        await page.getByRole("dialog").getByLabel("Monthly fee", { exact: true }).fill("450");
        await page.getByRole("dialog").getByRole("button", { name: "Save draft", exact: true }).click();
        await expect(page.getByRole("dialog")).toContainText("Ready for final review.");
        await expect(page.getByRole("dialog")).toContainText("Synthetic mixed questions");
        await page.getByRole("dialog").getByRole("button", { name: "Review next student", exact: true }).click();
        await expect(page.getByRole("dialog")).toContainText("Synthetic mixed combined");
        await page.getByRole("dialog").getByLabel("Student name", { exact: true }).fill("Synthetic mixed combined");
        await page.getByRole("dialog").getByLabel("Phone", { exact: true }).fill("9876543211");
        await page.getByRole("dialog").getByRole("button", { name: "Save draft", exact: true }).click();
        await expect(page.getByRole("dialog")).toContainText("This student still needs your help");
        // The uncertain source payment is a deliberate per-student confirmation.
        const status = page.getByRole("dialog").getByRole("combobox", { name: "Payment status", exact: true });
        await status.click(); await page.getByRole("option", { name: "Due", exact: true }).click();
        await page.getByRole("dialog").getByRole("button", { name: "Save draft", exact: true }).click();
        await expect(page.getByRole("dialog")).toContainText("Ready for final review.");
        await page.getByRole("dialog").getByRole("button", { name: "Review next student", exact: true }).click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(page.getByText("No students need help now. Review the saved draft before importing.", { exact: true })).toBeVisible();
        await expect(page.getByRole("tab", { name: "Needs your help · 0", exact: true })).toBeVisible();
        await expect(page.getByRole("article")).toHaveCount(0);
        await page.getByRole("tab", { name: /^All students/ }).click();
        await page.getByRole("button", { name: /^Keep eligible fees Due/ }).click();
        await expect(page.getByText(/On final import: 3 eligible fees/)).toContainText("1,550");
        let lost = false;
        await page.route("**/import-sessions/*/payments", async route => {
            if (!lost && route.request().method() === "POST") { lost = true; await route.fetch(); await route.abort("failed"); }
            else await route.continue();
        });
        await page.getByRole("button", { name: "Save payment choices to draft", exact: true }).click();
        await expect(page.getByRole("alert").first()).toBeVisible();
        // Read persisted choices after a lost response; do not replay the POST.
        await expect(page.getByText("Saved Due choices: 3. Confirmed Paid choices: 0.", { exact: true })).toBeVisible();
        await page.reload();
        await expect(page.getByText("Saved Due choices: 3. Confirmed Paid choices: 0.", { exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Review payments and select Paid", exact: true }).click();
        await expect(page.getByRole("list", { name: "Current-month payment choices" })).not.toContainText("November mixed register");
        await page.getByRole("checkbox", { name: "Confirm Paid for Synthetic mixed selected", exact: true }).check();
        await page.getByRole("list", { name: "Current-month payment choices" }).getByRole("combobox", { name: "Method", exact: true }).selectOption("UPI");
        await expect(page.getByText(/On final import: 1 selected payments/)).toContainText("600");
        await page.getByRole("button", { name: "Save payment choices to draft", exact: true }).click();
        await expect(page.getByText("Saved Due choices: 2. Confirmed Paid choices: 1.", { exact: true })).toBeVisible();
        await page.getByRole("heading", { name: "Choose how this month's fees start", exact: true }).scrollIntoViewIfNeeded();
        await capture(page, "mixed-payment-choices");
        await step(page, "Review and import");
        await expect(page.getByRole("heading", { name: "Students and their assignments" })).toBeVisible();
        await expect(page.getByText("Morning · Seat C1", { exact: true })).toBeVisible();
        await expect(page.getByText("Source rows deliberately left out: 2. They will not be imported.", { exact: true })).toBeVisible();
        await capture(page, "mixed-final-review");
        let commitRequests = 0;
        await page.route("**/import-sessions/*/commit", async route => {
            if (route.request().method() === "POST") { commitRequests++; await route.fetch(); await route.abort("failed"); }
            else await route.continue();
        });
        await page.getByRole("button", { name: "Confirm and save", exact: true }).click();
        await page.getByRole("alertdialog").getByRole("button", { name: "Confirm import", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Your import results", exact: true })).toBeVisible();
        await expect.poll(async () => (await db.query('SELECT count(*)::int AS count FROM "Student" WHERE "branchId"=$1 AND name LIKE $2', [branchId, "Synthetic mixed%"])).rows[0].count, { timeout: 120_000 }).toBe(6);
        await expect.poll(async () => (await db.query('SELECT status FROM "ImportRun" WHERE "importSessionId"=$1 AND kind=\'COMMIT\' ORDER BY "createdAt" DESC LIMIT 1', [sessionId])).rows[0]?.status, { timeout: 120_000 }).toBe("COMPLETED_WITH_ISSUES");
        const fees = (await db.query('SELECT p.status,p.amount,s.name FROM "Payment" p JOIN "Student" s ON p."studentId"=s.id WHERE s."branchId"=$1 AND s.name LIKE $2 ORDER BY s.name', [branchId, "Synthetic mixed%"])).rows;
        expect(fees).toHaveLength(5);
        expect(fees.filter(p => p.status === "DUE").reduce((sum, p) => sum + p.amount, 0)).toBe(1850);
        expect(fees.filter(p => p.status === "PAID").reduce((sum, p) => sum + p.amount, 0)).toBe(1400);
        expect((await db.query('SELECT count(*)::int AS count FROM "SeatAllocation" a JOIN "Student" s ON a."studentId"=s.id WHERE s."branchId"=$1 AND s.name LIKE $2', [branchId, "Synthetic mixed%"])).rows[0].count).toBe(1);
        expect(commitRequests).toBe(1);
        await page.reload(); await expect(page.getByRole("heading", { name: "Your import results", exact: true })).toBeVisible();
        await expect(page.getByRole("heading", { name: "Your students are saved", exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "Finish the remaining work", exact: true })).toHaveCount(0);
        await capture(page, "mixed-saved-records");
    });
    test("missing seating stays a decision, supports keyboard/localized review and recovers a failed draft request", async ({ page }) => {
        await refreshDevelopmentSession(page); await page.setViewportSize({ width: 390, height: 950 });
        await upload(page, "Name\tJoined Date\tMonthly Fee\nSynthetic no seating A\t2026-01-28\t500\nSynthetic no seating B\t2026-01-28\t600");
        await page.getByRole("button", { name: "Records", exact: true }).focus(); await page.keyboard.press("Tab"); await page.keyboard.press("Enter");
        await expect(page.getByRole("heading", { name: "Your branch timings", exact: true })).toBeVisible();
        await expect(page.getByText("Not supplied in the file · Students: 2", { exact: true })).toBeVisible();
        for (const language of ["hi", "hinglish"] as const) {
            const t = (key: string) => translateOwnedText(language, key);
            await page.getByLabel(/Interface language|स्क्रीन की भाषा|Screen ki language/).selectOption(language);
            await expect(page.getByRole("button", { name: t("Seats and assignments"), exact: true })).toBeVisible();
            await page.getByRole("button", { name: t("Seats and assignments"), exact: true }).click();
            await expect(page.getByText(t("Needs a decision"), { exact: true }).first()).toBeVisible();
            await capture(page, `missing-seating-${language}-390`);
        }
        await page.getByLabel(/Interface language|स्क्रीन की भाषा|Screen ki language/).selectOption("en");
        let failed = false;
        await page.route("**/setup", async route => { if (!failed && route.request().method() === "POST") { failed = true; await route.abort("failed"); } else await route.continue(); });
        await page.getByRole("button", { name: "Leave unresolved seating for later", exact: true }).click();
        await expect(page.getByRole("alert").first()).toBeVisible();
        await page.getByRole("button", { name: "Leave unresolved seating for later", exact: true }).click();
        await expect(page.getByRole("button", { name: "Leave unresolved seating for later", exact: true })).toHaveCount(0);
        await save(page);
        const remaining = (await db.query('SELECT count(a.id)::int AS allocations FROM "Student" s LEFT JOIN "SeatAllocation" a ON a."studentId"=s.id WHERE s."branchId"=$1 AND s.name LIKE $2', [branchId, "Synthetic no seating%"])).rows[0];
        expect(remaining.allocations).toBe(0);
        await capture(page, "missing-seating-recovery-result");
    });
});
