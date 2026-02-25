import { prisma } from "@/lib/prisma";
import { CreateBranchDto } from "@/types";
import { ShiftService } from "./shift.service";

interface CreateBranchForOrgParams {
    organizationId: string;
    userId: string;
    name: string;
    city?: string;
    defaultFee?: number;
    seatCount?: number;
    shifts?: {
        name: string;
        startTime: string | null;
        endTime: string | null;
        price: number;
    }[];
}

export class BranchService {
    /**
     * Shared branch creation logic used by both onboarding and the
     * "Add New Branch" flow. Creates branch + seats + shifts + staff
     * in a single atomic transaction.
     */
    static async createBranchForOrg(params: CreateBranchForOrgParams) {
        const { organizationId, userId, name, city, defaultFee, seatCount, shifts } = params;

        return await prisma.$transaction(async (tx) => {
            // 1. Create the branch
            const branch = await tx.branch.create({
                data: {
                    name,
                    city,
                    defaultFee: defaultFee ?? 0,
                    organizationId,
                },
            });

            // 2. Create shifts (custom or defaults)
            const shiftsToCreate = shifts && shifts.length > 0
                ? shifts
                : [
                    { name: "Morning", startTime: "06:00", endTime: "12:00", price: 0 },
                    { name: "Evening", startTime: "16:00", endTime: "22:00", price: 0 },
                    { name: "Reserved", startTime: null, endTime: null, price: 0 },
                ];

            for (const shift of shiftsToCreate) {
                await tx.shift.create({
                    data: {
                        branchId: branch.id,
                        name: shift.name,
                        startTime: shift.startTime,
                        endTime: shift.endTime,
                        price: shift.price,
                    },
                });
            }

            // 3. Create seats
            if (seatCount && seatCount > 0) {
                for (let i = 1; i <= seatCount; i++) {
                    await tx.seat.create({
                        data: { branchId: branch.id, label: `${i}` },
                    });
                }
            }

            // 4. Add calling user as MANAGER on this branch
            await tx.staff.create({
                data: { userId, branchId: branch.id, role: "MANAGER" },
            });

            return branch;
        });
    }

    static async createBranch(data: CreateBranchDto) {
        const branch = await prisma.branch.create({
            data: {
                name: data.name,
                organizationId: data.organizationId,
            },
        });

        await ShiftService.ensureDefaultShifts(branch.id);

        return branch;
    }

    static async getBranchesByOrganizationId(organizationId: string) {
        return await prisma.branch.findMany({
            where: { organizationId },
            orderBy: { createdAt: "desc" },
        });
    }

    static async getBranchById(id: string) {
        return await prisma.branch.findUnique({
            where: { id },
        });
    }
}

