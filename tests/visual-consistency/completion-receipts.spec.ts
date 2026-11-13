import {expect,test} from "@playwright/test";
import {installSettingsRouteFixture} from "../application-design-pilot/settings-route-closeout-fixture";
const receipt={id:"completion-receipt",receiptNumber:"LL-REVIEW-001",amount:12500,collectedAt:"2026-09-30T18:30:00.000Z",method:"CASH",reference:null,voidedAt:null,voidReason:null,
    snapshot:{version:1,branchName:"Shanti Study Library",organizationName:"Shanti Learning Spaces",address:"Synthetic review address",contactPhone:null,studentName:"Aarav Mehta",studentId:"student-aarav",recordedBy:"Review owner",recordedById:"synthetic-owner",collectedAt:"2026-09-30T18:30:00.000Z",amount:12500,method:"CASH",reference:"",note:"",remainingBalance:27500,allocations:[{paymentId:"fee-review",type:"MONTHLY",periodStart:"2026-09-30T18:30:00.000Z",periodEnd:"2026-10-31T18:29:59.000Z",amount:12500,remaining:27500}]}};
test("Basic and full receipts label collections, preserve calendar dates and format balances",async({page,context},info)=>{
    await context.route("**/*",route=>new URL(route.request().url()).hostname==="127.0.0.1"?route.continue():route.abort());
    await installSettingsRouteFixture(page);
    await page.route("**/api/branches/pilot/basic-overview",route=>route.fulfill({json:{branchId:"pilot",today:"2026-10-01",activeStudents:3,money:{collectedThisMonth:12500,pendingDues:27500}}}));
    await page.route("**/api/branches/pilot/shifts",async route=>{const response=await route.fetch();await route.fulfill({json:(await response.json()).map((row:Record<string,unknown>)=>({...row,status:"ACTIVE"}))});});
    await page.route("**/api/branches/pilot/collections?*",route=>route.fulfill({json:{items:[receipt],total:1,nextCursor:null}}));
    await page.route("**/api/branches/pilot/collections/completion-receipt",route=>route.fulfill({json:receipt}));
    await page.goto("/branch/pilot/students/student-aarav?plan=BASIC&legacy=1&mode=after&lang=en");
    await page.locator(".bp-history").getByRole("button",{name:/View receipt/}).click();
    const basic=page.getByRole("dialog");
    await expect(basic.getByText("Amount collected",{exact:true})).toBeVisible();
    await expect(basic.getByText("Collection date",{exact:true})).toBeVisible();
    await expect(basic).toContainText("12,500");await expect(basic).toContainText("27,500");await expect(basic).toContainText("01 Oct 2026");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath("basic-formatted-receipt.png"),animations:"disabled"});
    await page.goto("/branch/pilot/payments?collectionId=completion-receipt&mode=after&lang=en");
    const full=page.getByRole("dialog");
    await expect(full).toBeVisible();await expect(full).toContainText("Received: ₹12,500");await expect(full).toContainText("₹27,500");await expect(full).toContainText("Collection date");await expect(full).toContainText("01 Oct 2026");
    await expect(full.getByText("student-aarav",{exact:true})).toBeHidden();
    await full.getByText("Student ID",{exact:true}).click();await expect(full.getByText("student-aarav",{exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath("full-formatted-receipt.png"),animations:"disabled"});
});
