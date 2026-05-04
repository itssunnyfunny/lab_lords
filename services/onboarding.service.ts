import { prisma } from "@/lib/prisma";
import {
    FORM_LIMITS,
    parseIntegerField,
    validateOptionalText,
    validateRequiredText,
    validateShiftDrafts,
} from "@/lib/formValidation";

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
        const orgNameResult = validateRequiredText(orgData.name, "Organization name", 120);
        if (!orgNameResult.ok) throw new Error(orgNameResult.error);
        const businessTypeResult = validateOptionalText(orgData.businessType, "Business type", 80);
        if (!businessTypeResult.ok) throw new Error(businessTypeResult.error);
        const branchNameResult = validateRequiredText(branchData.name, "Branch name", 120);
        if (!branchNameResult.ok) throw new Error(branchNameResult.error);
        const cityResult = validateOptionalText(branchData.city, "City", FORM_LIMITS.cityMax);
        if (!cityResult.ok) throw new Error(cityResult.error);
        const defaultFeeResult = parseIntegerField(branchData.defaultFee, "Default monthly fee", {
            min: 0,
            max: FORM_LIMITS.moneyMax,
        });
        if (!defaultFeeResult.ok) throw new Error(defaultFeeResult.error);
        const seatCountResult = parseIntegerField(params.seatCount, "Total seats", {
            min: 0,
            max: FORM_LIMITS.seatsMax,
        });
        if (!seatCountResult.ok) throw new Error(seatCountResult.error);
        const shiftsResult = params.shifts ? validateShiftDrafts(params.shifts, { allowEmpty: false }) : null;
        if (shiftsResult && !shiftsResult.ok) throw new Error(shiftsResult.error);

        // Use interactive transaction for atomicity
        return await prisma.$transaction(async (tx) => {
            // 1. Create Organization
            const org = await tx.organization.create({
                data: {
                    name: orgNameResult.value,
                    businessType: businessTypeResult.value,
                    ownerId: userId,
                },
            });

            // 2. Create First Branch linked to Org
            const branch = await tx.branch.create({
                data: {
                    name: branchNameResult.value,
                    city: cityResult.value,
                    defaultFee: defaultFeeResult.value,
                    organizationId: org.id,
                },
            });

            // 3. Create Default Shifts for the branch (manually reusing logic or calling service if compatible with tx)
            // Since service methods might use global `prisma`, we should replicate crucial logic or pass tx if refactored.
            // For safety in transaction, we'll implement the creation directly here to ensure it uses `tx`.

            // 3. Create Custom Shifts (or defaults if not provided, though generic defaults lack price context)
            const shiftsToCreate = shiftsResult?.ok && shiftsResult.value.length > 0
                ? shiftsResult.value
                : [
                    { name: "Morning", startTime: "06:00", endTime: "12:00", price: 0 },
                    { name: "Evening", startTime: "16:00", endTime: "22:00", price: 0 },
                    { name: "Reserved", startTime: null, endTime: null, price: 0 },
                ];

            // ⚡ Bolt: Bulk shift creation to prevent N+1 query problem during network setup
            if (shiftsToCreate.length > 0) {
                await tx.shift.createMany({
                    data: shiftsToCreate.map(shift => ({
                        branchId: branch.id,
                        name: shift.name,
                        startTime: shift.startTime,
                        endTime: shift.endTime,
                        price: shift.price,
                    }))
                });
            }

            // 4. Create Seats
            // Generate seats based on seatCount (e.g. "1", "2", ...)
            // ⚡ Bolt: Bulk seat creation. Reduces DB roundtrips from N to 1
            if (seatCountResult.value && seatCountResult.value > 0) {
                const seatsData = Array.from({ length: seatCountResult.value }, (_, i) => ({
                    branchId: branch.id,
                    label: `${i + 1}`,
                }));
                await tx.seat.createMany({
                    data: seatsData,
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
