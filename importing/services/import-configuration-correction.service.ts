import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";
import { AccessPolicy } from "@/services/accessPolicy.service";
import { ShiftService } from "@/services/shift.service";
import { validateSeatLabel, validateRequiredText, validateOptionalTime, parseIntegerField, FORM_LIMITS } from "@/lib/formValidation";
import { parseNullableTime, timesOverlap } from "@/utils/shiftTime";
import { ImportSessionService, normalizeMapping } from "./import-session.service";
import { ImportRevisionConflictError, ImportValidationError } from "../utils/import-errors";
import { isSetupImport, setupKey } from "../utils/guided-setup";
import type { ImportNormalizedRow } from "../contracts/import-session.contract";
import type { ImportConfigurationCorrection, ImportCorrectionPreview } from "../contracts/import-correction.contract";
import { hasManualNormalizedData, markManualNormalizedData } from "../pipeline/import-extraction.pipeline";
import { GUIDED_SOURCE_HOLDS, guidedSourceHolds } from "../utils/guided-source-reconciliation";
import { normalizeImportRow } from "../utils/row-normalizer";

const activeRuns = ["QUEUED", "RUNNING", "RETRYABLE_FAILURE", "CANCEL_REQUESTED"] as const;
function parseCorrection(input: ImportConfigurationCorrection): ImportConfigurationCorrection {
    if (input?.kind === "RENAME_SEATS") {
        if (!Array.isArray(input.seats) || !input.seats.length || input.seats.length > 100 || new Set(input.seats.map(s => s?.id)).size !== input.seats.length) throw new ImportValidationError("Choose up to 100 existing seats to rename.");
        return { kind: input.kind, seats: input.seats.map(seat => {
            const label = validateSeatLabel(seat?.label);
            if (!label.ok || typeof seat.id !== "string" || seat.id.length > 300) throw new ImportValidationError("Check the existing seat and its new label.");
            return { id: seat.id, label: label.value };
        }).sort((a, b) => a.id.localeCompare(b.id)) };
    }
    if (input?.kind !== "UPDATE_TIMING" || typeof input.id !== "string" || input.id.length > 300) throw new ImportValidationError("Choose an existing timing to correct.");
    const name = validateRequiredText(input.name, "Shift name", 50), start = validateOptionalTime(input.startTime, "Start time"), end = validateOptionalTime(input.endTime, "End time");
    const price = parseIntegerField(input.price, "Monthly price", { min: 0, max: FORM_LIMITS.moneyMax });
    if (!name.ok || !start.ok || !end.ok || !start.value || !end.value || !price.ok || price.value === undefined) throw new ImportValidationError("Check the timing name, both hours and whole-rupee price.");
    return { kind: input.kind, id: input.id, name: name.value, startTime: start.value, endTime: end.value, price: price.value };
}

export class ImportConfigurationCorrectionService {
    private static async inspect(tx: Prisma.TransactionClient, userId: string, branchId: string, sessionId: string, input: ImportConfigurationCorrection) {
        await AccessPolicy.authorizeCapability(userId, branchId, "importView", tx);
        await AccessPolicy.authorizeAction(userId, branchId, "manage_branch", tx, true);
        const session = await tx.importSession.findFirst({ where: { id: sessionId, branchId, archivedAt: null } });
        if (!session || !isSetupImport(session.sourceConfiguration)) throw new Error("Import session not found");
        const correction = parseCorrection(input);
        const seats = await tx.seat.findMany({ where: { branchId }, orderBy: { id: "asc" } });
        const shifts = await tx.shift.findMany({ where: { branchId, status: "ACTIVE" }, orderBy: { id: "asc" } });
        const drafts = await tx.importSession.findMany({ where: { branchId, archivedAt: null, status: { notIn: ["COMMITTED", "CANCELLED"] } }, orderBy: { id: "asc" }, take: 101,
            include: { rows: { orderBy: { rowNumber: "asc" } }, runs: { where: { status: { in: [...activeRuns] } }, select: { id: true, status: true } } } });
        if (drafts.length > 100) throw new ImportValidationError("Review or archive older import drafts before correcting branch configuration.");
        const conflicts: string[] = [];
        if (!drafts.some(d => d.id === sessionId) || drafts.some(d => d.runs.length)) conflicts.push("Wait for running imports and preparation to finish before changing branch configuration.");
        const renames = new Map<string, string>();
        const changes: ImportCorrectionPreview["changes"] = [];
        let shift: typeof shifts[number] | undefined;
        if (correction.kind === "RENAME_SEATS") {
            if (correction.seats.some(s => !seats.some(existing => existing.id === s.id))) throw new Error("Seat not found");
            for (const edit of correction.seats) {
                const old = seats.find(s => s.id === edit.id)!;
                if (old.label !== edit.label) { renames.set(setupKey(old.label), edit.label); changes.push({ before: old.label, after: edit.label }); }
            }
            const labels = seats.map(s => correction.seats.find(edit => edit.id === s.id)?.label ?? s.label).map(setupKey);
            if (new Set(labels).size !== labels.length) conflicts.push("The new numbering collides with another existing seat. Each seat needs a unique label.");
        } else {
            shift = shifts.find(s => s.id === correction.id);
            if (!shift) throw new Error("Shift not found");
            if (shifts.some(s => s.id !== shift!.id && setupKey(s.name) === setupKey(correction.name))) conflicts.push("Another timing already uses this name.");
            if (shifts.some(s => s.id !== shift!.id && timesOverlap(parseNullableTime(correction.startTime), parseNullableTime(correction.endTime), parseNullableTime(s.startTime), parseNullableTime(s.endTime)))) conflicts.push("These hours overlap another active timing. Correct the hours or use combined access.");
            if (shift.name !== correction.name || shift.startTime !== correction.startTime || shift.endTime !== correction.endTime || shift.price !== correction.price) changes.push({ before: `${shift.name} · ${shift.startTime ?? "?"}–${shift.endTime ?? "?"} · ₹${shift.price}`, after: `${correction.name} · ${correction.startTime}–${correction.endTime} · ₹${correction.price}` });
        }
        if (!changes.length) conflicts.push("Nothing changed. Enter a different label, time or price.");
        const allocations = await tx.seatAllocation.findMany({ where: { branchId, ...(correction.kind === "RENAME_SEATS" ? { seatId: { in: correction.seats.map(s => s.id) } } : { shiftId: correction.id }) }, orderBy: { id: "asc" }, select: { id: true, studentId: true, endDate: true } });
        const linked = correction.kind === "UPDATE_TIMING" ? await tx.student.findMany({ where: { branchId, feeLinkedShiftId: correction.id }, orderBy: { id: "asc" }, select: { id: true, monthlyFee: true } }) : [];
        const combinations = correction.kind === "UPDATE_TIMING" ? await tx.multiShift.findMany({ where: { branchId, components: { some: { shiftId: correction.id } } }, orderBy: { id: "asc" }, select: { id: true, name: true, price: true } }) : [];
        if (correction.kind === "UPDATE_TIMING" && await tx.multiShift.count({ where: { branchId, name: { equals: correction.name, mode: "insensitive" } } })) conflicts.push("A combined-access option already uses this name.");
        const affectedRows = drafts.flatMap(d => d.rows.filter(row => {
            const data = row.normalizedData as ImportNormalizedRow | null;
            return correction.kind === "RENAME_SEATS" ? [data?.seat?.label, data?.allocation?.seatLabel].some(label => label && renames.has(setupKey(label)))
                : [data?.shift?.name, data?.allocation?.shiftName, data?.student?.feeLinkedShiftName, ...(data?.multiShift?.componentShiftNames ?? [])].some(name => name && setupKey(name) === setupKey(shift!.name));
        }));
        const snapshot = { correction, revision: session.draftRevision, seats, shifts, allocations, linked, combinations, drafts: drafts.map(d => ({ id: d.id, revision: d.draftRevision, runs: d.runs })) };
        const preview: ImportCorrectionPreview = { hash: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"), expectedRevision: session.draftRevision, correction, changes, conflicts,
            activeAllocations: allocations.filter(a => !a.endDate).length, historyAllocations: allocations.length, students: new Set(allocations.map(a => a.studentId)).size,
            linkedFees: linked.length, combinedAccess: combinations.map(c => c.name), drafts: drafts.length, draftRows: affectedRows.length };
        return { preview, session, drafts, renames, shift };
    }
    static async preview(userId: string, branchId: string, sessionId: string, input: ImportConfigurationCorrection) {
        return prisma.$transaction(async tx => (await this.inspect(tx, userId, branchId, sessionId, input)).preview, { timeout: 30_000 });
    }
    static async apply(userId: string, branchId: string, sessionId: string, input: ImportConfigurationCorrection, hash: string, expectedRevision: number) {
        if (!/^[a-f0-9]{64}$/.test(hash)) throw new ImportValidationError("Review the configuration correction before applying it.");
        let affected: string[] = [];
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                affected = await prisma.$transaction(async tx => {
                    await AccessPolicy.authorizeCapability(userId, branchId, "importView", tx);
                    await AccessPolicy.authorizeAction(userId, branchId, "manage_branch", tx, true);
                    await tx.$queryRaw`SELECT id FROM "ImportSession" WHERE "branchId" = ${branchId} AND "archivedAt" IS NULL ORDER BY id FOR UPDATE`;
                    const context = await this.inspect(tx, userId, branchId, sessionId, input);
                    const source = context.session.sourceConfiguration as Record<string, unknown>;
                    const receipts = Array.isArray(source.configurationCorrections) ? source.configurationCorrections as Array<{ hash: string; command: string }> : [];
                    const command = createHash("sha256").update(JSON.stringify(context.preview.correction)).digest("hex");
                    const receipt = receipts.find(item => item.hash === hash);
                    if (receipt) {
                        if (receipt.command !== command) throw new ImportRevisionConflictError();
                        return context.drafts.map(d => d.id);
                    }
                    if (context.preview.hash !== hash || context.session.draftRevision !== expectedRevision) throw new ImportRevisionConflictError();
                    if (context.preview.conflicts.length) throw new ImportValidationError(context.preview.conflicts.join(" "));
                    const correction = context.preview.correction;
                    if (correction.kind === "RENAME_SEATS") {
                        // Temporary unique labels permit swaps without replacing seat IDs.
                        for (const seat of correction.seats) await tx.seat.update({ where: { id: seat.id, branchId }, data: { label: `__rename_${hash.slice(0, 12)}_${seat.id}` } });
                        for (const seat of correction.seats) await tx.seat.update({ where: { id: seat.id, branchId }, data: { label: seat.label } });
                    } else await ShiftService.updateShift(userId, correction.id, correction, tx, branchId);
                    for (const draft of context.drafts) {
                        const mapping = normalizeMapping(draft.mapping, []);
                        const replaceTiming = (name: string | undefined) => name && correction.kind === "UPDATE_TIMING" && setupKey(name) === setupKey(context.shift!.name) ? correction.name : name;
                        for (const row of draft.rows) {
                            if (row.status === "IMPORTED") continue;
                            const data = structuredClone(row.normalizedData ?? {}) as ImportNormalizedRow;
                            const before = JSON.stringify(data);
                            if (correction.kind === "RENAME_SEATS") {
                                if (data.seat?.label) data.seat.label = context.renames.get(setupKey(data.seat.label)) ?? data.seat.label;
                                if (data.allocation?.seatLabel) data.allocation.seatLabel = context.renames.get(setupKey(data.allocation.seatLabel)) ?? data.allocation.seatLabel;
                            } else {
                                if (data.shift?.name) data.shift.name = replaceTiming(data.shift.name);
                                if (data.allocation?.shiftName) data.allocation.shiftName = replaceTiming(data.allocation.shiftName);
                                if (data.student?.feeLinkedShiftName) data.student.feeLinkedShiftName = replaceTiming(data.student.feeLinkedShiftName);
                                if (data.multiShift?.componentShiftNames) data.multiShift.componentShiftNames = data.multiShift.componentShiftNames.map(name => replaceTiming(name)!);
                            }
                            if (before !== JSON.stringify(data)) {
                                // A configuration correction must not resurrect a
                                // source problem the owner has already resolved.
                                const holds = [...guidedSourceHolds(row.mappedData), ...(hasManualNormalizedData(row.mappedData) ? []
                                    : normalizeImportRow(row.rawData as Record<string, string>, mapping.columnMappings, mapping.importOptions?.paymentMapping).issues)];
                                await tx.importRow.update({ where: { id: row.id }, data: { normalizedData: data as Prisma.InputJsonValue, mappedData: { ...markManualNormalizedData(row.mappedData ?? {}), [GUIDED_SOURCE_HOLDS]: holds } as Prisma.InputJsonValue } });
                            }
                        }
                        if (mapping.importOptions?.preparedSetup && correction.kind === "UPDATE_TIMING") {
                            for (const bundle of mapping.importOptions.preparedSetup.multiShifts) bundle.componentShiftNames = bundle.componentShiftNames.map(name => replaceTiming(name)!);
                        }
                        if (mapping.guidance && correction.kind === "UPDATE_TIMING") mapping.guidance.answers = mapping.guidance.answers.map(answer => ({ ...answer, target: replaceTiming(answer.target)! }));
                        if (mapping.importOptions) mapping.importOptions.configurationBatchApproved = false;
                        await tx.importSession.update({ where: { id: draft.id }, data: { draftRevision: { increment: 1 }, mapping: mapping as Prisma.InputJsonValue,
                            ...(draft.id === sessionId ? { sourceConfiguration: { ...source, configurationCorrections: [...receipts.slice(-19), { hash, command }] } as Prisma.InputJsonValue } : {}) } });
                    }
                    await tx.branch.update({ where: { id: branchId }, data: { lastDataChange: new Date() } });
                    return context.drafts.map(d => d.id);
                }, { isolationLevel: "Serializable", timeout: 30_000 });
                break;
            } catch (error) {
                if (attempt === 3 || typeof error !== "object" || error === null || !("code" in error) || error.code !== "P2034") throw error;
            }
        }
        // Drafts retain their manual metadata. A crash here leaves bumped
        // revisions, so old plans cannot run; refresh safely repeats validation.
        for (const id of affected) await ImportSessionService.revalidateCurrentDraft(userId, branchId, id);
        return ImportSessionService.getSessionDetail(userId, branchId, sessionId);
    }
}
