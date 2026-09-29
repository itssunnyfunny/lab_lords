import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const io = vi.hoisted(() => ({
    authorize: vi.fn(), branch: vi.fn(), payments: vi.fn(), paymentCount: vi.fn(), students: vi.fn(),
    drafts: vi.fn(), latestDraft: vi.fn(), lease: vi.fn(), remove: vi.fn(), create: vi.fn(),
    claim: vi.fn(), publish: vi.fn(), release: vi.fn(), gemini: vi.fn(),
}));
vi.mock("@/services/accessPolicy.service", () => ({ AccessPolicy: { recheckCapability: io.authorize } }));
vi.mock("@/lib/prisma", () => ({ prisma: {
    branch: { findUnique: io.branch }, payment: { findMany: io.payments, count: io.paymentCount },
    student: { findMany: io.students },
    messageDraft: { findMany: io.drafts, findFirst: io.latestDraft },
    branchGenerationLease: { findUnique: io.lease },
} }));
vi.mock("@/ai/llm/gemini.client", () => ({ callGemini: io.gemini }));
vi.mock("@/ai/generationLease", () => ({
    claimGeneration: io.claim, publishDraftGeneration: io.publish, releaseGeneration: io.release,
    DraftSourceChangedError: class DraftSourceChangedError extends Error {},
}));

import { draftOverdueMessages } from "@/ai/messageDrafting/branchMessageDrafter";
import {
    buildDraftDebtFingerprints, draftSourceFingerprint, loadDraftDebtSource, versionedDraftAction,
    type DraftDebtReader,
} from "@/ai/messageDrafting/debtSource";
import type { BranchAccessContext } from "@/services/accessPolicy.service";
import { MESSAGE_DRAFT_ACTION_PREFIX as action } from "@/lib/messageDrafts";

type Fee = { id: string; branchId: string; studentId: string; dueDate: Date; status: string;
    amount: number; collectedAmount: number; waivedAmount: number };
type Draft = { id: string; branchId: string; studentId: string; action: string; language: string; message: string; createdAt: Date };
type DraftWhere = { branchId?: string; studentId?: string | { in: string[] }; language?: string;
    action?: string | { startsWith: string }; OR?: DraftWhere[] };
const day = (value: string) => new Date(`${value}T12:00:00`);
const beforeBoundary = day("2026-09-28");
const afterBoundary = day("2026-09-29");
const access = {} as BranchAccessContext;
let fees: Fee[];
let drafts: Draft[];
let student: { id: string; name: string; phone: string | null; updatedAt: Date };
function fee(id: string, dueDate: string, amount = 1000): Fee {
    return { id, branchId: "branch", studentId: "student", dueDate: new Date(`${dueDate}T00:00:00`),
        status: "DUE", amount, collectedAmount: 0, waivedAmount: 0 };
}
function draftMatches(record: Draft, where: DraftWhere): boolean {
    return (!where.branchId || record.branchId === where.branchId)
        && (!where.language || record.language === where.language)
        && (!where.studentId || (typeof where.studentId === "string"
            ? record.studentId === where.studentId : where.studentId.in.includes(record.studentId)))
        && (!where.action || (typeof where.action === "string"
            ? record.action === where.action : record.action.startsWith(where.action.startsWith)))
        && (!where.OR || where.OR.some(clause => draftMatches(record, clause)));
}
function existing(actionValue = action): Draft {
    return { id: `cached-${drafts.length}`, branchId: "branch", studentId: "student", action: actionValue,
        language: "en", message: "Synthetic fee of Rs 1,000 is pending.", createdAt: day("2026-09-20") };
}
async function generate() {
    return draftOverdueMessages(access, { regenerateStudentIds: ["student"], generateMissing: false, now: beforeBoundary });
}
async function read(now = beforeBoundary) {
    return draftOverdueMessages(access, { allowGeneration: false, now });
}

beforeEach(() => {
    vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(beforeBoundary);
    fees = [fee("old", "2026-08-21"), fee("next", "2026-09-21")]; drafts = [];
    student = { id: "student", name: "Synthetic", phone: null, updatedAt: day("2026-08-01") };
    io.authorize.mockResolvedValue({ branchId: "branch" });
    io.branch.mockResolvedValue({ defaultMessageLanguage: "en", reminderTone: "polite", aiEnabled: true });
    const matchingFees = (where: { branchId: string; status: string; dueDate: { lt: Date } }) =>
        fees.filter(row => row.branchId === where.branchId && row.status === where.status && row.dueDate < where.dueDate.lt);
    io.payments.mockImplementation(async ({ where }) => matchingFees(where).map(row => ({ ...row, student })));
    io.paymentCount.mockImplementation(async ({ where }) => matchingFees(where).length);
    io.students.mockImplementation(async ({ where }) => where.branchId === "branch" && where.id.in.includes(student.id)
        ? [{ id: student.id, updatedAt: student.updatedAt }] : []);
    io.drafts.mockImplementation(async ({ where }) => drafts.filter(row => draftMatches(row, where))
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime()));
    io.latestDraft.mockImplementation(async ({ where }) => drafts.filter(row => draftMatches(row, where))
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0] ?? null);
    io.lease.mockResolvedValue(null);
    io.claim.mockResolvedValue("synthetic-lease"); io.gemini.mockResolvedValue("[]");
    io.remove.mockImplementation(async ({ where }) => {
        const previous = drafts.length; drafts = drafts.filter(row => !draftMatches(row, where));
        return { count: previous - drafts.length };
    });
    io.create.mockImplementation(async ({ data }) => {
        const row = { ...data, id: `generated-${drafts.length}`, createdAt: new Date() };
        drafts.push(row); return row;
    });
    io.publish.mockImplementation(async (_branch, _token, _ids, assertSource, publish) => {
        const tx = {
            payment: { findMany: io.payments, count: io.paymentCount },
            student: { findMany: io.students },
            messageDraft: { deleteMany: io.remove, create: io.create },
        };
        await assertSource(tx, new Date());
        const result = await publish(tx);
        await assertSource(tx, new Date());
        return result;
    });
});
afterEach(() => vi.useRealTimers());

describe("AI draft source freshness through the actual overdue reader", () => {
    it("withholds legacy text and marks it outdated even when Student has not changed", async () => {
        drafts.push(existing());
        const result = await read();
        expect(result.items[0]).toMatchObject({ message: "", amount: 1000, isOutdated: true });
        expect(drafts[0].message).toContain("Rs 1,000");
        expect(io.gemini).not.toHaveBeenCalled(); expect(io.claim).not.toHaveBeenCalled();
        expect(io.publish).not.toHaveBeenCalled(); expect(io.remove).not.toHaveBeenCalled();
    });

    it("keeps an unchanged versioned source current and the response action semantic", async () => {
        await generate();
        expect(drafts[0].action).toMatch(new RegExp(`^${action}:SOURCE_V1:[a-f0-9]{64}$`));
        const result = await read();
        expect(result.action).toBe(action);
        expect(result.items[0]).toMatchObject({ amount: 1000, isOutdated: false });
        expect(io.gemini).toHaveBeenCalledTimes(1);
    });

    it("marks text outdated when another existing fee ages past seven days without a Student edit", async () => {
        await generate(); vi.setSystemTime(afterBoundary);
        const result = await read(afterBoundary);
        expect(result.items[0]).toMatchObject({ amount: 2000, paymentCount: 2, isOutdated: true });
        expect(result.items[0].message).toBe("");
        expect(io.gemini).toHaveBeenCalledTimes(1);
    });

    it("uses the supplied source clock for canonical overdue eligibility", async () => {
        await generate();
        const result = await read(afterBoundary);
        expect(result.items[0]).toMatchObject({ amount: 2000, paymentCount: 2, isOutdated: true });
    });

    it.each([
        ["time eligibility", () => { vi.setSystemTime(afterBoundary); }],
        ["partial collection", () => { fees[0].collectedAmount = 300; }],
        ["waiver", () => { fees[0].waivedAmount = 200; }],
        ["new due", () => { fees.push(fee("new", "2026-08-22", 400)); }],
    ] as const)("rejects %s changed during fake AI latency before any draft write", async (_name, change) => {
        let finish!: (value: string) => void;
        let entered!: () => void;
        const waitingForProvider = new Promise<void>(resolve => { entered = resolve; });
        io.gemini.mockImplementationOnce(() => {
            entered();
            return new Promise<string>(resolve => { finish = resolve; });
        });
        const pending = generate();
        await waitingForProvider;
        change();
        finish("[]");
        await expect(pending).rejects.toThrow();
        expect(io.remove).not.toHaveBeenCalled();
        expect(io.create).not.toHaveBeenCalled();
        expect(drafts).toEqual([]);
    });

    it.each([
        ["partial collection", () => { fees[0].collectedAmount = 300; }, 700],
        ["partial waiver", () => { fees[0].waivedAmount = 250; }, 750],
        ["new overdue fee", () => { fees.push(fee("added", "2026-08-22", 400)); }, 1400],
        ["waived source replaced at the same total", () => { fees[0].status = "WAIVED"; fees.push(fee("replacement", "2026-08-21")); }, 1000],
        ["changed due date", () => { fees[0].dueDate = new Date("2026-08-20T00:00:00"); }, 1000],
        ["changed name without a revision bump", () => { student.name = "Renamed synthetic"; }, 1000],
        ["student revision", () => { student.updatedAt = new Date(beforeBoundary.getTime() + 1000); }, 1000],
    ] as const)("detects %s without relying on Student timestamp changes", async (_label, change, amount) => {
        await generate(); change();
        expect((await read()).items[0]).toMatchObject({ amount, isOutdated: true });
    });

    it("detects elapsed overdue days even when no additional fee becomes overdue", async () => {
        fees = [fees[0]]; await generate();
        expect((await read(afterBoundary)).items[0]).toMatchObject({ amount: 1000, paymentCount: 1, isOutdated: true });
    });

    it("does not return drafts for fully resolved debt", async () => {
        await generate(); fees[0].status = "PAID";
        expect((await read()).items).toEqual([]);
        expect(io.gemini).toHaveBeenCalledTimes(1);
    });

    it("treats a malformed stored source marker as outdated", async () => {
        drafts.push(existing(`${action}:SOURCE_V1:invalid`));
        expect((await read()).items[0]).toMatchObject({ isOutdated: true });
    });

    it("replaces only the exact action and language family", async () => {
        drafts.push(existing(), existing(`${action}:SOURCE_V1:${"a".repeat(64)}`),
            existing(`${action}:friendly:name-date-fee:SOURCE_V1:${"b".repeat(64)}`),
            { ...existing(), language: "hi" }, { ...existing(), branchId: "other" });
        await generate();
        expect(drafts).toHaveLength(4);
        expect(drafts.filter(row => row.branchId === "branch" && row.language === "en" && !row.action.includes(":friendly:")))
            .toHaveLength(1);
        expect((await read()).items[0]).toMatchObject({ isOutdated: false });
    });

    it("retains durable cooldown on cache-only reads", async () => {
        await generate();
        const result = await read();
        expect(result.meta.nextAllowedCallAt).toBe(new Date(beforeBoundary.getTime() + 300_000).toISOString());
        expect(io.claim).toHaveBeenCalledTimes(1); expect(io.gemini).toHaveBeenCalledTimes(1);
    });

    it("keeps selected still-overdue students in the response while regeneration is cooling down", async () => {
        await generate();
        const response = await generate();
        expect(response.meta).toMatchObject({ rateLimited: true, pendingGenerationCount: 1, generatedCount: 0 });
        expect(response.items).toHaveLength(1);
        expect(response.items[0]).toMatchObject({ studentId: "student", amount: 1000, isOutdated: false });
        expect(response.items[0].message).toContain("Rs 1,000");
        expect(io.gemini).toHaveBeenCalledTimes(1);
    });

    it("keeps a blank current target when another caller won generation admission", async () => {
        io.claim.mockResolvedValue(null);
        const response = await generate();
        expect(response.meta).toMatchObject({ rateLimited: true, pendingGenerationCount: 1, generatedCount: 0 });
        expect(response.items).toHaveLength(1);
        expect(response.items[0]).toMatchObject({ studentId: "student", amount: 1000, message: "" });
        expect(io.gemini).not.toHaveBeenCalled();
    });

    it("cannot mark a cached draft current when its scoped Student revision is missing", async () => {
        await generate(); io.students.mockResolvedValue([]);
        expect((await read()).items[0].isOutdated).toBe(true);
    });

    it("applies freshness checks to selected cache-only requests without generating", async () => {
        drafts.push(existing());
        const result = await draftOverdueMessages(access, { allowGeneration: false, regenerateStudentIds: ["student"], now: beforeBoundary });
        expect(result.items[0].isOutdated).toBe(true);
        expect(io.claim).not.toHaveBeenCalled(); expect(io.gemini).not.toHaveBeenCalled();
    });
});

describe("draft debt source contract", () => {
    it("uses only the supplied transaction reader and preserves branch scope and canonical overdue arithmetic", async () => {
        const paymentRead = vi.fn().mockResolvedValue([{ ...fees[0], collectedAmount: 300, waivedAmount: 200, student }]);
        const countRead = vi.fn().mockResolvedValue(1);
        const studentRead = vi.fn().mockResolvedValue([{ id: student.id, updatedAt: student.updatedAt }]);
        const client = { payment: { findMany: paymentRead, count: countRead }, student: { findMany: studentRead } } as unknown as DraftDebtReader;
        const result = await loadDraftDebtSource("branch", beforeBoundary, client);
        expect(result.payments[0]).toMatchObject({ paymentId: "old", studentId: "student", amount: 500 });
        expect(result.fingerprintsByStudentId.get("student")).toMatch(/^[a-f0-9]{64}$/);
        expect(paymentRead.mock.calls[0][0].where).toMatchObject({ branchId: "branch", status: "DUE" });
        expect(studentRead).toHaveBeenCalledWith({ where: { branchId: "branch", id: { in: ["student"] } }, select: { id: true, updatedAt: true } });
        expect(io.payments).not.toHaveBeenCalled(); expect(io.paymentCount).not.toHaveBeenCalled(); expect(io.students).not.toHaveBeenCalled();
    });

    it("has stable ordering while separating branches and student identities", async () => {
        const source = await loadDraftDebtSource("branch", afterBoundary);
        const original = source.fingerprintsByStudentId.get("student");
        const revision = [{ id: student.id, updatedAt: student.updatedAt }];
        expect(buildDraftDebtFingerprints("branch", [...source.payments].reverse(), revision).get("student")).toBe(original);
        expect(buildDraftDebtFingerprints("other", source.payments, revision).get("student")).not.toBe(original);
        const other = source.payments.map(payment => ({ ...payment, studentId: "other-student" }));
        expect(buildDraftDebtFingerprints("branch", other, [{ id: "other-student", updatedAt: student.updatedAt }]).get("other-student"))
            .not.toBe(original);
    });

    it("strictly parses the exact variant's marker and keeps the longest action bounded", () => {
        const fingerprint = "a".repeat(64);
        const variant = `${action}:friendly:name-date-fee`;
        const stored = versionedDraftAction(variant, fingerprint);
        expect(stored).toHaveLength(124);
        expect(draftSourceFingerprint(stored, variant)).toBe(fingerprint);
        expect(draftSourceFingerprint(stored, action)).toBeNull();
        expect(draftSourceFingerprint(`${stored}extra`, variant)).toBeNull();
        expect(draftSourceFingerprint(action, action)).toBeNull();
        expect(() => versionedDraftAction(action, "invalid")).toThrow("source is unavailable");
    });
});
