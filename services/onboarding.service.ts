import { prisma } from "@/lib/prisma";
import { ShiftService } from "./shift.service";

interface CreateNetworkParams {
    userId: string;
    orgData: {
        name: string;
        businessType?: string;
    };
    branchData: {
        name: string;
        city?: string;
        defaultFee?: number;
    };
}

export class OnboardingService {
    static async createNetwork(params: CreateNetworkParams) {
        const { userId, orgData, branchData } = params;

        // Use interactive transaction for atomicity
        return await prisma.$transaction(async (tx) => {
            // 1. Create Organization
            const org = await tx.organization.create({
                data: {
                    name: orgData.name,
                    businessType: orgData.businessType,
                    ownerId: userId,
                },
            });

            // 2. Create First Branch linked to Org
            const branch = await tx.branch.create({
                data: {
                    name: branchData.name,
                    city: branchData.city,
                    defaultFee: branchData.defaultFee,
                    organizationId: org.id,
                },
            });

            // 3. Create Default Shifts for the branch (manually reusing logic or calling service if compatible with tx)
            // Since service methods might use global `prisma`, we should replicate crucial logic or pass tx if refactored.
            // For safety in transaction, we'll implement the creation directly here to ensure it uses `tx`.

            const defaults = [
                { name: "Morning", startTime: "06:00", endTime: "12:00" },
                { name: "Evening", startTime: "16:00", endTime: "22:00" },
                { name: "Reserved", startTime: null, endTime: null },
            ];

            for (const def of defaults) {
                await tx.shift.create({
                    data: {
                        branchId: branch.id,
                        name: def.name,
                        startTime: def.startTime,
                        endTime: def.endTime,
                    },
                });
            }

            // 4. (Optional) Assign User as STAFF/MANAGER to this branch?
            // The schema says `Staff` table links User to Branch with Role.
            // Owner is implicitly owner via Org, but for consistency in "Staff List", we often add them.
            // Requirement says: "AssignUserAsOwner" -> typically implied by Org.ownerId, 
            // but let's add them as MANAGER in Staff table to be explicit and appear in lists.

            await tx.staff.create({
                data: {
                    userId,
                    branchId: branch.id,
                    role: "MANAGER",
                },
            });

            return { org, branch };
        });
    }
}
