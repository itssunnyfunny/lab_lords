import { expect,test,type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { installSettingsRouteFixture } from "../application-design-pilot/settings-route-closeout-fixture";
import type { WorkspaceDirectory } from "@/types";
async function open(page:Page,route:string,lang="en") {
    await page.goto(`${route}${route.includes("?")?"&":"?"}mode=after&lang=${lang}`);
    await page.getByTestId("synthetic-pilot-label").evaluate(node => node.remove());
    await page.locator("h1").first().waitFor();
    await page.evaluate(()=>document.fonts.ready);
}
test.beforeEach(async({context})=>{
    await context.route("**/*",route=>new URL(route.request().url()).hostname==="127.0.0.1"?route.continue():route.abort());
});
test("Basic keeps long workspace context inside the header and prioritizes student identity",async({page},info)=>{
    await installSettingsRouteFixture(page);
    await page.route("**/api/branches/pilot/shifts",async route=>{const response=await route.fetch();await route.fulfill({json:(await response.json()).map((row:Record<string,unknown>)=>({...row,status:"ACTIVE"}))});});
    await page.route("**/api/branches/pilot/basic-overview",route=>route.fulfill({json:{branchId:"pilot",today:"2026-09-22",activeStudents:3,money:{collectedThisMonth:1900,pendingDues:2400}}}));
    await page.route("**/api/workspaces",async route=>{
        const response=await route.fetch(),directory=await response.json() as WorkspaceDirectory;
        for(const organization of directory.organizations){organization.name="Shanti Learning and Competitive Examination Study Centres";for(const branch of organization.branches)branch.name="Shanti Central Library — Civil Services and Evening Study Wing";}
        await route.fulfill({json:directory});
    });
    for(const lang of ["en","hi","hinglish"]){
        await open(page,"/branch/pilot/students?plan=BASIC&legacy=1",lang);
        const header=page.locator(".bp-topbar"),select=header.locator("select");
        await expect(select).toHaveValue("pilot");
        const rect=await header.boundingBox(),branch=await select.boundingBox(),heading=await page.locator("h1").boundingBox();
        expect(branch!.y+branch!.height).toBeLessThanOrEqual(rect!.y+rect!.height);
        expect(heading!.y).toBeGreaterThanOrEqual(rect!.y+rect!.height+18);
        const row=page.locator(".bp-student-row").filter({hasText:"Nisha Verma"});
        await expect(row).toBeVisible();
        const identity=await row.locator(".bp-person strong").boundingBox(),phone=await row.locator(".bp-phone").boundingBox(),dues=await row.locator(".bp-fee-status").boundingBox();
        expect(phone!.height).toBeLessThan(25);
        if(info.project.name!=="desktop-1440"){expect((await row.locator(".bp-person").boundingBox())!.width - (await row.locator(".bp-avatar").boundingBox())!.width - 16).toBeGreaterThan(130);expect(identity!.height).toBeLessThan(25);expect(dues!.y).toBeGreaterThan(identity!.y+identity!.height);}
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
        await page.screenshot({path:info.outputPath(`basic-context-${lang}.png`),animations:"disabled"});
        await row.click();
        await expect(page.locator("h1")).toHaveText("Nisha Verma");
        const actions=page.locator(".bp-student-heading-actions button");
        for(const action of await actions.all())expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    }
});
test("seat tiles have one availability state with consistent selection and assignment",async({page},info)=>{
    await open(page,"/branch/pilot/seats");
    const tile=page.getByRole("article",{name:"Seat A2",exact:true});
    await expect(tile.getByText("Available",{exact:true})).toHaveCount(1);
    await expect(tile.getByText("Ready to assign",{exact:true})).toHaveCount(0);
    expect((await tile.boundingBox())!.height).toBeLessThan(220);
    const inspect=tile.getByRole("button",{name:"View seat A2",exact:true});
    await inspect.click();
    await expect(inspect).toHaveAttribute("aria-pressed","true");
    if(info.project.name==="desktop-1440"){
        await expect(page.locator(".ui-seat-detail")).toBeVisible();
        await page.locator(".ui-seat-detail").getByRole("button",{name:"Close seat details",exact:true}).click();
    }else{
        await expect(page.getByRole("dialog",{name:"Seat A2",exact:true})).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(inspect).toBeFocused();
    }
    await tile.getByRole("button",{name:"Assign",exact:true}).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.screenshot({path:info.outputPath("seat-assignment.png"),animations:"disabled"});
    await page.keyboard.press("Escape");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const audit=await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze();
    expect(audit.violations.filter(item=>["critical","serious"].includes(item.impact!))).toEqual([]);
});
