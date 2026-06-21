import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    revalidateSession: vi.fn(),
    authorize: vi.fn(),
    prisma: {
        seat: { findMany: vi.fn() },
        shift: { findMany: vi.fn() },
        multiShift: { findMany: vi.fn() },
        importSession: { update: vi.fn() },
        importRow: { update: vi.fn() },
        importCommit: { create: vi.fn() },
    },
    createImportedStudent: vi.fn(),
    assignSeatToShifts: vi.fn(),
    ensureMonthlyPaymentForStudent: vi.fn(),
    markPaymentAsPaid: vi.fn(),
    markPaymentAsWaived: vi.fn(),
    createSeat: vi.fn(),
    createShift: vi.fn(),
    createMultiShift: vi.fn(),
}));

vi.mock("@/importing/services/import-session.service", () => ({
    ImportSessionService: {
        revalidateSession: mocks.revalidateSession,
    },
}));

vi.mock("@/lib/prisma", () => ({
    prisma: mocks.prisma,
}));

vi.mock("@/services/staff.service", () => ({
    StaffService: {
        authorize: mocks.authorize,
    },
}));

vi.mock("@/services/student.service", () => ({
    StudentService: {
        createImportedStudent: mocks.createImportedStudent,
    },
}));

vi.mock("@/services/seatAllocation.service", () => ({
    SeatAllocationService: {
        assignSeatToShifts: mocks.assignSeatToShifts,
    },
}));

vi.mock("@/services/payment.service", () => ({
    PaymentService: {
        ensureMonthlyPaymentForStudent: mocks.ensureMonthlyPaymentForStudent,
        markPaymentAsPaid: mocks.markPaymentAsPaid,
        markPaymentAsWaived: mocks.markPaymentAsWaived,
    },
}));

vi.mock("@/services/seat.service", () => ({
    SeatService: {
        createSeat: mocks.createSeat,
    },
}));

vi.mock("@/services/shift.service", () => ({
    ShiftService: {
        createShift: mocks.createShift,
    },
}));

vi.mock("@/services/multiShift.service", () => ({
    MultiShiftService: {
        createMultiShift: mocks.createMultiShift,
    },
}));

const readyDetail = {
    status: "READY_TO_COMMIT",
    mapping: {
        importOptions: {
            paymentCycle: "CURRENT_MONTH",
            paymentAction: "IMPORT_PAID_UNPAID",
            paymentMapping: { confirmed: true, paidValues: ["paid"], unpaidValues: ["due"], waivedValues: [], unclearValues: [], defaultMethod: "CASH" },
        },
    },
    rows: [
        {
            id: "row_1",
            rowNumber: 2,
            status: "READY",
            skipped: false,
            warnings: [],
            normalizedData: {
                student: { name: "Asha", phone: "9876543210", monthlyFee: 1200, joinedAt: "2026-01-01T00:00:00.000Z" },
                allocation: { seatLabel: "A1", shiftName: "Morning" },
                payment: { amount: 1200, status: "PAID", method: "UPI", referenceId: "TXN1" },
            },
        },
    ],
};

describe("ImportCommitService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.authorize.mockResolvedValue(true);
        mocks.prisma.seat.findMany.mockResolvedValue([{ id: "seat_1", label: "A1" }]);
        mocks.prisma.shift.findMany.mockResolvedValue([{ id: "shift_1", name: "Morning" }]);
        mocks.prisma.multiShift.findMany.mockResolvedValue([]);
        mocks.prisma.importSession.update.mockResolvedValue({});
        mocks.prisma.importRow.update.mockResolvedValue({});
        mocks.prisma.importCommit.create.mockResolvedValue({});
        mocks.createImportedStudent.mockResolvedValue({ id: "student_1" });
        mocks.assignSeatToShifts.mockResolvedValue([{ id: "allocation_1" }]);
        mocks.ensureMonthlyPaymentForStudent.mockResolvedValue({ id: "payment_1" });
        mocks.markPaymentAsPaid.mockResolvedValue({ id: "payment_1", status: "PAID" });
        mocks.markPaymentAsWaived.mockResolvedValue({ id: "payment_1", status: "WAIVED" });
    });

    it("does not run when the session is not READY_TO_COMMIT", async () => {
        mocks.revalidateSession.mockResolvedValueOnce({
            ...readyDetail,
            status: "NEEDS_INFO",
            questions: [{ status: "OPEN" }],
        });
        const { ImportCommitService } = await import("@/importing/services/import-commit.service");

        await expect(ImportCommitService.commitSession("user_1", "branch_1", "session_1")).rejects.toThrow("not ready");
        expect(mocks.createImportedStudent).not.toHaveBeenCalled();
    }, 10000);

    it("imports valid student rows through StudentService", async () => {
        mocks.revalidateSession.mockResolvedValueOnce(readyDetail);
        const { ImportCommitService } = await import("@/importing/services/import-commit.service");

        const result = await ImportCommitService.commitSession("user_1", "branch_1", "session_1");

        expect(result.status).toBe("SUCCESS");
        expect(mocks.createImportedStudent).toHaveBeenCalledWith("user_1", "branch_1", expect.objectContaining({ name: "Asha" }));
    });

    it("skips blocked rows in SAFE_PARTIAL mode", async () => {
        mocks.revalidateSession.mockResolvedValueOnce({
            ...readyDetail,
            rows: [
                ...readyDetail.rows,
                { id: "row_2", rowNumber: 3, status: "BLOCKED", skipped: false, warnings: [], normalizedData: { student: {} } },
            ],
        });
        const { ImportCommitService } = await import("@/importing/services/import-commit.service");

        const result = await ImportCommitService.commitSession("user_1", "branch_1", "session_1", "SAFE_PARTIAL");

        expect(result.status).toBe("PARTIAL");
        expect(result.summary.skippedRows).toBe(1);
        expect(mocks.createImportedStudent).toHaveBeenCalledTimes(1);
        expect(mocks.prisma.importCommit.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ status: "PARTIAL" }),
        }));
    });

    it("refuses blocked rows in STRICT_ALL_OR_NOTHING mode", async () => {
        mocks.revalidateSession.mockResolvedValueOnce({
            ...readyDetail,
            rows: [
                ...readyDetail.rows,
                { id: "row_2", rowNumber: 3, status: "BLOCKED", skipped: false, warnings: [], normalizedData: { student: {} } },
            ],
        });
        const { ImportCommitService } = await import("@/importing/services/import-commit.service");

        await expect(ImportCommitService.commitSession("user_1", "branch_1", "session_1", "STRICT_ALL_OR_NOTHING")).rejects.toThrow("Strict import refused");
    });

    it("uses SeatAllocationService for allocations", async () => {
        mocks.revalidateSession.mockResolvedValueOnce(readyDetail);
        const { ImportCommitService } = await import("@/importing/services/import-commit.service");

        await ImportCommitService.commitSession("user_1", "branch_1", "session_1");

        expect(mocks.assignSeatToShifts).toHaveBeenCalledWith("user_1", "seat_1", "student_1", ["shift_1"]);
    });

    it("links imported students to selected shift fees when the fee came from branch pricing", async () => {
        mocks.revalidateSession.mockResolvedValueOnce({
            ...readyDetail,
            rows: [{
                ...readyDetail.rows[0],
                normalizedData: {
                    ...readyDetail.rows[0].normalizedData,
                    student: {
                        ...readyDetail.rows[0].normalizedData.student,
                        monthlyFee: 1200,
                        feeSource: "SHIFT_PRICE",
                        feeLinkedShiftName: "Morning",
                    },
                },
            }],
        });
        const { ImportCommitService } = await import("@/importing/services/import-commit.service");

        await ImportCommitService.commitSession("user_1", "branch_1", "session_1");

        expect(mocks.createImportedStudent).toHaveBeenCalledWith(
            "user_1",
            "branch_1",
            expect.objectContaining({ feeLinkedShiftId: "shift_1", feeLinkedMultiShiftId: undefined })
        );
    });

    it("expands a known Full Time multi-shift from a plain shift value", async () => {
        mocks.prisma.shift.findMany.mockResolvedValueOnce([
            { id: "shift_morning", name: "Morning" },
            { id: "shift_afternoon", name: "Afternoon" },
            { id: "shift_evening", name: "Evening" },
        ]);
        mocks.prisma.multiShift.findMany.mockResolvedValueOnce([{
            id: "multi_full_time",
            name: "Full Time",
            components: [
                { shiftId: "shift_morning", shift: { name: "Morning" } },
                { shiftId: "shift_afternoon", shift: { name: "Afternoon" } },
                { shiftId: "shift_evening", shift: { name: "Evening" } },
            ],
        }]);
        mocks.assignSeatToShifts.mockResolvedValueOnce([
            { id: "allocation_morning" },
            { id: "allocation_afternoon" },
            { id: "allocation_evening" },
        ]);
        mocks.revalidateSession.mockResolvedValueOnce({
            ...readyDetail,
            rows: [{
                ...readyDetail.rows[0],
                normalizedData: {
                    ...readyDetail.rows[0].normalizedData,
                    allocation: { seatLabel: "A1", shiftName: "Full Time" },
                },
            }],
        });
        const { ImportCommitService } = await import("@/importing/services/import-commit.service");

        await ImportCommitService.commitSession("user_1", "branch_1", "session_1");

        expect(mocks.assignSeatToShifts).toHaveBeenCalledWith(
            "user_1",
            "seat_1",
            "student_1",
            ["shift_morning", "shift_afternoon", "shift_evening"],
            "multi_full_time"
        );
    });

    it("uses PaymentService for generated and paid transitions", async () => {
        mocks.revalidateSession.mockResolvedValueOnce(readyDetail);
        const { ImportCommitService } = await import("@/importing/services/import-commit.service");

        await ImportCommitService.commitSession("user_1", "branch_1", "session_1");

        expect(mocks.ensureMonthlyPaymentForStudent).toHaveBeenCalled();
        expect(mocks.markPaymentAsPaid).toHaveBeenCalledWith("user_1", "payment_1", "UPI", "TXN1");
    });

    it("previews generated dues for student-only rows when payment generation is enabled", async () => {
        mocks.revalidateSession.mockResolvedValueOnce({
            status: "READY_TO_COMMIT",
            mapping: {
                importOptions: {
                    paymentCycle: "CURRENT_MONTH",
                    paymentAction: "GENERATE_DUE",
                },
            },
            questions: [],
            rows: [{
                id: "row_1",
                rowNumber: 2,
                status: "READY",
                skipped: false,
                issues: [],
                warnings: [],
                normalizedData: {
                    student: { name: "Asha", phone: "9876543210", monthlyFee: 1200 },
                },
            }],
        });
        const { ImportPreviewService } = await import("@/importing/services/import-preview.service");

        const preview = await ImportPreviewService.getPreview("user_1", "branch_1", "session_1");

        expect(preview.summary.generatePayments).toBe(1);
        expect(preview.summary.markPaid).toBe(0);
    });
});
