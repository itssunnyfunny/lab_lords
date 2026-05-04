import { prisma } from "@/lib/prisma";

export interface CreateMultiShiftDto {
    name: string;
    price?: number;
    shiftIds: string[];
}

export interface UpdateMultiShiftDto {
    name?: string;
    price?: number;
    shiftIds?: string[];
}

export interface MultiShiftItem {
    id: string;
    name: string;
    price: number;
    createdAt: Date;
    components: {
        shiftId: string;
        shiftName: string;
        startTime: string | null;
        endTime: string | null;
        order: number;
    }[];
}

type MultiShiftWithComponents = {
    id: string;
    name: string;
    price: number;
    createdAt: Date;
    components: {
        shiftId: string;
        order: number;
        shift: {
            name: string;
            startTime: string | null;
            endTime: string | null;
        };
    }[];
};

export class MultiShiftService {
    private static async assertBranchOwnership(userId: string, branchId: string) {
        const branch = await prisma.branch.findUnique({
            where: { id: branchId },
            include: { organization: true },
        });
        if (!branch) throw new Error("Branch not found");
        if (branch.organization.ownerId !== userId)
            throw new Error("Unauthorized: User does not own this branch");
        return branch;
    }

    /**
     * Validate and normalize shiftIds for a multi-shift:
     * - At least 2 shifts
     * - All shifts must be ACTIVE primary shifts of this branch
     * - Exact combination must not already exist (sorted set comparison)
     */
    private static async validateComponents(
        branchId: string,
        shiftIds: string[],
        excludeMultiShiftId?: string
    ) {
        if (!shiftIds || shiftIds.length < 2) {
            throw new Error("A multi-shift must contain at least 2 primary shifts.");
        }

        const uniqueIds = [...new Set(shiftIds)];

        // Validate all shifts exist, are ACTIVE, and belong to this branch
        const shifts = await prisma.shift.findMany({
            where: { id: { in: uniqueIds } },
            select: { id: true, name: true, branchId: true, status: true },
        });

        if (shifts.length !== uniqueIds.length) {
            throw new Error("One or more shifts were not found.");
        }
        for (const s of shifts) {
            if (s.branchId !== branchId)
                throw new Error(`Shift "${s.name}" does not belong to this branch.`);
            if (s.status !== "ACTIVE")
                throw new Error(`Shift "${s.name}" is not active.`);
        }

        // Check for duplicate combination (order-independent)
        const sortedNew = [...uniqueIds].sort().join(",");
        const existingMultiShifts = await prisma.multiShift.findMany({
            where: {
                branchId,
                ...(excludeMultiShiftId ? { id: { not: excludeMultiShiftId } } : {}),
            },
            include: {
                components: { select: { shiftId: true } },
            },
        });

        for (const ms of existingMultiShifts) {
            const sortedExisting = ms.components.map((c) => c.shiftId).sort().join(",");
            if (sortedExisting === sortedNew) {
                throw new Error(
                    `A multi-shift with this exact combination already exists: "${ms.name}"`
                );
            }
        }

        return uniqueIds;
    }

    static async createMultiShift(
        userId: string,
        branchId: string,
        data: CreateMultiShiftDto
    ): Promise<MultiShiftItem> {
        await this.assertBranchOwnership(userId, branchId);
        const uniqueIds = await this.validateComponents(branchId, data.shiftIds);

        const ms = await prisma.multiShift.create({
            data: {
                branchId,
                name: data.name.trim(),
                price: data.price ?? 0,
                components: {
                    create: uniqueIds.map((shiftId, i) => ({ shiftId, order: i })),
                },
            },
            include: {
                components: {
                    include: { shift: { select: { name: true, startTime: true, endTime: true } } },
                    orderBy: { order: "asc" },
                },
            },
        });

        return this.toDto(ms);
    }

    static async updateMultiShift(
        userId: string,
        multiShiftId: string,
        data: UpdateMultiShiftDto
    ): Promise<MultiShiftItem> {
        const ms = await prisma.multiShift.findUnique({ where: { id: multiShiftId } });
        if (!ms) throw new Error("Multi-shift not found");
        await this.assertBranchOwnership(userId, ms.branchId);

        let uniqueIds: string[] | undefined;
        if (data.shiftIds) {
            uniqueIds = await this.validateComponents(ms.branchId, data.shiftIds, multiShiftId);
        }

        const priceChanged = data.price !== undefined && data.price !== ms.price;

        const updated = await prisma.$transaction(async (tx) => {
            const saved = await tx.multiShift.update({
                where: { id: multiShiftId },
                data: {
                    ...(data.name !== undefined ? { name: data.name.trim() } : {}),
                    ...(data.price !== undefined ? { price: data.price } : {}),
                    ...(uniqueIds
                        ? {
                              components: {
                                  deleteMany: {},
                                  create: uniqueIds.map((shiftId, i) => ({ shiftId, order: i })),
                              },
                          }
                        : {}),
                },
                include: {
                    components: {
                        include: { shift: { select: { name: true, startTime: true, endTime: true } } },
                        orderBy: { order: "asc" },
                    },
                },
            });

            if (priceChanged) {
                await tx.student.updateMany({
                    where: {
                        branchId: ms.branchId,
                        feeLinkedMultiShiftId: multiShiftId,
                    },
                    data: {
                        monthlyFee: data.price,
                    },
                });
            }

            await tx.branch.update({
                where: { id: ms.branchId },
                data: { lastDataChange: new Date() },
            });

            return saved;
        });

        return this.toDto(updated);
    }

    static async deleteMultiShift(userId: string, multiShiftId: string) {
        const ms = await prisma.multiShift.findUnique({ where: { id: multiShiftId } });
        if (!ms) throw new Error("Multi-shift not found");
        await this.assertBranchOwnership(userId, ms.branchId);

        await prisma.$transaction(async (tx) => {
            // Null out the multiShiftId on existing allocations (keep history intact)
            await tx.seatAllocation.updateMany({
                where: { multiShiftId },
                data: { multiShiftId: null },
            });
            await tx.student.updateMany({
                where: { branchId: ms.branchId, feeLinkedMultiShiftId: multiShiftId },
                data: { feeLinkedMultiShiftId: null },
            });
            await tx.multiShift.delete({ where: { id: multiShiftId } });
        });

        return { success: true };
    }

    static async listMultiShifts(userId: string, branchId: string): Promise<MultiShiftItem[]> {
        await this.assertBranchOwnership(userId, branchId);

        const list = await prisma.multiShift.findMany({
            where: { branchId },
            include: {
                components: {
                    include: { shift: { select: { name: true, startTime: true, endTime: true } } },
                    orderBy: { order: "asc" },
                },
            },
            orderBy: { name: "asc" },
        });

        return list.map(this.toDto);
    }

    private static toDto(ms: MultiShiftWithComponents): MultiShiftItem {
        return {
            id: ms.id,
            name: ms.name,
            price: ms.price,
            createdAt: ms.createdAt,
            components: ms.components.map((c) => ({
                shiftId: c.shiftId,
                shiftName: c.shift.name,
                startTime: c.shift.startTime,
                endTime: c.shift.endTime,
                order: c.order,
            })),
        };
    }
}
