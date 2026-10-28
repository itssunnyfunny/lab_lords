import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createPayment, createStudent, createTestWorld, createUser } from "@/tests/factories";
import { disconnectDatabase, resetDatabase, testPrisma } from "@/tests/setup/db";
import { PaymentService } from "@/services/payment.service";

const mocks = vi.hoisted(() => ({ session: vi.fn(), gemini: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSessionUser: mocks.session }));
vi.mock("@/ai/llm/gemini.client", () => ({ callGemini: mocks.gemini }));
import { GET, POST } from "@/app/api/ai/branch/[branchId]/messages/route";

beforeEach(async () => { vi.clearAllMocks(); await resetDatabase(); });
afterAll(disconnectDatabase);

describe("retired messages preserve historical data", () => {
    it("returns 410 for reads and generation without modifying legacy drafts or leases", async () => {
        const { user, branch } = await createTestWorld(); const student = await createStudent({ branchId: branch.id });
        const old = await testPrisma.messageDraft.create({ data: { branchId: branch.id, studentId: student.id,
            action: "FOLLOW_UP_OVERDUE_PAYMENTS", language: "en", message: "Historical draft retained" } });
        const lease = await testPrisma.branchGenerationLease.create({ data: { branchId: branch.id, kind: "DRAFTS", token: null, lastStartedAt: new Date("2020-01-01") } });
        mocks.session.mockResolvedValue({ id: user.id });
        for (const [method, handler] of [["GET", GET], ["POST", POST]] as const) {
            const response = await handler(new Request("http://local.test/api/messages", { method }), { params: Promise.resolve({ branchId: branch.id }) });
            expect(response.status).toBe(410); expect(await response.json()).toMatchObject({ code: "AI_MESSAGES_RETIRED" });
        }
        expect(await testPrisma.messageDraft.findUniqueOrThrow({ where: { id: old.id } })).toEqual(old);
        expect(await testPrisma.branchGenerationLease.findUniqueOrThrow({ where: { id: lease.id } })).toEqual(lease);
        expect(mocks.gemini).not.toHaveBeenCalled();
    });
    it("does not let a later legitimate payment erase historical message text", async () => {
        const { user, branch } = await createTestWorld(); const student = await createStudent({ branchId: branch.id });
        const payment = await createPayment({ branchId: branch.id, studentId: student.id, dueDate: new Date("2026-01-01"), periodStart: new Date("2026-01-01"), periodEnd: new Date("2026-02-01") });
        const old = await testPrisma.messageDraft.create({ data: { branchId: branch.id, studentId: student.id,
            action: "FOLLOW_UP_OVERDUE_PAYMENTS", language: "en", message: "Historical pre-payment text" } });
        await PaymentService.markPaymentAsPaid(user.id, payment.id);
        expect(await testPrisma.messageDraft.findUniqueOrThrow({ where: { id: old.id } })).toEqual(old);
        expect((await testPrisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("PAID");
    });
    it("keeps anonymous and foreign-branch responses tenant-safe", async () => {
        const { branch } = await createTestWorld(); const foreign = await createUser();
        mocks.session.mockResolvedValue(null);
        expect((await GET(new Request("http://local.test"), { params: Promise.resolve({ branchId: branch.id }) })).status).toBe(401);
        mocks.session.mockResolvedValue({ id: foreign.id });
        const existing = await GET(new Request("http://local.test"), { params: Promise.resolve({ branchId: branch.id }) });
        const missing = await GET(new Request("http://local.test"), { params: Promise.resolve({ branchId: "missing" }) });
        expect(existing.status).toBe(404); expect(missing.status).toBe(404); expect(await existing.json()).toEqual(await missing.json());
        expect(mocks.gemini).not.toHaveBeenCalled();
    });
});
