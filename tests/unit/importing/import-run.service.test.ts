import { beforeEach, describe, expect, it, vi } from "vitest";
import { importBusinessDate } from "@/importing/utils/current-month-import";

const mocks = vi.hoisted(() => {
    const tx = {
        $queryRaw: vi.fn(),
        importSession: { findFirst: vi.fn(), update: vi.fn() },
        importPlan: { findFirst: vi.fn() },
        importRowEvaluation: { findMany: vi.fn() },
        importRun: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        },
        importRunItem: {
            createMany: vi.fn(),
            updateMany: vi.fn(),
        },
        seat: { findMany: vi.fn() },
        shift: { findMany: vi.fn() },
        multiShift: { findMany: vi.fn() },
    };
    return {
        authorize: vi.fn(),
        assertBranchWritable: vi.fn(),
        getMaxPlannedMutations: vi.fn(),
        tx,
        transaction: vi.fn(async (operation: (client: typeof tx) => unknown) => operation(tx)),
        importRunFindUnique: vi.fn(),
    };
});

vi.mock("@/services/staff.service", () => ({
    StaffService: { authorize: mocks.authorize },
}));

vi.mock("@/services/entitlement.service", () => ({
    EntitlementService: { assertBranchWritable: mocks.assertBranchWritable },
}));

vi.mock("@/lib/importFeature", () => ({
    getImportMaxPlannedMutations: mocks.getMaxPlannedMutations,
}));

vi.mock("@/lib/prisma", () => ({
    prisma: {
        $transaction: mocks.transaction,
        importRun: { findUnique: mocks.importRunFindUnique },
    },
}));

const snapshot = {
    schemaVersion: 2,
    sessionId: "session_1",
    targetRevision: 3,
    engineVersion: 2,
    goal: "STUDENTS_ALLOCATIONS",
    readinessPolicy: "READY_ROWS_ONLY",
    mapping: { entityTypesDetected: ["STUDENT"], columnMappings: [] },
    summary: null,
    evaluations: [],
    requiredPermissions: ["students", "seat_allocation"],
    configurationApproval: { required: false, approved: false, affectedRows: 0 },
    mutationSummary: {
        total: 2,
        configuration: 0,
        students: 1,
        allocations: 1,
        paymentCycles: 0,
        affectedRows: { students: 1, allocations: 1, payments: 0, configuration: 0 },
        payments: {
            historical: { DUE: 0, PAID: 0, WAIVED: 0 },
            current: { DUE: 0, PAID: 0, WAIVED: 0 },
        },
    },
    items: [
        {
            itemKey: "row:row_1:student",
            kind: "STUDENT",
            rowId: "row_1",
            evaluationId: "evaluation_1",
            payload: { student: { name: "Asha" } },
        },
        {
            itemKey: "row:row_1:allocation",
            kind: "ALLOCATION",
            rowId: "row_1",
            evaluationId: "evaluation_1",
            payload: { studentItemKey: "row:row_1:student" },
        },
    ],
};

function mockReviewedPaymentPlan(plannedStatus: string) {
    const session = { id: "session_1", branchId: "branch_1", engineVersion: 2, goal: "FULL", draftRevision: 3, activeEvaluationRevision: 3, archivedAt: null };
    const plan = {
        id: "plan_1", importSessionId: session.id, revision: 3, planVersion: "corrected-legend", canRun: true,
        snapshot: { ...snapshot, goal: session.goal,
            mapping: {
                columnMappings: [{ sourceColumn: "Payment Status", targetField: "payment.status" }],
                importOptions: { paymentAction: "IMPORT_PAID_UNPAID", paymentMapping: {
                    confirmed: true, paidValues: [], unpaidValues: [], waivedValues: [], unclearValues: ["X"],
                } },
            },
            items: [{ itemKey: "row:row_1:payment:2026-11-01", kind: "PAYMENT_CYCLE", rowId: "row_1", evaluationId: "evaluation_1",
                payload: { amount: 900, bucket: "current", status: plannedStatus } }],
        },
    };
    mocks.tx.importSession.findFirst.mockResolvedValue(session);
    mocks.tx.importPlan.findFirst.mockResolvedValue(plan);
    return { userId: "user_1", sessionId: session.id, branchId: session.branchId, kind: "COMMIT" as const,
        importPlanId: plan.id, confirmedPlanVersion: plan.planVersion, targetRevision: session.draftRevision, idempotencyKey: "confirm" };
}

describe("ImportRunService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.authorize.mockResolvedValue(true);
        mocks.assertBranchWritable.mockResolvedValue({});
        mocks.getMaxPlannedMutations.mockReturnValue(5000);
        mocks.tx.$queryRaw.mockResolvedValue([{ id: "session_1" }]);
        mocks.tx.importSession.findFirst.mockResolvedValue({
            id: "session_1",
            branchId: "branch_1",
            engineVersion: 2,
            goal: "STUDENTS_ALLOCATIONS",
            draftRevision: 3,
            activeEvaluationRevision: 3,
            archivedAt: null,
        });
        mocks.tx.importSession.update.mockResolvedValue({});
        mocks.tx.importRowEvaluation.findMany.mockResolvedValue([]);
        mocks.tx.importRun.findUnique.mockResolvedValue(null);
        mocks.tx.importRun.findFirst.mockResolvedValue(null);
        mocks.tx.importPlan.findFirst.mockResolvedValue({
            id: "plan_1",
            importSessionId: "session_1",
            revision: 3,
            planVersion: "plan-version-1",
            canRun: true,
            snapshot,
        });
        mocks.tx.importRun.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
            id: "run_1",
            ...data,
        }));
        mocks.tx.importRunItem.createMany.mockResolvedValue({ count: 2 });
        mocks.tx.seat.findMany.mockResolvedValue([]);
        mocks.tx.shift.findMany.mockResolvedValue([]);
        mocks.tx.multiShift.findMany.mockResolvedValue([]);
    });

    it("creates a commit run and one item per immutable plan mutation", async () => {
        const { ImportRunService } = await import("@/importing/services/import-run.service");
        const run = await ImportRunService.createOrGetRun({
            userId: "user_1",
            branchId: "branch_1",
            sessionId: "session_1",
            kind: "COMMIT",
            importPlanId: "plan_1",
            confirmedPlanVersion: "plan-version-1",
            targetRevision: 3,
            idempotencyKey: "request-1",
        });

        expect(run).toMatchObject({ id: "run_1", kind: "COMMIT", totalItems: 2 });
        expect(mocks.tx.importRun.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                importSessionId: "session_1",
                importPlanId: "plan_1",
                targetRevision: 3,
                idempotencyKey: "request-1",
                requestHash: expect.stringMatching(/^[a-f0-9]{64}$/),
            }),
        }));
        const items = mocks.tx.importRunItem.createMany.mock.calls[0][0].data;
        expect(items).toHaveLength(2);
        expect(items.map((item: { itemKey: string }) => item.itemKey)).toEqual([
            "row:row_1:student",
            "row:row_1:allocation",
        ]);
    });

    it("rejects reuse of an idempotency key with a different request hash", async () => {
        mocks.tx.importRun.findUnique.mockResolvedValueOnce({
            id: "run_other",
            idempotencyKey: "request-1",
            requestHash: "different",
        });
        const { ImportRunService } = await import("@/importing/services/import-run.service");

        await expect(ImportRunService.createOrGetRun({
            userId: "user_1",
            branchId: "branch_1",
            sessionId: "session_1",
            kind: "COMMIT",
            importPlanId: "plan_1",
            confirmedPlanVersion: "plan-version-1",
            targetRevision: 3,
            idempotencyKey: "request-1",
        })).rejects.toMatchObject({ code: "IMPORT_IDEMPOTENCY_CONFLICT" });
        expect(mocks.tx.importRun.create).not.toHaveBeenCalled();
    });

    it("blocks a first commit of a conflicting same-day plan but replays and dispatches its already-started run", async () => {
        const { ImportRunService } = await import("@/importing/services/import-run.service");
        const legacySnapshot = {
            ...snapshot, goal: "FULL",
            currentMonthReview: { businessDate: importBusinessDate(), rows: [] },
            mapping: { ...snapshot.mapping, importOptions: { paymentAction: "IMPORT_PAID_UNPAID", paymentMapping: {
                confirmed: true, paidValues: ["X"], unpaidValues: [" x "], waivedValues: [], unclearValues: [],
            } } },
            items: [snapshot.items[0], { itemKey: "row:row_1:payment:2026-10-10", kind: "PAYMENT_CYCLE",
                rowId: "row_1", evaluationId: "evaluation_1", payload: { status: "PAID", bucket: "current", amount: 900, method: "CASH" } }],
        };
        const plan = { id: "plan_1", importSessionId: "session_1", revision: 3, planVersion: "old-version", canRun: true, snapshot: legacySnapshot };
        const session = { id: "session_1", branchId: "branch_1", engineVersion: 2, goal: "FULL", draftRevision: 3, activeEvaluationRevision: 3, archivedAt: null };
        const request = { userId: "user_1", branchId: session.branchId, sessionId: session.id, kind: "COMMIT" as const,
            importPlanId: plan.id, confirmedPlanVersion: plan.planVersion, targetRevision: 3, idempotencyKey: "confirm" };
        mocks.tx.importSession.findFirst.mockResolvedValue(session);
        mocks.tx.importPlan.findFirst.mockResolvedValue(plan);
        await expect(ImportRunService.createOrGetRun(request)).rejects.toMatchObject({ code: "IMPORT_PAYMENT_LEGEND_CONFLICT" });
        expect(mocks.tx.importRun.create).not.toHaveBeenCalled();
        expect(mocks.tx.importRunItem.createMany).not.toHaveBeenCalled();
        expect(mocks.tx.importSession.update).not.toHaveBeenCalled();

        const recovered = { id: "earlier_run", branchId: session.branchId, kind: "COMMIT", status: "RETRYABLE_FAILURE",
            idempotencyKey: request.idempotencyKey, requestHash: mocks.tx.importRun.findFirst.mock.calls[0][0].where.requestHash,
            workflowRunId: null, session, plan };
        mocks.tx.importRun.findUnique.mockResolvedValueOnce(recovered);
        await expect(ImportRunService.createOrGetRun(request)).resolves.toEqual(recovered);
        mocks.tx.importRun.findFirst.mockResolvedValueOnce(recovered);
        await expect(ImportRunService.createOrGetRun({ ...request, idempotencyKey: "another-confirmation" })).resolves.toEqual(recovered);
        mocks.tx.importRun.findFirst.mockResolvedValueOnce(recovered);
        await expect(ImportRunService.getDispatchableRun(request.userId, session.branchId, recovered.id)).resolves.toEqual(recovered);
        expect(mocks.tx.importRun.create).not.toHaveBeenCalled();
        expect(mocks.tx.importRunItem.createMany).not.toHaveBeenCalled();
    });

    it.each([
        { savedStatus: "PAID", plannedStatus: "PAID" },
        { savedStatus: "UNCLEAR", plannedStatus: "DUE" },
    ])("requires a fresh review of a legacy manual $savedStatus with an unclear source and a planned $plannedStatus", async ({ savedStatus, plannedStatus }) => {
        const { ImportRunService } = await import("@/importing/services/import-run.service");
        const request = mockReviewedPaymentPlan(plannedStatus);
        mocks.tx.importRowEvaluation.findMany.mockResolvedValue([{
            id: "evaluation_1", importRowId: "row_1", row: { rawData: { "Payment Status": "X" } },
            mappedData: { __manualNormalizedData: true },
            normalizedData: { allocation: { shiftName: "Evening" }, payment: { status: savedStatus, rawStatus: "PAID", amount: 900 } },
        }]);
        await expect(ImportRunService.createOrGetRun(request)).rejects.toMatchObject({ code: "IMPORT_PAYMENT_REVIEW_REQUIRED" });
        expect(mocks.tx.importRowEvaluation.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: { in: ["evaluation_1"] }, branchId: request.branchId, revision: 3,
                row: { importSessionId: request.sessionId, branchId: request.branchId } },
        }));
        expect(mocks.tx.importRun.create).not.toHaveBeenCalled();
        expect(mocks.tx.importRunItem.createMany).not.toHaveBeenCalled();

        const prior = { id: "started", requestHash: mocks.tx.importRun.findFirst.mock.calls[0][0].where.requestHash };
        mocks.tx.importRun.findUnique.mockResolvedValueOnce(prior);
        await expect(ImportRunService.createOrGetRun(request)).resolves.toEqual(prior);
        expect(mocks.tx.importRowEvaluation.findMany).toHaveBeenCalledTimes(1);
    });

    it("accepts a source discrepancy with an explicit matching payment decision in the reviewed evaluation", async () => {
        const { ImportRunService } = await import("@/importing/services/import-run.service");
        const request = mockReviewedPaymentPlan("DUE");
        mocks.tx.importRowEvaluation.findMany.mockResolvedValue([{
            id: "evaluation_1", importRowId: "row_1", row: { rawData: { "Payment Status": "X" } },
            mappedData: { __manualNormalizedData: true }, normalizedData: { payment: { status: "DUE", decision: "KEEP_DUE" } },
        }]);
        await expect(ImportRunService.createOrGetRun(request)).resolves.toMatchObject({ id: "run_1" });
    });

    it.each([
        ["GENERATE_DUE", "START_CURRENT_JOINED_CYCLE", "current"],
        ["IMPORT_PAID_UNPAID", "FROM_JOINED_MARK_PAID", "current"],
        ["IMPORT_PAID_UNPAID", "FROM_JOINED_MARK_DUE", "current"],
        ["IMPORT_PAID_UNPAID", "FROM_JOINED_PAID_THROUGH_PREVIOUS", "historical"],
    ])("allows %s with %s when the %s status is independent of the source label", async (paymentAction, paymentHistoryMode, bucket) => {
        const { ImportRunService } = await import("@/importing/services/import-run.service");
        const session = { id: "session_1", branchId: "branch_1", engineVersion: 2, goal: "FULL", draftRevision: 3, activeEvaluationRevision: 3 };
        mocks.tx.importSession.findFirst.mockResolvedValue(session);
        const source = { ...snapshot, goal: "FULL",
            mapping: { ...snapshot.mapping, importOptions: { paymentAction, paymentHistoryMode,
                paymentMapping: { confirmed: true, paidValues: ["X"], unpaidValues: ["X"], waivedValues: [] } } },
            items: [{ itemKey: "row:row_1:payment:2026-10-10", kind: "PAYMENT_CYCLE", payload: { bucket } }],
        };
        mocks.tx.importPlan.findFirst.mockResolvedValue({ id: "plan_1", canRun: true, planVersion: "old-version", snapshot: source });
        await expect(ImportRunService.createOrGetRun({
            userId: "user_1", branchId: session.branchId, sessionId: session.id, kind: "COMMIT",
            importPlanId: "plan_1", confirmedPlanVersion: "old-version", targetRevision: 3, idempotencyKey: "confirm",
        })).resolves.toMatchObject({ id: "run_1" });
    });

    it("blocks commit start when the reviewed plan now exceeds the current mutation cap", async () => {
        mocks.getMaxPlannedMutations.mockReturnValueOnce(1);
        const { ImportRunService } = await import("@/importing/services/import-run.service");

        await expect(ImportRunService.createOrGetRun({
            userId: "user_1",
            branchId: "branch_1",
            sessionId: "session_1",
            kind: "COMMIT",
            importPlanId: "plan_1",
            confirmedPlanVersion: "plan-version-1",
            targetRevision: 3,
            idempotencyKey: "request-over-cap",
        })).rejects.toThrow("above the current safety limit");

        expect(mocks.tx.importRun.create).not.toHaveBeenCalled();
    });

    it("supersedes a retryable commit when a newer reviewed revision starts", async () => {
        const repairedSnapshot = { ...snapshot, targetRevision: 4 };
        mocks.tx.importSession.findFirst.mockResolvedValueOnce({
            id: "session_1",
            branchId: "branch_1",
            engineVersion: 2,
            goal: "STUDENTS_ALLOCATIONS",
            draftRevision: 4,
            activeEvaluationRevision: 4,
            archivedAt: null,
        });
        mocks.tx.importPlan.findFirst.mockResolvedValueOnce({
            id: "plan_2",
            importSessionId: "session_1",
            revision: 4,
            planVersion: "plan-version-2",
            canRun: true,
            snapshot: repairedSnapshot,
        });
        mocks.tx.importRun.findFirst
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({
                id: "run_retryable",
                importSessionId: "session_1",
                kind: "COMMIT",
                status: "RETRYABLE_FAILURE",
                targetRevision: 3,
                requestHash: "old-request",
            });
        mocks.tx.importRunItem.updateMany.mockResolvedValueOnce({ count: 1 });
        mocks.tx.importRun.update.mockResolvedValueOnce({ id: "run_retryable", status: "SUPERSEDED" });
        const { ImportRunService } = await import("@/importing/services/import-run.service");

        const run = await ImportRunService.createOrGetRun({
            userId: "user_1",
            branchId: "branch_1",
            sessionId: "session_1",
            kind: "COMMIT",
            importPlanId: "plan_2",
            confirmedPlanVersion: "plan-version-2",
            targetRevision: 4,
            idempotencyKey: "retry-request-2",
        });

        expect(mocks.tx.importRunItem.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ importRunId: "run_retryable" }),
        }));
        expect(mocks.tx.importRun.update).toHaveBeenCalledWith({
            where: { id: "run_retryable" },
            data: { status: "SUPERSEDED", finishedAt: expect.any(Date) },
        });
        expect(run).toMatchObject({ kind: "COMMIT", targetRevision: 4 });
    });

    it("confirms PDF extraction once and returns the already-confirmed run on replay", async () => {
        mocks.tx.importSession.findFirst.mockResolvedValue({
            id: "session_1",
            sourceConfiguration: { parser: "pdf" },
            archivedAt: null,
        });
        const waitingRun = {
            id: "run_pdf",
            branchId: "branch_1",
            importSessionId: "session_1",
            kind: "ANALYSIS",
            status: "WAITING_FOR_USER",
            workflowRunId: null,
        };
        const queuedRun = { ...waitingRun, status: "QUEUED" };
        mocks.tx.importRun.findFirst
            .mockResolvedValueOnce(waitingRun)
            .mockResolvedValueOnce(queuedRun);
        mocks.tx.importRun.update.mockResolvedValueOnce(queuedRun);
        const { ImportRunService } = await import("@/importing/services/import-run.service");

        const first = await ImportRunService.confirmPdfExtraction("user_1", "branch_1", "session_1");
        const replay = await ImportRunService.confirmPdfExtraction("user_1", "branch_1", "session_1");

        expect(first).toMatchObject({ id: "run_pdf", status: "QUEUED" });
        expect(replay).toMatchObject({ id: "run_pdf", status: "QUEUED" });
        expect(mocks.tx.importSession.update).toHaveBeenCalledTimes(1);
        expect(mocks.tx.importRun.update).toHaveBeenCalledTimes(1);
        expect(mocks.authorize).toHaveBeenCalledWith("user_1", "branch_1", "students", mocks.tx);
        expect(mocks.assertBranchWritable).toHaveBeenCalledWith("branch_1", mocks.tx);
    });
});

vi.mock("@/services/accessPolicy.service", async importOriginal => {
    const actual = await importOriginal<typeof import("@/services/accessPolicy.service")>();
    const { callerPolicyMock } = await import("@/tests/helpers/accessPolicyCallerMock");
    const { StaffService } = await import("@/services/staff.service");
    const { EntitlementService } = await import("@/services/entitlement.service");
    return { ...actual, AccessPolicy: callerPolicyMock(actual.AccessPolicy, StaffService, EntitlementService) };
});
