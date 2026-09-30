import type { Prisma } from "@/app/generated/prisma/client";
import {
  createWhatsAppReportSourceFingerprint,
  hashWhatsAppReportMetrics,
  WHATSAPP_REPORT_METRICS_VERSION,
} from "@/lib/whatsappReportMetrics";
import { WhatsAppReportService } from "@/services/whatsappReport.service";
import { createBranch, createOrg, createSaasSubscription, createStaff, createUser } from "@/tests/factories";
import { disconnectDatabase, resetDatabase, testPrisma } from "@/tests/setup/db";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

const NOW = new Date("2026-09-30T15:30:00.000Z");
const REPORT_ENV = {
  NODE_ENV: "test",
  VERCEL_ENV: "preview",
  META_WHATSAPP_MODE: "TEST",
  WHATSAPP_INTEGRATION_ENABLED: "true",
  WHATSAPP_REPORTS_ENABLED: "true",
} as const;

describe("WhatsApp report-only pause and persisted history", () => {
  beforeEach(resetDatabase);
  afterAll(disconnectDatabase);

  it("cancels only the actor's unsubmitted reports and preserves other work and submitted history", async () => {
    const owner = await createUser({ id: "report-pause-owner" });
    const otherRecipient = await createUser({ id: "report-pause-other-recipient" });
    const organization = await createOrg({
      id: "report-pause-organization",
      ownerId: owner.id,
      name: "Report Pause Organization",
    });
    await createSaasSubscription({ organizationId: organization.id, plan: "PRO" });
    const branch = await createBranch({
      id: "report-pause-branch",
      organizationId: organization.id,
      name: "Report Pause Branch",
    });
    await createStaff({ userId: otherRecipient.id, branchId: branch.id, role: "MANAGER" });
    const sender = await testPrisma.whatsAppSender.create({
      data: {
        id: "report-pause-sender",
        organizationId: organization.id,
        provider: "META_CLOUD",
        providerMode: "TEST",
        wabaId: "report-pause-waba",
        phoneNumberId: "report-pause-phone",
        displayPhoneNumber: "+91 90000 00000",
        status: "ACTIVE",
      },
    });
    await testPrisma.branchWhatsAppSettings.create({
      data: {
        branchId: branch.id,
        organizationId: organization.id,
        senderId: sender.id,
        enabled: true,
        automationEnabledAt: NOW,
        automationEnabledByUserId: owner.id,
      },
    });

    const actorPhone = "+919876543210";
    const otherPhone = "+919876543211";
    async function subscription(userId: string, phoneE164: string) {
      const consent = await testPrisma.whatsAppConsent.create({
        data: {
          senderId: sender.id,
          phoneE164,
          consentType: "OWNER_REPORT",
          status: "OPTED_IN",
          source: "OWNER_CONFIGURATION",
          policyVersion: "owner-report-v1",
          grantedAt: NOW,
          recordedByUserId: userId,
        },
      });
      return testPrisma.whatsAppReportSubscription.create({
        data: {
          organizationId: organization.id,
          branchId: branch.id,
          scope: "BRANCH",
          scopeKey: branch.id,
          senderId: sender.id,
          userId,
          consentId: consent.id,
          phoneE164,
          language: "en_IN",
          status: "ACTIVE",
          activatedAt: NOW,
        },
      });
    }
    const actorSubscription = await subscription(owner.id, actorPhone);
    const otherSubscription = await subscription(otherRecipient.id, otherPhone);
    const metrics = {
      branchName: branch.name,
      localReportDate: "2026-09-30",
      metricsAsOfAt: NOW.toISOString(),
      asOfLocalTime: "21:00",
      paymentsRecordedTodayCount: 0,
      paymentsRecordedTodayAmount: 0,
      newStudentsToday: 0,
      activeStudents: 0,
      usedShiftSlots: 0,
      totalShiftCapacity: 0,
      openDueCount: 0,
      openDueAmount: 0,
      overdueCount: 0,
      overdueAmount: 0,
      whatsAppAcceptedToday: 0,
      whatsAppDeliveredToday: 0,
      whatsAppFailedToday: 0,
      whatsAppUnknownToday: 0,
    };
    const reportSourceFingerprint = createWhatsAppReportSourceFingerprint({
      scope: "BRANCH",
      scopeKey: branch.id,
      localReportDate: metrics.localReportDate,
      scheduledCutoffAt: NOW,
      metricsAsOfAt: NOW,
    });
    const snapshot = await testPrisma.whatsAppDailyReportSnapshot.create({
      data: {
        organizationId: organization.id,
        branchId: branch.id,
        scope: "BRANCH",
        scopeKey: branch.id,
        localReportDate: "2026-09-30",
        timeZone: "Asia/Kolkata",
        scheduledCutoffAt: NOW,
        metricsAsOfAt: NOW,
        generatedAt: NOW,
        metricsVersion: WHATSAPP_REPORT_METRICS_VERSION,
        metrics,
        metricsHash: hashWhatsAppReportMetrics(metrics),
        sourceFingerprint: reportSourceFingerprint,
      },
    });
    const notice = await testPrisma.whatsAppServiceNotice.create({
      data: {
        organizationId: organization.id,
        branchId: branch.id,
        senderId: sender.id,
        actorUserId: owner.id,
        idempotencyKey: "report-pause-notice-key",
        requestHash: "report-pause-notice-hash",
        type: "BRANCH_CLOSED",
        reason: "MAINTENANCE",
        localEffectiveDate: "2026-10-01",
        scheduledFor: NOW,
        status: "QUEUED",
      },
    });

    const baseMessage = (id: string, phone: string): Prisma.WhatsAppMessageCreateManyInput => ({
      id,
      organizationId: organization.id,
      branchId: branch.id,
      senderId: sender.id,
      recipientPhoneE164: phone,
      purpose: "DAILY_BRANCH_REPORT",
      trigger: "MANUAL",
      templateVariables: {},
      scheduledFor: NOW,
      availableAt: NOW,
      dedupeKey: id,
      sourceFingerprint: reportSourceFingerprint,
      budgetMonth: "2026-09",
      budgetState: "RESERVED",
      estimatedCostMicros: 800_000n,
    });
    await testPrisma.whatsAppMessage.createMany({
      data: [
        {
          ...baseMessage("actor-scheduled-report", actorPhone),
          reportSubscriptionId: actorSubscription.id,
          dailyReportSnapshotId: snapshot.id,
          status: "SCHEDULED",
        },
        {
          ...baseMessage("actor-claimed-report", actorPhone),
          reportSubscriptionId: actorSubscription.id,
          dailyReportSnapshotId: snapshot.id,
          status: "CLAIMED",
          claimedAt: NOW,
          leaseToken: "report-pause-claim",
          leaseUntil: new Date(NOW.getTime() + 60_000),
          submissionStartedAt: null,
        },
        {
          ...baseMessage("actor-delivered-report", actorPhone),
          reportSubscriptionId: actorSubscription.id,
          dailyReportSnapshotId: snapshot.id,
          status: "DELIVERED",
          budgetState: "COMMITTED",
          providerMessageId: "wamid.report.pause.delivered",
          submissionStartedAt: NOW,
          acceptedAt: NOW,
          deliveredAt: NOW,
          renderedPreview: "private report contents",
        },
        {
          ...baseMessage("other-recipient-report", otherPhone),
          reportSubscriptionId: otherSubscription.id,
          dailyReportSnapshotId: snapshot.id,
          status: "SCHEDULED",
        },
        {
          ...baseMessage("queued-reminder", actorPhone),
          purpose: "FEE_RENEWAL",
          trigger: "AUTOMATION",
          automationStage: "FEE_DUE_TODAY",
          status: "SCHEDULED",
          reportSubscriptionId: null,
          dailyReportSnapshotId: null,
          sourceFingerprint: "queued-reminder-source",
        },
        {
          ...baseMessage("queued-notice", actorPhone),
          purpose: "SERVICE_NOTICE",
          status: "SCHEDULED",
          reportSubscriptionId: null,
          dailyReportSnapshotId: null,
          serviceNoticeId: notice.id,
          sourceFingerprint: "queued-notice-source",
        },
      ],
    });

    const beforeOtherWork = await testPrisma.whatsAppMessage.findMany({
      where: { id: { in: ["other-recipient-report", "queued-reminder", "queued-notice", "actor-delivered-report"] } },
      orderBy: { id: "asc" },
    });
    const paused = await WhatsAppReportService.pauseSubscription({
      scope: "BRANCH",
      branchId: branch.id,
      actorUserId: owner.id,
      now: NOW,
      env: REPORT_ENV,
    });
    expect(paused).toMatchObject({ changed: true, cancelledMessages: 2, subscription: { status: "PAUSED" } });

    const changedReports = await testPrisma.whatsAppMessage.findMany({
      where: { id: { in: ["actor-scheduled-report", "actor-claimed-report"] } },
      orderBy: { id: "asc" },
    });
    expect(changedReports).toHaveLength(2);
    for (const message of changedReports) {
      expect(message).toMatchObject({
        status: "CANCELLED",
        budgetState: "RELEASED",
        failureCode: "REPORT_SUBSCRIPTION_PAUSED",
        cancelledAt: NOW,
        leaseToken: null,
        leaseUntil: null,
      });
    }
    expect(await testPrisma.whatsAppMessage.findMany({
      where: { id: { in: beforeOtherWork.map(message => message.id) } },
      orderBy: { id: "asc" },
    })).toEqual(beforeOtherWork);
    expect(await testPrisma.whatsAppReportSubscription.findUniqueOrThrow({
      where: { id: otherSubscription.id },
    })).toMatchObject({ status: "ACTIVE", pausedAt: null });
    expect(await testPrisma.whatsAppServiceNotice.findUniqueOrThrow({ where: { id: notice.id } }))
      .toMatchObject({ status: "QUEUED", cancelledAt: null });
    expect(await testPrisma.branchWhatsAppSettings.findUniqueOrThrow({ where: { branchId: branch.id } }))
      .toMatchObject({ enabled: true, automationEnabledAt: NOW });

    const history = await WhatsAppReportService.listRecentHistory({
      scope: "BRANCH",
      branchId: branch.id,
      actorUserId: owner.id,
      env: REPORT_ENV,
    });
    expect(new Set(history.reports.map(report => report.id))).toEqual(new Set([
      "actor-scheduled-report", "actor-claimed-report", "actor-delivered-report",
    ]));
    expect(history.reports.map(report => report.status).sort()).toEqual([
      "CANCELLED", "CANCELLED", "DELIVERED",
    ]);
    expect(history.reports.every(report => report.maskedPhone === "••••••3210")).toBe(true);
    expect(JSON.stringify(history)).not.toContain(actorPhone);
    expect(JSON.stringify(history)).not.toContain("private report contents");
    const otherHistory = await WhatsAppReportService.listRecentHistory({
      scope: "BRANCH",
      branchId: branch.id,
      actorUserId: otherRecipient.id,
      env: REPORT_ENV,
    });
    expect(otherHistory.reports.map(report => report.id)).toEqual(["other-recipient-report"]);

    const repeated = await WhatsAppReportService.pauseSubscription({
      scope: "BRANCH",
      branchId: branch.id,
      actorUserId: owner.id,
      now: new Date(NOW.getTime() + 60_000),
      env: REPORT_ENV,
    });
    expect(repeated).toMatchObject({ changed: false, cancelledMessages: 0 });
  });
});
