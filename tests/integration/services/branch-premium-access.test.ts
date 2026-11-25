import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createAllocation, createBranch, createOrg, createPayment, createSaasSubscription, createSeat, createShift, createStaff, createStudent, createUser } from "@/tests/factories";
import { disconnectDatabase, resetDatabase, testPrisma as db } from "@/tests/setup/db";
import { FeeCollectionService } from "@/services/feeCollection.service";
import { getWhatsAppDailyReportMetrics } from "@/analytics/whatsapp-report.analytics";
import { whatsappLocalDateKey } from "@/lib/whatsappSchedule";
import { reportBranchScopeMatches } from "@/lib/whatsappReportMetrics";
import { EntitlementService } from "@/services/entitlement.service";
import { AccessPolicy } from "@/services/accessPolicy.service";
import { AnalyticsAccessService } from "@/services/analyticsAccess.service";
import { checkFinalBranchSendScope, lockBranchBillingForSend, reconcileBranchPremiumWork } from "@/services/branchPremiumWork.service";
import { guardPreparedWhatsAppSubmissionAgainstPauseInTransaction } from "@/services/whatsappDispatcher.service";

async function world() {
  const owner = await createUser();
  const organization = await createOrg({ownerId: owner.id, billingModelVersion: "BRANCH_V3"});
  const organizationId = organization.id;
  async function branch(plan: "BASIC" | "STANDARD" | "PRO") {
    const row = await createBranch({organizationId, name: plan});
    await db.branchBillingAgreement.create({data: {organizationId, branchId: row.id, selectedPlan: plan}});
    const subscription = await createSaasSubscription({organizationId, agreementBranchId: row.id, plan});
    await createStudent({branchId: row.id});
    return {id: row.id, subscription};
  }
  return {owner, organizationId, basic: await branch("BASIC"), standard: await branch("STANDARD"), pro: await branch("PRO")};
}

describe("branch feature admission", () => {
  beforeEach(resetDatabase);
  afterAll(disconnectDatabase);

  it("returns premium aggregates only for eligible branches, while existing Basic staff can use core imports", async () => {
    const {owner, organizationId, basic, standard, pro} = await world();
    const staff = await createUser();
    await db.staff.create({data:{userId:staff.id, branchId:basic.id, role:"MANAGER"}});
    await expect(AccessPolicy.authorizeCapability(staff.id, basic.id, "importStudents")).resolves.toMatchObject({branchId:basic.id});
    await expect(AccessPolicy.authorizeCapability(staff.id, basic.id, "staffManage")).rejects.toThrow();
    await expect(AccessPolicy.authorizeCapability(staff.id, pro.id, "importStudents")).rejects.toThrow("Branch not found");
    await expect(AccessPolicy.authorizeCapability(owner.id, standard.id, "whatsappSend")).rejects.toThrow("upgraded");
    await expect(AccessPolicy.authorizeCapability(owner.id, pro.id, "whatsappSend")).resolves.toMatchObject({branchId:pro.id});
    const report = await AnalyticsAccessService.organizationSnapshot(owner.id, organizationId);
    expect(report.organization.includedBranches.map(b => b.id).sort()).toEqual([standard.id, pro.id].sort());
    expect(report.organization.excludedBranches.map(b => b.id)).toEqual([basic.id]);
    expect(report.students.total).toBe(2);
    expect((await EntitlementService.getEligibleBranchScope(organizationId, "WHATSAPP_AUTOMATION")).included.map(b => b.id)).toEqual([pro.id]);
    const now = new Date();
    const metrics = await db.$transaction(tx => getWhatsAppDailyReportMetrics(tx, {
      scope:"ORGANIZATION", organizationId, metricsAsOfAt:now, scheduledCutoffAt:now,
      localReportDate:whatsappLocalDateKey(now, "Asia/Kolkata"),
    }), {isolationLevel:"RepeatableRead"});
    expect(metrics).toMatchObject({branchCount:1, activeStudents:1, branchScope:{included:[{id:pro.id}]}});
    await db.organizationSubscription.update({where:{id:pro.subscription.id},data:{status:"HALTED"}});
    await db.organizationSubscription.update({where:{id:standard.subscription.id},data:{currentAgreementBranchId:null}});
    await createSaasSubscription({organizationId, agreementBranchId:standard.id, plan:"PRO"});
    const current = await EntitlementService.getEligibleBranchScope(organizationId, "WHATSAPP_AUTOMATION");
    expect(current.included).toHaveLength(1);
    expect(reportBranchScopeMatches(metrics, current)).toBe(false);
  });

  it("retains fee balances, receipts, enrollment, allocations, and staff overrides across a Pro-to-Basic change", async () => {
    const {owner, organizationId, pro} = await world();
    const branchId = pro.id;
    const student = await db.student.findFirstOrThrow({where:{branchId}});
    const staff = await createUser();
    const member = await createStaff({branchId,userId:staff.id,role:"MANAGER"});
    await db.staffPermissionOverride.create({data:{staffId:member.id, action:"VIEW_PAYMENTS", allowed:true}});
    const startedAt = new Date("2026-07-03");
    await db.studentEnrollmentHistory.create({data:{branchId,studentId:student.id,startedAt,billingStartAt:startedAt}});
    const seat = await createSeat({branchId});
    const shift = await createShift({branchId});
    await createAllocation({studentId:student.id,seatId:seat.id,shiftId:shift.id,startDate:startedAt});
    const payment = await createPayment({branchId,studentId:student.id,dueDate:startedAt,periodStart:startedAt,periodEnd:new Date("2026-08-02"),amount:1200});
    await FeeCollectionService.collect(owner.id, branchId, {
      studentId:student.id, paymentIds:[payment.id], method:"CASH", amount:500,
      idempotencyKey:"partial-receipt", reference:"", note:"",
    });
    const snapshot = () => Promise.all([
      db.student.findMany({where:{branchId}}), db.payment.findMany({where:{branchId}}),
      db.feeCollection.findMany({where:{branchId},include:{allocations:true}}),
      db.studentEnrollmentHistory.findMany({where:{branchId}}), db.seatAllocation.findMany({where:{branchId}}),
      db.staff.findMany({where:{branchId},include:{permissionOverrides:true}}),
      db.seat.findMany({where:{branchId}}), db.shift.findMany({where:{branchId}}),
    ]);
    const records = await snapshot();
    const before = await EntitlementService.getBranchProfile(branchId);
    await db.organizationSubscription.update({where:{id:pro.subscription.id},data:{currentAgreementBranchId:null}});
    await createSaasSubscription({organizationId, agreementBranchId:branchId, plan:"BASIC"});
    await db.$transaction(async tx => {
      await lockBranchBillingForSend(tx, organizationId, branchId);
      await reconcileBranchPremiumWork(tx, organizationId, branchId, before);
    });
    await expect(AccessPolicy.authorizeCapability(staff.id,branchId,"paymentsView")).resolves.toMatchObject({staffId:member.id});
    await expect(AccessPolicy.authorizeCapability(owner.id,branchId,"staffManage")).rejects.toThrow("upgraded");
    expect(await snapshot()).toEqual(records);
  });

  it.each(["admission", "downgrade"] as const)("preserves provider admission ordering when %s acquires the agreement lock first", async first => {
    const {organizationId, pro} = await world();
    const sender = await db.whatsAppSender.create({data: {organizationId, provider:"META_CLOUD", providerMode: "TEST", wabaId:"waba", phoneNumberId:"test", displayPhoneNumber:"+919000000002", status:"ACTIVE"}});
    await db.whatsAppSenderSafetyState.create({data:{senderId:sender.id}});
    const message = await db.whatsAppMessage.create({data:{
      organizationId, branchId:pro.id, senderId:sender.id, recipientPhoneE164:"+919000000001",
      purpose:"MANUAL_REMINDER", trigger:"MANUAL", templateVariables:{}, scheduledFor:new Date(), availableAt:new Date(),
      dedupeKey:"test-message", sourceFingerprint:"test", status:"SUBMITTING", leaseToken:"test-lease",
      submissionStartedAt:new Date(), budgetState:"RESERVED",
    }});
    const sibling = await createBranch({organizationId, name:"Pro sibling"});
    await db.branchBillingAgreement.create({data:{branchId:sibling.id, organizationId, selectedPlan:"PRO"}});
    await createSaasSubscription({organizationId, agreementBranchId:sibling.id, plan:"PRO"});
    const queuedSibling = await db.whatsAppMessage.create({data:{
      organizationId, branchId:sibling.id, senderId:sender.id, recipientPhoneE164:"+919000000003",
      purpose:"MANUAL_REMINDER", trigger:"MANUAL", templateVariables:{}, scheduledFor:new Date(), availableAt:new Date(),
      dedupeKey:"untouched-sibling", sourceFingerprint:"sibling-fixture", status:"SCHEDULED", budgetState:"RESERVED",
    }});
    const input = {messageId:message.id, leaseToken:"test-lease", senderId:sender.id, organizationId, branchId:pro.id};
    const admit = async (wait: () => Promise<void>) => db.$transaction(async tx => {
      const scope = await checkFinalBranchSendScope(tx, input);
      await wait();
      if (scope !== "READY") return scope;
      return guardPreparedWhatsAppSubmissionAgainstPauseInTransaction({ ...input, tx, admittedAt:new Date() });
    });
    const downgrade = async (wait: () => Promise<void>) => db.$transaction(async tx => {
      await lockBranchBillingForSend(tx, organizationId, pro.id);
      const before = await EntitlementService.getBranchProfile(pro.id, tx);
      await wait();
      await tx.organizationSubscription.update({where:{id:pro.subscription.id},data:{status:"HALTED"}});
      await reconcileBranchPremiumWork(tx, organizationId, pro.id, before);
    });
    const acquired = Promise.withResolvers<void>();
    const proceed = Promise.withResolvers<void>();
    const pause = () => { acquired.resolve(); return proceed.promise; };
    const firstTransaction = first === "admission" ? admit(pause) : downgrade(pause);
    await acquired.promise;
    const secondTransaction = first === "admission" ? downgrade(async () => {}) : admit(async () => {});
    proceed.resolve();
    const results = await Promise.all([firstTransaction, secondTransaction]);
    const persisted = await db.whatsAppMessage.findUniqueOrThrow({where:{id:message.id}});
    expect(await db.whatsAppMessage.findUniqueOrThrow({where:{id:queuedSibling.id}})).toEqual(queuedSibling);
    expect(await EntitlementService.getBranchProfile(sibling.id)).toMatchObject({effectivePlan:"PRO",canWrite:true});
    if (first === "admission") {
      expect(results[0]).toBe("READY");
      expect(persisted.providerCallAdmittedAt).toBeInstanceOf(Date);
      expect(persisted.budgetState).toBe("RESERVED");
    } else {
      expect(results[1]).toBe("STALE");
      expect(persisted).toMatchObject({status:"SUPPRESSED", providerCallAdmittedAt:null, budgetState:"RELEASED"});
      const before = await EntitlementService.getBranchProfile(pro.id);
      await db.$transaction(async tx => {
        await lockBranchBillingForSend(tx, organizationId, pro.id);
        await tx.organizationSubscription.update({where:{id:pro.subscription.id},data:{status:"ACTIVE"}});
        await reconcileBranchPremiumWork(tx, organizationId, pro.id, before);
      });
      expect((await db.whatsAppMessage.findUniqueOrThrow({where:{id:message.id}})).status).toBe("SUPPRESSED");
    }
  });
});
