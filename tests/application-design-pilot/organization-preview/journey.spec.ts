import {test,expect,type Page} from "@playwright/test";
const org="/org/org-pilot?journey=org&case=future-mixed";
const route=(path:string,extra="")=>path+"?journey=org"+(extra.includes("&case=")?extra:"&case=future-mixed"+extra);
const link=(page:Page,name:string)=>page.getByRole("link",{name,exact:true}).filter({visible:true}).last();
async function switchBranch(page:Page,id:string){await page.getByRole("combobox",{name:"Switch branch",exact:true}).selectOption(id);await expect(page.locator("[data-preview-branch]")).toHaveAttribute("data-preview-branch",id);}
test.beforeEach(async({page})=>{await page.route(/https?:\/\/(?!127\.0\.0\.1:4187)/,route=>route.abort());});
test("future-only mixed simulation: Basic operations → Standard → Pro → Billing → correct return",async({page})=>{
 const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto(org);await page.getByTestId("branch-card-pilot").getByRole("link",{name:"Open branch"}).click();
 await link(page,"Students").click();await page.getByRole("button",{name:"Add student",exact:true}).click();
 await page.getByLabel("Student name",{exact:true}).fill("New Basic Student");await page.getByLabel("Mobile number").fill("9876501256");await page.getByRole("spinbutton",{name:/^Monthly fee/}).fill("900");await page.getByRole("button",{name:"Save & choose seat"}).click();
 await page.getByRole("button",{name:"Seat 30, available",exact:true}).click();await page.getByRole("button",{name:"Assign seat",exact:true}).click();await page.getByRole("button",{name:"Record fee payment"}).click();
 await page.getByLabel("Amount received").fill("300");await page.getByRole("dialog").getByRole("button",{name:"Record payment",exact:true}).click();await expect(page.getByRole("dialog")).toContainText("₹600");await page.getByRole("button",{name:"Done",exact:true}).click();
 await link(page,"Fees").click();await expect(page.getByRole("heading",{name:"Student fees"})).toBeVisible();await link(page,"Back to organization").click();
 await page.getByTestId("branch-card-central").getByRole("link",{name:"Open branch"}).click();await switchBranch(page,"riverside");await page.getByRole("link",{name:"Manage plan →",exact:true}).click();
 await expect(page.getByRole("combobox",{name:"Manage plan for"})).toHaveValue("riverside");await expect(page.getByRole("heading",{name:"Riverside Reading Room",exact:true})).toBeVisible();
 await page.getByRole("link",{name:"Return to workspace",exact:true}).click();await expect(page).toHaveURL(/branch\/riverside\?/);expect(errors).toEqual([]);
});
test("repeated switches keep records, plans, styling, refresh and history together",async({page})=>{
 await page.goto(route("/branch/pilot/students"));await expect(page.getByText("Aarav Mehta",{exact:true}).filter({visible:true})).toBeVisible();
 for(let n=0;n<2;n++){await switchBranch(page,"central");await expect(page.getByText("Kavya Sen",{exact:true}).filter({visible:true})).toBeVisible();await expect(page.getByText("Aarav Mehta",{exact:true}).filter({visible:true})).toHaveCount(0);await expect(page.locator(".bp-prototype")).toHaveCount(0);await switchBranch(page,"riverside");await expect(page.getByText("Zoya Khan",{exact:true}).filter({visible:true})).toBeVisible();await switchBranch(page,"pilot");await expect(page.getByText("Aarav Mehta",{exact:true}).filter({visible:true})).toBeVisible();}
 await page.goBack();await expect(page.getByText("Zoya Khan",{exact:true}).filter({visible:true})).toBeVisible();await page.goForward();await expect(page.getByText("Aarav Mehta",{exact:true}).filter({visible:true})).toBeVisible();await page.reload();await expect(page.getByTestId("branch-plan-context")).toContainText("Basic");
});
test("one simulated plan change keeps siblings and operational records intact",async({page})=>{
 await page.goto(route("/org/org-pilot/billing","&branchId=pilot&returnTo=%2Fbranch%2Fpilot%2Fstudents"));
 await page.locator(".op-plan-card").filter({has:page.getByRole("heading",{name:"Pro",exact:true})}).getByRole("button",{name:"Choose plan"}).click();await expect(page.getByRole("dialog")).toContainText("Saraswati Library");await page.getByRole("button",{name:"Confirm",exact:true}).click();
 await expect(page.locator(".op-scheduled")).toContainText("Pro");await expect(page.getByTestId("branch-plan-context")).toContainText("Feature access: Basic");await page.getByRole("button",{name:"Preview effective date"}).click();await page.getByRole("link",{name:"Return to workspace",exact:true}).click();
 await expect(page.getByText("Aarav Mehta",{exact:true}).filter({visible:true})).toBeVisible();await expect(page.locator(".bp-prototype")).toHaveCount(0);await link(page,"Back to organization").click();await expect(page.getByTestId("branch-card-pilot")).toContainText("Pro");await expect(page.getByTestId("branch-card-central")).toContainText("Standard");await page.reload();await expect(page.getByTestId("branch-card-pilot")).toContainText("Pro");
});
test("trial, grant, scheduled and expired access labels",async({page})=>{
 for(const [scenario,plan,label] of [["trial","Standard","Trial until"],["grant","Pro","Temporary access until"],["scheduled","Basic","Scheduled"]]){await page.goto(route("/branch/pilot","&case="+scenario));await expect(page.getByTestId("branch-plan-context")).toContainText("Organization plan: Basic");await expect(page.getByTestId("branch-plan-context")).toContainText("Feature access: "+plan);await expect(page.getByTestId("branch-plan-context")).toContainText(label);}
 await page.goto(route("/branch/pilot/students","&case=expired"));await expect(page.getByTestId("branch-plan-context")).toContainText("Read-only");await expect(page.getByRole("button",{name:"Add student",exact:true})).toBeDisabled();await expect(page.getByRole("status")).toContainText("read-only");
});
test("staff only sees permitted branches and actions",async({page})=>{
 await page.goto(route("/branch/pilot/students","&role=staff"));await expect(page.getByRole("combobox",{name:"Switch branch"}).locator("option")).toHaveCount(2);await expect(page.getByRole("link",{name:"Manage plan →"})).toHaveCount(0);await expect(page.getByRole("link",{name:"Back to organization"})).toHaveCount(0);await expect(page.locator(".bp-fee-status")).toHaveCount(0);await switchBranch(page,"central");await expect(page.getByText("Kavya Sen",{exact:true}).filter({visible:true})).toBeVisible();
 for(const path of ["/branch/riverside","/org/org-pilot/billing"]){await page.goto(route(path,"&role=staff"));await expect(page.getByRole("heading",{name:"Branch unavailable"})).toBeVisible();await expect(page.locator("[data-preview-branch]")).toHaveCount(0);}
});
test("unsaved form protects browser Back",async({page})=>{
 await page.goto(org);await page.getByTestId("branch-card-pilot").getByRole("link",{name:"Open branch"}).click();await link(page,"Students").click();await page.getByRole("button",{name:"Add student",exact:true}).click();await page.getByLabel("Student name",{exact:true}).fill("Unsubmitted Draft");
 page.once("dialog",dialog=>dialog.dismiss());await page.goBack();await expect(page.getByLabel("Student name",{exact:true})).toHaveValue("Unsubmitted Draft");await expect(page).toHaveURL(/\/students/);
 page.once("dialog",dialog=>dialog.accept());await page.goBack();await expect(page.getByRole("heading",{name:"Your library overview"})).toBeVisible();
});
test("slow reads and pending payment stay scoped",async({page})=>{
 await page.goto(route("/branch/central/students","&case=slow"));await switchBranch(page,"riverside");await expect(page.getByText("Zoya Khan",{exact:true}).filter({visible:true})).toBeVisible();await page.waitForTimeout(1800);await expect(page.getByText("Kavya Sen",{exact:true})).toHaveCount(0);
 await page.goto(route("/branch/pilot","&case=slow"));await link(page,"Fees").click();await page.locator(".bp-fee-row").filter({hasText:"Priya Sharma"}).getByRole("button",{name:"Record payment"}).click();await page.getByLabel("Amount received").fill("200");await page.getByRole("dialog").getByRole("button",{name:"Record payment",exact:true}).click();await expect(page.getByRole("button",{name:"Recording…"})).toBeDisabled();page.once("dialog",dialog=>{expect(dialog.message()).toContain("still being recorded");return dialog.accept();});await page.goBack();await expect(page).toHaveURL(/branch\/pilot\/fees/);await expect(page.getByRole("dialog")).toContainText("₹400");await page.getByRole("button",{name:"Done",exact:true}).click();await switchBranch(page,"central");await expect(page.getByTestId("branch-plan-context")).toContainText("Basic");await switchBranch(page,"pilot");await expect(page.locator(".bp-fee-row").filter({hasText:"Priya Sharma"})).toContainText("₹400");
});
test("single, empty, loading, error and unavailable routes recover",async({page})=>{
 await page.goto(route("/branch/pilot","&case=single"));await expect(page.getByRole("combobox",{name:"Switch branch"}).locator("option")).toHaveCount(1);
 await page.goto(route("/org/org-pilot","&case=empty"));await expect(page.getByRole("heading",{name:"No branches yet"})).toBeVisible();await page.getByRole("button",{name:"Add a sample branch"}).click();await expect(page.getByTestId("branch-card-pilot")).toBeVisible();
 await page.goto(route("/branch/pilot","&case=loading"));await expect(page.getByRole("heading",{name:"Loading workspaces"})).toBeVisible();await expect(page.getByRole("heading",{name:"Your library overview"})).toBeVisible();
 await page.goto(route("/branch/pilot","&case=error"));await expect(page.getByRole("heading",{name:"Workspaces unavailable"})).toBeVisible();await page.getByRole("button",{name:"Retry",exact:true}).click();await expect(page.getByRole("heading",{name:"Your library overview"})).toBeVisible();
 await page.goto(route("/branch/not-permitted"));await expect(page.getByRole("heading",{name:"Branch unavailable"})).toBeVisible();await link(page,"Back to organization").click();await expect(page.getByTestId("branch-card-pilot")).toBeVisible();
});
test("Hindi and Hinglish forms and navigation fit narrow screens",async({page})=>{
 for(const [lang,students,add] of [["hi","विद्यार्थी","विद्यार्थी जोड़ें"],["hinglish","Students","Student jodein"]]){await page.goto(route("/branch/pilot/students","&lang="+lang));await expect(page.getByRole("link",{name:students,exact:true}).filter({visible:true})).toBeVisible();await page.getByRole("button",{name:add,exact:true}).click();await expect(page.getByRole("dialog")).toBeVisible();await page.getByRole("button",{name:lang==="hi"?"बंद करें":"Band karein",exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);}
 await page.goto(route("/branch/central/students"));await page.getByRole("combobox",{name:"Interface language",exact:true}).selectOption("hi");await expect(page.locator("html")).toHaveAttribute("lang","hi-IN");await page.getByRole("combobox",{name:"Interface language",exact:true}).selectOption("en");await expect(page.locator("html")).toHaveAttribute("lang","en-IN");
});

test("secondary navigation, plain links and identity stay scoped",async({page})=>{
 await page.goto(route("/branch/pilot"));
 const header=await page.locator(".bp-topbar").boundingBox(),context=await page.getByTestId("branch-plan-context").boundingBox();expect(context!.y).toBeGreaterThanOrEqual(header!.y+header!.height);
 await link(page,"Library setup").click();
 await page.getByRole("textbox",{name:"Library name",exact:true}).fill("Updated sample library");
 await page.getByRole("button",{name:"Save setup",exact:true}).click();
 await expect(page.getByRole("combobox",{name:"Switch branch",exact:true})).toContainText("Updated sample library");
 await page.goto(route("/branch/pilot","&identity=second-account"));
 await expect(page.getByRole("combobox",{name:"Switch branch",exact:true})).toContainText("Saraswati Library");
 await page.goto(route("/branch/pilot/subscription","&identity=second-account"));
 await expect(page).toHaveURL(/org\/org-pilot\/billing/);
 await expect(page.getByRole("combobox",{name:"Manage plan for"})).toHaveValue("pilot");
 await page.goto(route("/branch/central","&identity=second-account"));
 await page.getByRole("link",{name:"Mark attendance",exact:true}).click();
 await expect(page).toHaveURL(/journey=org/);
 await expect(page).toHaveURL(/identity=second-account/);
 await switchBranch(page,"pilot");
 await expect(page.getByRole("heading",{name:"Your library overview"})).toBeVisible();
});


test("account keeps branch context without organization navigation", async ({page}) => {
 await page.goto(route("/branch/pilot/students"));
 await page.locator(".bp-profile").click();
 await expect(page.getByRole("heading", {name:"Personal account",exact:true})).toBeVisible();
 await expect(page.locator(".op-org-sidebar")).toHaveCount(0);
 await expect(page.getByRole("combobox", {name:"Switch branch",exact:true})).toHaveCount(0);
 await page.getByTestId("account-return").click();
 await expect(page).toHaveURL(/\/branch\/pilot\/students\?/);
 await switchBranch(page,"central");
 await page.getByRole("link", {name:"Account settings",exact:true}).click();
 await expect(page.getByTestId("account-return")).toHaveAttribute("href",/\/branch\/central\/students\?/);
 await page.getByTestId("account-return").click();
 await expect(page.getByText("Kavya Sen", {exact:true}).filter({visible:true})).toBeVisible();
 await page.goto(route("/account","&role=staff&returnTo=%2Fbranch%2Friverside%2Fstudents"));
 await expect(page.getByTestId("account-return")).toHaveAttribute("href",/\/branch\/pilot\?/);
});


test("restored dashboard previews use the selected branch records", async ({page}) => {
 await page.goto(route("/branch/central"));
 const previews = page.getByRole("region", {name:"Branch work previews",exact:true});
 await expect(previews.getByRole("heading", {name:"New enrollments",exact:true})).toBeVisible();
 await expect(previews.getByRole("link", {name:"Kavya Sen",exact:true})).toHaveAttribute("href", /branch\/central\/students\?studentId=central-/);
 await expect(previews.getByText("No overdue payments returned", {exact:true})).toBeVisible();
 await switchBranch(page,"riverside");
 await expect(previews.getByRole("link", {name:"Zoya Khan",exact:true})).toHaveAttribute("href", /branch\/riverside\/students\?studentId=riverside-/);
 await expect(previews.getByRole("link", {name:"Kavya Sen",exact:true})).toHaveCount(0);
 await expect(previews.getByText("No overdue payments returned", {exact:true})).toBeVisible();
 await expect(previews.getByText("Recent student records could not be refreshed.", {exact:true})).toHaveCount(0);
 await expect(previews.getByText("Something went wrong", {exact:true})).toHaveCount(0);
});

test("current product defaults to one Basic organization plan and applies changes to every branch",async({page})=>{
 await page.goto("/org/org-pilot?journey=org");
 await expect(page.getByLabel("Preview scenario")).toHaveValue("basic");
 for(const id of ["pilot","central","riverside"])await expect(page.getByTestId("branch-card-"+id)).toContainText("Basic");
 await page.goto("/org/org-pilot/billing?journey=org");
 await expect(page.getByRole("combobox",{name:"Manage plan for"})).toHaveCount(0);
 await expect(page.locator(".op-simulation").filter({hasText:"One organization plan applies to every branch. Prices are per active branch."})).toBeVisible();
 await page.locator(".op-plan-card").filter({has:page.getByRole("heading",{name:"Pro",exact:true})}).getByRole("button",{name:"Choose plan"}).click();
 await expect(page.getByRole("dialog")).toContainText("This plan change applies to every branch in the organization.");
 await page.getByRole("button",{name:"Confirm",exact:true}).click();
 await page.getByRole("button",{name:"Preview effective date"}).click();
 await page.goto("/org/org-pilot?journey=org");
 for(const id of ["pilot","central","riverside"])await expect(page.getByTestId("branch-card-"+id)).toContainText("Pro");
});
test("isolated Standard and Pro organization scenarios share access across branches",async({page})=>{
 for(const plan of ["standard","pro"]){
  await page.goto("/org/org-pilot?journey=org&case="+plan);
  for(const id of ["pilot","central","riverside"])await expect(page.getByTestId("branch-card-"+id)).toContainText(plan==="standard"?"Standard":"Pro");
 }
});
