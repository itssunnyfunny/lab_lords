import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MetaWhatsAppProviderClient } from "@/lib/metaWhatsApp";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  count: vi.fn(),
  start: vi.fn(),
  finish: vi.fn(),
  reconcileNotice: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {
  $transaction: mocks.transaction,
  whatsAppMessage: { count: mocks.count },
} }));
vi.mock("@/services/entitlement.service", () => ({ EntitlementService: {
  assertOrganizationEntitlement: vi.fn(),
  assertBranchWritable: vi.fn(),
} }));
vi.mock("@/services/whatsappJobRun.service", () => ({ WhatsAppJobRunService: {
  start: mocks.start, finish: mocks.finish,
} }));
vi.mock("@/services/whatsappServiceNotice.service", () => ({
  verifyWhatsAppServiceNoticeSource: vi.fn(),
  WhatsAppServiceNoticeService: { reconcileStatusInTransaction: mocks.reconcileNotice },
}));

import { WhatsAppDispatcherService } from "@/services/whatsappDispatcher.service";

const now = new Date("2026-08-23T10:00:00.000Z");
const env = {
  NODE_ENV: "test", META_WHATSAPP_MODE: "TEST",
  WHATSAPP_INTEGRATION_ENABLED: "true", WHATSAPP_META_MESSAGE_WRITES_ENABLED: "true",
};
const purposes = ["MANUAL_REMINDER", "SERVICE_NOTICE"] as const;

function fixture(
  purpose: typeof purposes[number] | "WELCOME" | "DAILY_BRANCH_REPORT",
  actor: string | null = "staff_1"
) {
  const branch = {
    id: "branch_1", name: "Test branch", organizationId: "org_1",
    organization: { id: "org_1", ownerId: "owner_1" },
  };
  const claimTx = {
    $queryRaw: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "message_1" }]),
    whatsAppMessage: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn().mockResolvedValue({ organizationId: "org_1" }),
    },
  };
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: "message_1", branchId: "branch_1" }]),
    branch: { findUnique: vi.fn().mockResolvedValue(branch) },
    staff: { findUnique: vi.fn().mockResolvedValue({
      id: "membership_1", role: "MANAGER", permissionOverrides: [],
    }) },
    branchWhatsAppSettings: { findFirst: vi.fn().mockResolvedValue({ enabled: true }) },
    whatsAppMessage: {
      findFirst: vi.fn().mockResolvedValue({
        id: "message_1", senderId: "sender_1", organizationId: "org_1",
        organization: branch.organization, branchId: branch.id, branch,
        createdByUserId: actor, purpose, trigger: "MANUAL", budgetState: "RESERVED",
        serviceNoticeId: purpose === "SERVICE_NOTICE" ? "notice_1" : null,
        // Positive authorization controls stop at the next independent sender check.
        sender: { organizationId: "org_1", status: "DISCONNECTED", providerMode: "TEST" },
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    whatsAppMessageEvent: { create: vi.fn().mockResolvedValue({}) },
  };
  mocks.transaction.mockImplementationOnce(async callback => callback(claimTx))
    .mockImplementationOnce(async callback => callback(tx));
  const send = vi.fn();
  const run = () => WhatsAppDispatcherService.run({
    now, env, provider: { sendApprovedUtilityTemplate: send } as unknown as MetaWhatsAppProviderClient,
  });
  return { tx, send, run };
}

describe("queued WhatsApp creator authorization", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.start.mockResolvedValue({ created: true, run: { id: "job_1", status: "RUNNING" } });
    mocks.count.mockResolvedValue(0);
  });

  it.each(purposes)("suppresses %s after the creator loses branch membership", async purpose => {
    const { tx, send, run } = fixture(purpose);
    tx.staff.findUnique.mockResolvedValue(null as never);
    await expect(run()).resolves.toMatchObject({ messagesSuppressed: 1, messagesAccepted: 0 });
    expect(tx.staff.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_branchId: { userId: "staff_1", branchId: "branch_1" } },
    }));
    expect(tx.whatsAppMessage.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "SUPPRESSED", failureCode: "SOURCE_AUTHORIZATION_CHANGED", budgetState: "RELEASED",
      }),
    }));
    expect(send).not.toHaveBeenCalled();
    if (purpose === "SERVICE_NOTICE") expect(mocks.reconcileNotice).toHaveBeenCalledOnce();
  });

  it.each([
    ["MANUAL_REMINDER", "VIEW_PAYMENTS"], ["MANUAL_REMINDER", "VIEW_WHATSAPP"],
    ["MANUAL_REMINDER", "SEND_WHATSAPP"], ["SERVICE_NOTICE", "MANAGE_WHATSAPP"],
    ["SERVICE_NOTICE", "VIEW_WHATSAPP"], ["SERVICE_NOTICE", "SEND_WHATSAPP"],
  ] as const)("suppresses %s when %s is revoked", async (purpose, permission) => {
    const { tx, send, run } = fixture(purpose);
    tx.staff.findUnique.mockResolvedValue({
      id: "membership_1", role: "MANAGER",
      permissionOverrides: [{ action: permission, allowed: false }] as never,
    });
    await run();
    expect(tx.whatsAppMessage.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ failureCode: "SOURCE_AUTHORIZATION_CHANGED", budgetState: "RELEASED" }),
    }));
    expect(send).not.toHaveBeenCalled();
  });

  it.each(purposes)("fails closed for %s without an initiating user", async purpose => {
    const { tx, send, run } = fixture(purpose, null);
    await run();
    expect(tx.staff.findUnique).not.toHaveBeenCalled();
    expect(tx.whatsAppMessage.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ failureCode: "SOURCE_AUTHORIZATION_CHANGED" }),
    }));
    expect(send).not.toHaveBeenCalled();
  });

  it.each(purposes.flatMap(purpose => ["owner_1", "staff_1"].map(actor => [purpose, actor] as const)))(
    "preserves current authorization for %s by %s", async (purpose, actor) => {
    const { tx, run } = fixture(purpose, actor);
    await run();
    expect(tx.whatsAppMessage.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ failureCode: "SENDER_INACTIVE" }),
    }));
    expect(tx.branch.findUnique).toHaveBeenCalledTimes(3);
    expect(tx.staff.findUnique).toHaveBeenCalledTimes(actor === "owner_1" ? 0 : 3);
  });

  it.each(["WELCOME", "DAILY_BRANCH_REPORT"] as const)("keeps %s under its own source authorization", async purpose => {
    const { tx, run } = fixture(purpose, null);
    await run();
    expect(tx.staff.findUnique).not.toHaveBeenCalled();
    expect(tx.whatsAppMessage.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ failureCode: "SENDER_INACTIVE" }),
    }));
  });

  it("leaves the claim recoverable when authorization storage is unavailable", async () => {
    const { tx, send, run } = fixture("MANUAL_REMINDER");
    const error = new Error("Synthetic unavailable authorization storage");
    tx.staff.findUnique.mockRejectedValue(error);
    await expect(run()).rejects.toBe(error);
    expect(tx.whatsAppMessage.updateMany).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});
