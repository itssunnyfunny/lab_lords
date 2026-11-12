import {expect,test} from "@playwright/test";
const day="2026-09-28";
const rows=[{id:"student-aarav",name:"Aarav Mehta",phone:"+919876543210",status:"ACTIVE",attendance:"NOT_MARKED",mark:null,visits:[],openVisit:null,currentAllocations:[{seat:"A3",shift:"Morning"}]},{id:"student-nisha",name:"Nisha Verma",phone:"+919876543211",status:"ACTIVE",attendance:"PRESENT",mark:{date:day,status:"PRESENT",version:1,note:null,correctedAt:null,updatedAt:day+"T04:00:00.000Z",source:"MANUAL",actor:{name:"Review owner"}},visits:[],openVisit:null,currentAllocations:[]}];
test("populated attendance keeps complete dates, identities and actions readable",async({page,context},info)=>{
    await context.route("**/*",route=>new URL(route.request().url()).hostname==="127.0.0.1"?route.continue():route.abort());
    await page.route(/\/api\/branches\/pilot\/attendance(?:\?.*)?$/,route=>route.fulfill({json:{items:rows,total:2,nextCursor:null,date:day,today:day,timezone:"Asia/Kolkata",shifts:[{id:"morning",name:"Morning"}],counts:{attended:1,absent:0,notMarked:1,open:0}}}));
    await page.goto("/branch/pilot/attendance?mode=after&lang=en");
    const date=page.getByLabel("Attendance date",{exact:true});await expect(date).toHaveValue(day);
    if(info.project.name==="mobile-320")expect((await date.boundingBox())!.width).toBeGreaterThan(240);
    const cards=page.locator(".ui-record-card:visible");await expect(cards).toHaveCount(2);
    await page.screenshot({path:info.outputPath("attendance-complete-date.png"),animations:"disabled"});
    await cards.first().scrollIntoViewIfNeeded();
    await expect(cards.first().getByText("Aarav Mehta",{exact:true})).toBeVisible();
    await expect(cards.first().getByRole("button",{name:"Mark Present",exact:true})).toBeVisible();
    const phone=cards.first().locator(".ui-phone");expect((await phone.boundingBox())!.height).toBeLessThan(25);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:info.outputPath("attendance-populated-records.png"),animations:"disabled"});
});
