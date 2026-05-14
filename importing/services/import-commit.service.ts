import { addMonths, endOfMonth, startOfDay, startOfMonth, subMonths } from "date-fns";
import { prisma } from "@/lib/prisma";
import { MultiShiftService } from "@/services/multiShift.service";
import { PaymentService } from "@/services/payment.service";
import { SeatAllocationService } from "@/services/seatAllocation.service";
import { SeatService } from "@/services/seat.service";
import { ShiftService } from "@/services/shift.service";
import { StaffService } from "@/services/staff.service";
import { StudentService } from "@/services/student.service";
import type { CommitMode, ImportCommitResult, ImportMappingState, ImportNormalizedRow } from "@/importing/contracts/import-session.contract";
import { ImportSessionService } from "./import-session.service";
import type { PaymentMethod } from "@/app/generated/prisma/enums";
import type { Prisma } from "@/app/generated/prisma/client";

function asJson(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
}

function messageOf(error: unknown) {
    return error instanceof Error ? error.message : "Something went wrong";
}

function key(value: string | undefined | null) {
    return (value ?? "").trim().toLowerCase();
}

function resolvePaymentPeriod(option: ImportMappingState["importOptions"], joinedAt: Date) {
    const today = new Date();
    const cycle = option?.paymentCycle ?? "SKIP_PAYMENTS";

    if (cycle === "CURRENT_MONTH") {
        return { periodStart: startOfMonth(today), periodEnd: endOfMonth(today), dueDate: endOfMonth(today) };
    }
    if (cycle === "PREVIOUS_MONTH") {
        const previous = subMonths(today, 1);
        return { periodStart: startOfMonth(previous), periodEnd: endOfMonth(previous), dueDate: endOfMonth(previous) };
    }
    if (cycle === "CUSTOM_PERIOD" && option?.customPeriodStart && option.customPeriodEnd) {
        return {
            periodStart: startOfDay(new Date(option.customPeriodStart)),
            periodEnd: startOfDay(new Date(option.customPeriodEnd)),
            dueDate: startOfDay(new Date(option.customPeriodEnd)),
        };
    }
    if (cycle === "USE_JOINED_AT_ANNIVERSARY") {
        return {
            periodStart: startOfDay(joinedAt),
            periodEnd: startOfDay(addMonths(joinedAt, 1)),
            dueDate: startOfDay(addMonths(joinedAt, 1)),
        };
    }

    return null;
}

export class ImportCommitService {
    private static async loadBusinessContext(branchId: string) {
        const [seats, shifts, multiShifts] = await Promise.all([
            prisma.seat.findMany({ where: { branchId } }),
            prisma.shift.findMany({ where: { branchId, status: "ACTIVE" } }),
            prisma.multiShift.findMany({
                where: { branchId },
                include: { components: { include: { shift: true }, orderBy: { order: "asc" } } },
            }),
        ]);

        return {
            seatsByLabel: new Map(seats.map(seat => [key(seat.label), seat])),
            shiftsByName: new Map(shifts.map(shift => [key(shift.name), shift])),
            multiShiftsByName: new Map(multiShifts.map(multiShift => [key(multiShift.name), multiShift])),
        };
    }

    private static async ensureCommitPermissions(
        userId: string,
        branchId: string,
        rows: { normalizedData: ImportNormalizedRow | null; warnings: unknown }[],
        mapping: ImportMappingState
    ) {
        await StaffService.authorize(userId, branchId, "students");
        const needsManageBranch = rows.some(row =>
            Array.isArray(row.warnings) && row.warnings.some((warning: { code?: string }) =>
                ["WILL_CREATE_SEAT", "WILL_CREATE_SHIFT", "WILL_CREATE_MULTI_SHIFT"].includes(warning.code ?? "")
            )
        );
        const needsAllocation = rows.some(row =>
            row.normalizedData?.allocation?.seatLabel &&
            (row.normalizedData.allocation.shiftName || row.normalizedData.allocation.multiShiftName)
        );
        const needsPayments = mapping.importOptions?.paymentAction && mapping.importOptions.paymentAction !== "SKIP_PAYMENTS";
        const needsPaid = rows.some(row => row.normalizedData?.payment?.status === "PAID");
        const needsWaived = rows.some(row => row.normalizedData?.payment?.status === "WAIVED");

        if (needsManageBranch) await StaffService.authorize(userId, branchId, "manage_branch");
        if (needsAllocation) await StaffService.authorize(userId, branchId, "seat_allocation");
        if (needsPayments) await StaffService.authorize(userId, branchId, "generate_payments");
        if (needsPaid) await StaffService.authorize(userId, branchId, "mark_payment_paid");
        if (needsWaived) await StaffService.authorize(userId, branchId, "waive_payments");
    }

    static async commitSession(
        userId: string,
        branchId: string,
        sessionId: string,
        mode: CommitMode = "SAFE_PARTIAL"
    ): Promise<ImportCommitResult> {
        const detail = await ImportSessionService.revalidateSession(userId, branchId, sessionId);
        if (detail.status !== "READY_TO_COMMIT") {
            throw new Error("Import session is not ready to commit.");
        }

        const rows = detail.rows.map(row => ({
            id: row.id,
            rowNumber: row.rowNumber,
            status: row.status,
            skipped: row.skipped,
            normalizedData: row.normalizedData as ImportNormalizedRow | null,
            warnings: row.warnings,
        }));
        const blockedRows = rows.filter(row => ["BLOCKED", "CONFLICT", "NEEDS_REVIEW", "DUPLICATE"].includes(row.status));
        if (mode === "STRICT_ALL_OR_NOTHING" && blockedRows.length > 0) {
            throw new Error("Strict import refused because blocked or review rows remain.");
        }

        const importableRows = rows.filter(row => !row.skipped && ["READY", "WARNING"].includes(row.status));
        const mapping = detail.mapping as ImportMappingState;
        await this.ensureCommitPermissions(userId, branchId, importableRows, mapping);

        await prisma.importSession.update({
            where: { id: sessionId },
            data: { status: "COMMITTING" },
        });

        const summary = {
            createdStudents: 0,
            createdSeats: 0,
            createdShifts: 0,
            createdMultiShifts: 0,
            createdAllocations: 0,
            generatedPayments: 0,
            markedPaid: 0,
            markedWaived: 0,
            skippedRows: rows.length - importableRows.length,
            failedRows: 0,
        };
        const errors: { rowId?: string; rowNumber?: number; message: string }[] = [];

        try {
            let context = await this.loadBusinessContext(branchId);

            for (const row of importableRows) {
                const normalized = row.normalizedData;
                if (!normalized?.student?.name) continue;
                const createdEntityIds: Record<string, unknown> = {};

                try {
                    const seatLabel = normalized.allocation?.seatLabel ?? normalized.seat?.label;
                    const shiftName = normalized.allocation?.shiftName ?? normalized.shift?.name;
                    const multiShiftName = normalized.allocation?.multiShiftName ?? normalized.multiShift?.name;

                    if (seatLabel && !context.seatsByLabel.has(key(seatLabel)) && mapping.importOptions?.createUnknownSeats) {
                        const seat = await SeatService.createSeat(userId, branchId, seatLabel);
                        context.seatsByLabel.set(key(seat.label), seat);
                        createdEntityIds.seatId = seat.id;
                        summary.createdSeats++;
                    }

                    if (shiftName && !context.shiftsByName.has(key(shiftName)) && mapping.importOptions?.createUnknownShifts) {
                        const shift = await ShiftService.createShift(userId, branchId, {
                            name: shiftName,
                            startTime: normalized.shift?.startTime,
                            endTime: normalized.shift?.endTime,
                            price: normalized.student.monthlyFee ?? 0,
                        });
                        context.shiftsByName.set(key(shift.name), shift);
                        createdEntityIds.shiftId = shift.id;
                        summary.createdShifts++;
                    }

                    if (multiShiftName && !context.multiShiftsByName.has(key(multiShiftName)) && mapping.importOptions?.createUnknownMultiShifts) {
                        const componentShiftIds = (normalized.multiShift?.componentShiftNames ?? [])
                            .map(name => context.shiftsByName.get(key(name))?.id)
                            .filter((id): id is string => Boolean(id));

                        if (componentShiftIds.length >= 2) {
                            const multiShift = await MultiShiftService.createMultiShift(userId, branchId, {
                                name: multiShiftName,
                                price: normalized.student.monthlyFee ?? 0,
                                shiftIds: componentShiftIds,
                            });
                            context = await this.loadBusinessContext(branchId);
                            createdEntityIds.multiShiftId = multiShift.id;
                            summary.createdMultiShifts++;
                        }
                    }

                    const seat = seatLabel ? context.seatsByLabel.get(key(seatLabel)) : undefined;
                    const shift = shiftName ? context.shiftsByName.get(key(shiftName)) : undefined;
                    const multiShift = multiShiftName ? context.multiShiftsByName.get(key(multiShiftName)) : undefined;
                    const joinedAt = normalized.student.joinedAt ? new Date(normalized.student.joinedAt) : new Date();
                    const student = await StudentService.createImportedStudent(userId, branchId, {
                        name: normalized.student.name,
                        phone: normalized.student.phone,
                        joinedAt,
                        monthlyFee: normalized.student.monthlyFee,
                        admissionFee: 0,
                    });
                    createdEntityIds.studentId = student.id;
                    summary.createdStudents++;

                    if (seat && multiShift) {
                        const shiftIds = multiShift.components.map(component => component.shiftId);
                        const allocations = await SeatAllocationService.assignSeatToShifts(userId, seat.id, student.id, shiftIds, multiShift.id);
                        createdEntityIds.allocationIds = allocations.map(allocation => allocation.id);
                        summary.createdAllocations += allocations.length;
                    } else if (seat && shift) {
                        const allocations = await SeatAllocationService.assignSeatToShifts(userId, seat.id, student.id, [shift.id]);
                        createdEntityIds.allocationIds = allocations.map(allocation => allocation.id);
                        summary.createdAllocations += allocations.length;
                    }

                    if (mapping.importOptions?.paymentAction && mapping.importOptions.paymentAction !== "SKIP_PAYMENTS") {
                        const period = resolvePaymentPeriod(mapping.importOptions, joinedAt);
                        if (period) {
                            const payment = await PaymentService.ensureMonthlyPaymentForStudent(userId, branchId, {
                                studentId: student.id,
                                periodStart: period.periodStart,
                                periodEnd: period.periodEnd,
                                dueDate: period.dueDate,
                                amount: normalized.payment?.amount ?? normalized.student.monthlyFee,
                            });
                            createdEntityIds.paymentId = payment.id;
                            summary.generatedPayments++;

                            if (mapping.importOptions.paymentAction === "IMPORT_PAID_UNPAID" && normalized.payment?.status === "PAID") {
                                const method = normalized.payment.method ?? mapping.importOptions.paymentMapping?.defaultMethod as PaymentMethod | undefined;
                                await PaymentService.markPaymentAsPaid(userId, payment.id, method, normalized.payment.referenceId);
                                summary.markedPaid++;
                            }
                            if (mapping.importOptions.paymentAction === "IMPORT_PAID_UNPAID" && normalized.payment?.status === "WAIVED") {
                                await PaymentService.markPaymentAsWaived(userId, payment.id);
                                summary.markedWaived++;
                            }
                        }
                    }

                    await prisma.importRow.update({
                        where: { id: row.id },
                        data: {
                            status: "IMPORTED",
                            createdEntityIds: asJson(createdEntityIds),
                        },
                    });
                } catch (error) {
                    summary.failedRows++;
                    errors.push({ rowId: row.id, rowNumber: row.rowNumber, message: messageOf(error) });
                    await prisma.importRow.update({
                        where: { id: row.id },
                        data: {
                            status: "FAILED",
                            issues: asJson([{ code: "COMMIT_FAILED", message: messageOf(error), severity: "error" }]),
                        },
                    });
                }
            }

            const status = errors.length > 0 ? "PARTIAL" : "COMMITTED";
            const commitStatus = errors.length > 0 ? "PARTIAL" : "SUCCESS";

            await prisma.importCommit.create({
                data: {
                    importSessionId: sessionId,
                    committedByUserId: userId,
                    status: commitStatus,
                    summary: asJson(summary),
                    errors: asJson(errors),
                },
            });
            await prisma.importSession.update({
                where: { id: sessionId },
                data: { status, summary: asJson(summary) },
            });

            return { status: commitStatus, summary, errors };
        } catch (error) {
            errors.push({ message: messageOf(error) });
            await prisma.importCommit.create({
                data: {
                    importSessionId: sessionId,
                    committedByUserId: userId,
                    status: "FAILED",
                    summary: asJson(summary),
                    errors: asJson(errors),
                },
            });
            await prisma.importSession.update({
                where: { id: sessionId },
                data: { status: "FAILED", summary: asJson(summary) },
            });
            return { status: "FAILED", summary, errors };
        }
    }
}
