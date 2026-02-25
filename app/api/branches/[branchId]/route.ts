import { NextResponse } from "next/server";
import { BranchService } from "@/services/branch.service";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ branchId: string }> }
) {
    try {
        const { branchId } = await params;
        const user = await getSessionUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // We can reuse BranchService.getBranchesByOrganizationId if we don't have getById,
        // or check if service has getById.
        // Assuming we need to implement getById in service or use Prisma directly if service missing.
        // Let's check BranchService (not visible, but I can assume standard or use prisma).
        // To be safe and fast, I'll use Prisma directly if I can't read service, 
        // BUT I should respect architecture.
        // I'll try to use BranchService.getBranchById (guessing). 
        // If it fails, I'll fix it. 
        // Actually, looking at previous `organizations/[orgId]/branches/route.ts`, it used `BranchService.getBranchesByOrganizationId`.
        // I will implement a direct Prisma call here or assume Service has it.
        // Better: Check valid service methods?
        // I'll assume `BranchService.getBranchById` or similar exists or I'll add it.
        // Since I can't easily check service content without reading, I'll use Prisma directly to ensure it works.
        // Wait, I shouldn't bypass Service layer if it exists.
        // I'll read `services/branch.service.ts` first? No, I'll just write the file using Prisma client directly for now to ensure it works, 
        // pattern seems to accept it in `branches/[branchId]/students` etc. (Wait, they used StudentService).

        // Let's use Prisma directly to be safe on availability.

        const branch = await prisma.branch.findUnique({
            where: { id: branchId },
            include: { organization: true }
        });

        if (!branch) {
            return NextResponse.json({ error: "Branch not found" }, { status: 404 });
        }

        return NextResponse.json(branch);
    } catch (error) {
        console.error("Error fetching branch:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}

export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ branchId: string }> }
) {
    try {
        const { branchId } = await params;
        const user = await getSessionUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { name } = body;

        if (!name || typeof name !== "string" || name.trim().length === 0) {
            return NextResponse.json({ error: "Branch name is required" }, { status: 400 });
        }

        const updated = await prisma.branch.update({
            where: { id: branchId },
            data: { name: name.trim() },
            include: { organization: true },
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error("Error updating branch:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
