import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const DEFAULT_PRIMARY_SHIFTS = [
    { name: "Morning", startTime: "06:00", endTime: "09:59", price: 0, isReserved: false },
    { name: "Afternoon", startTime: "10:00", endTime: "15:59", price: 0, isReserved: false },
    { name: "Evening", startTime: "16:00", endTime: "21:59", price: 0, isReserved: false },
] as const;

export const DEFAULT_FULL_TIME_MULTI_SHIFT = {
    name: "Full Time",
    price: 0,
    componentNames: DEFAULT_PRIMARY_SHIFTS.map(shift => shift.name),
} as const;

type DefaultShiftTx = Pick<Prisma.TransactionClient, "shift" | "multiShift">;

function normalizedName(value: string) {
    return value.trim().toLowerCase();
}

export function includesDefaultPrimaryShiftNames(shifts: ReadonlyArray<{ name: string }>) {
    const names = new Set(shifts.map(shift => normalizedName(shift.name)));
    return DEFAULT_PRIMARY_SHIFTS.every(shift => names.has(normalizedName(shift.name)));
}

export async function ensureDefaultFullTimeMultiShift(tx: DefaultShiftTx, branchId: string) {
    const existing = await tx.multiShift.findUnique({
        where: { branchId_name: { branchId, name: DEFAULT_FULL_TIME_MULTI_SHIFT.name } },
        select: { id: true },
    });
    if (existing) return existing;

    const componentShifts = await tx.shift.findMany({
        where: {
            branchId,
            status: "ACTIVE",
            name: { in: [...DEFAULT_FULL_TIME_MULTI_SHIFT.componentNames] },
        },
        select: { id: true, name: true },
    });
    const byName = new Map(componentShifts.map(shift => [normalizedName(shift.name), shift]));
    const orderedComponents = DEFAULT_FULL_TIME_MULTI_SHIFT.componentNames
        .map(name => byName.get(normalizedName(name)))
        .filter((shift): shift is { id: string; name: string } => Boolean(shift));

    if (orderedComponents.length !== DEFAULT_FULL_TIME_MULTI_SHIFT.componentNames.length) {
        return null;
    }

    try {
        return await tx.multiShift.create({
            data: {
                branchId,
                name: DEFAULT_FULL_TIME_MULTI_SHIFT.name,
                price: DEFAULT_FULL_TIME_MULTI_SHIFT.price,
                components: {
                    create: orderedComponents.map((shift, order) => ({
                        shiftId: shift.id,
                        order,
                    })),
                },
            },
            select: { id: true },
        });
    } catch (error) {
        if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
            return tx.multiShift.findUnique({
                where: { branchId_name: { branchId, name: DEFAULT_FULL_TIME_MULTI_SHIFT.name } },
                select: { id: true },
            });
        }
        throw error;
    }
}

export async function ensureDefaultShiftsAndFullTime(branchId: string) {
    return prisma.$transaction(async tx => {
        const existingShifts = await tx.shift.findMany({
            where: {
                branchId,
                name: { in: DEFAULT_PRIMARY_SHIFTS.map(shift => shift.name) },
                status: "ACTIVE",
            },
            select: { name: true },
        });
        const existingNames = new Set(existingShifts.map(shift => normalizedName(shift.name)));
        const missingShifts = DEFAULT_PRIMARY_SHIFTS.filter(shift => !existingNames.has(normalizedName(shift.name)));

        if (missingShifts.length > 0) {
            await tx.shift.createMany({
                data: missingShifts.map(shift => ({
                    branchId,
                    name: shift.name,
                    startTime: shift.startTime,
                    endTime: shift.endTime,
                    price: shift.price,
                    isReserved: shift.isReserved,
                })),
            });
        }

        await ensureDefaultFullTimeMultiShift(tx, branchId);
    });
}
