
import { prisma } from "@/lib/prisma";
import { CreateShiftDto } from "@/types";

export const DEFAULT_SHIFTS = [
    { name: "Morning", startTime: "06:00", endTime: "12:00", price: 0, isReserved: false },
    { name: "Afternoon", startTime: "12:00", endTime: "17:00", price: 0, isReserved: false },
    { name: "Evening", startTime: "17:00", endTime: "22:00", price: 0, isReserved: false },
    { name: "Full Time", startTime: "06:00", endTime: "22:00", price: 0, isReserved: false },
];

export class ShiftService {
    private static async assertBranchOwnership(userId: string, branchId: string) {
        const branch = await prisma.branch.findUnique({
            where: { id: branchId },
            include: { organization: true },
        });
        if (!branch) throw new Error("Branch not found");
        if (branch.organization.ownerId !== userId) throw new Error("Unauthorized: User does not own this branch");
        return branch;
    }

    static async createShift(userId: string, branchId: string, data: CreateShiftDto) {
        await this.assertBranchOwnership(userId, branchId);

        const existingShift = await prisma.shift.findUnique({
            where: { branchId_name: { branchId, name: data.name } },
        });
        if (existingShift) throw new Error(`Shift with name "${data.name}" already exists in this branch.`);

        return prisma.shift.create({
            data: {
                branchId,
                name: data.name,
                startTime: data.startTime,
                endTime: data.endTime,
                price: data.price ?? 0,
                isReserved: data.isReserved ?? false,
            },
        });
    }

    static async updateShift(
        userId: string,
        shiftId: string,
        data: Partial<{ name: string; startTime: string | null; endTime: string | null; price: number; isReserved: boolean }>
    ) {
        const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
        if (!shift) throw new Error("Shift not found");
        await this.assertBranchOwnership(userId, shift.branchId);

        if (data.name && data.name !== shift.name) {
            const duplicate = await prisma.shift.findUnique({
                where: { branchId_name: { branchId: shift.branchId, name: data.name } },
            });
            if (duplicate) throw new Error(`Shift with name "${data.name}" already exists in this branch.`);
        }

        return prisma.shift.update({
            where: { id: shiftId },
            data: {
                ...(data.name !== undefined ? { name: data.name } : {}),
                ...(data.startTime !== undefined ? { startTime: data.startTime } : {}),
                ...(data.endTime !== undefined ? { endTime: data.endTime } : {}),
                ...(data.price !== undefined ? { price: data.price } : {}),
                ...(data.isReserved !== undefined ? { isReserved: data.isReserved } : {}),
            },
        });
    }

    static async deleteShift(userId: string, shiftId: string) {
        const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
        if (!shift) throw new Error("Shift not found");
        await this.assertBranchOwnership(userId, shift.branchId);

        const activeAllocations = await prisma.seatAllocation.count({
            where: { shiftId, endDate: null },
        });
        if (activeAllocations > 0) {
            throw new Error(`Cannot delete: ${activeAllocations} active seat allocation(s) use this shift.`);
        }

        return prisma.shift.delete({ where: { id: shiftId } });
    }

    static async ensureDefaultShifts(branchId: string) {
        for (const def of DEFAULT_SHIFTS) {
            const existing = await prisma.shift.findUnique({
                where: { branchId_name: { branchId, name: def.name } },
            });
            if (!existing) {
                await prisma.shift.create({
                    data: {
                        branchId,
                        name: def.name,
                        startTime: def.startTime,
                        endTime: def.endTime,
                        price: def.price,
                        isReserved: def.isReserved,
                    },
                });
            }
        }
    }

    static async listShifts(userId: string, branchId: string) {
        await this.assertBranchOwnership(userId, branchId);
        await this.ensureDefaultShifts(branchId);
        return prisma.shift.findMany({
            where: { branchId },
            orderBy: { name: "asc" },
        });
    }
}
