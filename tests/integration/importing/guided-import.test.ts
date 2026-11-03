import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { format } from "date-fns";
import { randomUUID } from "node:crypto";
const provider = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("@/ai/llm/gemini.client", () => ({ callGeminiJson: provider.call, resolveGeminiProModel: () => "deterministic-provider-fixture" }));
import { ImportSessionService } from "@/importing/services/import-session.service";
import { ImportPlanService } from "@/importing/services/import-plan.service";
import { ImportRunService } from "@/importing/services/import-run.service";
import { ImportRunRunner } from "@/importing/services/import-runner.service";
import { ImportRunExecutor } from "@/importing/services/import-run-executor.service";
import { ImportWiringService } from "@/importing/services/import-wiring.service";
import { PaymentService } from "@/services/payment.service";
import { SeatAllocationService } from "@/services/seatAllocation.service";
import { createTestWorld, createSaasSubscription, createSeat, createShift, createStudent, createUser, createBranch, createStaff } from "@/tests/factories";
import { resetDatabase, disconnectDatabase, testPrisma as db } from "@/tests/setup/db";
import { prisma } from "@/lib/prisma";
import { draftFromImportRowWithFallback, normalizedFromImportDraft } from "@/importing/utils/manual-row-draft";
import { freezeTime, restoreTime } from "@/tests/setup/time";
import type { ImportNormalizedRow } from "@/importing/contracts/import-session.contract";

type World = Awaited<ReturnType<typeof createTestWorld>>;
async function draft(f: World, lines: string[]) {
    const created = await ImportSessionService.createSession(f.user.id, f.branch.id, { sourceType: "PASTED_TABLE", fileName: "synthetic.tsv", experience: "GUIDED_CURRENT_MONTH_V1", pastedTable: ["Name\tPhone\tJoined Date\tMonthly Fee\tShift\tSeat\tPayment Status\tPayment Method\tPaid Amount", ...lines].join("\n") });
    const detail = await ImportSessionService.analyzeSession(f.user.id, f.branch.id, created.id, 0);
    await ImportRunRunner.setAnalysisStatus({ importRunId: created.analysisRun.id, status: "COMPLETED" });
    return detail;
}
async function commit(f: World, detail: Awaited<ReturnType<typeof draft>>) {
    const plan = await ImportPlanService.compilePlan({ userId: f.user.id, branchId: f.branch.id, sessionId: detail.id, targetRevision: detail.draftRevision, readinessPolicy: "READY_ROWS_ONLY" });
    const input = { userId: f.user.id, branchId: f.branch.id, sessionId: detail.id, kind: "COMMIT" as const, targetRevision: detail.draftRevision, importPlanId: plan.id, confirmedPlanVersion: plan.planVersion, idempotencyKey: randomUUID() };
    const run = await ImportRunService.createOrGetRun(input);
    expect((await ImportRunService.createOrGetRun(input)).id).toBe(run.id);
    for (let i = 0; i < 10; i++) {
        const items = await ImportRunRunner.claimBatch({ importRunId: run.id, workerId: "guided-fixture", limit: 25 });
        if (!items.length) break;
        for (const item of items) {
            await ImportRunExecutor.executeClaimedItem(item);
            expect(await ImportRunExecutor.executeClaimedItem(item)).toEqual({ alreadyCompleted: true });
        }
    }
    await ImportRunRunner.finalizeRun(run.id);
    return { plan, run, input };
}
describe("guided import uses real parsing, policy, immutable plans and domain mutations", () => {
    beforeEach(async () => {
        await resetDatabase(); freezeTime(new Date(2026, 10, 2, 12));
        vi.stubEnv("IMPORT_V2_ENABLED", "true"); vi.stubEnv("IMPORT_MAX_PLANNED_MUTATIONS", "1000");
        provider.call.mockReset().mockResolvedValue({ ok: false, error: "Deterministic provider unavailable" });
    });
    afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); restoreTime(); });
    afterAll(disconnectDatabase);
    async function world(plan: "BASIC" | "STANDARD" | "PRO" = "BASIC") {
        const f = await createTestWorld({ shiftName: "Full Day" });
        await db.organization.update({ where: { id: f.org.id }, data: { billingModelVersion: "WORKSPACE_V2" } });
        await createSaasSubscription({ organizationId: f.org.id, plan, paidThrough: new Date(2027, 0, 1) }); return f;
    }
    it.each(["BASIC", "STANDARD", "PRO"] as const)("prepares structured records on %s without a column approval step, and never backfills", async tier => {
        const f = await world(tier);
        const detail = await draft(f, ["Past Student\t9876501001\t2026-01-01\t1000\t\t\t\t\t", "Today Student\t9876501002\t2026-01-02\t1000\t\t\t\t\t", "Future Student\t9876501003\t2026-01-15\t1000\t\t\tDUE\t\t1000", "New Student\t9876501004\t2026-11-01\t1000\t\t\t\t\t"]);
        expect(detail.questions).toEqual([]); expect(detail.guidance?.needsHelp).toBe(0);
        expect(detail.rows.map(row => row.paymentOutcome?.state)).toEqual(["CREATE_NOW", "CREATE_NOW", "GENERATE_LATER", "NO_DUE"]);
        expect(await db.student.count()).toBe(0);
        await commit(f, detail);
        const students = await db.student.findMany({ where: { branchId: f.branch.id }, orderBy: { name: "asc" } });
        expect(students).toHaveLength(4); expect(students.every(student => !!student.billingStartAt)).toBe(true);
        expect(await db.payment.count()).toBe(2);
        await PaymentService.generateDuePaymentsForBranch(f.user.id, f.branch.id, new Date(2026, 10, 20, 12));
        expect(await db.payment.count()).toBe(3);
        await PaymentService.generateDuePaymentsForBranch(f.user.id, f.branch.id, new Date(2026, 11, 20, 12));
        await PaymentService.generateDuePaymentsForBranch(f.user.id, f.branch.id, new Date(2026, 11, 20, 12));
        const payments = await db.payment.findMany(); expect(payments).toHaveLength(7);
        expect(payments.every(payment => format(payment.dueDate, "yyyy-MM") >= "2026-11")).toBe(true);
        expect(payments.every(payment => payment.status === "DUE")).toBe(true);
        expect(format(students.find(student => student.name === "Past Student")!.joinedAt, "yyyy-MM-dd")).toBe("2026-01-01");
    });
    it("applies repeated ambiguity across pages, sends updated structural context, preserves manual fields and bounds passes", async () => {
        const f = await world();
        let detail = await draft(f, Array.from({ length: 30 }, (_, i) => `Student ${i}\t98765${String(i).padStart(5, "0")}\t${i < 3 ? "" : "2026-01-15"}\t1000\tFD\t\t\t\t`));
        expect(detail.guidance?.groups).toEqual([{ source: "FD", count: 30, suggestionId: f.shift.id }]);
        const page = await ImportSessionService.getSessionDetail(f.user.id, f.branch.id, detail.id, { limit: 5 });
        expect(page.rows).toHaveLength(5); expect(page.guidance?.groups[0].count).toBe(30);
        detail = await ImportSessionService.confirmShiftInterpretation(f.user.id, f.branch.id, detail.id, { expectedRevision: detail.draftRevision, source: "FD", targetId: f.shift.id });
        expect(detail.rows.every(row => (row.normalizedData as ImportNormalizedRow).allocation?.shiftName === "Full Day")).toBe(true);
        const manual = { ...(detail.rows[0].normalizedData as ImportNormalizedRow), student: { ...(detail.rows[0].normalizedData as ImportNormalizedRow).student, name: "Confirmed Name", monthlyFee: 1250 } };
        detail = await ImportSessionService.updateRows(f.user.id, f.branch.id, detail.id, { expectedRevision: detail.draftRevision, edits: [{ rowId: detail.rows[0].id, normalizedData: manual }] });
        detail = await ImportSessionService.analyzeSession(f.user.id, f.branch.id, detail.id);
        const prompt = provider.call.mock.calls.at(-1)![0] as string;
        expect(prompt).toContain("confirmedAnswers"); expect(prompt).toContain('"affectedRecords":30'); expect(prompt).toContain("unresolvedRows");
        expect(prompt).not.toContain("Confirmed Name"); expect(prompt).not.toContain("Full Day"); expect(prompt).not.toContain("9876500000");
        expect(detail.rows[0].normalizedData).toMatchObject({ student: { name: "Confirmed Name", monthlyFee: 1250 } });
        expect(detail.mapping.guidance?.answers[0].affected).toBe(30);
        // Force a new explicit review revision before another bounded pass.
        detail = await ImportSessionService.updateMapping(f.user.id, f.branch.id, detail.id, { expectedRevision: detail.draftRevision, columnMappings: detail.mapping.columnMappings });
        await ImportSessionService.analyzeSession(f.user.id, f.branch.id, detail.id);
        detail = await ImportSessionService.getSessionDetail(f.user.id, f.branch.id, detail.id);
        detail = await ImportSessionService.updateMapping(f.user.id, f.branch.id, detail.id, { expectedRevision: detail.draftRevision, columnMappings: detail.mapping.columnMappings });
        await expect(ImportSessionService.analyzeSession(f.user.id, f.branch.id, detail.id)).rejects.toThrow("limit");
    });
    it("uses a confirmed meaning on another preparation pass to improve unresolved records with correct columns", async () => {
        const f = await world();
        let detail = await draft(f, ["First Meaning\t9876501101\t2026-01-01\t1000\tFD\t\t\t\t",
            "Remaining One\t9876501102\t2026-01-01\t1000\tF.D.\t\t\t\t", "Remaining Two\t9876501103\t2026-01-01\t1000\tF D\t\t\t\t",
            "Manual Student\t9876501104\t2026-01-01\t1000\tF.D.\t\t\t\t"]);
        expect(detail.mapping.columnMappings.every(column => !column.needsReview)).toBe(true);
        const originalMappings = detail.mapping.columnMappings;
        const manual = detail.rows[3];
        const confirmed = { ...(manual.normalizedData as ImportNormalizedRow), student: { ...(manual.normalizedData as ImportNormalizedRow).student, name: "Owner Confirmed", monthlyFee: 1400 } };
        detail = await ImportSessionService.updateRows(f.user.id, f.branch.id, detail.id, { expectedRevision: detail.draftRevision, edits: [{ rowId: manual.id, normalizedData: confirmed }] });
        detail = await ImportSessionService.confirmShiftInterpretation(f.user.id, f.branch.id, detail.id, { expectedRevision: detail.draftRevision, source: "FD", targetId: f.shift.id });
        expect(detail.rows[1].normalizedData).toMatchObject({ allocation: { shiftName: "F.D." } });
        provider.call.mockImplementationOnce(async (prompt: string) => {
            const current = JSON.parse(prompt.match(/opaque structural context\):\n([^\n]+)/)![1]);
            const assistance = current.shiftAssistance;
            expect(prompt).toContain('Uploaded columns:\n[]');
            for (const value of ["Owner Confirmed", "Remaining One", "9876501102", "Full Day", "F.D.", f.shift.id, detail.id]) expect(prompt).not.toContain(value);
            return { ok: true, data: { entityTypesDetected: ["STUDENT"], columnMappings: [], questions: [], warnings: [],
                draftShiftProposals: assistance.groups.map((group: { sourceAlias: string; meaningAlias: string }) => {
                    const answer = assistance.answers.find((answer: { meaningAlias: string }) => answer.meaningAlias === group.meaningAlias);
                    return { sourceAlias: group.sourceAlias, choiceAlias: answer.choiceAlias, answerAlias: answer.answerAlias };
                }) } };
        });
        detail = await ImportSessionService.analyzeSession(f.user.id, f.branch.id, detail.id);
        expect(detail.mapping.columnMappings).toEqual(originalMappings);
        expect(detail.mapping.guidance?.preparedRows).toBe(2);
        expect(detail.rows.slice(0, 3).every(row => (row.normalizedData as ImportNormalizedRow).allocation?.shiftName === "Full Day")).toBe(true);
        expect(detail.rows[3].normalizedData).toEqual(confirmed);
        expect(detail.rows.slice(1, 3).every(row => !(row.issues as Array<{ code: string }>).some(issue => issue.code.includes("SHIFT")))).toBe(true);
        expect(detail.guidance?.needsHelp).toBe(1);
        expect(await db.student.count()).toBe(0);
    });
    it.each(["300", "300.50"])("retains newly interpreted financial source %s while preparing a remaining shift", async receipt => {
        const f = await world();
        const created = await ImportSessionService.createSession(f.user.id, f.branch.id, { sourceType: "PASTED_TABLE", experience: "GUIDED_CURRENT_MONTH_V1",
            pastedTable: `Name\tJoined Date\tMonthly Fee\tShift\tUnknown Receipt\nFirst Meaning\t2026-01-01\t1000\tFD\t\nRemaining\t2026-01-01\t1000\tF.D.\t${receipt}` });
        let detail = await ImportSessionService.analyzeSession(f.user.id, f.branch.id, created.id);
        await ImportRunRunner.setAnalysisStatus({ importRunId: created.analysisRun.id, status: "COMPLETED" });
        detail = await ImportSessionService.confirmShiftInterpretation(f.user.id, f.branch.id, detail.id, { expectedRevision: detail.draftRevision, source: "FD", targetId: f.shift.id });
        provider.call.mockImplementationOnce(async (prompt: string) => {
            const aliases = JSON.parse(prompt.match(/Uploaded columns:\n([^\n]+)/)![1]);
            const context = JSON.parse(prompt.match(/opaque structural context\):\n([^\n]+)/)![1]).shiftAssistance;
            return { ok: true, data: { entityTypesDetected: ["STUDENT", "PAYMENT"], columnMappings: [{ sourceColumn: aliases[0], targetField: "payment.amount", confidence: 99 }],
                questions: [], warnings: [], draftShiftProposals: [{ sourceAlias: context.groups[0].sourceAlias, choiceAlias: context.answers[0].choiceAlias, answerAlias: context.answers[0].answerAlias }] } };
        });
        detail = await ImportSessionService.analyzeSession(f.user.id, f.branch.id, detail.id);
        const row = detail.rows[1];
        expect(row.normalizedData).toMatchObject({ allocation: { shiftName: "Full Day" } });
        expect(row.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: receipt === "300" ? "PARTIAL_PAYMENT_REVIEW" : "INVALID_PAYMENT_AMOUNT" })]));
        if (receipt === "300") expect(row.normalizedData).toMatchObject({ payment: { amount: 300 } });
        expect(detail.mapping.guidance?.preparedRows).toBe(1);
    });
    it.each(["300", "300.50"])("preserves explicitly clearing source amount %s through the real save and reload path", async receipt => {
        const f = await world();
        let detail = await draft(f, [`Student\t9876501201\t2026-01-01\t1000\t\t\t\t\t${receipt}`]);
        const row = detail.rows[0];
        const editorRow = { normalizedData: row.normalizedData as ImportNormalizedRow, rawData: row.rawData as Record<string, string>, mappedData: row.mappedData };
        const editor = draftFromImportRowWithFallback(editorRow, detail.mapping.columnMappings, "RECORDED_ONLY");
        expect(editor.paymentAmount).toBe(receipt);
        detail = await ImportSessionService.updateRows(f.user.id, f.branch.id, detail.id, { expectedRevision: detail.draftRevision,
            edits: [{ rowId: row.id, normalizedData: normalizedFromImportDraft(editorRow, { ...editor, paymentAmount: "" }, detail.branchContext, "RECORDED_ONLY") }] });
        const reloaded = detail.rows[0];
        const reopened = draftFromImportRowWithFallback({ normalizedData: reloaded.normalizedData as ImportNormalizedRow, rawData: reloaded.rawData as Record<string, string>, mappedData: reloaded.mappedData }, detail.mapping.columnMappings, "RECORDED_ONLY");
        expect(reopened.paymentAmount).toBe("");
        expect(reloaded.issues).toEqual([]);
    });
    it("rejects a stale provider publication and leaves manual correction usable", async () => {
        const f = await world(); let detail = await draft(f, ["Student\t9876501001\t2026-01-01\t1000\tFD\t\t\t\t"]);
        let finish!: (result: unknown) => void; let entered!: () => void;
        const started = new Promise<void>(resolve => { entered = resolve; });
        provider.call.mockImplementationOnce(() => { entered(); return new Promise(resolve => { finish = resolve; }); });
        detail = await ImportSessionService.updateMapping(f.user.id, f.branch.id, detail.id, { expectedRevision: detail.draftRevision, columnMappings: detail.mapping.columnMappings });
        const pending = ImportSessionService.analyzeSession(f.user.id, f.branch.id, detail.id);
        const rejected = expect(pending).rejects.toMatchObject({ code: "IMPORT_ANALYSIS_OWNERSHIP_LOST" });
        await started;
        await ImportSessionService.updateRows(f.user.id, f.branch.id, detail.id, { expectedRevision: detail.draftRevision, edits: [{ rowId: detail.rows[0].id, normalizedData: { student: { name: "Owner Confirmed", joinedAt: "2026-01-01T00:00:00.000Z", monthlyFee: 1400 } } }] });
        finish({ ok: false, error: "Provider failed" }); await rejected;
        const current = await ImportSessionService.getSessionDetail(f.user.id, f.branch.id, detail.id);
        expect(current.rows[0].normalizedData).toMatchObject({ student: { name: "Owner Confirmed", monthlyFee: 1400 } });
        expect(current.guidance?.needsHelp).toBe(0);
    });
    it("applies confidence-validated provider mappings and requires an explicit decision for unrecognized values", async () => {
        const f = await world();
        provider.call.mockImplementation(async (prompt: string) => {
            const columns = JSON.parse(prompt.match(/Uploaded columns:\n([^\n]+)/)![1]) as string[];
            return { ok: true, data: { entityTypesDetected: ["STUDENT"], columnMappings: columns.map(sourceColumn => ({ sourceColumn, targetField: "student.phone", confidence: 99 })) } };
        });
        const created = await ImportSessionService.createSession(f.user.id, f.branch.id, { sourceType: "PASTED_TABLE", experience: "GUIDED_CURRENT_MONTH_V1", pastedTable: "Name\tJoined Date\tMonthly Fee\tReach Me\nSynthetic Student\t2026-01-01\t1000\t9876501001" });
        const prepared = await ImportSessionService.analyzeSession(f.user.id, f.branch.id, created.id);
        expect(prepared.rows[0].normalizedData).toMatchObject({ student: { phone: "+91 98765 01001" } });
        expect(prepared.guidance?.needsHelp).toBe(0);
        expect(prepared.mapping.columnMappings.find(column => column.sourceColumn === "Reach Me")).toMatchObject({ source: "AI", targetField: "student.phone", needsReview: false });
        expect(provider.call.mock.calls[0][0]).not.toContain("Synthetic Student");
        provider.call.mockResolvedValue({ ok: false, error: "Provider unavailable" });
        const ambiguous = await ImportSessionService.createSession(f.user.id, f.branch.id, { sourceType: "PASTED_TABLE", experience: "GUIDED_CURRENT_MONTH_V1", pastedTable: "Name\tJoined Date\tMonthly Fee\tUnrecognized\nAnother Student\t2026-01-01\t1000\t300" });
        const held = await ImportSessionService.analyzeSession(f.user.id, f.branch.id, ambiguous.id);
        expect(held.guidance?.needsHelp).toBe(1);
        expect(held.rows[0].issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "SOURCE_COLUMN_REVIEW" })]));
        const confirmed = await ImportSessionService.updateMapping(f.user.id, f.branch.id, held.id, { expectedRevision: held.draftRevision,
            columnMappings: held.mapping.columnMappings.map(column => ({ ...column, needsReview: false })) });
        provider.call.mockImplementation(async (prompt: string) => ({ ok: true, data: { entityTypesDetected: ["STUDENT"],
            columnMappings: (JSON.parse(prompt.match(/Uploaded columns:\n([^\n]+)/)![1]) as string[]).map(sourceColumn => ({ sourceColumn, targetField: "student.phone", confidence: 99 })) } }));
        const reanalyzed = await ImportSessionService.analyzeSession(f.user.id, f.branch.id, held.id, confirmed.draftRevision);
        expect(reanalyzed.mapping.columnMappings.find(column => column.sourceColumn === "Unrecognized")?.targetField).toBe("ignore");
    });
    it("holds partial facts and duplicate existing identities, preserving paid and waived truth", async () => {
        const f = await world(); const existing = await createStudent({ branchId: f.branch.id, name: "Existing", phone: "9876501004", monthlyFee: 900, billingStartAt: new Date("2026-02-01T00:00:00Z") });
        const detail = await draft(f, ["Paid\t9876501001\t2026-01-01\t1000\t\t\tPAID\tUPI\t1000", "Waived\t9876501002\t2026-01-01\t1000\t\t\tWAIVED\t\t", "Partial\t9876501003\t2026-01-01\t1000\t\t\tPAID\tCASH\t300", "Existing\t9876501004\t2026-01-01\t1000\t\t\tDUE\t\t"]);
        expect(detail.guidance?.needsHelp).toBe(2);
        const { run } = await commit(f, detail);
        expect((await db.importRun.findUniqueOrThrow({ where: { id: run.id } })).status).toBe("COMPLETED_WITH_ISSUES");
        expect(await db.student.count()).toBe(3);
        expect(await db.student.findUniqueOrThrow({ where: { id: existing.id } })).toEqual(existing);
        const payments = await db.payment.findMany({ where: { student: { name: { in: ["Paid", "Waived"] } } } });
        expect(payments.map(payment => payment.status).sort()).toEqual(["PAID", "WAIVED"]);
        expect(await db.payment.count({ where: { studentId: existing.id } })).toBe(0);
    });
    it("covers every bundle component and detects intra-import and newly occupied seats at execution", async () => {
        const f = await world(); const evening = await createShift({ branchId: f.branch.id, name: "Evening", startTime: "18:00", endTime: "23:00" });
        const bundle = await db.multiShift.create({ data: { branchId: f.branch.id, name: "Combo", price: 1500, components: { create: [{ shiftId: f.shift.id, order: 0 }, { shiftId: evening.id, order: 1 }] } } });
        const free = await createSeat({ branchId: f.branch.id });
        let detail = await draft(f, [`First\t9876501001\t2026-01-15\t1000\tFull Day\t${f.seat.label}\t\t\t`, `Second\t9876501002\t2026-01-15\t1000\tFull Day\t${f.seat.label}\t\t\t`]);
        expect(detail.guidance?.needsHelp).toBe(2);
        const available = await ImportWiringService.getAvailability(f.user.id, f.branch.id, detail.id, { rowId: detail.rows[0].id, multiShiftId: bundle.id });
        expect(available.seatMap?.seats.find(seat => seat.seatId === f.seat.id)?.source).toBe("staged");
        detail = await ImportSessionService.updateRows(f.user.id, f.branch.id, detail.id, { expectedRevision: detail.draftRevision, skipRowIds: [detail.rows[1].id], edits: [{ rowId: detail.rows[0].id, normalizedData: { student: { name: "First", phone: "9876501001", joinedAt: "2026-01-15T00:00:00Z", monthlyFee: 1000 }, allocation: { seatLabel: free.label, multiShiftName: bundle.name }, multiShift: { name: bundle.name, componentShiftNames: [f.shift.name, evening.name] } } }] });
        const plan = await ImportPlanService.compilePlan({ userId: f.user.id, branchId: f.branch.id, sessionId: detail.id, targetRevision: detail.draftRevision, readinessPolicy: "READY_ROWS_ONLY" });
        const occupant = await createStudent({ branchId: f.branch.id });
        await SeatAllocationService.assignSeatToShifts(f.user.id, free.id, occupant.id, [evening.id]);
        const run = await ImportRunService.createOrGetRun({ userId: f.user.id, branchId: f.branch.id, sessionId: detail.id, kind: "COMMIT", targetRevision: detail.draftRevision, importPlanId: plan.id, confirmedPlanVersion: plan.planVersion, idempotencyKey: randomUUID() });
        const [studentItem] = await ImportRunRunner.claimBatch({ importRunId: run.id, workerId: "late-seat", limit: 10 }); await ImportRunExecutor.executeClaimedItem(studentItem);
        const [allocation] = await ImportRunRunner.claimBatch({ importRunId: run.id, workerId: "late-seat", limit: 10 });
        await expect(ImportRunExecutor.executeClaimedItem(allocation)).rejects.toThrow();
        expect(await db.seatAllocation.count({ where: { seatId: free.id, studentId: { not: occupant.id } } })).toBe(0);
    });
    it("fences date-crossing commits and rejects foreign branches and insufficient permissions", async () => {
        const f = await world(); const detail = await draft(f, ["Student\t9876501001\t2026-01-15\t1000\t\t\t\t\t"]);
        const plan = await ImportPlanService.compilePlan({ userId: f.user.id, branchId: f.branch.id, sessionId: detail.id, targetRevision: detail.draftRevision, readinessPolicy: "READY_ROWS_ONLY" });
        vi.setSystemTime(new Date(2026, 10, 15, 12));
        await expect(ImportPlanService.getPlanForCommit(f.user.id, f.branch.id, detail.id, plan.id)).rejects.toMatchObject({ code: "IMPORT_BUSINESS_DATE_CHANGED" });
        const foreign = await createBranch({ organizationId: f.org.id });
        await expect(ImportSessionService.confirmShiftInterpretation(f.user.id, foreign.id, detail.id, { expectedRevision: detail.draftRevision, source: "FD", targetId: f.shift.id })).rejects.toThrow("not found");
        const user = await createUser(); const staff = await createStaff({ branchId: f.branch.id, userId: user.id });
        await db.staffPermissionOverride.create({ data: { staffId: staff.id, action: "STUDENTS", allowed: false } });
        await expect(ImportSessionService.updateRows(user.id, f.branch.id, detail.id, { expectedRevision: detail.draftRevision, skipRowIds: [detail.rows[0].id] })).rejects.toThrow();
    });
    it("repairs seating in a later month without resetting the successful student or reapplying old paid facts to a new cycle", async () => {
        const f = await world(); const destination = await createSeat({ branchId: f.branch.id });
        let detail = await draft(f, [`Recover Student\t9876501001\t2026-01-01\t1000\tFull Day\t${f.seat.label}\tPAID\tUPI\t1000`]);
        const plan = await ImportPlanService.compilePlan({ userId: f.user.id, branchId: f.branch.id, sessionId: detail.id, targetRevision: detail.draftRevision, readinessPolicy: "READY_ROWS_ONLY" });
        const run = await ImportRunService.createOrGetRun({ userId: f.user.id, branchId: f.branch.id, sessionId: detail.id, kind: "COMMIT", targetRevision: detail.draftRevision, importPlanId: plan.id, confirmedPlanVersion: plan.planVersion, idempotencyKey: randomUUID() });
        const [studentItem] = await ImportRunRunner.claimBatch({ importRunId: run.id, workerId: "month-repair", limit: 25 });
        await ImportRunExecutor.executeClaimedItem(studentItem);
        for (let pass = 0; pass < 5; pass++) {
            const batch = await ImportRunRunner.claimBatch({ importRunId: run.id, workerId: "month-repair", limit: 25 });
            if (!batch.length) break;
            for (const item of batch) {
                if (item.kind === "ALLOCATION") await ImportRunRunner.failItem({ importRunId: run.id, itemId: item.id, leaseToken: item.leaseToken, error: { code: "FIXTURE_CONFLICT", message: "Choose another seat", retryable: false } });
                else await ImportRunExecutor.executeClaimedItem(item);
            }
        }
        await ImportRunRunner.finalizeRun(run.id);
        expect((await db.importSession.findUniqueOrThrow({ where: { id: detail.id } })).status).toBe("PARTIAL");
        const student = await db.student.findFirstOrThrow({ where: { name: "Recover Student" } });
        vi.setSystemTime(new Date(2026, 11, 2, 12));
        const data = JSON.parse(JSON.stringify(detail.rows[0].normalizedData)) as ImportNormalizedRow;
        data.allocation!.seatLabel = destination.label; data.seat!.label = destination.label;
        detail = await ImportSessionService.updateRows(f.user.id, f.branch.id, detail.id, { expectedRevision: detail.draftRevision, edits: [{ rowId: detail.rows[0].id, normalizedData: data }] });
        const repaired = await commit(f, detail);
        expect(repaired.plan.canRun).toBe(true);
        expect(await db.student.count()).toBe(1);
        expect((await db.student.findUniqueOrThrow({ where: { id: student.id } })).billingStartAt).toEqual(student.billingStartAt);
        expect(await db.payment.count()).toBe(1);
        await PaymentService.generateDuePaymentsForBranch(f.user.id, f.branch.id, new Date(2026, 11, 2, 12));
        const payments = await db.payment.findMany({ orderBy: { dueDate: "asc" } });
        expect(payments.map(payment => payment.status)).toEqual(["PAID", "DUE"]);
    });
    it("cancels preparation while retaining an editable guided draft", async () => {
        const f = await world();
        const created = await ImportSessionService.createSession(f.user.id, f.branch.id, { sourceType: "PASTED_TABLE", experience: "GUIDED_CURRENT_MONTH_V1", pastedTable: "Name\tJoined Date\tMonthly Fee\nStudent\t2026-01-01\t1000" });
        await ImportRunService.requestCancel(f.user.id, f.branch.id, created.analysisRun.id);
        const current = await ImportSessionService.getSessionDetail(f.user.id, f.branch.id, created.id);
        expect(current.status).toBe("NEEDS_MAPPING"); expect(current.draftRevision).toBe(1);
        const prepared = await ImportSessionService.analyzeSession(f.user.id, f.branch.id, created.id, current.draftRevision);
        expect(prepared.guidance?.needsHelp).toBe(0);
    });
    it.each(["new", "conflicting"] as const)("keeps %s financial interpretation visible after a grouped answer and reanalysis", async kind => {
        const f = await world();
        const created = await ImportSessionService.createSession(f.user.id, f.branch.id, { sourceType: "PASTED_TABLE", experience: "GUIDED_CURRENT_MONTH_V1",
            pastedTable: `Name\tPhone\tJoined Date\tMonthly Fee\tShift\tReceipt Detail\tPaid Amount\tPayment Status\tPayment Method\nStudent\t9876501001\t2026-01-01\t1000\tFD\t300\t${kind === "conflicting" ? "1000" : ""}\tPAID\tCASH` });
        let detail = await ImportSessionService.analyzeSession(f.user.id, f.branch.id, created.id);
        await ImportRunRunner.setAnalysisStatus({ importRunId: created.analysisRun.id, status: "COMPLETED" });
        detail = await ImportSessionService.confirmShiftInterpretation(f.user.id, f.branch.id, detail.id, { expectedRevision: detail.draftRevision, source: "FD", targetId: f.shift.id });
        detail = await ImportSessionService.updateMapping(f.user.id, f.branch.id, detail.id, { expectedRevision: detail.draftRevision,
            columnMappings: detail.mapping.columnMappings.map(column => ({ ...column, targetField: column.sourceColumn === "Receipt Detail" ? "payment.amount" as const : column.sourceColumn === "Paid Amount" ? "ignore" as const : column.targetField, needsReview: false })) });
        const data = detail.rows[0].normalizedData as ImportNormalizedRow;
        expect(data.allocation?.shiftName).toBe("Full Day");
        expect(data.payment?.amount).toBe(kind === "new" ? 300 : 1000);
        expect(detail.guidance?.needsHelp).toBe(1);
        const code = kind === "new" ? "PARTIAL_PAYMENT_REVIEW" : "SOURCE_INTERPRETATION_CONFLICT";
        expect(detail.rows[0].issues).toEqual(expect.arrayContaining([expect.objectContaining({ code })]));
        detail = await ImportSessionService.analyzeSession(f.user.id, f.branch.id, detail.id);
        expect(detail.rows[0].issues).toEqual(expect.arrayContaining([expect.objectContaining({ code })]));
        const preview = await ImportWiringService.previewRowDraft(f.user.id, f.branch.id, detail.id, { rowId: detail.rows[0].id, normalizedData: data });
        expect(preview.issues).toEqual(expect.arrayContaining([expect.objectContaining({ code })]));
        if (kind === "conflicting") {
            data.payment!.amount = 300;
            detail = await ImportSessionService.updateRows(f.user.id, f.branch.id, detail.id, { expectedRevision: detail.draftRevision, edits: [{ rowId: detail.rows[0].id, normalizedData: data }] });
            expect(detail.rows[0].issues).not.toEqual(expect.arrayContaining([expect.objectContaining({ code: "SOURCE_INTERPRETATION_CONFLICT" })]));
            expect(detail.rows[0].issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "PARTIAL_PAYMENT_REVIEW" })]));
        }
        expect(await db.student.count()).toBe(0); expect(await db.payment.count()).toBe(0);
    });
    it.each(["Paid Amount", "Monthly Fee"])("preserves invalid %s source facts through shift confirmation", async field => {
        const f = await world();
        const detail = await draft(f, [`Student\t9876501001\t2026-01-01\t${field === "Monthly Fee" ? "300.50" : "1000"}\tFD\t\tPAID\tCASH\t${field === "Paid Amount" ? "300.50" : ""}`]);
        const answered = await ImportSessionService.confirmShiftInterpretation(f.user.id, f.branch.id, detail.id, { expectedRevision: detail.draftRevision, source: "FD", targetId: f.shift.id });
        expect(answered.guidance?.needsHelp).toBe(1);
        expect(answered.rows[0].issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: field === "Paid Amount" ? "INVALID_PAYMENT_AMOUNT" : "INVALID_MONTHLY_FEE" })]));
    });
    it("applies a validated new AI amount mapping to the corrected draft without overwriting the confirmed shift", async () => {
        const f = await world();
        const created = await ImportSessionService.createSession(f.user.id, f.branch.id, { sourceType: "PASTED_TABLE", experience: "GUIDED_CURRENT_MONTH_V1",
            pastedTable: "Name\tJoined Date\tMonthly Fee\tShift\tReceipt Detail\tPayment Status\tPayment Method\nStudent\t2026-01-01\t1000\tFD\t300\tPAID\tCASH" });
        let detail = await ImportSessionService.analyzeSession(f.user.id, f.branch.id, created.id);
        await ImportRunRunner.setAnalysisStatus({ importRunId: created.analysisRun.id, status: "COMPLETED" });
        detail = await ImportSessionService.confirmShiftInterpretation(f.user.id, f.branch.id, detail.id, { expectedRevision: detail.draftRevision, source: "FD", targetId: f.shift.id });
        provider.call.mockImplementation(async (prompt: string) => ({ ok: true, data: { entityTypesDetected: ["STUDENT", "PAYMENT"],
            columnMappings: (JSON.parse(prompt.match(/Uploaded columns:\n([^\n]+)/)![1]) as string[]).map(sourceColumn => ({ sourceColumn, targetField: "payment.amount", confidence: 99 })) } }));
        detail = await ImportSessionService.analyzeSession(f.user.id, f.branch.id, detail.id);
        expect(detail.rows[0].normalizedData).toMatchObject({ allocation: { shiftName: "Full Day" }, payment: { amount: 300 } });
        expect(detail.rows[0].issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "PARTIAL_PAYMENT_REVIEW" })]));
        expect(provider.call.mock.calls.at(-1)![0]).toContain('"affectedRecords":1');
    });
    it("rejects duplicate financial column meanings instead of discarding one source amount", async () => {
        const f = await world();
        const created = await ImportSessionService.createSession(f.user.id, f.branch.id, { sourceType: "PASTED_TABLE", experience: "GUIDED_CURRENT_MONTH_V1",
            pastedTable: "Name\tJoined Date\tMonthly Fee\tReceipt Detail\tPaid Amount\tPayment Status\tPayment Method\nStudent\t2026-01-01\t1000\t300\t1000\tPAID\tCASH" });
        const detail = await ImportSessionService.analyzeSession(f.user.id, f.branch.id, created.id);
        await expect(ImportSessionService.updateMapping(f.user.id, f.branch.id, detail.id, { expectedRevision: detail.draftRevision,
            columnMappings: detail.mapping.columnMappings.map(column => ({ ...column, targetField: column.sourceColumn === "Receipt Detail" ? "payment.amount" as const : column.targetField, needsReview: false })) })).rejects.toThrow("one source column");
        expect((await db.importSession.findUniqueOrThrow({ where: { id: detail.id } })).draftRevision).toBe(detail.draftRevision);
    });
    it("does not change a row imported between the mapping read and the publication lock", async () => {
        const f = await world();
        const created = await ImportSessionService.createSession(f.user.id, f.branch.id, { sourceType: "PASTED_TABLE", experience: "GUIDED_CURRENT_MONTH_V1",
            pastedTable: "Name\tJoined Date\tMonthly Fee\tShift\tReceipt Detail\nReady Student\t2026-01-01\t1000\tFD\t300\nHeld Student\t\t1000\tFD\t300" });
        let detail = await ImportSessionService.analyzeSession(f.user.id, f.branch.id, created.id);
        await ImportRunRunner.setAnalysisStatus({ importRunId: created.analysisRun.id, status: "COMPLETED" });
        detail = await ImportSessionService.updateMapping(f.user.id, f.branch.id, detail.id, { expectedRevision: detail.draftRevision, columnMappings: detail.mapping.columnMappings.map(column => ({ ...column, needsReview: false })) });
        detail = await ImportSessionService.confirmShiftInterpretation(f.user.id, f.branch.id, detail.id, { expectedRevision: detail.draftRevision, source: "FD", targetId: f.shift.id });
        const rowId = detail.rows[0].id;
        let saved: Awaited<ReturnType<typeof db.importRow.findUniqueOrThrow>> | undefined;
        const findFirst = prisma.importSession.findFirst.bind(prisma.importSession);
        vi.spyOn(prisma.importSession, "findFirst").mockImplementationOnce(args => findFirst(args).then(async found => {
            await commit(f, detail);
            saved = await db.importRow.findUniqueOrThrow({ where: { id: rowId } });
            return found;
        }) as ReturnType<typeof findFirst>);
        await ImportSessionService.updateMapping(f.user.id, f.branch.id, detail.id, { expectedRevision: detail.draftRevision,
            columnMappings: detail.mapping.columnMappings.map(column => ({ ...column, targetField: column.sourceColumn === "Receipt Detail" ? "payment.amount" as const : column.targetField, needsReview: false })) });
        expect(saved?.status).toBe("IMPORTED");
        expect(await db.importRow.findUniqueOrThrow({ where: { id: rowId } })).toMatchObject({ status: "IMPORTED", normalizedData: saved!.normalizedData, mappedData: saved!.mappedData });
    });
});
