import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { createTestWorld, createBranch, createSeat, createSaasSubscription, createStudent, createPayment, createShift, createUser, createStaff } from "@/tests/factories";
import { resetDatabase, disconnectDatabase, testPrisma as db } from "@/tests/setup/db";
import { StaffService } from "@/services/staff.service";
import { StaffInviteService } from "@/services/staffInvite.service";
import { BillingExperienceService } from "@/services/billingExperience.service";
import { EntitlementService } from "@/services/entitlement.service";
import { StudentService } from "@/services/student.service";
import { SeatAllocationService } from "@/services/seatAllocation.service";
import { ShiftService } from "@/services/shift.service";
import { SeatService } from "@/services/seat.service";
import { FeeCollectionService } from "@/services/feeCollection.service";
import { DashboardService } from "@/services/dashboard.service";
import { workspacePresentation } from "@/lib/workspacePresentation";
import { StaffRole } from "@/types";
async function world(plan:"BASIC"|"STANDARD"|"PRO"="BASIC") {
    const f=await createTestWorld();
    await db.organization.update({where:{id:f.org.id},data:{billingModelVersion:"WORKSPACE_V2"}});
    const subscription=await createSaasSubscription({organizationId:f.org.id,plan});
    return {...f,subscription};
}
async function snapshot(f:Awaited<ReturnType<typeof world>>) {
    return {...await StaffService.getBranchAccess(f.user.id,f.branch.id),billingExperience:await BillingExperienceService.getForBranch(f.branch.id,f.user.id)};
}
describe("Basic workspace: shared production services on disposable PostgreSQL",()=>{
    beforeEach(resetDatabase);afterAll(disconnectDatabase);
    it.each([["BASIC","STANDARD"],["BASIC","PRO"],["STANDARD","BASIC"],["STANDARD","PRO"],["PRO","BASIC"],["PRO","STANDARD"]] as const)("%s to %s changes presentation without changing records",async(from,to)=>{
        const f=await world(from);const student=await createStudent({branchId:f.branch.id});const fee=await createPayment({branchId:f.branch.id,studentId:student.id,periodStart:new Date("2026-10-01T00:00:00Z"),periodEnd:new Date("2026-11-01T00:00:00Z"),dueDate:new Date("2026-10-01T00:00:00Z")});
        await db.organization.update({where:{id:f.org.id},data:{selectedPostTrialPlan:to}});
        expect(workspacePresentation(await snapshot(f))).toBe(from === "BASIC"?"simple":"full");
        // Install a distinct settled target snapshot using the existing exact-evidence
        // factory. Provider mutation/recovery is covered by the billing suite.
        await db.organizationSubscription.update({where:{id:f.subscription.id},data:{currentOrganizationId:null}});
        await createSaasSubscription({organizationId:f.org.id,plan:to});
        const access=await snapshot(f);
        expect(workspacePresentation(access)).toBe(to === "BASIC"?"simple":"full");
        expect(access.entitlements.includes("WHATSAPP_AUTOMATION")).toBe(to === "PRO");
        expect(access.entitlements.includes("ADVANCED_ANALYTICS")).toBe(to !== "BASIC");
        expect(await db.student.findUnique({where:{id:student.id}})).toMatchObject({branchId:f.branch.id,name:student.name});
        expect(await db.payment.findUnique({where:{id:fee.id}})).toMatchObject({amount:fee.amount,status:fee.status});
        expect(await db.shift.findUnique({where:{id:f.shift.id}})).toMatchObject({name:f.shift.name});
    });
    it("Basic admits and edits students, resolves overlapping seats, records partial fees idempotently and reports real totals",async()=>{
        const f=await world();
        const student=await StudentService.createStudent(f.user.id,f.branch.id,{name:"Local Basic Student",phone:"9876543210",monthlyFee:1000,admissionFee:1000});
        await StudentService.updateStudentProfile(f.user.id,student.id,{name:"Updated Basic Student"});
        await SeatAllocationService.assignSeatToShifts(f.user.id,f.seat.id,student.id,[f.shift.id]);
        const overlap=await createShift({branchId:f.branch.id,name:"Custom overlapping shift",startTime:"10:00",endTime:"14:00"});
        const map=await SeatService.getSeatMap(f.user.id,f.branch.id,overlap.id);
        expect(map.occupiedCount).toBe(1);expect(map.availableCount).toBe(0);
        const fee=await db.payment.findFirstOrThrow({where:{studentId:student.id,status:"DUE"}});
        const input={studentId:student.id,paymentIds:[fee.id],amount:300,method:"CASH" as const,reference:"",note:"",idempotencyKey:randomUUID()};
        const receipt=await FeeCollectionService.collect(f.user.id,f.branch.id,input);
        expect(await FeeCollectionService.collect(f.user.id,f.branch.id,input)).toEqual(receipt);
        const overview=await DashboardService.basicOverview(f.user.id,f.branch.id);
        expect(overview.money?.collectedThisMonth).toBe(300);expect(overview.activeStudents).toBe(1);
        await expect(DashboardService.overview(f.user.id,f.branch.id)).rejects.toThrow("Standard plan");
        const foreign=await createUser();await expect(SeatService.getSeatMap(foreign.id,f.branch.id,overlap.id)).rejects.toThrow();
        await expect(StudentService.updateStudentProfile(foreign.id,student.id,{name:"foreign"})).rejects.toThrow();
    });
    it("downgrade retains existing memberships under current core policy but blocks invitations and premium operations",async()=>{
        const f=await world("STANDARD");const staff=await createUser();await createStaff({branchId:f.branch.id,userId:staff.id});
        const invited=await createUser();const invite=await StaffInviteService.createInvite(f.user.id,f.branch.id,StaffRole.STAFF,invited.email);
        await db.organizationSubscription.update({where:{id:f.subscription.id},data:{currentOrganizationId:null}});
        await createSaasSubscription({organizationId:f.org.id,plan:"BASIC"});
        await expect(StaffService.authorize(staff.id,f.branch.id,"students")).resolves.toBe(true);
        await expect(StaffInviteService.acceptInvite(invited.id,invite.token)).rejects.toMatchObject({code:"SUBSCRIPTION_UPGRADE_REQUIRED"});
        expect(await db.staffInvite.findUnique({where:{id:invite.id}})).toMatchObject({acceptedAt:null});
        await expect(StaffService.listStaff(f.user.id,f.branch.id)).rejects.toThrow();
        await expect(EntitlementService.assertOrganizationEntitlement(f.org.id,"AI_ACCESS")).rejects.toThrow();
    });
    it("unpaid confirmation cannot make Basic writable and server rechecks an already-open form",async()=>{
        const f=await world();const student=await createStudent({branchId:f.branch.id});
        await db.organizationSubscription.update({where:{id:f.subscription.id},data:{status:"HALTED"}});
        expect((await snapshot(f)).billingExperience.accessMode).toBe("READ_ONLY");
        await expect(StudentService.updateStudentProfile(f.user.id,student.id,{name:"stale form"})).rejects.toThrow();
        expect((await db.student.findUniqueOrThrow({where:{id:student.id}})).name).toBe(student.name);
    });
});
import { AccessPolicy } from "@/services/accessPolicy.service";
import { ImportSessionService } from "@/importing/services/import-session.service";
import { PaymentService } from "@/services/payment.service";
import { NextRequest } from "next/server";
const session=vi.hoisted(()=>({user:null as {id:string}|null}));
vi.mock("@/lib/auth",()=>({getSessionUser:async()=>session.user}));
import { PATCH as studentRoute } from "@/app/api/branches/[branchId]/students/route";
import { GET as dashboardRoute } from "@/app/api/branches/[branchId]/dashboard/route";
import { GET as reportRoute } from "@/app/api/branches/[branchId]/reports/route";

describe("Basic's deliberately narrow server boundary",()=>{
 beforeEach(resetDatabase);afterAll(disconnectDatabase);
 it.each(["BASIC","STANDARD","PRO"] as const)("checks %s feature APIs independently of navigation",async plan=>{
  const f=await world(plan); session.user={id:f.user.id};
  const response=await dashboardRoute(new NextRequest("http://local/api/branches/"+f.branch.id+"/dashboard"),{params:Promise.resolve({branchId:f.branch.id})});
  expect(response.status).toBe(plan==="BASIC"?403:200);
  const report=await reportRoute(new Request("http://local/reports?kind=students&from=2026-10-01&through=2026-10-29"),{params:Promise.resolve({branchId:f.branch.id})});
  expect(report.status).toBe(plan==="BASIC"?403:200);
  for(const capability of ["attendanceView","attendanceRecord","attendanceCorrect","importView","importStudents","overdueView","fullWorkspace"] as const){
   const call=AccessPolicy.authorizeCapability(f.user.id,f.branch.id,capability);
   if(plan==="BASIC")await expect(call).rejects.toMatchObject({code:"SUBSCRIPTION_UPGRADE_REQUIRED"});else await expect(call).resolves.toMatchObject({branchId:f.branch.id});
  }
  const imports=ImportSessionService.listSessions(f.user.id,f.branch.id);
  if(plan==="BASIC")await expect(imports).rejects.toMatchObject({code:"SUBSCRIPTION_UPGRADE_REQUIRED"});else await expect(imports).resolves.toEqual([]);
  for(const capability of ["studentsManage","allocationsManage","paymentsRecord","paymentsGenerate","settingsManage"] as const)
   await expect(AccessPolicy.authorizeCapability(f.user.id,f.branch.id,capability)).resolves.toMatchObject({branchId:f.branch.id});
 });
 it("keeps two branches on the organization's trial and paid plan without mixing records",async()=>{
  const f=await world();const second=await createBranch({organizationId:f.org.id});const firstStudent=await createStudent({branchId:f.branch.id});
  await db.ownerTrialGrant.create({data:{ownerId:f.user.id,organizationId:f.org.id,source:"ONBOARDING",status:"ACTIVE",claimedAt:new Date(),trialStartedAt:new Date(),trialEndsAt:new Date(Date.now()+86400000)}});
  for(const branchId of [f.branch.id,second.id]) {
   expect((await BillingExperienceService.getForBranch(branchId,f.user.id)).effectivePlan).toBe("STANDARD_TRIAL");
   await expect(AccessPolicy.authorizeCapability(f.user.id,branchId,"attendanceView")).resolves.toBeDefined();
  }
  await db.ownerTrialGrant.update({where:{ownerId:f.user.id},data:{trialEndsAt:new Date(Date.now()-1000)}});
  for(const branchId of [f.branch.id,second.id])await expect(AccessPolicy.authorizeCapability(f.user.id,branchId,"attendanceView")).rejects.toThrow("Standard plan");
  expect(await db.student.count({where:{branchId:second.id}})).toBe(0);
  expect((await db.student.findUniqueOrThrow({where:{id:firstStudent.id}})).branchId).toBe(f.branch.id);
 });
 it("recovers an exact receipt after access expires, while refusing a new collection",async()=>{
  const f=await world();const student=await StudentService.createStudent(f.user.id,f.branch.id,{name:"Recovery Student",phone:"9876543210",monthlyFee:1000,admissionFee:1000});
  const fee=await db.payment.findFirstOrThrow({where:{studentId:student.id}});
  const input={studentId:student.id,paymentIds:[fee.id],amount:300,method:"CASH" as const,reference:"",note:"",idempotencyKey:randomUUID()};
  const receipt=await FeeCollectionService.collect(f.user.id,f.branch.id,input);
  await db.organizationSubscription.update({where:{id:f.subscription.id},data:{status:"HALTED"}});
  await expect(FeeCollectionService.recover(f.user.id,f.branch.id,input.idempotencyKey)).resolves.toMatchObject({id:receipt.id,amount:300});
  await expect(FeeCollectionService.collect(f.user.id,f.branch.id,{...input,idempotencyKey:randomUUID()})).rejects.toThrow();
  const staff=await createUser();await createStaff({userId:staff.id,branchId:f.branch.id});
  await expect(FeeCollectionService.recover(staff.id,f.branch.id,input.idempotencyKey)).resolves.toBeNull();
  const stranger=await createUser();await expect(FeeCollectionService.recover(stranger.id,f.branch.id,input.idempotencyKey)).rejects.toThrow("not found");
  expect(await db.feeCollection.count({where:{branchId:f.branch.id}})).toBe(1);
 });
 it("keeps allocation history when a lost move response is retried after another move",async()=>{
  const f=await world();const student=await createStudent({branchId:f.branch.id});
  const nextSeat=await createSeat({branchId:f.branch.id,label:"Custom C3"}),third=await createSeat({branchId:f.branch.id,label:"Roof 7"});
  const initial=await SeatAllocationService.assignSeatToShifts(f.user.id,f.seat.id,student.id,[f.shift.id]);
  const key=randomUUID(),command={branchId:f.branch.id,studentId:student.id,seatId:nextSeat.id,shiftIds:[f.shift.id],allocationIds:initial.map(a=>a.id)};
  const first=await SeatAllocationService.moveAllocation(f.user.id,key,command);
  await SeatAllocationService.moveAllocation(f.user.id,randomUUID(),{...command,seatId:third.id,allocationIds:first.allocations.map(a=>a.id)});
  const recovered=await SeatAllocationService.moveAllocation(f.user.id,key,command);
  expect(recovered).toMatchObject({replayed:true,current:false});expect(recovered.allocations).toHaveLength(1);expect(recovered.allocations[0].seatId).toBe(third.id);
  expect(await db.seatAllocation.count({where:{studentId:student.id}})).toBe(3);
 });
 it("binds a submitted student and allocation to the route's branch even for an owner of both",async()=>{
  const f=await world(),second=await createBranch({organizationId:f.org.id}),student=await createStudent({branchId:f.branch.id});
  await expect(StudentService.assertStudentInBranch(f.user.id,student.id,second.id)).rejects.toThrow("Student not found");
  await expect(SeatAllocationService.assignSeatToShifts(f.user.id,f.seat.id,student.id,[f.shift.id],undefined,second.id)).rejects.toThrow("Seat not found");
  await expect(ShiftService.updateShift(f.user.id,f.shift.id,{name:"Wrong branch"},undefined,second.id)).rejects.toThrow("Shift not found");
  expect(await db.seatAllocation.count({where:{studentId:student.id}})).toBe(0);
 });
 it("preserves later anniversary dues and partial or waived balances in Basic",async()=>{
  const f=await world();const student=await createStudent({branchId:f.branch.id,monthlyFee:1000,joinedAt:new Date("2026-01-15T12:00:00Z")});
  await PaymentService.generateDuePaymentsForBranch(f.user.id,f.branch.id,new Date("2026-04-20T12:00:00Z"));
  const fees=await db.payment.findMany({where:{studentId:student.id,type:"MONTHLY"},orderBy:{dueDate:"asc"}});
  expect(fees).toHaveLength(3);expect(fees.map(p=>p.dueDate.getDate())).toEqual([15,15,15]);
  const receipt=await FeeCollectionService.collect(f.user.id,f.branch.id,{studentId:student.id,paymentIds:[fees[0].id],amount:300,method:"UPI",reference:"",note:"",idempotencyKey:randomUUID()});
  await PaymentService.markPaymentAsWaived(f.user.id,fees[0].id);
  expect((await FeeCollectionService.get(f.user.id,f.branch.id,receipt.id)).amount).toBe(300);
  expect((await db.payment.findUniqueOrThrow({where:{id:fees[0].id}})).collectedAmount).toBe(300);
  expect(await db.payment.count({where:{studentId:student.id,status:"DUE"}})).toBe(2);
 });

 it("keeps a Basic seat race atomic and preserves all shifts when moving a bundle",async()=>{
  const f=await world(),a=await createStudent({branchId:f.branch.id}),b=await createStudent({branchId:f.branch.id});
  const results=await Promise.allSettled([a,b].map(s=>SeatAllocationService.assignSeatToShifts(f.user.id,f.seat.id,s.id,[f.shift.id])));
  expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);
  expect(await db.seatAllocation.count({where:{seatId:f.seat.id,endDate:null}})).toBe(1);
  const winner=await db.seatAllocation.findFirstOrThrow({where:{seatId:f.seat.id,endDate:null}});
  const evening=await createShift({branchId:f.branch.id,name:"Evening",startTime:"18:00",endTime:"23:00"});
  const bundle=await db.multiShift.create({data:{branchId:f.branch.id,name:"Morning and Evening",price:1500,components:{create:[{shiftId:f.shift.id},{shiftId:evening.id}]}}});
  const destination=await createSeat({branchId:f.branch.id,label:"Custom 27"});
  const moved=await SeatAllocationService.moveAllocation(f.user.id,randomUUID(),{branchId:f.branch.id,studentId:winner.studentId,seatId:destination.id,allocationIds:[winner.id],shiftIds:[f.shift.id,evening.id],multiShiftId:bundle.id});
  expect(moved.allocations).toHaveLength(2);expect(moved.allocations.every(row=>row.multiShiftId===bundle.id&&row.seatId===destination.id)).toBe(true);
  expect(await db.seatAllocation.count({where:{studentId:winner.studentId,endDate:{not:null}}})).toBe(1);
 });
 it("Basic inactivation keeps ledger evidence, ends a multi-shift bundle, and reactivation keeps anniversary rules",async()=>{
  const f=await world();const student=await createStudent({branchId:f.branch.id,monthlyFee:1000,joinedAt:new Date("2026-01-15T12:00:00Z")});
  const evening=await createShift({branchId:f.branch.id,name:"Evening",startTime:"18:00",endTime:"23:00"});
  const bundle=await db.multiShift.create({data:{branchId:f.branch.id,name:"Lifecycle bundle",price:1500,components:{create:[{shiftId:f.shift.id},{shiftId:evening.id}]}}});
  await SeatAllocationService.assignSeatToShifts(f.user.id,f.seat.id,student.id,[f.shift.id,evening.id],bundle.id);
  await PaymentService.generateDuePaymentsForBranch(f.user.id,f.branch.id,new Date("2026-04-20T12:00:00Z"));
  const fee=await db.payment.findFirstOrThrow({where:{studentId:student.id},orderBy:{dueDate:"asc"}});
  const receipt=await FeeCollectionService.collect(f.user.id,f.branch.id,{studentId:student.id,paymentIds:[fee.id],amount:300,method:"CASH",reference:"",note:"",idempotencyKey:randomUUID()});
  const beforeFees=await db.payment.findMany({where:{studentId:student.id},orderBy:{id:"asc"}});
  const beforeAllocations=await db.seatAllocation.findMany({where:{studentId:student.id},orderBy:{id:"asc"}});
  session.user={id:f.user.id};const change=async(status:"ACTIVE"|"INACTIVE")=>studentRoute(new NextRequest("http://local/students",{method:"PATCH",body:JSON.stringify({id:student.id,status,dueResolution:"KEEP"})}),{params:Promise.resolve({branchId:f.branch.id})});
  expect((await change("INACTIVE")).status).toBe(200);
  expect(await db.payment.findMany({where:{studentId:student.id},orderBy:{id:"asc"}})).toEqual(beforeFees);
  expect(await FeeCollectionService.get(f.user.id,f.branch.id,receipt.id)).toEqual(receipt);
  const ended=await db.seatAllocation.findMany({where:{studentId:student.id},orderBy:{id:"asc"}});expect(ended).toHaveLength(2);expect(ended.every(a=>a.endDate!==null&&a.multiShiftId===bundle.id)).toBe(true);expect(ended.map(a=>a.id)).toEqual(beforeAllocations.map(a=>a.id));
  await PaymentService.generateDuePaymentsForBranch(f.user.id,f.branch.id,new Date("2026-06-20T12:00:00Z"));expect(await db.payment.count({where:{studentId:student.id}})).toBe(3);
  expect((await change("ACTIVE")).status).toBe(200);expect(await db.student.findUniqueOrThrow({where:{id:student.id}})).toMatchObject({status:"ACTIVE",joinedAt:student.joinedAt,billingStartAt:student.billingStartAt});
  expect(await db.seatAllocation.findMany({where:{studentId:student.id},orderBy:{id:"asc"}})).toEqual(ended);
  await PaymentService.generateDuePaymentsForBranch(f.user.id,f.branch.id,new Date("2026-06-20T12:00:00Z"));
  const afterFees=await db.payment.findMany({where:{studentId:student.id}});expect(afterFees).toHaveLength(5);expect(afterFees.every(p=>p.dueDate.getUTCDate()===15)).toBe(true);expect(afterFees.find(p=>p.id===fee.id)).toMatchObject({collectedAmount:300,status:"DUE",amount:1000});
  expect(await FeeCollectionService.get(f.user.id,f.branch.id,receipt.id)).toEqual(receipt);expect(await db.feeCollection.count({where:{studentId:student.id}})).toBe(1);
 });
 it.each(["anonymous","stranger","denied staff","foreign branch","read only","archived"] as const)("Basic status rejects %s without changing the student or allocations",async scenario=>{
  const f=await world(),student=await createStudent({branchId:f.branch.id});await SeatAllocationService.assignSeatToShifts(f.user.id,f.seat.id,student.id,[f.shift.id]);session.user={id:f.user.id};let branchId=f.branch.id;
  if(scenario==="anonymous")session.user=null;
  if(scenario==="stranger")session.user=await createUser();
  if(scenario==="denied staff"){const user=await createUser(),staff=await createStaff({branchId:f.branch.id,userId:user.id});await db.staffPermissionOverride.create({data:{staffId:staff.id,action:"STUDENTS",allowed:false}});session.user=user;}
  if(scenario==="foreign branch")branchId=(await createBranch({organizationId:f.org.id})).id;
  if(scenario==="read only")await db.organizationSubscription.update({where:{id:f.subscription.id},data:{status:"HALTED"}});
  if(scenario==="archived")await db.branch.update({where:{id:f.branch.id},data:{billingStatus:"ARCHIVED",billingArchivedAt:new Date()}});
  const response=await studentRoute(new NextRequest("http://local/students",{method:"PATCH",body:JSON.stringify({id:student.id,status:"INACTIVE",dueResolution:"KEEP"})}),{params:Promise.resolve({branchId})});
  expect(response.status).toBeGreaterThanOrEqual(400);if(scenario==="foreign branch")expect(response.status).toBe(404);
  expect(await db.student.findUniqueOrThrow({where:{id:student.id}})).toMatchObject({status:"ACTIVE"});expect(await db.seatAllocation.count({where:{studentId:student.id,endDate:null}})).toBe(1);
 });

});
