import { expect,test } from "@playwright/test";
import { installSettingsRouteFixture } from "../application-design-pilot/settings-route-closeout-fixture";

test.beforeEach(async({context})=>{
    await context.route("**/*",route=>new URL(route.request().url()).hostname==="127.0.0.1"?route.continue():route.abort());
});
test("fee states share one home and amounts remain explicit and formatted",async({page},info)=>{
    await page.route("**/api/branches/pilot/payments?*",async route=>{
        const response=await route.fetch(),data=await response.json();
        data.items=data.items.map((row:Record<string,unknown>,index:number)=>index?row:{...row,status:"DUE",dueDate:"2020-01-01T00:00:00.000Z",periodStart:"2020-01-01T00:00:00.000Z",periodEnd:"2020-01-31T00:00:00.000Z",amount:10000,collectedAmount:2500,waivedAmount:1000,ledgerBacked:true});
        await route.fulfill({json:data});
    });
    await page.goto("/branch/pilot/payments?mode=after&lang=en");
    const record=page.locator("tr:visible,[data-payment-record-card]:visible").filter({hasText:"Aarav Mehta"}).first();
    await expect(record).toBeVisible();
    const status=record.locator(".ui-fee-state");
    await expect(status).toContainText("Due");await expect(status).toContainText("Partially paid");await expect(status).toContainText("OVERDUE");
    await expect(record.getByText("Remaining due",{exact:true}).first()).toBeVisible();
    await expect(record.getByText(/₹\s?6,500/).first()).toBeVisible();
    await record.getByText("Fee breakdown",{exact:true}).click();
    await expect(record.locator(".ui-fee-breakdown")).toContainText("10,000");
    await expect(record.locator(".ui-fee-breakdown")).toContainText("2,500");
    await expect(record.locator(".ui-fee-breakdown")).toContainText("1,000");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath("fee-states-breakdown.png"),animations:"disabled"});
});

test("report preview formats rupees and keeps CSV values unchanged",async({page},info)=>{
    let csvQuery="";
    await page.route("**/api/branches/pilot/reports?*",route=>{
        const url=new URL(route.request().url());
        if(url.searchParams.get("format")==="csv"){csvQuery=url.search;return route.fulfill({contentType:"text/csv",body:'"Student name","Original fee"\r\n"Mira Sharma",12500\r\n'});}
        return route.fulfill({json:{columns:["Student name","Fee type","Period start","Period end","Fee date","Original fee","Collected amount","Waived amount","Remaining balance","Status"],rows:[["Mira Sharma","Monthly","2026-09-01","2026-09-30","2026-09-01",12500,2500,1000,9000,"Due"]],count:1,asOf:"2026-09-28T06:00:00.000Z"}});
    });
    await page.goto("/branch/pilot/reports?mode=after&lang=en");
    const from=page.getByLabel("From date",{exact:true}),through=page.getByLabel("Through date",{exact:true});
    await from.fill("2026-09-01");await through.fill("2026-09-30");
    await expect(from).toHaveValue("2026-09-01");await expect(through).toHaveValue("2026-09-30");
    const dateBoxes=await Promise.all([from.boundingBox(),through.boundingBox()]);
    if(info.project.name==="mobile-320"){
        // Full dates and native calendar controls need their own usable row.
        expect(dateBoxes.every(box=>box!==null&&box.width>=240)).toBe(true);
        expect(dateBoxes[1]!.y).toBeGreaterThanOrEqual(dateBoxes[0]!.y+dateBoxes[0]!.height+8);
    }
    if(info.project.name.startsWith("mobile"))for(const input of [from,through])await expect(input).toHaveCSS("font-size","16px");
    await expect(page.getByRole("columnheader",{name:"Original fee (₹)",exact:true})).toHaveCSS("text-align","right");
    await expect(page.getByRole("cell",{name:/₹\s?12,500/})).toBeVisible();
    await expect(page.getByText("Preview: first 1 rows",{exact:false})).toBeVisible();
    const download=page.waitForEvent("download");await page.getByRole("button",{name:"Download CSV",exact:true}).click();await download;
    expect(csvQuery).toContain("kind=fees");expect(csvQuery).toContain("format=csv");
    expect(new URLSearchParams(csvQuery).get("from")).toBe("2026-09-01");
    expect(new URLSearchParams(csvQuery).get("through")).toBe("2026-09-30");
    await page.screenshot({path:info.outputPath("formatted-report-preview.png"),animations:"disabled"});
});

test("billing purpose leads and every section is reachable at each width",async({page},info)=>{
    await installSettingsRouteFixture(page);
    await page.goto("/account/billing?organizationId=org-pilot&branchId=pilot&mode=after&lang=en");
    await expect(page.getByRole("heading",{name:"Billing and plans",exact:true})).toBeVisible();
    const title=await page.getByRole("heading",{name:"Billing and plans",exact:true}).boundingBox();
    const context=await page.getByRole("region",{name:"Subscription workspace",exact:true}).boundingBox();
    expect(title!.y).toBeLessThan(context!.y);
    if(info.project.name.startsWith("mobile")){
        await page.getByRole("combobox",{name:"Go to section",exact:true}).click();
        const options=page.getByRole("option");await expect(options.first()).toBeVisible();expect(await options.count()).toBeGreaterThanOrEqual(4);
        await options.filter({hasText:"Invoices"}).click();
        await expect(page.locator("#invoices")).toBeInViewport();
    }else{
        await page.getByRole("navigation",{name:"Settings",exact:true}).getByRole("button",{name:"Invoices",exact:true}).click();
        await expect(page.locator("#invoices")).toBeInViewport();
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath("billing-sections.png"),animations:"disabled"});
});
