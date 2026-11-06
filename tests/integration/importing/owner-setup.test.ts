import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
const provider = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("@/ai/llm/gemini.client", () => ({ callGeminiJson: provider.call, resolveGeminiProModel: () => "synthetic" }));
import { ImportSessionService as Sessions } from "@/importing/services/import-session.service";
import { ImportSetupService } from "@/importing/services/import-setup.service";
import { ImportPaymentChoiceService as PaymentChoices } from "@/importing/services/import-payment-choice.service";
import { ImportConfigurationCorrectionService as Corrections } from "@/importing/services/import-configuration-correction.service";
import { importSaveOutcome } from "@/importing/utils/import-readiness";
import type { ImportNormalizedRow, ImportIssue } from "@/importing/contracts/import-session.contract";
import { ImportPlanService } from "@/importing/services/import-plan.service";
import { ImportRunService } from "@/importing/services/import-run.service";
import { ImportRunRunner } from "@/importing/services/import-runner.service";
import { ImportRunExecutor } from "@/importing/services/import-run-executor.service";
import { ImportWiringService } from "@/importing/services/import-wiring.service";
import { emptyImportSetup } from "@/importing/utils/guided-setup";
import { createTestWorld, createSaasSubscription, createStaff, createUser, createSeat, createStudent, createAllocation } from "@/tests/factories";
import { resetDatabase, disconnectDatabase, testPrisma as db } from "@/tests/setup/db";
import { freezeTime, restoreTime } from "@/tests/setup/time";
import type { ImportPlanSnapshot } from "@/importing/contracts/import-v2.contract";
type World = Awaited<ReturnType<typeof createTestWorld>>;
async function draft(f: World, text: string) {
    const created = await Sessions.createSession(f.user.id, f.branch.id, { sourceType: "PASTED_TABLE", experience: "GUIDED_SETUP_V2", goal: "FULL", pastedTable: text });
    const detail = await Sessions.analyzeSession(f.user.id, f.branch.id, created.id, 0);
    await ImportRunRunner.setAnalysisStatus({ importRunId: created.analysisRun.id, status: "COMPLETED" });
    return detail;
}
async function plan(f: World, d: Awaited<ReturnType<typeof draft>>) {
    return ImportPlanService.compilePlan({ userId: f.user.id, branchId: f.branch.id, sessionId: d.id, targetRevision: d.draftRevision, readinessPolicy: "REQUIRE_ALL_ROWS_READY" });
}
describe("complete setup import with isolated persistence", () => {
    beforeEach(async () => { await resetDatabase(); freezeTime(new Date(2026, 10, 4, 12)); vi.stubEnv("IMPORT_V2_ENABLED", "true"); vi.stubEnv("IMPORT_MAX_PLANNED_MUTATIONS", "1000"); provider.call.mockReset().mockResolvedValue({ ok: false, error: "Synthetic unavailable provider" }); });
    afterEach(() => { vi.unstubAllEnvs(); restoreTime(); }); afterAll(disconnectDatabase);
    it("previews timing and linked-price consequences, rejects stale previews and revalidates confirmed draft choices", async () => {
        const f = await createTestWorld({ shiftEnd: "12:00" });
        const linked = await createStudent({ branchId: f.branch.id });
        await db.student.update({ where: { id: linked.id }, data: { feeLinkedShiftId: f.shift.id, monthlyFee: f.shift.price } });
        let d = await draft(f, `Name\tJoined Date\tMonthly Fee\tShift\tSeat\nSynthetic fixed\t2026-01-01\tunclear\tMorning\t${f.seat.label}`);
        const original = d.rows[0].normalizedData as ImportNormalizedRow;
        d = await Sessions.updateRows(f.user.id, f.branch.id, d.id, { expectedRevision: d.draftRevision, edits: [{ rowId: d.rows[0].id,
            normalizedData: { ...original, student: { ...original.student, monthlyFee: 500, feeSource: "UPLOADED", feeLinkedShiftName: undefined } } }] });
        d = await PaymentChoices.apply(f.user.id, f.branch.id, d.id, { action: "DUE", expectedRevision: d.draftRevision, businessDate: "2026-11-04", rowIds: [d.rows[0].id] });
        const input = { kind: "UPDATE_TIMING" as const, id: f.shift.id, name: "Morning study", startTime: "06:00", endTime: "11:30", price: 950 };
        const stale = await Corrections.preview(f.user.id, f.branch.id, d.id, input);
        expect(stale.linkedFees).toBe(1);
        await Sessions.updateRows(f.user.id, f.branch.id, d.id, { expectedRevision: d.draftRevision, edits: [{ rowId: d.rows[0].id, normalizedData: d.rows[0].normalizedData as ImportNormalizedRow }] });
        await expect(Corrections.apply(f.user.id, f.branch.id, d.id, input, stale.hash, stale.expectedRevision)).rejects.toThrow(/changed|revision/i);
        const current = await Corrections.preview(f.user.id, f.branch.id, d.id, input);
        d = await Corrections.apply(f.user.id, f.branch.id, d.id, input, current.hash, current.expectedRevision);
        expect((await db.student.findUniqueOrThrow({ where: { id: linked.id } })).monthlyFee).toBe(950);
        expect(d.rows[0].normalizedData).toMatchObject({ student: { monthlyFee: 500 }, allocation: { shiftName: "Morning study" }, payment: { decision: "KEEP_DUE", status: "DUE" } });
        expect(d.guidance?.needsHelp).toBe(0);
        expect((await plan(f, d)).canRun).toBe(true);
        const outsider = await createUser();
        await expect(Corrections.preview(outsider.id, f.branch.id, d.id, input)).rejects.toThrow();
    });
    it("previews seat collisions and renames existing identities with history, draft preservation and lost-response replay", async () => {
        const f = await createTestWorld();
        const second = await createSeat({ branchId: f.branch.id, label: "A2" });
        const student = await createStudent({ branchId: f.branch.id });
        const allocation = await createAllocation({ seatId: f.seat.id, studentId: student.id, shiftId: f.shift.id, endDate: new Date(2026, 9, 1) });
        let d = await draft(f, `Name\tJoined Date\tMonthly Fee\tShift\tSeat\nSynthetic rename\t2026-01-01\t500\tMorning\t${f.seat.label}`);
        d = await PaymentChoices.apply(f.user.id, f.branch.id, d.id, { action: "DUE", expectedRevision: d.draftRevision, businessDate: "2026-11-04", rowIds: [d.rows[0].id] });
        const collision = await Corrections.preview(f.user.id, f.branch.id, d.id, { kind: "RENAME_SEATS", seats: [{ id: f.seat.id, label: second.label }] });
        expect(collision.conflicts.join(" ")).toMatch(/collides/);
        await expect(Corrections.apply(f.user.id, f.branch.id, d.id, collision.correction, collision.hash, collision.expectedRevision)).rejects.toThrow(/collides/);
        const preview = await Corrections.preview(f.user.id, f.branch.id, d.id, { kind: "RENAME_SEATS", seats: [{ id: f.seat.id, label: "B1" }] });
        expect(preview).toMatchObject({ historyAllocations: 1, activeAllocations: 0, draftRows: 1 });
        const saved = await Corrections.apply(f.user.id, f.branch.id, d.id, preview.correction, preview.hash, preview.expectedRevision);
        const replay = await Corrections.apply(f.user.id, f.branch.id, d.id, preview.correction, preview.hash, preview.expectedRevision);
        expect(replay.draftRevision).toBe(saved.draftRevision);
        expect(await db.seat.count()).toBe(2);
        expect((await db.seat.findUniqueOrThrow({ where: { id: f.seat.id } })).label).toBe("B1");
        expect((await db.seatAllocation.findUniqueOrThrow({ where: { id: allocation.id } })).seatId).toBe(f.seat.id);
        expect(saved.rows[0].normalizedData).toMatchObject({ allocation: { seatLabel: "B1" }, student: { monthlyFee: 500 }, payment: { status: "DUE", decision: "KEEP_DUE" } });
        await expect(Corrections.apply(f.user.id, f.branch.id, d.id, { kind: "RENAME_SEATS", seats: [{ id: f.seat.id, label: "C1" }] }, preview.hash, preview.expectedRevision)).rejects.toThrow(/changed|revision/i);
    });
    it("retains untidy source rows until explicitly left out and completes after focused corrections", async () => {
        const f = await createTestWorld();
        let d = await draft(f, "November study register\nName\tJoined Date\tMonthly Fee\tPayment Status\nSynthetic A\t01/01/2026\tRs. 500.00\tDue\nName\tJoined Date\tMonthly Fee\tPayment Status\nSynthetic B / 9876543211\t28/01/26\t₹700\t\nSynthetic C\t2026-01-01\t800\tprobably paid");
        expect(d.rows.map(r => r.rowNumber)).toEqual([1, 3, 4, 5, 6]);
        expect(d.guidance?.nonStudentRows.map(r => r.rowNumber)).toEqual([1, 4]);
        d = await Sessions.updateRows(f.user.id, f.branch.id, d.id, { expectedRevision: d.draftRevision, bulkAction: { action: "SKIP", issueCode: "NON_STUDENT_SOURCE_ROW" } });
        d = await ImportSetupService.resolve(f.user.id, f.branch.id, d.id, { expectedRevision: d.draftRevision, action: "DEFER_UNRESOLVED" });
        const combined = d.rows.find(r => r.rowNumber === 5)!;
        d = await Sessions.updateRows(f.user.id, f.branch.id, d.id, { expectedRevision: d.draftRevision, edits: [{ rowId: combined.id, normalizedData: { ...(combined.normalizedData as ImportNormalizedRow), student: { ...(combined.normalizedData as ImportNormalizedRow).student, name: "Synthetic B", phone: "9876543211" } } }] });
        const uncertain = d.rows.find(r => r.rowNumber === 6)!;
        expect(d.guidance?.needsHelp).toBe(1);
        d = await Sessions.updateRows(f.user.id, f.branch.id, d.id, { expectedRevision: d.draftRevision, edits: [{ rowId: uncertain.id, normalizedData: { ...(uncertain.normalizedData as ImportNormalizedRow), payment: { status: "DUE", rawStatus: "DUE" } } }] });
        expect(d.guidance?.ready).toBe(3); expect(d.guidance?.needsHelp).toBe(0);
        expect((await PaymentChoices.preview(f.user.id, f.branch.id, d.id)).rows.map(row => row.rowNumber)).toEqual([3, 5, 6]);
        expect((await Sessions.getSessionDetail(f.user.id, f.branch.id, d.id, { rowFilter: "attention" })).rows).toHaveLength(0);
        expect((await plan(f, d)).canRun).toBe(true);
        expect(await db.importRow.count()).toBe(5);
    });
    it("releases a duplicate after the owner explicitly excludes the earlier copy, preserving both source rows", async () => {
        const f = await createTestWorld();
        let d = await draft(f, "Name\tPhone\tJoined Date\tMonthly Fee\nSynthetic duplicate\t9876543211\t2026-01-01\t500\nSynthetic duplicate\t9876543211\t2026-01-01\t500");
        d = await ImportSetupService.resolve(f.user.id, f.branch.id, d.id, { expectedRevision: d.draftRevision, action: "DEFER_UNRESOLVED" });
        expect(d.rows[1].status).toBe("DUPLICATE");
        d = await Sessions.updateRows(f.user.id, f.branch.id, d.id, { expectedRevision: d.draftRevision, skipRowIds: [d.rows[0].id] });
        expect(d.guidance?.ready).toBe(1); expect(d.guidance?.needsHelp).toBe(0);
        expect((await Sessions.getSessionDetail(f.user.id, f.branch.id, d.id, { rowFilter: "attention" })).rows).toHaveLength(0);
        expect((await plan(f, d)).canRun).toBe(true);
        expect(await db.importRow.count()).toBe(2);
        // Restoring the source copy restores the concrete duplicate decision.
        d = await Sessions.updateRows(f.user.id, f.branch.id, d.id, { expectedRevision: d.draftRevision, unskipRowIds: [d.rows[0].id] });
        expect(d.guidance?.needsHelp).toBe(1);
        expect(d.rows[1].status).toBe("DUPLICATE");
    });
    it("removes warning-only students from the help queue and reports remaining decisions after a save", async () => {
        const f = await createTestWorld();
        let d = await draft(f, "Name\tJoined Date\tMonthly Fee\nSynthetic Ready\t2026-01-01\t500\nSynthetic Questions\t\t");
        d = await ImportSetupService.resolve(f.user.id, f.branch.id, d.id, { expectedRevision: d.draftRevision, action: "DEFER_UNRESOLVED" });
        const ready = d.rows[0], blocked = d.rows[1];
        expect(ready.status).toBe("WARNING"); expect(d.guidance?.ready).toBe(1); expect(d.guidance?.needsHelp).toBe(1);
        expect((await Sessions.getSessionDetail(f.user.id, f.branch.id, d.id, { rowFilter: "attention" })).rows.map(r => r.id)).toEqual([blocked.id]);
        d = await Sessions.updateRows(f.user.id, f.branch.id, d.id, { expectedRevision: d.draftRevision, edits: [{ rowId: blocked.id,
            normalizedData: { ...(blocked.normalizedData as ImportNormalizedRow), student: { name: "Synthetic Questions", joinedAt: "2026-01-01", joinedAtSource: "UPLOADED" } } }] });
        const updated = d.rows.find(r => r.id === blocked.id)!;
        const toReasons = (r: typeof updated) => ({ ...r, issues: r.issues as ImportIssue[], warnings: r.warnings as ImportIssue[] });
        const result = importSaveOutcome(toReasons(blocked), toReasons(updated));
        expect(result.readiness).toBe("attention");
        expect(result.resolved.map(i => i.code)).toContain("CONFIRM_JOINING_DATE");
        expect(result.remaining.map(i => i.code)).toContain("CONFIRM_STUDENT_FEE");
        expect(await db.student.count()).toBe(0);
    });
    it("persists batch Due and selected Paid choices, fences concurrent/lost responses and protects source and future payments", async () => {
        const f = await createTestWorld();
        let d = await draft(f, "Name\tJoined Date\tMonthly Fee\tPayment Status\tPayment Method\tPaid Amount\nSynthetic Due\t2026-01-01\t500\t\t\t\nSynthetic Selected\t2026-01-02\t600\t\t\t\nSynthetic Future\t2026-01-28\t700\t\t\t\nSynthetic Source\t2026-01-01\t800\tPAID\tCASH\t800\nSynthetic Unclear\t2026-01-01\t900\tmaybe paid\t\t");
        d = await ImportSetupService.resolve(f.user.id, f.branch.id, d.id, { expectedRevision: d.draftRevision, action: "DEFER_UNRESOLVED" });
        const before = await PaymentChoices.preview(f.user.id, f.branch.id, d.id);
        expect(before.rows.filter(r => r.dueEligible).map(r => r.name)).toEqual(["Synthetic Due", "Synthetic Selected"]);
        const command = { action: "DUE" as const, expectedRevision: before.draftRevision, businessDate: before.businessDate, rowIds: before.rows.filter(r => r.dueEligible).map(r => r.rowId) };
        const race = await Promise.allSettled([PaymentChoices.apply(f.user.id, f.branch.id, d.id, command), PaymentChoices.apply(f.user.id, f.branch.id, d.id, command)]);
        expect(race.filter(r => r.status === "fulfilled")).toHaveLength(1);
        // Retrying after a lost response must not overwrite the committed draft.
        await expect(PaymentChoices.apply(f.user.id, f.branch.id, d.id, command)).rejects.toThrow(/changed|revision/i);
        const afterDue = await PaymentChoices.preview(f.user.id, f.branch.id, d.id);
        expect(afterDue.rows.filter(r => r.decision === "KEEP_DUE")).toHaveLength(2);
        expect(afterDue.rows.filter(r => r.dueEligible)).toHaveLength(0);
        const selected = afterDue.rows.find(r => r.name === "Synthetic Selected")!;
        d = await PaymentChoices.apply(f.user.id, f.branch.id, d.id, { action: "PAID", expectedRevision: afterDue.draftRevision, businessDate: afterDue.businessDate, payments: [{ rowId: selected.rowId, method: "UPI" }] });
        const afterPaid = await PaymentChoices.preview(f.user.id, f.branch.id, d.id);
        expect(afterPaid.rows.find(r => r.rowId === selected.rowId)).toMatchObject({ decision: "CONFIRMED_PAID", dueEligible: false, paidEligible: false, outcome: { status: "PAID", state: "CREATE_NOW", amount: 600 } });
        for (const name of ["Synthetic Source", "Synthetic Future", "Synthetic Unclear", "Synthetic Selected"]) {
            await expect(PaymentChoices.apply(f.user.id, f.branch.id, d.id, { action: "DUE", expectedRevision: afterPaid.draftRevision, businessDate: afterPaid.businessDate, rowIds: [afterPaid.rows.find(r => r.name === name)!.rowId] })).rejects.toThrow(/eligible/);
        }
        expect((d.rows.find(r => (r.normalizedData as ImportNormalizedRow).student?.name === "Synthetic Source")!.normalizedData as ImportNormalizedRow).payment).toMatchObject({ status: "PAID", amount: 800, method: "CASH" });
        expect(afterPaid.rows.find(r => r.name === "Synthetic Future")!.outcome.state).toBe("GENERATE_LATER");
        expect(await db.payment.count()).toBe(0); expect(await db.student.count()).toBe(0);
    });
    it.each(["BASIC", "STANDARD", "PRO"] as const)("reviews and creates missing setup on %s with separate prices and replay safety", async tier => {
        const f = await createTestWorld({ shiftEnd: "12:00" });
        await createSaasSubscription({ organizationId: f.org.id, plan: tier, paidThrough: new Date(2027, 0, 1) });
        let d = await draft(f, "Name\tJoined Date\tMonthly Fee\tShift\tSeat\nSynthetic A\t2026-01-01\t500\tEvening\tA2\nSynthetic B\t2026-01-15\t600\tAll access\tA3");
        const setup = { seats: ["A2", "A3"], shifts: [{ name: "Evening", startTime: "12:00", endTime: "20:00", price: 900 }], multiShifts: [{ name: "All access", componentShiftNames: ["Morning", "Evening"], price: 1500 }] };
        d = await Sessions.updateMapping(f.user.id, f.branch.id, d.id, { expectedRevision: d.draftRevision, importOptions: { preparedSetup: setup } });
        expect(d.guidance?.setup.counts.matched).toBe(2);
        expect(await db.seat.count()).toBe(1); expect(await db.shift.count()).toBe(1); expect(await db.student.count()).toBe(0);
        expect((await plan(f, d)).canRun).toBe(false);
        const available = await ImportWiringService.getAvailability(f.user.id, f.branch.id, d.id, { rowId: d.rows[0].id, shiftIds: [d.branchContext.shifts.find(s => s.name === "Evening")!.id] });
        expect(available.seatMap?.seats.find(s => s.label === "A3")?.source).toBe("staged");
        d = await Sessions.updateMapping(f.user.id, f.branch.id, d.id, { expectedRevision: d.draftRevision, importOptions: { configurationBatchApproved: true } });
        const reviewed = await plan(f, d), snapshot = reviewed.snapshot as unknown as ImportPlanSnapshot;
        expect(reviewed.canRun).toBe(true); expect(snapshot.currentMonthReview?.setup?.shifts[0].price).toBe(900);
        expect(snapshot.currentMonthReview?.rows.map(r => r.allocation?.seatLabel)).toEqual(["A2", "A3"]);
        const input = { userId: f.user.id, branchId: f.branch.id, sessionId: d.id, kind: "COMMIT" as const, targetRevision: d.draftRevision, importPlanId: reviewed.id, confirmedPlanVersion: reviewed.planVersion, idempotencyKey: randomUUID() };
        const run = await ImportRunService.createOrGetRun(input);
        for (let pass = 0; pass < 10; pass++) { const items = await ImportRunRunner.claimBatch({ importRunId: run.id, workerId: "setup-test", limit: 25 }); if (!items.length) break; for (const item of items) { await ImportRunExecutor.executeClaimedItem(item); expect(await ImportRunExecutor.executeClaimedItem(item)).toEqual({ alreadyCompleted: true }); } }
        await ImportRunRunner.finalizeRun(run.id);
        expect((await ImportRunService.createOrGetRun(input)).id).toBe(run.id);
        expect(await db.student.count()).toBe(2); expect(await db.seat.count()).toBe(3); expect(await db.shift.count()).toBe(2);
        expect(await db.multiShiftComponent.count()).toBe(2); expect(await db.seatAllocation.count()).toBe(3);
        expect((await db.shift.findFirstOrThrow({ where: { name: "Evening" } })).price).toBe(900);
        expect((await db.student.findMany({ orderBy: { name: "asc" } })).map(s => s.monthlyFee)).toEqual([500, 600]);
        expect(await db.payment.count()).toBe(1);
    });
    it("requires a decision for missing seating and defers a whole group without discarding financial holds", async () => {
        const f = await createTestWorld();
        let d = await draft(f, "Name\tJoined Date\tMonthly Fee\tPaid Amount\nSynthetic A\t2026-01-01\t500\t\nSynthetic B\t2026-01-01\t600\tinvalid");
        expect(d.guidance?.setup.counts.decision).toBe(2);
        d = await ImportSetupService.resolve(f.user.id, f.branch.id, d.id, { expectedRevision: d.draftRevision, action: "DEFER_UNRESOLVED" });
        expect(d.guidance?.setup.counts.deferred).toBe(2);
        expect(["READY", "WARNING"]).toContain(d.rows[0].status); expect(d.rows[1].issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "INVALID_PAYMENT_AMOUNT" })]));
        const again = await Sessions.analyzeSession(f.user.id, f.branch.id, d.id, d.draftRevision);
        expect(again.guidance?.setup.counts.deferred).toBe(2);
    });
    it("groups an absent timing once, preserves source seats and rejects stale decisions", async () => {
        const f = await createTestWorld();
        const d = await draft(f, `Name\tJoined Date\tMonthly Fee\tSeat\nSynthetic A\t2026-01-01\t500\t${f.seat.label}`);
        const input = { expectedRevision: d.draftRevision, action: "TIMING" as const, source: "", targetId: f.shift.id };
        const resolved = await ImportSetupService.resolve(f.user.id, f.branch.id, d.id, input);
        expect(resolved.guidance?.setup.counts.matched).toBe(1);
        await expect(ImportSetupService.resolve(f.user.id, f.branch.id, d.id, input)).rejects.toThrow(/revision/i);
    });
    it("saves assignment-only decisions without confirming invalid fees or payments", async () => {
        const f = await createTestWorld();
        let d = await draft(f, "Name\tJoined Date\tMonthly Fee\tPaid Amount\nSynthetic A\t2026-01-01\tinvalid\t300.50");
        const rowId = d.rows[0].id;
        d = await ImportSetupService.resolve(f.user.id, f.branch.id, d.id, { expectedRevision: d.draftRevision, action: "ASSIGN_ROW", rowId, seatId: f.seat.id, targetId: f.shift.id });
        expect(d.guidance?.setup.counts.matched).toBe(1);
        expect(d.rows[0].issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "INVALID_MONTHLY_FEE" }), expect.objectContaining({ code: "INVALID_PAYMENT_AMOUNT" })]));
        d = await ImportSetupService.resolve(f.user.id, f.branch.id, d.id, { expectedRevision: d.draftRevision, action: "DEFER_ROW", rowId });
        expect(d.guidance?.setup.counts.deferred).toBe(1);
        expect(d.rows[0].issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "INVALID_PAYMENT_AMOUNT" })]));
        d = await ImportSetupService.resolve(f.user.id, f.branch.id, d.id, { expectedRevision: d.draftRevision, action: "ASSIGN_ROW", rowId, seatId: f.seat.id, targetId: f.shift.id });
        expect(d.guidance?.setup.counts.matched).toBe(1);
        expect((await plan(f, d)).canRun).toBe(false);
        expect(await db.student.count()).toBe(0);
    });
    it("checks setup permission and rejects overlapping additions before live writes", async () => {
        const f = await createTestWorld(); const staff = await createUser(); await createStaff({ userId: staff.id, branchId: f.branch.id, role: "STAFF" });
        const d = await draft(f, "Name\tJoined Date\tMonthly Fee\nSynthetic A\t2026-01-01\t500");
        await expect(Sessions.updateMapping(staff.id, f.branch.id, d.id, { expectedRevision: d.draftRevision, importOptions: { preparedSetup: { ...emptyImportSetup(), seats: ["B1"] } } })).rejects.toThrow();
        await expect(Sessions.updateMapping(f.user.id, f.branch.id, d.id, { expectedRevision: d.draftRevision, importOptions: { preparedSetup: { ...emptyImportSetup(), shifts: [{ name: "Overlap", startTime: "07:00", endTime: "08:00", price: 0 }] } } })).rejects.toThrow(/overlap/);
        expect(await db.seat.count()).toBe(1); expect(await db.shift.count()).toBe(1);
    });
    it("retains reviewed fee-configuration dependencies after explicit seating deferral", async () => {
        const f = await createTestWorld({ shiftEnd: "12:00" });
        let d = await draft(f, "Name\tJoined Date\tMonthly Fee\nSynthetic linked\t2026-01-01\t900");
        d = await Sessions.updateMapping(f.user.id, f.branch.id, d.id, { expectedRevision: d.draftRevision, importOptions: { preparedSetup: { ...emptyImportSetup(), shifts: [{ name: "Evening", startTime: "12:00", endTime: "20:00", price: 900 }] } } });
        const normalized = d.rows[0].normalizedData as Record<string, unknown>;
        d = await Sessions.updateRows(f.user.id, f.branch.id, d.id, { expectedRevision: d.draftRevision, edits: [{ rowId: d.rows[0].id, normalizedData: { ...normalized, student: { name: "Synthetic linked", joinedAt: "2026-01-01", monthlyFee: 900, feeSource: "SHIFT_PRICE", feeLinkedShiftName: "Evening" }, allocation: { deferred: true } } }] });
        d = await Sessions.updateMapping(f.user.id, f.branch.id, d.id, { expectedRevision: d.draftRevision, importOptions: { configurationBatchApproved: true } });
        const compiled = await plan(f, d);
        expect(compiled.canRun).toBe(true);
        const snapshot = compiled.snapshot as unknown as ImportPlanSnapshot;
        expect(snapshot.items.filter(i => i.kind === "CONFIG").map(i => i.payload?.name)).toEqual(["Evening"]);
        expect(snapshot.items.some(i => i.kind === "ALLOCATION")).toBe(false);
    });
    it("reuses a confirmed meaning for proposed timing choices while retaining manual answers", async () => {
        const f = await createTestWorld({ shiftEnd: "12:00" });
        let d = await draft(f, "Name\tJoined Date\tMonthly Fee\tShift\tSeat\nSynthetic A\t2026-01-01\t500\tEV\tA2\nSynthetic B\t2026-01-28\t600\tE.V.\tA3");
        d = await Sessions.updateMapping(f.user.id, f.branch.id, d.id, { expectedRevision: d.draftRevision, importOptions: { preparedSetup: { seats: ["A2", "A3"], shifts: [{ name: "Evening", startTime: "12:00", endTime: "20:00", price: 900 }], multiShifts: [] } } });
        d = await ImportSetupService.resolve(f.user.id, f.branch.id, d.id, { expectedRevision: d.draftRevision, action: "TIMING", source: "EV", targetId: d.branchContext.shifts.find(s => s.name === "Evening")!.id });
        provider.call.mockImplementationOnce(async (prompt: string) => {
            for (const value of ["Evening", "E.V.", "Synthetic A", d.id]) expect(prompt).not.toContain(value);
            const context = JSON.parse(prompt.match(/opaque structural context\):\n([^\n]+)/)![1]).shiftAssistance;
            return { ok: true, data: { entityTypesDetected: ["STUDENT"], columnMappings: [], questions: [], warnings: [],
                draftShiftProposals: context.groups.map((group: { sourceAlias: string; meaningAlias: string }) => {
                    const answer = context.answers.find((answer: { meaningAlias: string }) => answer.meaningAlias === group.meaningAlias);
                    return { sourceAlias: group.sourceAlias, choiceAlias: answer.choiceAlias, answerAlias: answer.answerAlias };
                }) } };
        });
        d = await Sessions.analyzeSession(f.user.id, f.branch.id, d.id, d.draftRevision);
        expect(d.rows.map(row => (row.normalizedData as { allocation?: { shiftName?: string } }).allocation?.shiftName)).toEqual(["Evening", "Evening"]);
        expect(d.mapping?.importOptions?.preparedSetup?.shifts[0].price).toBe(900);
        expect(await db.shift.count()).toBe(1);
    });
});
