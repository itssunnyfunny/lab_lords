import {expect,test} from "@playwright/test";
import {installCompletionImport} from "./completion-import-fixture.mjs";
test("legacy records stay compact and preserve selected drafts, navigation confirmation and retry",async({page,context},info)=>{
    await context.route("**/*",route=>new URL(route.request().url()).hostname==="127.0.0.1"?route.continue():route.abort());
    const state=await installCompletionImport(page,"legacy");
    await page.goto("/branch/pilot/onboarding/import/session-legacy?mode=after&lang=en");
    async function step(name:RegExp){if(info.project.name.startsWith("mobile")){await page.getByRole("combobox",{name:"Import step",exact:true}).click();await page.getByRole("option",{name}).click();}else await page.getByRole("navigation",{name:"Fix import issues",exact:true}).getByRole("button",{name}).click();}
    await step(/^Rows/);
    const row=page.getByRole("button",{name:/^Row 2: Anaya Rao/});
    await expect(row).toBeVisible();
    expect((await row.boundingBox())!.y).toBeLessThan(info.project.use.viewport!.height-60);
    if(info.project.name!=="desktop-1440")await expect(page.getByRole("button",{name:"All imports",exact:true})).toBeHidden();
    await page.screenshot({path:info.outputPath("legacy-compact-records.png"),animations:"disabled"});
    await row.click();
    const editor=page.getByRole("region",{name:"Row 2: Anaya Rao",exact:true});
    if(info.project.name!=="desktop-1440") {await expect(editor).toBeFocused();expect((await editor.boundingBox())!.y).toBeLessThan(160);}
    await editor.getByLabel("Student name",{exact:true}).fill("Anaya Rao reviewed");
    await step(/^Payments/);
    const confirmation=page.getByRole("alertdialog",{name:"Discard unsaved import changes?",exact:true});
    await expect(confirmation).toBeVisible();await confirmation.getByRole("button",{name:"Keep editing",exact:true}).click();
    await expect(editor.getByLabel("Student name",{exact:true})).toHaveValue("Anaya Rao reviewed");
    state.failSave=true;await editor.getByRole("button",{name:"Save",exact:true}).click();
    await expect(page.getByRole("alert").filter({hasText:/failure|could not|try again/i})).toBeVisible();
    await expect(editor.getByLabel("Student name",{exact:true})).toHaveValue("Anaya Rao reviewed");
    expect(state.revision).toBe(1);state.failSave=false;
    await editor.getByRole("button",{name:"Save",exact:true}).click();
    await expect.poll(()=>state.revision).toBe(2);
    expect(state.rows[1].rawData.Name).toBe("Anaya Rao");expect(state.rows[1].normalizedData.student.monthlyFee).toBe(1400);
    expect(state.requests.filter((r:{path:string})=>r.path==="/commit")).toHaveLength(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath("legacy-saved-correction.png"),animations:"disabled"});
});
