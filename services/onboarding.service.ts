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
    seatCount?: number;
    shifts?: {
        name: string;
        startTime: string | null;
        endTime: string | null;
        price: number;
    }[];
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

            // 3. Create Custom Shifts (or defaults if not provided, though generic defaults lack price context)
            const shiftsToCreate = params.shifts && params.shifts.length > 0
                ? params.shifts
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

            // 4. Create Seats
            // Generate seats based on seatCount (e.g. "1", "2", ...)
            if (params.seatCount && params.seatCount > 0) {
                for (let i = 1; i <= params.seatCount; i++) {
                    await tx.seat.create({
                        data: {
                            branchId: branch.id,
                            label: `${i}`,
                        },
                    });
                }
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
