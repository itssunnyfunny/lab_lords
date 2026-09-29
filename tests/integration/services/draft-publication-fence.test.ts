import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as generation from "@/ai/generationLease";
import { draftOverdueMessages } from "@/ai/messageDrafting/branchMessageDrafter";
import { MESSAGE_DRAFT_ACTION_PREFIX, MESSAGE_REGENERATION_COOLDOWN_MS } from "@/lib/messageDrafts";
import { AccessPolicy, type BranchAccessContext } from "@/services/accessPolicy.service";
import { FeeCollectionService, lockFeeStudent } from "@/services/feeCollection.service";
import { PaymentService } from "@/services/payment.service";
import { createPayment, createSaasSubscription, createStudent, createTestWorld } from "@/tests/factories";
import { disconnectDatabase, resetDatabase, testPrisma } from "@/tests/setup/db";

// Connected suite: invoke only against a separately verified disposable local
// PostgreSQL target. The normal integration setup checks identity and truncates.
// Only Gemini is replaced; authorization, readers, leases, fee writers and all
// publication transactions below use the real application and PostgreSQL.
const mocks = vi.hoisted(() => ({ gemini: vi.fn() }));
vi.mock("@/ai/llm/gemini.client", () => ({ callGemini: mocks.gemini }));

const NOW = new Date("2026-09-29T12:00:00.000Z");
const oldDraftAt = new Date(NOW.getTime() - 60 * 60_000);

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => { resolve = done; });
    return { promise, resolve };
}

function outcome<T>(promise: Promise<T>) {
    return promise.then(value => ({ value, error: null as unknown }), error => ({ value: null, error: error as unknown }));
}

async function within<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([promise, new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => reject(new Error("Controlled publication barrier exceeded its deadline")), ms);
        })]);
    } finally {
        if (timer) clearTimeout(timer);
    }
}

async function fixture() {
    const world = await createTestWorld();
    await createSaasSubscription({ organizationId: world.org.id });
    await testPrisma.branch.update({ where: { id: world.branch.id }, data: { aiEnabled: true } });
    const student = await createStudent({ branchId: world.branch.id, name: "Synthetic draft student" });
    const payment = await createPayment({ branchId: world.branch.id, studentId: student.id, amount: 1000,
        dueDate: new Date("2026-08-21T00:00:00.000Z"),
        periodStart: new Date("2026-08-01T00:00:00.000Z"), periodEnd: new Date("2026-09-01T00:00:00.000Z") });
    const original = await testPrisma.messageDraft.create({ data: {
        branchId: world.branch.id, studentId: student.id, action: MESSAGE_DRAFT_ACTION_PREFIX,
        language: "en", message: "Synthetic previous draft", createdAt: oldDraftAt,
    } });
    const access = await AccessPolicy.authorizeCapability(world.user.id, world.branch.id, "aiGenerate");
    const input = { studentId: student.id, paymentIds: [payment.id], amount: 300,
        method: "CASH" as const, reference: "", note: "", idempotencyKey: randomUUID() };
    return { ...world, student, payment, original, access, input };
}

async function pauseGeneration(access: BranchAccessContext, studentIds: string[]) {
    const entered = deferred<void>();
    const response = deferred<string>();
    mocks.gemini.mockImplementationOnce(() => {
        entered.resolve();
        return response.promise;
    });
    const settled = outcome(draftOverdueMessages(access, {
        regenerateStudentIds: studentIds, generateMissing: false,
    }));
    await within(Promise.race([entered.promise, settled.then(result => {
        throw result.error ?? new Error("Generation completed without reaching the controlled provider");
    })]), 4000);
    return {
        settled,
        complete: () => response.resolve(JSON.stringify(studentIds.map(studentId => ({
            studentId, message: "Synthetic draft based on the original debt.",
        })))),
    };
}

describe("AI draft publication fence — controlled PostgreSQL interleavings", () => {
    beforeEach(async () => {
        vi.restoreAllMocks(); vi.clearAllMocks();
        // Freeze Date only: real timers and socket scheduling remain available
        // to PostgreSQL, transaction timeouts and explicit barrier deadlines.
        vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(NOW);
        vi.stubGlobal("fetch", vi.fn(() => { throw new Error("External provider access is forbidden in this connected fixture"); }));
        await resetDatabase();
    });
    afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
    afterAll(disconnectDatabase);

    it("publishes and rereads an unchanged source with one durable current marker", async () => {
        const f = await fixture();
        const run = await pauseGeneration(f.access, [f.student.id]);
        try {
            run.complete();
            const result = await run.settled;
            expect(result.error).toBeNull();
            expect(result.value).toMatchObject({ action: MESSAGE_DRAFT_ACTION_PREFIX,
                meta: { generatedCount: 1 }, items: [{ studentId: f.student.id, amount: 1000, isOutdated: false }] });
            const stored = await testPrisma.messageDraft.findMany({ where: { branchId: f.branch.id } });
            expect(stored).toHaveLength(1);
            expect(stored[0].action).toMatch(/:SOURCE_V1:[a-f0-9]{64}$/);
            expect(stored[0].id).not.toBe(f.original.id);
            expect((await draftOverdueMessages(f.access, { allowGeneration: false })).items[0])
                .toMatchObject({ amount: 1000, isOutdated: false, message: stored[0].message });
            expect(mocks.gemini).toHaveBeenCalledTimes(1);
        } finally { run.complete(); await run.settled; }
    });

    it("rejects old provider output after a real partial collection commits", async () => {
        const f = await fixture();
        const run = await pauseGeneration(f.access, [f.student.id]);
        try {
            await FeeCollectionService.collect(f.user.id, f.branch.id, f.input);
            run.complete();
            expect((await run.settled).error).toBeInstanceOf(generation.DraftSourceChangedError);
            expect(await testPrisma.payment.findUniqueOrThrow({ where: { id: f.payment.id } }))
                .toMatchObject({ status: "DUE", collectedAmount: 300 });
            expect(await testPrisma.messageDraft.count({ where: { branchId: f.branch.id } })).toBe(0);
            const cache = await draftOverdueMessages(f.access, { allowGeneration: false });
            expect(cache.items[0]).toMatchObject({ amount: 700, message: "" });
            expect(new Date(cache.meta.nextAllowedCallAt).getTime()).toBeGreaterThan(NOW.getTime());
            expect(mocks.gemini).toHaveBeenCalledTimes(1);
        } finally { run.complete(); await run.settled; }
    });

    it("cannot resurrect a draft after the real waiver writer resolves its debt", async () => {
        const f = await fixture();
        const run = await pauseGeneration(f.access, [f.student.id]);
        try {
            await PaymentService.markPaymentAsWaived(f.user.id, f.payment.id);
            run.complete();
            expect((await run.settled).error).toBeInstanceOf(generation.DraftSourceChangedError);
            expect(await testPrisma.messageDraft.count({ where: { branchId: f.branch.id } })).toBe(0);
            expect((await draftOverdueMessages(f.access, { allowGeneration: false })).items).toEqual([]);
            expect(await testPrisma.payment.findUniqueOrThrow({ where: { id: f.payment.id } })).toMatchObject({ status: "WAIVED" });
        } finally { run.complete(); await run.settled; }
    });

    it("rejects old output after the real monthly-fee writer adds a newly overdue source", async () => {
        const f = await fixture();
        const run = await pauseGeneration(f.access, [f.student.id]);
        try {
            await PaymentService.ensureMonthlyPaymentForStudent(f.user.id, f.branch.id, {
                studentId: f.student.id, amount: 400,
                periodStart: new Date("2026-09-01T00:00:00.000Z"),
                periodEnd: new Date("2026-10-01T00:00:00.000Z"), dueDate: new Date("2026-09-01T00:00:00.000Z"),
            });
            run.complete();
            expect((await run.settled).error).toBeInstanceOf(generation.DraftSourceChangedError);
            expect(await testPrisma.messageDraft.findMany({ where: { branchId: f.branch.id } }))
                .toEqual([f.original]);
            expect((await draftOverdueMessages(f.access, { allowGeneration: false })).items[0])
                .toMatchObject({ amount: 1400, paymentCount: 2, isOutdated: true });
        } finally { run.complete(); await run.settled; }
    });

    it("rejects a stale reduced balance after an owner voids a real collection", async () => {
        const f = await fixture();
        const collection = await FeeCollectionService.collect(f.user.id, f.branch.id, f.input);
        const run = await pauseGeneration(f.access, [f.student.id]);
        try {
            await FeeCollectionService.void(f.user.id, f.branch.id, collection.id, "Synthetic correction");
            run.complete();
            expect((await run.settled).error).toBeInstanceOf(generation.DraftSourceChangedError);
            expect((await draftOverdueMessages(f.access, { allowGeneration: false })).items[0])
                .toMatchObject({ amount: 1000, message: "" });
            expect(await testPrisma.messageDraft.count({ where: { branchId: f.branch.id } })).toBe(0);
        } finally { run.complete(); await run.settled; }
    });

    it("fails NOWAIT before a writer holding the Student lock is allowed to finish", async () => {
        const f = await fixture();
        const run = await pauseGeneration(f.access, [f.student.id]);
        const locked = deferred<void>(); const continueWriter = deferred<void>();
        let writerFinished = false;
        const writer = outcome(testPrisma.$transaction(async tx => {
            // This is the real fee writer's locking primitive. Hold before
            // Branch work so generation cleanup can finish independently.
            await lockFeeStudent(tx, f.student.id, f.branch.id);
            locked.resolve();
            await continueWriter.promise;
            return FeeCollectionService.collectInTransaction(f.user.id, f.branch.id, f.input, tx);
        }, { timeout: 10_000 }).finally(() => { writerFinished = true; }));
        try {
            await within(Promise.race([locked.promise, writer.then(result => {
                throw result.error ?? new Error("Writer completed before the lock barrier");
            })]), 4000);
            run.complete();
            const result = await within(run.settled, 4000);
            expect(result.error).toBeInstanceOf(generation.DraftPublicationBusyError);
            expect(writerFinished).toBe(false);
            expect(await testPrisma.messageDraft.findUnique({ where: { id: f.original.id } })).toEqual(f.original);
        } finally {
            continueWriter.resolve(); run.complete();
            const [writerResult] = await Promise.all([writer, run.settled]);
            if (writerResult.error) throw writerResult.error;
        }
        expect(await testPrisma.payment.findUniqueOrThrow({ where: { id: f.payment.id } })).toMatchObject({ collectedAmount: 300 });
        expect(await testPrisma.messageDraft.count({ where: { branchId: f.branch.id } })).toBe(0);
    });

    it("rejects a late owner and does not clear its successor's lease", async () => {
        const f = await fixture();
        const run = await pauseGeneration(f.access, [f.student.id]);
        let successor: string | null = null;
        try {
            await testPrisma.branchGenerationLease.update({ where: { branchId_kind: { branchId: f.branch.id, kind: "DRAFTS" } },
                data: { lastStartedAt: new Date(NOW.getTime() - 6 * 60_000), leaseUntil: new Date(NOW.getTime() - 1) } });
            successor = await generation.claimGeneration(f.branch.id, "DRAFTS", MESSAGE_REGENERATION_COOLDOWN_MS);
            expect(successor).toBeTruthy();
            run.complete();
            expect((await run.settled).error).toBeInstanceOf(generation.DraftSourceChangedError);
            expect(await testPrisma.branchGenerationLease.findUniqueOrThrow({ where: { branchId_kind: { branchId: f.branch.id, kind: "DRAFTS" } } }))
                .toMatchObject({ token: successor });
            expect(await testPrisma.messageDraft.findMany({ where: { branchId: f.branch.id } })).toEqual([f.original]);
        } finally {
            run.complete(); await run.settled;
            if (successor) await generation.releaseGeneration(f.branch.id, "DRAFTS", successor);
        }
    });

    it("rolls back every replacement and keeps cooldown when publication fails after writing the batch", async () => {
        const f = await fixture();
        const second = await createStudent({ branchId: f.branch.id, name: "Synthetic second student", phone: "9999999998" });
        await createPayment({ branchId: f.branch.id, studentId: second.id, amount: 600,
            dueDate: new Date("2026-08-21T00:00:00.000Z"),
            periodStart: new Date("2026-08-01T00:00:00.000Z"), periodEnd: new Date("2026-09-01T00:00:00.000Z") });
        const secondOriginal = await testPrisma.messageDraft.create({ data: {
            branchId: f.branch.id, studentId: second.id, action: MESSAGE_DRAFT_ACTION_PREFIX,
            language: "en", message: "Synthetic second previous draft", createdAt: oldDraftAt,
        } });
        const realPublish = generation.publishDraftGeneration;
        vi.spyOn(generation, "publishDraftGeneration").mockImplementationOnce((branchId, token, ids, assertSource, publish) =>
            realPublish(branchId, token, ids, assertSource, async tx => {
                await publish(tx);
                throw new Error("Synthetic publication failure after batch writes");
            }));
        mocks.gemini.mockResolvedValue("[]");
        const request = { regenerateStudentIds: [f.student.id, second.id], generateMissing: false };
        await expect(draftOverdueMessages(f.access, request)).rejects.toThrow("Synthetic publication failure after batch writes");
        const stored = await testPrisma.messageDraft.findMany({ where: { branchId: f.branch.id }, orderBy: { id: "asc" } });
        expect(stored).toEqual([f.original, secondOriginal].sort((left, right) => left.id.localeCompare(right.id)));
        const lease = await testPrisma.branchGenerationLease.findUniqueOrThrow({ where: { branchId_kind: { branchId: f.branch.id, kind: "DRAFTS" } } });
        expect(lease).toMatchObject({ token: null, leaseUntil: null, lastStartedAt: NOW });
        const retry = await draftOverdueMessages(f.access, request);
        expect(retry.meta).toMatchObject({ generatedCount: 0, rateLimited: true, pendingGenerationCount: 2 });
        expect(retry.items).toHaveLength(2);
        expect(mocks.gemini).toHaveBeenCalledTimes(1);
    });
});
