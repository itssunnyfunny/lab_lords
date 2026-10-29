import {readFileSync,writeFileSync} from "node:fs";
import {testPrisma as db} from "../setup/db";
import {createUser,createOrg,createBranch,createShift,createSeat,createStudent,createAllocation,createPayment,createSaasSubscription,createStaff} from "../factories";
function subject(file:string){const state=JSON.parse(readFileSync(file,"utf8"));const cookie=state.cookies.find((c:{name:string})=>c.name==="__session");const id=JSON.parse(Buffer.from(cookie.value.split(".")[1],"base64url").toString()).sub;if(!id?.startsWith("user_"))throw new Error("Saved development identity unavailable");return id as string;}
const proof=await db.$queryRawUnsafe<{name:string}[]>("SELECT current_database() AS name");
if(proof[0]?.name!=="lab_lords_dashboard_basic_integrated_browser_test"||await db.user.count())throw new Error("Seed requires the newly empty Basic test database");
const owner=await createUser({name:"Amit Kumar",email:"basic-owner@example.invalid",clerkId:subject(".clerk/dashboard-owner-auth.json")});
const staff=await createUser({name:"Meera",email:"basic-staff@example.invalid"});
const outsider=await createUser({name:"Other owner",email:"other-owner@example.invalid"});
const org=await createOrg({ownerId:owner.id,name:"Shanti Learning Spaces",billingModelVersion:"WORKSPACE_V2"});
const foreignOrg=await createOrg({ownerId:outsider.id,name:"Other organization",billingModelVersion:"WORKSPACE_V2"});
const branch=await createBranch({organizationId:org.id,name:"Saraswati Library",defaultFee:1000,defaultAdmissionFee:500});
const other=await createBranch({organizationId:org.id,name:"Central Study Hall",defaultFee:900});
const foreign=await createBranch({organizationId:foreignOrg.id});
const subscription=await createSaasSubscription({organizationId:org.id,plan:"BASIC"});
await createStaff({branchId:branch.id,userId:staff.id});
const shifts=await Promise.all([["Morning","06:00","12:00"],["Afternoon","12:00","18:00"],["Evening","18:00","23:59"]].map(([name,startTime,endTime])=>createShift({branchId:branch.id,name,startTime,endTime})));
const seats=[];for(let i=1;i<=30;i++)seats.push(await createSeat({branchId:branch.id,label:String(i).padStart(2,"0")}));
const names=["Ananya Sharma","Rohan Verma","Kavya Singh","Arjun Patel","Meera Gupta","Vivek Kumar","Tara Shah","Neha Yadav","Aman Khan","Priya Sen","Kabir Das","Zoya Khan","Riya Bose","Ishaan Roy"];
for(let i=0;i<names.length;i++){
 const student=await createStudent({branchId:branch.id,name:names[i],monthlyFee:1000,joinedAt:new Date(Date.now()-40*86400000)});
 if(i<10)await createAllocation({studentId:student.id,seatId:seats[i].id,shiftId:shifts[i%3].id});
 await createPayment({branchId:branch.id,studentId:student.id,amount:1000,dueDate:new Date(Date.now()-2*86400000),periodStart:new Date(Date.now()-10*86400000),periodEnd:new Date(Date.now()+20*86400000)});
}
const otherShift=await createShift({branchId:other.id,name:"Full day",startTime:"00:00",endTime:"00:00"});
await createSeat({branchId:other.id,label:"Desk C3"});
writeFileSync(".clerk/basic-connected-fixture.json",JSON.stringify({databaseName:proof[0].name,ownerId:owner.id,staffId:staff.id,orgId:org.id,branchId:branch.id,otherBranchId:other.id,foreignBranchId:foreign.id,subscriptionId:subscription.id,shiftIds:shifts.map(s=>s.id),seatIds:seats.map(s=>s.id),otherShiftId:otherShift.id},null,2));
console.log("Synthetic Basic fixture saved: one owned organization, two branches, 14 students; no provider calls.");
await db.$disconnect();
