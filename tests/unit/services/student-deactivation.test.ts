import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentResolutionEventSource, StaffPermissionAction, StudentStatus } from "@/types";

const mocks = vi.hoisted(() => ({
    transaction: vi.fn(), branch: vi.fn(), staff: vi.fn(), student: vi.fn(), writable: vi.fn(),
    updateStudent: vi.fn(), endAllocations: vi.fn(), duePayments: vi.fn(), touchBranch: vi.fn(),
    collect: vi.fn(), waive: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {
    $transaction: mocks.transaction,
    branch: { findUnique: mocks.branch }, staff: { findUnique: mocks.staff }, student: { findUnique: mocks.student },
} }));
vi.mock("@/services/entitlement.service", () => ({ EntitlementService: { assertBranchWritable: mocks.writable } }));
vi.mock("@/lib/whatsappFeature", () => ({ isWhatsAppDeliverySchemaAccessEnabled: () => false }));
vi.mock("@/lib/whatsappSchema", () => ({ isWhatsAppDeliverySchemaReady: async () => false }));
vi.mock("@/services/payment.service", () => ({ PaymentService: {
    markPaymentAsPaidInTransaction: mocks.collect, markPaymentAsWaivedInTransaction: mocks.waive,
} }));

// The student service and AccessPolicy/StaffService permission checks are real.
// Payment writers are only observed here; their ledger arithmetic has its own suite.
import { StudentService } from "@/services/student.service";

const branch = { id: "branch", name: "Main", organizationId: "org", organization: { ownerId: "owner" } };
const student = { id: "student", branchId: "branch", branch, name: "Asha", status: "ACTIVE" };
const tx = {
    student: { update: mocks.updateStudent }, seatAllocation: { updateMany: mocks.endAllocations },
    payment: { findMany: mocks.duePayments }, branch: { update: mocks.touchBranch },
};
function staff(overrides: { action: StaffPermissionAction; allowed: boolean }[] = []) {
    mocks.staff.mockResolvedValue({ id: "staff", role: "STAFF", permissionOverrides: overrides });
}
beforeEach(() => {
    vi.resetAllMocks();
    mocks.branch.mockResolvedValue(branch); mocks.student.mockResolvedValue(student); staff();
    mocks.updateStudent.mockResolvedValue({ ...student, status: "INACTIVE" });
    mocks.duePayments.mockResolvedValue([{ id: "due" }]);
    mocks.transaction.mockImplementation(async operation => operation(tx));
});

describe("student deactivation resolution authorization", () => {
    it.each([false, true])("deactivates with KEEP without reading or resolving any payment (all payment actions denied: %s)", async denyPayments => {
        if (denyPayments) staff([
            { action: StaffPermissionAction.MARK_PAYMENT_PAID, allowed: false },
            { action: StaffPermissionAction.WAIVE_PAYMENTS, allowed: false },
            { action: StaffPermissionAction.VIEW_PAYMENTS, allowed: false },
        ]);
        const result = await StudentService.updateStudentStatus("staff-user", "student", StudentStatus.INACTIVE, "KEEP");
        expect(result.status).toBe("INACTIVE");
        expect(mocks.updateStudent).toHaveBeenCalledExactlyOnceWith({ where: { id: "student" }, data: { status: "INACTIVE" } });
        expect(mocks.endAllocations).toHaveBeenCalledExactlyOnceWith({
            where: { studentId: "student", endDate: null }, data: { endDate: expect.any(Date) },
        });
        expect(mocks.duePayments).not.toHaveBeenCalled();
        expect(mocks.collect).not.toHaveBeenCalled(); expect(mocks.waive).not.toHaveBeenCalled();
    });

    it("rejects default STAFF waiver before starting a status transaction", async () => {
        await expect(StudentService.updateStudentStatus("staff-user", "student", StudentStatus.INACTIVE, "WAIVED"))
            .rejects.toThrow("Permission 'waive_payments' is disabled");
        expect(mocks.transaction).not.toHaveBeenCalled(); expect(mocks.waive).not.toHaveBeenCalled();
    });

    it("rejects a denied collection override before starting a status transaction", async () => {
        staff([{ action: StaffPermissionAction.MARK_PAYMENT_PAID, allowed: false }]);
        await expect(StudentService.updateStudentStatus("staff-user", "student", StudentStatus.INACTIVE, "PAID"))
            .rejects.toThrow("Permission 'mark_payment_paid' is disabled");
        expect(mocks.transaction).not.toHaveBeenCalled(); expect(mocks.collect).not.toHaveBeenCalled();
    });

    it.each(["PAID", "WAIVED"] as const)("delegates an explicit authorized owner %s choice to the canonical writer", async resolution => {
        await StudentService.updateStudentStatus("owner", "student", StudentStatus.INACTIVE, resolution);
        expect(mocks.duePayments).toHaveBeenCalledExactlyOnceWith({
            where: { studentId: "student", branchId: "branch", status: "DUE" },
        });
        const source = { source: PaymentResolutionEventSource.STUDENT_INACTIVATION };
        if (resolution === "PAID") {
            expect(mocks.collect).toHaveBeenCalledExactlyOnceWith("owner", "due", undefined, undefined, tx, source);
            expect(mocks.waive).not.toHaveBeenCalled();
        } else {
            expect(mocks.waive).toHaveBeenCalledExactlyOnceWith("owner", "due", tx, source);
            expect(mocks.collect).not.toHaveBeenCalled();
        }
    });

    it.each(["KEEP", "PAID", "WAIVED"] as const)("preserves the readonly guard for %s", async resolution => {
        mocks.writable.mockRejectedValue(new Error("This workspace is read-only."));
        await expect(StudentService.updateStudentStatus("owner", "student", StudentStatus.INACTIVE, resolution))
            .rejects.toThrow("This workspace is read-only.");
        expect(mocks.transaction).not.toHaveBeenCalled();
    });
});
