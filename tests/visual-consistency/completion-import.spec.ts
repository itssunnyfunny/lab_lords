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
