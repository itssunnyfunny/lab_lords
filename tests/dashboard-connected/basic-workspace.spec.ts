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
test.beforeEach(async()=>{await basicPlan();await db.user.update({where:{id:f.ownerId},data:{interfaceLanguage:"en",timezone:"Asia/Kolkata"}});});
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


for(const scenario of ["different admission fee","identical older record","committed lost response","lost duplicate rejection","foreign match"] as const){
 test("uncertain admission requires review: "+scenario,async({page})=>{
  await open(page,root+"/students");const name="Review Admission "+scenario+" "+Date.now(),phone="9876543210",monthlyFee=1000,admissionFee=999;
  const existing=["different admission fee","identical older record","lost duplicate rejection"].includes(scenario);
  if(existing){const before=await page.request.post("/api/branches/"+f.branchId+"/students",{data:{name,phone,monthlyFee,admissionFee:scenario==="different admission fee"?111:admissionFee}});expect(before.status()).toBe(201);}
  if(scenario==="foreign match"){const {createStudent}=await import("../factories");await createStudent({branchId:f.foreignBranchId,name,phone:"+91 98765 43210",monthlyFee});}
  const before=await db.student.count({where:{branchId:f.branchId,name}});let writes=0;
  await page.route("**/api/branches/"+f.branchId+"/students",async route=>{if(route.request().method()!=="POST")return route.continue();writes++;if(scenario==="committed lost response"||scenario==="lost duplicate rejection"){const response=await route.fetch();expect(response.status()).toBe(scenario==="committed lost response"?201:400);}await route.abort("failed");});
  await page.getByRole("button",{name:"Add student",exact:true}).click();const form=page.getByRole("dialog",{name:"Add a student"});await form.getByLabel("Student name",{exact:true}).fill(name);await form.getByLabel("Mobile number",{exact:true}).fill(phone);await form.getByLabel("Monthly fee",{exact:true}).fill(String(monthlyFee));await form.getByLabel("Admission fee",{exact:true}).fill(String(admissionFee));await form.getByRole("button",{name:"Save & choose seat",exact:true}).click();await expect(form.getByRole("alert")).toBeVisible();
  const frozen=await page.evaluate(()=>Object.entries(sessionStorage).find(([k])=>k.startsWith("basic-operation:v1:"))?.[1]);expect(frozen).toBeTruthy();expect(JSON.parse(frozen!).body).toMatchObject({name,phone,monthlyFee,admissionFee});
  await form.getByRole("button",{name:"Check saved operation",exact:true}).click();
  for(let check=0;check<3;check++){
   const review=page.getByRole("dialog",{name:"Review uncertain admission"});await expect(review.getByText("This admission is not confirmed. A matching student does not prove this request succeeded.",{exact:true})).toBeVisible();await expect(review.getByRole("region",{name:"Original admission request"})).toContainText("₹999");
   await expect(review.getByRole("button",{name:"Review student record",exact:true})).toHaveCount(existing||scenario==="committed lost response"?1:0);
   await expect(page.locator(".bp-notice")).toHaveCount(0);await expect(page).toHaveURL(root+"/students");expect(writes).toBe(1);
   expect(await page.evaluate(()=>Object.entries(sessionStorage).find(([k])=>k.startsWith("basic-operation:v1:"))?.[1])).toBe(frozen);
   if(check===0){await review.getByRole("button",{name:"Back",exact:true}).click();page.once("dialog",d=>d.accept());await page.reload();await expect(page.getByText("An operation needs confirmation",{exact:true})).toBeVisible();await page.getByRole("button",{name:"Check saved operation",exact:true}).click();}
   if(check===1){await review.getByRole("button",{name:"Back",exact:true}).click();await page.getByRole("button",{name:"Check saved operation",exact:true}).click();}
  }
  const students=await db.student.findMany({where:{branchId:f.branchId,name}});expect(students).toHaveLength(before+(scenario==="committed lost response"?1:0));
  const fees=await db.payment.findMany({where:{studentId:{in:students.map(x=>x.id)},type:"ADMISSION"}});expect(fees).toHaveLength(students.length);if(fees.length)expect(fees[0].amount).toBe(scenario==="different admission fee"?111:admissionFee);
  if(scenario==="different admission fee"){await page.getByRole("dialog",{name:"Review uncertain admission"}).screenshot({path:screenshots+"admission-review.png",animations:"disabled"});}
  page.once("dialog",d=>d.accept());await page.getByRole("button",{name:"Close recovery and keep draft",exact:true}).click();await expect(page.getByText("An operation needs confirmation",{exact:true})).toHaveCount(0);await expect(page.locator(".bp-notice")).toHaveCount(0);
  await page.getByRole("button",{name:"Add student",exact:true}).click();await expect(page.getByRole("dialog",{name:"Add a student"}).getByLabel("Student name",{exact:true})).toHaveValue(name);await expect(page.getByRole("dialog",{name:"Add a student"}).getByLabel("Admission fee",{exact:true})).toHaveValue("999");expect(writes).toBe(1);await page.keyboard.press("Escape");
 });
}

test("Basic lifecycle confirmation ends all allocations and reactivates without altering fees",async({page})=>{
 await open(page);const name="Lifecycle Student "+Date.now();const admission=await page.request.post("/api/branches/"+f.branchId+"/students",{data:{name,phone:"9876543210",monthlyFee:1000,admissionFee:1000}});expect(admission.status()).toBe(201);const student=await admission.json();
 const {createSeat}=await import("../factories");const seat=await createSeat({branchId:f.branchId,label:"Lifecycle "+Date.now()});const bundle=await db.multiShift.create({data:{branchId:f.branchId,name:"Lifecycle bundle "+Date.now(),price:1500,components:{create:f.shiftIds.slice(0,2).map((shiftId:string)=>({shiftId}))}}});
 const {SeatAllocationService}=await import("../../services/seatAllocation.service");await SeatAllocationService.assignSeatToShifts(f.ownerId,seat.id,student.id,f.shiftIds.slice(0,2),bundle.id);
 const fee=await db.payment.findFirstOrThrow({where:{studentId:student.id}});const collected=await page.request.post("/api/branches/"+f.branchId+"/collections",{data:{studentId:student.id,paymentIds:[fee.id],amount:300,method:"CASH",idempotencyKey:crypto.randomUUID()}});expect(collected.status()).toBe(200);const receipt=await collected.json();
 await page.goto(root+"/students/"+student.id);await page.getByRole("button",{name:"Mark inactive",exact:true}).click();let dialog=page.getByRole("dialog",{name:"Mark student inactive"});await expect(dialog.getByRole("button",{name:"Cancel",exact:true})).toBeFocused();await expect(dialog).toContainText("Unpaid fees, partial payments and receipt history stay unchanged.");await shot(page,"status-inactive-desktop");await page.keyboard.press("Escape");await expect(dialog).toHaveCount(0);
 const {translateOwnedText}=await import("../../lib/i18n");await page.setViewportSize({width:390,height:844});
 for(const language of ["en","hi","hinglish"] as const){await db.user.update({where:{id:f.ownerId},data:{interfaceLanguage:language}});await page.reload();await page.getByRole("button",{name:translateOwnedText(language,"Mark inactive"),exact:true}).click();dialog=page.getByRole("dialog",{name:translateOwnedText(language,"Mark student inactive"),exact:true});await expect(dialog).toBeVisible();expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);await shot(page,"status-inactive-mobile-"+language);await page.keyboard.press("Escape");}
 await db.user.update({where:{id:f.ownerId},data:{interfaceLanguage:"en"}});await page.reload();await page.getByRole("button",{name:"Mark inactive",exact:true}).click();await page.getByRole("dialog",{name:"Mark student inactive"}).getByRole("button",{name:"Mark inactive",exact:true}).click();await expect(page.getByRole("button",{name:"Reactivate student",exact:true})).toBeVisible();
 expect(await db.seatAllocation.count({where:{studentId:student.id,endDate:null}})).toBe(0);const history=await db.seatAllocation.findMany({where:{studentId:student.id}});expect(history).toHaveLength(2);expect(history.every(x=>x.multiShiftId===bundle.id)).toBe(true);
 expect(await db.payment.findUniqueOrThrow({where:{id:fee.id}})).toMatchObject({status:"DUE",amount:1000,collectedAmount:300});expect((await page.request.get("/api/branches/"+f.branchId+"/collections/"+receipt.id)).status()).toBe(200);await expect(page.getByRole("button",{name:"Choose or change a seat",exact:true})).toBeDisabled();
 await page.getByRole("button",{name:"Reactivate student",exact:true}).click();dialog=page.getByRole("dialog",{name:"Reactivate student",exact:true});await expect(dialog).toContainText("Previous seats are not restored.");await shot(page,"status-reactivate-mobile");await dialog.getByRole("button",{name:"Reactivate student",exact:true}).click();await expect(page.getByRole("button",{name:"Mark inactive",exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"Choose or change a seat",exact:true})).toBeEnabled();expect(await db.seatAllocation.findMany({where:{studentId:student.id}})).toEqual(history);expect(await db.student.findUniqueOrThrow({where:{id:student.id}})).toMatchObject({status:"ACTIVE",joinedAt:new Date(student.joinedAt)});
});

test("Basic status failure stays honest and lost responses reconcile without replay",async({page})=>{
 const {createStudent}=await import("../factories");const student=await createStudent({branchId:f.branchId,name:"Status recovery "+Date.now()});await open(page,root+"/students/"+student.id);let writes=0,commit=false;
 await page.route("**/api/branches/"+f.branchId+"/students",async route=>{if(route.request().method()!=="PATCH")return route.continue();writes++;if(commit){const response=await route.fetch();expect(response.status()).toBe(200);await route.abort("failed");}else await route.fulfill({status:400,contentType:"application/json",body:JSON.stringify({error:"Status was not changed"})});});
 await page.getByRole("button",{name:"Mark inactive",exact:true}).click();const dialog=page.getByRole("dialog",{name:"Mark student inactive"});await dialog.getByRole("button",{name:"Mark inactive",exact:true}).click();await expect(dialog.getByRole("alert")).toBeVisible();expect((await db.student.findUniqueOrThrow({where:{id:student.id}})).status).toBe("ACTIVE");await expect(page.locator(".bp-notice")).toHaveCount(0);
 commit=true;await dialog.getByRole("button",{name:"Mark inactive",exact:true}).click();await expect(dialog.getByRole("button",{name:"Check saved operation",exact:true})).toBeVisible();await expect(page.locator(".bp-notice")).toHaveCount(0);await dialog.getByRole("button",{name:"Check saved operation",exact:true}).click();await expect(dialog).toHaveCount(0);await expect(page.getByRole("button",{name:"Reactivate student",exact:true})).toBeVisible();expect(writes).toBe(2);
});

test("Basic receipt and PDF keep India dates across account timezones and void history",async({page})=>{
 await page.addInitScript(()=>{const recorded:string[]=[];(window as unknown as {receiptDrawnText:string[]}).receiptDrawnText=recorded;const original=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text:string,x:number,y:number,maxWidth?:number){recorded.push(text);if(maxWidth===undefined)original.call(this,text,x,y);else original.call(this,text,x,y,maxWidth);};});
 await open(page);const {createStudent,createPayment}=await import("../factories");const student=await createStudent({branchId:f.branchId,name:"India receipt "+Date.now()});const fee=await createPayment({branchId:f.branchId,studentId:student.id,amount:1000,dueDate:new Date("2026-10-28T18:30:00Z"),periodStart:new Date("2026-09-30T18:30:00Z"),periodEnd:new Date("2026-10-31T18:29:59.999Z")});
 // Insert a deterministic historical ledger fixture once; never rewrite immutable evidence.
 const collectedAt="2026-10-28T18:45:00.000Z",key=crypto.randomUUID();const branch=await db.branch.findUniqueOrThrow({where:{id:f.branchId},include:{organization:true}});
 const snapshot={version:1,branchName:branch.name,organizationName:branch.organization.name,address:null,contactPhone:null,studentName:student.name,studentId:student.id,recordedBy:"Synthetic owner",recordedById:f.ownerId,collectedAt,amount:300,method:"CASH",reference:"",note:"",remainingBalance:700,allocations:[{paymentId:fee.id,type:"MONTHLY",periodStart:fee.periodStart.toISOString(),periodEnd:fee.periodEnd.toISOString(),amount:300,remaining:700}]};
 const receipt=await db.$transaction(async tx=>{const row=await tx.feeCollection.create({data:{branchId:f.branchId,studentId:student.id,actorId:f.ownerId,amount:300,method:"CASH",idempotencyKey:key,requestHash:key,receiptNumber:"LL-2026-"+key.toUpperCase(),collectedAt:new Date(collectedAt),snapshot}});await tx.feeCollectionAllocation.create({data:{collectionId:row.id,paymentId:fee.id,studentId:student.id,branchId:f.branchId,amount:300}});await tx.payment.update({where:{id:fee.id},data:{ledgerBacked:true,collectedAmount:300}});await tx.auditLog.create({data:{branchId:f.branchId,userId:f.ownerId,paymentId:fee.id,action:"FEE_COLLECTED",details:{collectionId:row.id,amount:300,remaining:700,fixture:true}}});return row;});
 const {receiptCollectedAt,receiptPeriodDate}=await import("../../lib/feeReceiptDates");const dates=[receiptCollectedAt(collectedAt),receiptPeriodDate(snapshot.allocations[0].periodStart),receiptPeriodDate(snapshot.allocations[0].periodEnd)];
 for(const timezone of ["Asia/Kolkata","UTC","America/Los_Angeles"]){await db.user.update({where:{id:f.ownerId},data:{timezone}});await page.goto(root+"/students/"+student.id);await page.reload();await expect(page.locator(".bp-history")).toContainText(dates[0]);await page.getByRole("button",{name:/View receipt/}).click();const dialog=page.getByRole("dialog",{name:"Fee receipt",exact:true});for(const value of dates)await expect(dialog).toContainText(value);
  const downloaded=page.waitForEvent("download");await dialog.getByRole("button",{name:"Download PDF",exact:true}).click();const file=await downloaded;expect(file.suggestedFilename()).toBe(receipt.receiptNumber+".pdf");expect(await file.failure()).toBeNull();const drawn=await page.evaluate(()=>(window as unknown as {receiptDrawnText:string[]}).receiptDrawnText.join("\n"));for(const date of dates)expect(drawn).toContain(date);if(timezone==="UTC")await shot(page,"receipt-india-utc");await dialog.getByRole("button",{name:"Done",exact:true}).click();
 }
 const voidResponse=await page.request.patch("/api/branches/"+f.branchId+"/collections/"+receipt.id,{data:{reason:"Wrong collection review fixture"}});expect(voidResponse.status()).toBe(200);await page.reload();await expect(page.locator(".bp-history")).toContainText("Voided");await expect(page.locator(".bp-history")).toContainText(dates[0]);await page.getByRole("button",{name:/View receipt/}).click();const voided=page.getByRole("dialog",{name:"Voided receipt",exact:true});await expect(voided).toContainText("Wrong collection review fixture");for(const date of dates)await expect(voided).toContainText(date);await shot(page,"receipt-india-voided");expect(await db.payment.findUniqueOrThrow({where:{id:fee.id}})).toMatchObject({amount:1000,collectedAmount:0,status:"DUE"});await db.user.update({where:{id:f.ownerId},data:{timezone:"Asia/Kolkata"}});
});
