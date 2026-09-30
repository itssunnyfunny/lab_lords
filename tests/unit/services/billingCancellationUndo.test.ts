import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ownerAccess: vi.fn(),
  transaction: vi.fn(),
  lockOrganization: vi.fn(),
  organizationFindFirst: vi.fn(),
  changeFindFirst: vi.fn(),
  changeUpdate: vi.fn(),
  changeUpdateMany: vi.fn(),
}));

vi.mock("@/services/organization.service", () => ({ OrganizationService: {
  getOrganizationForOwnerAccess: mocks.ownerAccess,
} }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  $transaction: mocks.transaction,
  organizationBillingChange: {
    findFirst: mocks.changeFindFirst,
    update: mocks.changeUpdate,
    updateMany: mocks.changeUpdateMany,
  },
} }));

import { BillingService } from "@/services/billing.service";

const cutoff = new Date("2030-09-30T12:00:00.000Z");
const beforeCutoff = new Date("2030-09-30T11:59:59.000Z");

type Change = {
  id: string;
  organizationId: string;
  type: "CANCELLATION";
  status: "QUEUED" | "PROCESSING" | "UNDONE";
  operationStatus: "SCHEDULED" | "ABANDONED";
  undoCutoffAt: Date;
  updatedAt: Date;
  undoneAt?: Date;
  resolvedAt?: Date;
};

describe("billing cancellation Undo ownership", () => {
  let changes: Change[];
  let leaseToken: string | null;
  let inTransaction: boolean;
  let organizationLocked: boolean;
  let admitBeforeTransaction: () => void;

  beforeEach(() => {
    vi.resetAllMocks();
    changes = [{
      id: "cancel_old", organizationId: "org", type: "CANCELLATION",
      status: "QUEUED", operationStatus: "SCHEDULED", undoCutoffAt: cutoff,
      updatedAt: new Date("2030-09-29T00:00:00.000Z"),
    }];
    leaseToken = null;
    inTransaction = false;
    organizationLocked = false;
    admitBeforeTransaction = () => {};
    mocks.ownerAccess.mockResolvedValue({ id: "org", ownerId: "owner" });
    mocks.lockOrganization.mockImplementation(async () => {
      organizationLocked = true;
      return [{ id: "org" }];
    });
    mocks.organizationFindFirst.mockImplementation(async () => ({ billingMutationLeaseToken: leaseToken }));
    mocks.changeFindFirst.mockImplementation(async ({ where }: { where: {
      id?: string; organizationId?: string; status?: string | { in: string[] }; type?: string;
    } }) => {
      if (inTransaction && !organizationLocked) throw new Error("Billing change read before organization lock");
      const found = changes.filter(change =>
        (!where.id || where.id === change.id)
        && (!where.organizationId || where.organizationId === change.organizationId)
        && (!where.type || where.type === change.type)
        && (!where.status || (typeof where.status === "string"
          ? change.status === where.status : where.status.in.includes(change.status)))
      ).at(-1);
      if (!found) return null;
      const snapshot = { ...found };
      // The original helper reads QUEUED outside a transaction. Let the worker
      // admit that exact row after this stale read; the repaired helper takes
      // the organization lock before reading and never enters this branch.
      if (!inTransaction && where.status === "QUEUED" && admitBeforeTransaction) {
        admitBeforeTransaction();
      }
      return snapshot;
    });
    mocks.changeUpdate.mockImplementation(async ({ where, data }: {where:{id:string};data:Partial<Change>}) => {
      const change = changes.find(item => item.id === where.id)!;
      Object.assign(change, data);
      return { ...change };
    });
    mocks.changeUpdateMany.mockImplementation(async ({ where, data }: {where:{id:string;status:string;updatedAt:Date};data:Partial<Change>}) => {
      const change = changes.find(item => item.id === where.id);
      if (!change || change.status !== where.status || change.updatedAt.getTime() !== where.updatedAt.getTime()) {
        return { count: 0 };
      }
      Object.assign(change, data);
      return { count: 1 };
    });
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      admitBeforeTransaction();
      inTransaction = true;
      organizationLocked = false;
      try {
        return await callback({
          $queryRaw: mocks.lockOrganization,
          organization: { findFirst: mocks.organizationFindFirst },
          organizationBillingChange: {
            findFirst: mocks.changeFindFirst,
            updateMany: mocks.changeUpdateMany,
          },
        });
      } finally {
        inTransaction = false;
        organizationLocked = false;
      }
    });
  });

  afterEach(() => vi.useRealTimers());

  it.each(["direct", "generic"])("rejects %s Undo when the worker admitted cancellation first", async entry => {
    admitBeforeTransaction = () => {
      changes[0].status = "PROCESSING";
      changes[0].updatedAt = new Date("2030-09-30T11:59:59.500Z");
      leaseToken = "worker_lease";
    };
    const undo = entry === "direct"
      ? BillingService.undoWorkspaceCancellation("owner", "org", beforeCutoff)
      : BillingService.undoWorkspaceChange("owner", "org", "cancel_old");
    await expect(undo).rejects.toMatchObject({
      code: "BILLING_CHANGE_IN_PROGRESS",
      existingChangeId: "cancel_old",
    });
    expect(changes[0].status).toBe("PROCESSING");
    expect(changes[0].undoneAt).toBeUndefined();
    expect(mocks.changeUpdate).not.toHaveBeenCalled();
    expect(mocks.lockOrganization).toHaveBeenCalledOnce();
  });

  it("undoes the exact requested cancellation rather than the latest queued row", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(beforeCutoff);
    changes.push({
      id: "cancel_new", organizationId: "org", type: "CANCELLATION",
      status: "QUEUED", operationStatus: "SCHEDULED", undoCutoffAt: cutoff,
      updatedAt: new Date("2030-09-29T01:00:00.000Z"),
    });
    await expect(BillingService.undoWorkspaceChange("owner", "org", "cancel_old"))
      .resolves.toMatchObject({ undone: true });
    expect(changes[0].status).toBe("UNDONE");
    expect(changes[1].status).toBe("QUEUED");
  });

  it("keeps an early local Undo ahead of a later worker claim", async () => {
    await expect(BillingService.undoWorkspaceCancellation("owner", "org", beforeCutoff))
      .resolves.toEqual({ undone: true });
    expect(changes[0].status).toBe("UNDONE");
    expect(changes[0].operationStatus).toBe("ABANDONED");
    // The worker's queued-row selector cannot admit the now-undone intent.
    expect(changes.filter(change => change.status === "QUEUED")).toEqual([]);
    expect(mocks.changeUpdateMany).toHaveBeenCalledOnce();
    expect(mocks.lockOrganization).toHaveBeenCalledOnce();
  });

  it("checks the cutoff after obtaining mutation ownership", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(beforeCutoff);
    admitBeforeTransaction = () => vi.setSystemTime(cutoff);
    await expect(BillingService.undoWorkspaceCancellation("owner", "org"))
      .rejects.toThrow("no longer undoable");
    expect(changes[0].status).toBe("QUEUED");
    expect(mocks.changeUpdateMany).not.toHaveBeenCalled();
  });

  it("rejects when the owner-scoped lock finds no organization", async () => {
    mocks.lockOrganization.mockResolvedValueOnce([]);
    await expect(BillingService.undoWorkspaceCancellation("owner", "org", beforeCutoff))
      .rejects.toThrow("Organization not found");
    expect(mocks.changeFindFirst).not.toHaveBeenCalled();
    expect(changes[0].status).toBe("QUEUED");
  });

  it("does not report success when the exact queued-state update loses", async () => {
    mocks.changeUpdateMany.mockResolvedValueOnce({ count: 0 });
    await expect(BillingService.undoWorkspaceCancellation("owner", "org", beforeCutoff))
      .rejects.toThrow("moved while the undo was being finalized");
    expect(changes[0].status).toBe("QUEUED");
    expect(changes[0].undoneAt).toBeUndefined();
  });
});
