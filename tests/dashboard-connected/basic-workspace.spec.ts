import { test, expect, type Page } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { Client } from "pg";
import { assertDisposableTestDatabaseTarget } from "../setup/testDatabaseSafety";
import { refreshDevelopmentSession } from "../browser/helpers/development-session";
const f=JSON.parse(readFileSync(".clerk/basic-connected-fixture.json","utf8"));
const target=assertDisposableTestDatabaseTarget(process.env.TEST_DATABASE_URL,process.env);
if(target.databaseName!==f.databaseName||f.databaseName!=="lab_lords_dashboard_basic_integrated_browser_test")throw new Error("Basic database identity mismatch");
let db:typeof import("../setup/db").testPrisma;
const root="/branch/"+f.branchId;
const screenshots="test-results/basic-integration/";
async function shot(page:Page,name:string){await expect(page.locator("[data-basic-workspace] .bp-empty[role=status], [data-basic-workspace] .bp-history [role=status]")).toHaveCount(0,{timeout:60000});await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:screenshots+name+".png",fullPage:true});}
async function open(page:Page,path=root){await refreshDevelopmentSession(page);await page.goto(path);await expect(page.locator("[data-basic-workspace]")).toBeVisible({timeout:60000});}
async function basicPlan(){
 const {createSaasSubscription}=await import("../factories");
 await db.organizationSubscription.updateMany({where:{currentOrganizationId:f.orgId},data:{currentOrganizationId:null}});
 await db.ownerTrialGrant.deleteMany({where:{organizationId:f.orgId}});
 await createSaasSubscription({organizationId:f.orgId,plan:"BASIC"});
}
test.beforeAll(async()=>{
 const check=new Client({connectionString:process.env.TEST_DATABASE_URL});await check.connect();
 try{const value=await check.query('SELECT current_database() AS name,(SELECT count(*)::int FROM "Organization" WHERE "ownerId"=$1) AS owned',[f.ownerId]);if(value.rows[0]?.name!==f.databaseName||value.rows[0].owned!==1)throw new Error("Basic browser fixture proof failed");}finally{await check.end();}
 db=(await import("../setup/db")).testPrisma;mkdirSync(screenshots,{recursive:true});
});
test.beforeEach(async()=>{await basicPlan();});
test.afterAll(async()=>{if(db){await basicPlan();await db.$disconnect();}});
test("real Basic admission, edit, assignment, move, partial fee, receipt, persistence and navigation",async({page})=>{
 const available=await db.seat.findMany({where:{branchId:f.branchId,seatAllocations:{none:{endDate:null}}},orderBy:{label:"desc"},take:2});expect(available).toHaveLength(2);
 await open(page);await expect(page.getByRole("heading",{name:"Your library overview"})).toBeVisible();await shot(page,"overview-desktop");
 await page.locator(".bp-sidebar").getByRole("link",{name:"Students",exact:true}).click();
 await expect(page.getByRole("heading",{name:"Your students"})).toBeVisible();await shot(page,"students-desktop");
 await page.getByRole("button",{name:"Add student",exact:true}).click();
 let dialog=page.getByRole("dialog",{name:"Add a student"});await expect(dialog).toBeVisible();
 await dialog.getByLabel("Student name",{exact:true}).fill("Connected Basic "+Date.now());
 const name=await dialog.getByLabel("Student name",{exact:true}).inputValue();
 await dialog.getByLabel("Mobile number",{exact:true}).fill("9876543210");
 await dialog.getByLabel("Admission fee",{exact:true}).fill("1000");await shot(page,"student-form");
 await dialog.getByRole("button",{name:"Save & choose seat",exact:true}).click();
 await expect(dialog).toHaveCount(0);await expect(page).toHaveURL(root+"/seats");
 const student=await db.student.findFirstOrThrow({where:{branchId:f.branchId,name}});
 await expect(page.getByLabel("Student",{exact:true})).toHaveValue(student.id);
 await page.getByRole("button",{name:"Morning",exact:false}).click();
 await page.getByRole("button",{name:"Seat "+available[0].label+", Available",exact:true}).click();
 await page.getByRole("button",{name:"Assign seat",exact:true}).click();
 await expect(page.getByText("Seat assignment confirmed.",{exact:true})).toBeVisible();
 await expect.poll(()=>db.seatAllocation.count({where:{studentId:student.id,endDate:null}})).toBe(1);
 await page.getByLabel("Allocation to change").selectOption({label:available[0].label+" · Morning"});
 await page.getByRole("button",{name:"Seat "+available[1].label+", Available",exact:true}).click();await page.getByRole("button",{name:"Change seat",exact:true}).click();
 await expect.poll(()=>db.seatAllocation.count({where:{studentId:student.id,endDate:{not:null}}})).toBe(1);
 await shot(page,"seats-desktop");
 await page.getByRole("button",{name:"Review student fees",exact:true}).click();await expect(page.getByRole("heading",{name})).toBeVisible();
 await page.getByRole("button",{name:"Edit details",exact:true}).click();dialog=page.getByRole("dialog",{name:"Edit student"});
 await expect(dialog.getByLabel("Mobile number",{exact:true})).toHaveValue("+91 98765 43210");
 await dialog.getByLabel("Student name",{exact:true}).fill(name+" edited");await dialog.getByRole("button",{name:"Save changes",exact:true}).click();
 await expect(page.getByRole("heading",{name:name+" edited"})).toBeVisible();
 await page.getByRole("button",{name:"Record payment",exact:true}).click();dialog=page.getByRole("dialog",{name:"Record a payment"});
 await dialog.getByLabel("Amount received",{exact:true}).fill("300");await shot(page,"payment-form");await dialog.getByRole("button",{name:"Record payment",exact:true}).click();
 await expect(page.getByRole("dialog",{name:"Fee receipt"})).toBeVisible();await shot(page,"receipt");
 await expect.poll(()=>db.feeCollection.count({where:{studentId:student.id,amount:300}})).toBe(1);
 const fees=await db.payment.findMany({where:{studentId:student.id}});expect(fees).toHaveLength(1);expect(fees[0]).toMatchObject({type:"ADMISSION",collectedAmount:300,status:"DUE"});
 await page.getByRole("button",{name:"Done",exact:true}).click();await page.reload();await expect(page.getByRole("heading",{name:name+" edited"})).toBeVisible();
 await expect(page.getByRole("button",{name:/View receipt/})).toContainText("₹300");
 await page.getByLabel("Switch branch").selectOption(f.otherBranchId);await expect(page).toHaveURL("/branch/"+f.otherBranchId+"/students");await expect(page.getByRole("heading",{name:"No students found"})).toBeVisible();await expect(page.getByText(name+" edited",{exact:true})).toHaveCount(0);
 await page.getByLabel("Switch branch").selectOption(f.branchId);await expect(page).toHaveURL(root+"/students");
 await page.locator(".bp-sidebar").getByRole("link",{name:"Fees",exact:true}).click();await expect(page.getByRole("heading",{name:"Student fees"})).toBeVisible();await shot(page,"fees-desktop");
 await page.locator(".bp-sidebar").getByRole("link",{name:"Account",exact:true}).click();await expect(page.getByRole("link",{name:"Back to workspace",exact:true})).toBeVisible();await page.getByRole("link",{name:"Back to workspace",exact:true}).click();await expect(page).toHaveURL(root+"/fees");
 await page.locator(".bp-sidebar").getByRole("link",{name:"Library setup",exact:true}).click();await expect(page.getByRole("heading",{name:"Library setup"})).toBeVisible();await shot(page,"setup-desktop");
 await page.locator(".bp-sidebar").getByRole("link",{name:"Back to organization",exact:true}).click();await expect(page).toHaveURL("/org/"+f.orgId);await expect(page.getByText("Organization analytics are unavailable. Branch records remain accessible.",{exact:true})).toHaveCount(0);await expect(page.getByRole("heading",{name:"Organization snapshot",exact:true})).toHaveCount(0);await shot(page,"organization");
 await page.goto("/org/"+f.orgId+"/billing");await expect(page.getByRole("heading",{name:/Billing/}).first()).toBeVisible();await shot(page,"billing");
});
test("lost payment response recovers once after expiry without another write",async({page})=>{
 const {createStudent,createPayment}=await import("../factories");
 const student=await createStudent({branchId:f.branchId,name:"Lost payment recovery"}),fee=await createPayment({branchId:f.branchId,studentId:student.id,amount:1000,dueDate:new Date(),periodStart:new Date(),periodEnd:new Date(Date.now()+86400000)});
 await open(page,root+"/students/"+student.id);
 let writes=0;
 await page.route("**/api/branches/"+f.branchId+"/collections",async route=>{if(route.request().method()==="POST"&&writes++===0){const response=await route.fetch();expect(response.ok()).toBeTruthy();await route.abort("failed");}else await route.continue();});
 await page.getByRole("button",{name:"Record payment",exact:true}).click();
 const dialog=page.getByRole("dialog",{name:"Record a payment"});await dialog.getByLabel("Amount received",{exact:true}).fill("250");await dialog.getByRole("button",{name:"Record payment",exact:true}).click();
 await expect(dialog.getByRole("alert")).toBeVisible();expect(await db.feeCollection.count({where:{studentId:student.id}})).toBe(1);
 await db.organizationSubscription.updateMany({where:{currentOrganizationId:f.orgId},data:{status:"HALTED"}});
 page.once("dialog",d=>d.accept());await page.reload();await expect(page.getByText("An operation needs confirmation",{exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Check saved operation",exact:true}).click();await expect(page.getByRole("dialog",{name:"Fee receipt"})).toBeVisible();
 expect(writes).toBe(1);expect((await db.payment.findUniqueOrThrow({where:{id:fee.id}})).collectedAmount).toBe(250);
});
test("direct excluded APIs, foreign routes and stale branch submissions are denied",async({page})=>{
 await open(page);
 for(const path of ["/dashboard","/dashboard/tasks","/dashboard/follow-ups","/dashboard/settings","/payments/overdue","/reports?kind=students&from=2026-10-01&through=2026-10-29","/attendance","/renewals"]){
  const response=await page.request.get("/api/branches/"+f.branchId+path);expect(response.status(),path).toBe(403);
 }
 expect((await page.request.get("/api/branches/"+f.foreignBranchId+"/basic-overview")).status()).toBe(404);
 await page.goto(root+"/attendance");await expect(page.getByRole("heading",{name:"This feature requires the Standard plan."})).toBeVisible();
 const student=await db.student.findFirstOrThrow({where:{branchId:f.branchId}});
 const response=await page.request.patch("/api/branches/"+f.otherBranchId+"/students",{data:{id:student.id,name:"wrong branch"}});
 expect(response.status()).toBe(404);expect((await db.student.findUniqueOrThrow({where:{id:student.id}})).name).toBe(student.name);
});
test("Basic desktop and mobile language, keyboard and unsaved-navigation checks",async({page})=>{
 await open(page,root+"/students");await page.getByRole("button",{name:"Add student",exact:true}).click();
 const dialog=page.getByRole("dialog",{name:"Add a student"});await expect(dialog.getByLabel("Student name",{exact:true})).toBeFocused();
 await dialog.getByLabel("Student name",{exact:true}).fill("Unsaved local draft");
 page.once("dialog",d=>d.dismiss());await page.keyboard.press("Escape");await expect(dialog).toBeVisible();
 page.once("dialog",d=>d.accept());await page.keyboard.press("Escape");await expect(dialog).toHaveCount(0);
 await page.setViewportSize({width:390,height:844});await page.goto(root);await expect(page.getByRole("heading",{name:"Your library overview"})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await shot(page,"overview-mobile");
 await page.locator(".bp-mobile-nav").getByRole("link",{name:"Students",exact:true}).click();await shot(page,"students-mobile");
 await page.locator(".bp-mobile-nav").getByRole("link",{name:"Seats",exact:true}).click();await shot(page,"seats-mobile");
 await page.locator(".bp-mobile-nav").getByRole("link",{name:"Fees",exact:true}).click();await shot(page,"fees-mobile");
 for(const [locale,title]of [["hi","आपकी लाइब्रेरी का सार"],["hinglish","Aapki library ka overview"]] as const){
  await db.user.update({where:{id:f.ownerId},data:{interfaceLanguage:locale}});await page.goto(root);await page.reload();await expect(page.getByRole("heading",{name:title})).toBeVisible();await shot(page,"overview-mobile-"+locale);
 }
 await db.user.update({where:{id:f.ownerId},data:{interfaceLanguage:"en"}});
});
test("organization plan transitions choose the full workspace and preserve Basic records",async({page})=>{
 await open(page);const before=await db.student.count({where:{branchId:f.branchId}});
 const {createSaasSubscription}=await import("../factories");
 for(const plan of ["STANDARD","PRO"] as const){
  await db.organizationSubscription.updateMany({where:{currentOrganizationId:f.orgId},data:{currentOrganizationId:null}});await createSaasSubscription({organizationId:f.orgId,plan});
  await page.reload();await expect(page.locator("[data-basic-workspace]")).toHaveCount(0);await expect(page.locator("[data-dashboard-navigation]")).toBeVisible();await shot(page,"full-"+plan.toLowerCase());
  const other=await page.request.get("/api/branches/"+f.otherBranchId+"/access");expect((await other.json()).effectivePlan).toBe(plan);
 }
 await basicPlan();await page.reload();await expect(page.locator("[data-basic-workspace]")).toBeVisible();expect(await db.student.count({where:{branchId:f.branchId}})).toBe(before);
});

test("large roster, failed reads, late branch responses and Back preserve scope",async({page})=>{
 const marker="Roster pagination "+Date.now()+" ";
 await db.student.createMany({data:Array.from({length:105},(_,i)=>({branchId:f.branchId,name:marker+String(i).padStart(3,"0"),phone:null,monthlyFee:1000,status:"ACTIVE",joinedAt:new Date()}))});
 await page.route("**/api/branches/"+f.branchId+"/students?*",async route=>route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:"Temporary read failure"})}));
 await open(page,root+"/students");await expect(page.locator(".bp-empty[role=alert]")).toContainText("Something went wrong. Try again.");
 await page.unroute("**/api/branches/"+f.branchId+"/students?*");await page.getByRole("button",{name:"Retry",exact:true}).click();
 await expect(page.locator(".bp-student-row")).toHaveCount(50);await page.getByRole("button",{name:"Load more",exact:true}).click();await expect(page.locator(".bp-student-row")).toHaveCount(100);
 await page.getByRole("textbox",{name:"Search students"}).fill(marker+"104");await expect(page.locator(".bp-student-row")).toHaveCount(1);await expect(page.locator(".bp-student-row")).toContainText(marker+"104");
 await page.locator(".bp-sidebar").getByRole("link",{name:"Overview",exact:true}).click();await page.locator(".bp-sidebar").getByRole("link",{name:"Students",exact:true}).click();
 await page.getByRole("button",{name:"Add student",exact:true}).click();const dialog=page.getByRole("dialog",{name:"Add a student"});await dialog.getByLabel("Student name",{exact:true}).fill("Preserved Back draft");
 page.once("dialog",d=>d.dismiss());await page.goBack();await expect(page).toHaveURL(root+"/students");await expect(dialog.getByLabel("Student name",{exact:true})).toHaveValue("Preserved Back draft");
 page.once("dialog",d=>d.accept());await page.keyboard.press("Escape");
 let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;});
 await page.route("**/api/branches/"+f.branchId+"/students?*",async route=>{await held;await route.continue().catch(()=>{});});
 await page.reload();await expect(page.locator("[data-basic-workspace] .bp-empty[role=status]")).toBeVisible();await page.getByLabel("Switch branch").selectOption(f.otherBranchId);
 release();await expect(page).toHaveURL("/branch/"+f.otherBranchId+"/students");await expect(page.getByRole("heading",{name:"No students found"})).toBeVisible();await expect(page.getByText(marker+"104",{exact:true})).toHaveCount(0);
});

test("an access change preserves an unsaved Basic form without replay",async({page})=>{
 await open(page,root+"/students");await page.getByRole("button",{name:"Add student",exact:true}).click();const form=page.getByRole("dialog",{name:"Add a student"});await form.getByLabel("Student name",{exact:true}).fill("Unsaved plan transition");
 let mutations=0;page.on("request",r=>{if(r.url().includes("/api/branches/")&&["POST","PATCH"].includes(r.method()))mutations++;});
 const {createSaasSubscription}=await import("../factories");await db.organizationSubscription.updateMany({where:{currentOrganizationId:f.orgId},data:{currentOrganizationId:null}});await createSaasSubscription({organizationId:f.orgId,plan:"STANDARD"});
 await page.evaluate(()=>window.dispatchEvent(new Event("billing-access-changed")));await expect(page.getByRole("dialog",{name:"Workspace access changed"})).toBeVisible();expect(mutations).toBe(0);
 await expect(form.getByLabel("Student name",{exact:true})).toHaveValue("Unsaved plan transition");page.once("dialog",d=>d.accept());await page.getByRole("button",{name:"Continue to the updated workspace"}).click();await expect(page.locator("[data-basic-workspace]")).toHaveCount(0);
 await basicPlan();await page.evaluate(()=>window.dispatchEvent(new Event("billing-access-changed")));await expect(page.locator("[data-basic-workspace]")).toBeVisible();await page.getByRole("button",{name:"Add student",exact:true}).click();await expect(page.getByRole("dialog",{name:"Add a student"}).getByLabel("Student name",{exact:true})).toHaveValue("Unsaved plan transition");expect(mutations).toBe(0);
 page.once("dialog",d=>d.accept());await page.keyboard.press("Escape");
});

test("fresh connected visual review of shared destinations and mobile Basic",async({page})=>{
 await open(page);
 await page.goto("/org/"+f.orgId);await expect(page.getByText("Choose the branch you want to work in. Organization numbers are here only as quick context.",{exact:true})).toBeVisible();await expect(page.getByText("Saraswati Library",{exact:true}).filter({visible:true}).first()).toBeVisible();await shot(page,"organization");
 await page.goto("/org/"+f.orgId+"/billing");await expect(page.getByText("Basic",{exact:true}).first()).toBeVisible();await expect(page.locator(".animate-pulse")).toHaveCount(0);await shot(page,"billing");
 await page.goto("/account?returnTo="+encodeURIComponent(root+"/fees"));await expect(page.getByRole("link",{name:"Back to workspace",exact:true})).toBeVisible();await shot(page,"account");
 await page.setViewportSize({width:390,height:844});
 for(const area of ["","students","seats","fees"]){await page.goto(root+(area?"/"+area:""));await expect(page.locator("[data-basic-workspace]")).toBeVisible();await shot(page,(area||"overview")+"-mobile");expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();}
 const receipt=await db.feeCollection.findFirstOrThrow({where:{branchId:f.branchId,amount:300},orderBy:{collectedAt:"desc"}});
 await page.goto(root+"/students/"+receipt.studentId);await page.getByRole("button",{name:/View receipt/}).first().click();await expect(page.getByRole("dialog",{name:"Fee receipt"})).toBeVisible();await page.evaluate(()=>window.scrollTo(0,0));await shot(page,"receipt-mobile");expect(await page.getByRole("dialog").evaluate(el=>el.scrollWidth<=el.clientWidth)).toBeTruthy();await page.getByRole("button",{name:"Done",exact:true}).click();
 for(const locale of ["hi","hinglish"]){await db.user.update({where:{id:f.ownerId},data:{interfaceLanguage:locale}});await page.goto(root);await page.reload();await expect(page.locator("[data-basic-workspace]")).toBeVisible();await shot(page,"overview-mobile-"+locale);}
 await db.user.update({where:{id:f.ownerId},data:{interfaceLanguage:"en"}});
});

test("shared organization entry keeps Basic simple and Standard or Pro analytics intact",async({page})=>{
 await open(page);await page.goto("/org/"+f.orgId);await expect(page.getByText("Choose a branch for students, seats and fees.",{exact:true})).toBeVisible();await expect(page.getByRole("heading",{name:"Organization snapshot",exact:true})).toHaveCount(0);await expect(page.getByRole("button",{name:"Retry analytics",exact:true})).toHaveCount(0);await shot(page,"organization");
 const {createSaasSubscription}=await import("../factories");
 for(const plan of ["STANDARD","PRO"] as const){await db.organizationSubscription.updateMany({where:{currentOrganizationId:f.orgId},data:{currentOrganizationId:null}});await createSaasSubscription({organizationId:f.orgId,plan});await page.reload();await expect(page.getByRole("heading",{name:"Organization snapshot",exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"Retry analytics",exact:true})).toHaveCount(0);await shot(page,"organization-"+plan.toLowerCase());}
});

test("profile edits preserve a linked fee and recover a lost edit response without replay",async({page})=>{
 const {createStudent}=await import("../factories");const student=await createStudent({branchId:f.branchId,name:"Linked fee profile "+Date.now(),monthlyFee:1000});await db.student.update({where:{id:student.id},data:{feeLinkedShiftId:f.shiftIds[0]}});
 await open(page,root+"/students/"+student.id);let writes=0;
 await page.route("**/api/branches/"+f.branchId+"/students",async route=>{if(route.request().method()==="PATCH"&&writes++===0){expect(route.request().postDataJSON()).not.toHaveProperty("monthlyFee");const response=await route.fetch();expect(response.ok()).toBeTruthy();await route.abort("failed");}else await route.continue();});
 await page.getByRole("button",{name:"Edit details",exact:true}).click();let dialog=page.getByRole("dialog",{name:"Edit student"});await dialog.getByLabel("Student name",{exact:true}).fill(student.name+" edited");await dialog.getByRole("button",{name:"Save changes",exact:true}).click();await expect(dialog.getByRole("alert")).toBeVisible();
 await dialog.getByRole("button",{name:"Check saved operation",exact:true}).click();await expect(dialog).toHaveCount(0);expect(writes).toBe(1);await expect(page.getByRole("heading",{name:student.name+" edited",exact:true})).toBeVisible();
 expect(await db.student.findUniqueOrThrow({where:{id:student.id}})).toMatchObject({feeLinkedShiftId:f.shiftIds[0],monthlyFee:1000});await page.unroute("**/api/branches/"+f.branchId+"/students");
 await page.getByRole("button",{name:"Edit details",exact:true}).click();dialog=page.getByRole("dialog",{name:"Edit student"});await dialog.getByLabel("Monthly fee",{exact:true}).fill("1200");await dialog.getByRole("button",{name:"Save changes",exact:true}).click();await expect(dialog).toHaveCount(0);expect(await db.student.findUniqueOrThrow({where:{id:student.id}})).toMatchObject({feeLinkedShiftId:null,monthlyFee:1200});
});

test("lost admission response reconciles normalized profile fields without another create",async({page})=>{
 await open(page,root+"/students");let writes=0;const name="Admission Recovery "+Date.now();
 await page.route("**/api/branches/"+f.branchId+"/students",async route=>{if(route.request().method()==="POST"&&writes++===0){const response=await route.fetch();expect(response.ok()).toBeTruthy();await route.abort("failed");}else await route.continue();});
 await page.getByRole("button",{name:"Add student",exact:true}).click();const dialog=page.getByRole("dialog",{name:"Add a student"});await dialog.getByLabel("Student name",{exact:true}).fill(name);await dialog.getByLabel("Mobile number",{exact:true}).fill("9876543210");await dialog.getByRole("button",{name:"Save for later",exact:true}).click();await expect(dialog.getByRole("alert")).toBeVisible();
 await dialog.getByRole("button",{name:"Check saved operation",exact:true}).click();await expect(dialog).toHaveCount(0);expect(writes).toBe(1);expect(await db.student.count({where:{branchId:f.branchId,name}})).toBe(1);const student=await db.student.findFirstOrThrow({where:{branchId:f.branchId,name}});expect(student.phone).toBe("+91 98765 43210");expect(await db.payment.count({where:{studentId:student.id,type:"ADMISSION"}})).toBe(1);await page.getByRole("button",{name:"Add student",exact:true}).click();await expect(page.getByRole("dialog",{name:"Add a student"}).getByLabel("Student name",{exact:true})).toHaveValue("");await page.keyboard.press("Escape");
});
