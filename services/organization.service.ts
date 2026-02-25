import { prisma } from "@/lib/prisma";
import { CreateOrganizationDto } from "@/types";

export class OrganizationService {
    static async createOrganization(data: CreateOrganizationDto) {
        return await prisma.organization.create({
            data: { name: data.name, ownerId: data.ownerId },
        });
    }

    static async getOrganizationsByUserId(userId: string) {
        return await prisma.organization.findMany({
            where: { ownerId: userId },
            include: { _count: { select: { branches: true } } },
            orderBy: { createdAt: "desc" },
        });
    }

    static async getOrganizationById(id: string) {
        return await prisma.organization.findUnique({
            where: { id },
            include: {
                branches: {
                    select: { id: true, name: true, city: true, createdAt: true },
                    orderBy: { createdAt: "desc" },
                },
                _count: { select: { branches: true } },
            },
        });
    }

    static async updateOrganization(
        id: string,
        userId: string,
        data: { name?: string; businessType?: string }
    ) {
        // Ownership check
        const org = await prisma.organization.findUnique({ where: { id }, select: { ownerId: true } });
        if (!org) throw new Error("Organization not found");
        if (org.ownerId !== userId) throw new Error("Unauthorized");

        return await prisma.organization.update({
            where: { id },
            data: {
                ...(data.name !== undefined ? { name: data.name.trim() } : {}),
                ...(data.businessType !== undefined ? { businessType: data.businessType.trim() } : {}),
            },
        });
    }

    static async isOwner(organizationId: string, userId: string): Promise<boolean> {
        const org = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: { ownerId: true },
        });
        return org?.ownerId === userId;
    }
}

