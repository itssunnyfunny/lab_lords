import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  start: vi.fn(),
  finish: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/services/whatsappJobRun.service", () => ({
  WhatsAppJobRunService: { start: mocks.start, finish: mocks.finish },
}));

import { WhatsAppDispatcherService } from "@/services/whatsappDispatcher.service";
import type { MetaWhatsAppProviderClient } from "@/lib/metaWhatsApp";

describe("WhatsApp dispatcher failure evidence", () => {
  it("retains committed claims and outcomes when a later message preparation fails", async () => {
    const now = new Date("2026-08-23T10:00:00.000Z");
    const failure = new Error("synthetic preparation failure");
    const claimTx = {
      $queryRaw: vi.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: "stale_claim" }])
        .mockResolvedValueOnce([{ id: "message_1" }, { id: "message_2" }]),
      whatsAppMessage: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({ organizationId: "org_1" }),
      },
    };
    const suppressTx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: "message_1" }]),
      whatsAppMessage: {
        findFirst: vi.fn().mockResolvedValue({
          id: "message_1",
          senderId: "sender_1",
          organizationId: "org_1",
          organization: { id: "different_org" },
          purpose: "MANUAL_REMINDER",
          budgetState: "RESERVED",
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      whatsAppMessageEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    mocks.start.mockResolvedValue({
      created: true, run: { id: "job_1", status: "RUNNING" },
    });
    mocks.finish.mockResolvedValue({ changed: true });
    mocks.transaction
      .mockImplementationOnce(async callback => callback(claimTx))
      .mockImplementationOnce(async callback => callback(suppressTx))
      .mockRejectedValueOnce(failure);
    const send = vi.fn();

    await expect(WhatsAppDispatcherService.run({
      now,
      env: {
        NODE_ENV: "test",
        META_WHATSAPP_MODE: "TEST",
        WHATSAPP_INTEGRATION_ENABLED: "true",
        WHATSAPP_META_MESSAGE_WRITES_ENABLED: "true",
      },
      provider: { sendApprovedUtilityTemplate: send } as unknown as MetaWhatsAppProviderClient,
    })).rejects.toBe(failure);

    expect(suppressTx.whatsAppMessageEvent.create).toHaveBeenCalledOnce();
    expect(send).not.toHaveBeenCalled();
    expect(mocks.finish).toHaveBeenCalledWith(expect.objectContaining({
      runId: "job_1",
      status: "FAILED",
      safeErrorCode: "DISPATCHER_FAILED",
      counts: expect.objectContaining({
        messagesClaimed: 2,
        messagesSuppressed: 1,
        staleClaimsRecovered: 1,
        messagesAccepted: 0,
        messagesUnknown: 0,
      }),
    }));
  });
});
