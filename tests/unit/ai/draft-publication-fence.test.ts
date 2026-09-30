import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  DraftPublicationBusyError,
  DraftSourceChangedError,
  publishDraftGeneration,
} from "@/ai/generationLease";

vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: vi.fn() } }));

const branchId = "branch-1";
const studentId = "student-1";
const tx = {
  $queryRaw: vi.fn(),
  branch: { findUnique: vi.fn() },
  branchGenerationLease: { findUnique: vi.fn(), update: vi.fn() },
};

describe("draft publication fence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation(async callback => callback(tx as never));
    tx.$queryRaw.mockResolvedValueOnce([{ id: studentId }]).mockResolvedValueOnce([{ id: branchId }]);
    tx.branch.findUnique.mockResolvedValue({ aiEnabled: true, billingStatus: "ACTIVE" });
    tx.branchGenerationLease.findUnique.mockResolvedValue({ id: "lease-1", token: "owner-token", leaseUntil: new Date(Date.now() + 60_000) });
    tx.branchGenerationLease.update.mockResolvedValue({});
  });

  it("checks the source before and after writing, then completes the lease", async () => {
    const sequence: string[] = [];
    const result = await publishDraftGeneration(branchId, "owner-token", [studentId],
      async () => { sequence.push("source"); },
      async () => { sequence.push("write"); return "saved"; });
    expect(result).toBe("saved");
    expect(sequence).toEqual(["source", "write", "source"]);
    expect(tx.branchGenerationLease.update).toHaveBeenCalledTimes(1);
  });

  it("cannot write after the selected source changed", async () => {
    const write = vi.fn();
    await expect(publishDraftGeneration(branchId, "owner-token", [studentId],
      async () => { throw new DraftSourceChangedError(); }, write)).rejects.toBeInstanceOf(DraftSourceChangedError);
    expect(write).not.toHaveBeenCalled();
    expect(tx.branchGenerationLease.update).not.toHaveBeenCalled();
  });

  it("cannot write after takeover or branch retirement", async () => {
    tx.branchGenerationLease.findUnique.mockResolvedValue({ id: "lease-1", token: "successor", leaseUntil: new Date(Date.now() + 60_000) });
    const write = vi.fn();
    await expect(publishDraftGeneration(branchId, "owner-token", [studentId], vi.fn(), write))
      .rejects.toBeInstanceOf(DraftSourceChangedError);
    expect(write).not.toHaveBeenCalled();
  });

  it("turns a NOWAIT lock conflict into a recoverable conflict without publishing", async () => {
    tx.$queryRaw.mockReset().mockRejectedValue({ code: "P2010", meta: {
      driverAdapterError: { cause: { originalCode: "55P03" } },
    } });
    const write = vi.fn();
    await expect(publishDraftGeneration(branchId, "owner-token", [studentId], vi.fn(), write))
      .rejects.toBeInstanceOf(DraftPublicationBusyError);
    expect(write).not.toHaveBeenCalled();
  });
});
