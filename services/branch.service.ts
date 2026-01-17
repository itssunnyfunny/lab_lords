import { prisma } from "@/lib/prisma";
import { CreateBranchDto } from "@/types";
import { ShiftService } from "./shift.service";

export class BranchService {
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
            where: {
                organizationId,
            },
            orderBy: {
                createdAt: "desc",
            },
        });
    }

    static async getBranchById(id: string) {
        return await prisma.branch.findUnique({
            where: { id },
        });
    }
}
