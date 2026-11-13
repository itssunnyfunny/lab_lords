import { expect, test } from "@playwright/test";
import { installCompletionImport } from "./completion-import-fixture.mjs";

test.beforeEach(async ({context}) => {
    await context.route("**/*",route=>new URL(route.request().url()).hostname==="127.0.0.1"?route.continue():route.abort());
});
test("guided correction keeps identity, source facts and failed drafts through retry",async({page},info)=>{
    const state=await installCompletionImport(page);
    await page.goto("/branch/pilot/onboarding/import/session-guided?mode=after&lang=en");
    const record=page.getByRole("article").filter({hasText:"Anaya Rao"});
    await expect(record).toBeVisible();
    expect((await record.boundingBox())!.y).toBeLessThan(info.project.name==="desktop-1440"?600:950);
    await record.getByRole("button",{name:"Confirm joining date",exact:true}).click();
    const editor=info.project.name==="desktop-1440"?page.locator(".ui-import-editor"):page.getByRole("dialog");
    await expect(editor.getByRole("heading",{name:"Anaya Rao",exact:true})).toBeVisible();
    if(info.project.name==="desktop-1440"){
        expect((await editor.boundingBox())!.x).toBeGreaterThan((await record.boundingBox())!.x);
        await expect(page.getByRole("dialog")).toHaveCount(0);
    }
    const joined=editor.getByLabel("Joined date",{exact:true});
    await expect(joined).toBeFocused();
    await joined.fill("2026-08-12");
    state.failSave=true;
    await editor.getByRole("button",{name:"Save draft",exact:true}).click();
    await expect(editor.getByRole("alert")).toBeVisible();
    await expect(joined).toHaveValue("2026-08-12");
    expect(state.revision).toBe(1);
    await page.screenshot({path:info.outputPath("guided-failed-draft.png"),animations:"disabled"});
    state.failSave=false;
    await editor.getByRole("button",{name:"Save draft",exact:true}).click();
    await expect(editor.getByText("Anaya Rao: saved to draft, not imported.",{exact:true})).toBeVisible();
    expect(state.rows[1].rawData.Joined).toBe("12/08/2026");
    expect(state.rows[1].normalizedData.student.monthlyFee).toBe(1400);
    expect(state.requests.filter((r:{path:string})=>r.path==="/commit")).toHaveLength(0);
    await page.screenshot({path:info.outputPath("guided-saved-draft.png"),animations:"disabled"});
    await editor.getByRole("button",{name:"Back to student list",exact:true}).last().click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test("guided final review recovers an accepted commit after its response is lost",async({page},info)=>{
    const state=await installCompletionImport(page);
    state.loseCommitResponse=true;
    await page.goto("/branch/pilot/onboarding/import/session-guided?mode=after&lang=en");
    if(info.project.name.startsWith("mobile")){await page.getByRole("combobox",{name:"Import step",exact:true}).click();await page.getByRole("option",{name:"Review and import",exact:true}).click();} else await page.getByRole("button",{name:/^Review and save/}).click();
    await expect(page.getByRole("heading",{name:"Check what will be saved",exact:true})).toBeVisible();
    await page.getByRole("button",{name:"Confirm and save",exact:true}).click();
    await expect(page.getByRole("alertdialog",{name:"Save the reviewed students?",exact:true})).toBeVisible();
    await page.getByRole("button",{name:"Confirm import",exact:true}).click();
    await expect(page.getByRole("heading",{name:"Your import results",exact:true})).toBeVisible();
    expect(state.requests.filter((r:{path:string})=>r.path==="/commit")).toHaveLength(1);
    expect(state.rows[0].createdEntityIds).toMatchObject({studentId:"saved-mira"});
    await page.screenshot({path:info.outputPath("guided-recovered-result.png"),animations:"disabled"});
    await page.getByRole("button",{name:"Finish the remaining work",exact:true}).click();
    await expect(page.getByRole("article").filter({hasText:"Anaya Rao"})).toBeVisible();
    await expect(page.getByRole("article").filter({hasText:"Mira Sharma"})).toHaveCount(0);
    if (page.viewportSize()!.width >= 1280) {
        await page.getByRole("article").filter({ hasText: "Anaya Rao" }).getByRole("button", { name: "Confirm joining date", exact: true }).click();
        await expect(page.locator(".ui-import-editor")).toBeVisible();
        await page.getByRole("button", { name: "View saved progress", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Your import results", exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Finish the remaining work", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Check your students", exact: true })).toBeVisible();
        await expect(page.locator(".ui-import-editor")).toHaveCount(0);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test("seat correction preserves the source record and monthly fee",async({page},info)=>{
    const state=await installCompletionImport(page);
    await page.goto("/branch/pilot/onboarding/import/session-guided?mode=after&lang=en");
    await page.getByRole("article").filter({hasText:"Kabir Verma"}).getByRole("button",{name:"Choose a seat",exact:true}).click();
    const editor=info.project.name==="desktop-1440"?page.locator(".ui-import-editor"):page.getByRole("dialog");
    await editor.getByRole("button",{name:/^Morning, /}).click();
    await editor.getByRole("button",{name:/^A3, /}).click();
    await expect(editor.getByRole("button",{name:/^A3, /})).toHaveAttribute("aria-pressed","true");
    await page.screenshot({path:info.outputPath("guided-selected-seat.png"),animations:"disabled"});
    await editor.getByRole("button",{name:"Save draft",exact:true}).click();
    await expect(editor.getByText("Kabir Verma: saved to draft, not imported.",{exact:true})).toBeVisible();
    expect(state.rows[2].normalizedData.allocation).toEqual({shiftName:"Morning",seatLabel:"A3"});
    expect(state.rows[2].normalizedData.student.monthlyFee).toBe(1400);
    expect(state.rows[2].rawData.Timing).toBe("FD");
    expect(state.requests.filter((r:{path:string})=>r.path==="/setup")).toHaveLength(1);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

for (const experience of ["GUIDED_CURRENT_MONTH_V1", "GUIDED_SETUP_V2"]) {
    test(`guided version ${experience} can reach and confirm final review`, async ({ page }) => {
        const state = await installCompletionImport(page);
        state.experience = experience;
        await page.goto("/branch/pilot/onboarding/import/session-guided?mode=after&lang=en");
        const headerReview = page.getByRole("button", { name: /^Review and save/ });
        const stepSelector = page.getByRole("combobox", { name: "Import step", exact: true });
        if (experience === "GUIDED_SETUP_V2" && page.viewportSize()!.width < 768) {
            await expect(headerReview).toBeHidden();
            await stepSelector.click();
            await page.getByRole("option", { name: "Review and import", exact: true }).click();
        } else {
            if (experience === "GUIDED_CURRENT_MONTH_V1") await expect(stepSelector).toHaveCount(0);
            await expect(headerReview).toBeVisible();
            await expect(headerReview).toBeEnabled();
            await headerReview.click();
        }
        await expect(page.getByRole("heading", { name: "Check what will be saved", exact: true })).toBeVisible();
        expect(state.requests.filter((request: { path: string }) => request.path === "/plans")).toMatchObject([
            { body: { targetRevision: 1, readinessPolicy: "READY_ROWS_ONLY" } },
        ]);
        await page.getByRole("button", { name: "Confirm and save", exact: true }).click();
        const confirmation = page.getByRole("alertdialog", { name: "Save the reviewed students?", exact: true });
        await expect(confirmation).toBeVisible();
        expect(state.requests.filter((request: { path: string }) => request.path === "/commit")).toHaveLength(0);
        await confirmation.getByRole("button", { name: "Confirm import", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Your import results", exact: true })).toBeVisible();
        expect(state.requests.filter((request: { path: string }) => request.path === "/commit")).toMatchObject([
            { body: { planId: "plan-completion-1" } },
        ]);
    });
}

for (const saved of [false, true]) {
    test(`inline editor ${saved ? "saved" : "unchanged"} exposes a failed final review and permits retry`, async ({ page }, info) => {
        test.skip(page.viewportSize()!.width < 1280, "The inline editor starts at 1280px.");
        if (!saved) await page.setViewportSize({ width: 1280, height: 1024 });
        const state = await installCompletionImport(page);
        await page.goto("/branch/pilot/onboarding/import/session-guided?mode=after&lang=en");
        await page.getByRole("article").filter({ hasText: "Anaya Rao" }).getByRole("button", { name: "Confirm joining date", exact: true }).click();
        const editor = page.locator(".ui-import-editor");
        await expect(editor).toBeVisible();
        if (saved) {
            await editor.getByLabel("Joined date", { exact: true }).fill("2026-08-12");
            await editor.getByRole("button", { name: "Save draft", exact: true }).click();
            await expect(editor.getByText("Anaya Rao: saved to draft, not imported.", { exact: true })).toBeVisible();
            state.revision++;
        } else state.failPlan = true;
        await page.getByRole("button", { name: "Review and import", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Review your import", exact: true })).toBeVisible();
        await expect(editor).toHaveCount(0);
        const alert = page.getByRole("alert");
        await expect(alert).toBeVisible();
        await expect(alert).toHaveText(saved
            ? "This import changed in another tab or by a newer action. Refresh the session, review the latest version, and retry your edit."
            : "Something went wrong. Try again.");
        await page.screenshot({ path: info.outputPath(`review-error-${saved ? "revision" : "request"}.png`), animations: "disabled" });
        state.failPlan = false;
        await page.getByRole("button", { name: "Refresh review", exact: true }).click();
        await expect(page.getByRole("button", { name: "Confirm and save", exact: true })).toBeEnabled();
        await expect(page.getByRole("alert")).toHaveCount(0);
        expect(state.requests.filter((request: { path: string }) => request.path === "/plans")).toHaveLength(2);
        expect(state.requests.filter((request: { path: string }) => request.path === "/commit")).toHaveLength(0);
        await page.getByRole("button", { name: "Back to students", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Check your students", exact: true })).toBeVisible();
        await expect(editor).toHaveCount(0);
    });
}

test("inline editor guards unsaved edits and closes after a permitted section change", async ({ page }) => {
    test.skip(page.viewportSize()!.width < 1280, "The inline editor starts at 1280px.");
    const state = await installCompletionImport(page);
    await page.goto("/branch/pilot/onboarding/import/session-guided?mode=after&lang=en");
    await page.getByRole("article").filter({ hasText: "Anaya Rao" }).getByRole("button", { name: "Confirm joining date", exact: true }).click();
    const editor = page.locator(".ui-import-editor");
    const joined = editor.getByLabel("Joined date", { exact: true });
    await joined.fill("2026-08-12");
    const steps = page.getByRole("navigation", { name: "Import steps", exact: true });
    for (const name of ["Timings", "Review and import"]) {
        await steps.getByRole("button", { name, exact: true }).click();
        await expect(editor.getByRole("alert")).toContainText("Save or reset your edits before continuing.");
        await expect(joined).toHaveValue("2026-08-12");
        await expect(steps.getByRole("button", { name: "Records", exact: true })).toHaveAttribute("aria-current", "step");
    }
    expect(state.requests.filter((request: { path: string }) => request.path === "/plans")).toHaveLength(0);
    await editor.getByRole("button", { name: "Save draft", exact: true }).click();
    await expect(editor.getByText("Anaya Rao: saved to draft, not imported.", { exact: true })).toBeVisible();
    await steps.getByRole("button", { name: "Timings", exact: true }).click();
    await expect(steps.getByRole("button", { name: "Timings", exact: true })).toHaveAttribute("aria-current", "step");
    await steps.getByRole("button", { name: "Records", exact: true }).click();
    await expect(editor).toHaveCount(0);
});
