import { beforeEach, describe, expect, it, vi } from "vitest";
import { BranchReportService } from "@/services/branchReport.service";
import { reportQuerySchema } from "@/lib/branchReports";

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), user: vi.fn(), organization: vi.fn(), student: vi.fn(), payment: vi.fn(), attendance: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: (callback: (tx: unknown) => unknown) => callback({ user: { findUniqueOrThrow: mocks.user }, organization: { findUniqueOrThrow: mocks.organization }, student: { findMany: mocks.student }, payment: { findMany: mocks.payment }, attendanceMark: { findMany: mocks.attendance } }) } }));
vi.mock("@/services/accessPolicy.service", () => ({ AccessPolicy: { authorizeAction: mocks.authorize } }));
const query = reportQuerySchema.parse({ from: "2026-09-01", through: "2026-09-27", search: "Aman", status: "DUE" });
describe("branch reports authorization and projection", () => {
    beforeEach(() => { vi.clearAllMocks(); mocks.authorize.mockResolvedValue({ organizationId: "org" }); mocks.organization.mockResolvedValue({ timezone: "Asia/Kolkata" }); mocks.user.mockResolvedValue({ documentLanguage: "en" }); mocks.payment.mockResolvedValue([]); mocks.student.mockResolvedValue([]); mocks.attendance.mockResolvedValue([]); });
    it("authorizes financial access before reading any tenant data", async () => {
        mocks.authorize.mockRejectedValue(new Error("Not found"));
        await expect(BranchReportService.read("actor", "foreign", query)).rejects.toThrow("Not found");
        expect(mocks.payment).not.toHaveBeenCalled(); expect(mocks.user).not.toHaveBeenCalled();
    });
    it("scopes child records and student matching to the authorized branch, preserves partial balances", async () => {
        mocks.payment.mockResolvedValue([{ student: { name: "Aman" }, type: "MONTHLY", periodStart: new Date("2026-09-01"), periodEnd: new Date("2026-09-30"), dueDate: new Date("2026-09-01"), amount: 2000, collectedAmount: 700, waivedAmount: 300, status: "DUE" }]);
        const report = await BranchReportService.read("actor", "branch", query);
        expect(mocks.authorize).toHaveBeenCalledWith("actor", "branch", "view_payments", expect.anything());
        expect(mocks.payment).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ branchId: "branch", status: "DUE", student: { branchId: "branch", name: { contains: "Aman", mode: "insensitive" } } }), take: 10_001 }));
        expect(report.rows[0].slice(5, 9)).toEqual([2000, 700, 300, 1000]); expect(mocks.student).not.toHaveBeenCalled();
        expect(mocks.payment.mock.calls[0][0].where.dueDate.gte.toISOString()).toBe("2026-08-31T18:30:00.000Z");
        expect(mocks.payment.mock.calls[0][0].select).not.toHaveProperty("phone");
    });
    it("uses student permission for explicit attendance records without reading finances", async () => {
        await BranchReportService.read("actor", "branch", reportQuerySchema.parse({ from: "2026-09-01", through: "2026-09-27", kind: "attendance" }));
        expect(mocks.authorize).toHaveBeenCalledWith("actor", "branch", "students", expect.anything());
        expect(mocks.payment).not.toHaveBeenCalled(); expect(mocks.attendance).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ branchId: "branch", student: { branchId: "branch" } }) }));
    });
    it("uses recorded legacy settlement status without inventing ledger receipts", async () => {
        const fee = { student: { name: "Legacy student" }, type: "MONTHLY", periodStart: new Date("2026-09-01"), periodEnd: new Date("2026-09-30"), dueDate: new Date("2026-09-01"), amount: 2000, collectedAmount: 0, waivedAmount: 0, ledgerBacked: false };
        mocks.payment.mockResolvedValue([{ ...fee, status: "PAID" }, { ...fee, status: "WAIVED" },
            { ...fee, ledgerBacked: true, status: "PAID", collectedAmount: 1500, waivedAmount: 500 }]);
        const report = await BranchReportService.read("actor", "branch", { ...query, status: "ALL" });
        expect(report.rows.map(row => row.slice(5, 9))).toEqual([[2000, 2000, 0, 0], [2000, 0, 2000, 0], [2000, 1500, 500, 0]]);
        expect(mocks.payment.mock.calls[0][0].select.ledgerBacked).toBe(true);
    });
    it("refuses a truncated download and uses independent document-language headings", async () => {
        mocks.user.mockResolvedValue({ documentLanguage: "hi" });
        const report = await BranchReportService.read("actor", "branch", query); expect(report.columns[0]).not.toBe("Student name");
        mocks.student.mockResolvedValue(Array.from({ length: 10_001 }, () => ({ name: "Fixture", status: "ACTIVE", joinedAt: new Date("2026-09-01") })));
        await expect(BranchReportService.read("actor", "branch", reportQuerySchema.parse({ from: "2026-09-01", through: "2026-09-27", kind: "students" }))).rejects.toThrow("10,000 rows");
    });
});
