import { prisma as db } from "@/lib/prisma";
import { StaffRole, StaffAction, EntityPermissionMatrix } from "@/types";

// ==========================================
// 1. TYPES & PERMISSION MATRIX
// ==========================================

/**
 * Roles allowed to perform an action (IN ADDITION to Organization Owner).
 * If a role is listed here, it is allowed.
 * Owner is implicitly allowed for everything on their own org/branch.
 */
export const PERMISSION_MATRIX: EntityPermissionMatrix = {
    manage_org: [], // OWNER only
    manage_branch: [StaffRole.MANAGER],
    students: [StaffRole.MANAGER, StaffRole.STAFF],
    seat_allocation: [StaffRole.MANAGER, StaffRole.STAFF],
    generate_payments: [StaffRole.MANAGER],
    mark_payment_paid: [StaffRole.MANAGER, StaffRole.STAFF],
    analytics: [StaffRole.MANAGER],
    staff_management: [], // OWNER only
};

export class StaffService {
    // ==========================================
    // 2. AUTHORIZATION CHECK (The Core Logic)
    // ==========================================

    /**
     * Authorize a user to perform an action on a specific branch.
     * Logic:
     * 1. Check if user is Org OWNER -> Allow.
     * 2. If not, fetch Staff role for this branch.
     * 3. Match role against PERMISSION_MATRIX.
     * 4. Return true or throw Error.
     */
    static async authorize(userId: string, branchId: string, action: StaffAction): Promise<boolean> {
        // 1. Check if User is the Org Owner of this branch
        const branch = await db.branch.findUnique({
            where: { id: branchId },
            include: { organization: true },
        });

        if (!branch) {
            throw new Error("Branch not found");
        }

        if (branch.organization.ownerId === userId) {
            return true; // ✅ Owner is always allowed
        }

        // 2. Not Owner? Check Staff Role
        const staffMember = await db.staff.findUnique({
            where: {
                userId_branchId: {
                    userId,
                    branchId,
                },
            },
        });

        if (!staffMember) {
            throw new Error("Unauthorized: Not a staff member of this branch");
        }

        // 3. Match Role against Matrix
        const allowedRoles = PERMISSION_MATRIX[action];
        if (allowedRoles.includes(staffMember.role)) {
            return true; // ✅ Role is allowed
        }

        // 4. Reject
        throw new Error(`Unauthorized: Role '${staffMember.role}' cannot perform '${action}'`);
    }

    // ==========================================
    // 3. SERVICE METHODS
    // ==========================================

    /**
     * Add a new staff member to a branch.
     * Permission: staff_management (Owner Only)
     */
    static async addStaff(
        actorId: string,
        branchId: string,
        targetUserId: string,
        role: StaffRole
    ) {
        await this.authorize(actorId, branchId, "staff_management");

        // Check if target user exists
        const user = await db.user.findUnique({ where: { id: targetUserId } });
        if (!user) {
            throw new Error("Target user not found");
        }

        // Check if already staff
        const existingStaff = await db.staff.findUnique({
            where: {
                userId_branchId: {
                    userId: targetUserId,
                    branchId,
                },
            },
        });

        if (existingStaff) {
            throw new Error("User is already a staff member of this branch");
        }

        return db.staff.create({
            data: {
                userId: targetUserId,
                branchId,
                role,
            },
        });
    }

    /**
     * Remove a staff member.
     * Permission: staff_management (Owner Only)
     */
    static async removeStaff(actorId: string, branchId: string, staffId: string) {
        await this.authorize(actorId, branchId, "staff_management");

        return db.staff.delete({
            where: { id: staffId },
        });
    }

    /**
     * Update a staff member's role.
     * Permission: staff_management (Owner Only)
     */
    static async updateStaffRole(
        actorId: string,
        branchId: string,
        staffId: string,
        newRole: StaffRole
    ) {
        await this.authorize(actorId, branchId, "staff_management");

        return db.staff.update({
            where: { id: staffId },
            data: { role: newRole },
        });
    }

    /**
     * List all staff in a branch.
     * Permission: manage_branch (Owner + Manager)
     * Note: Using 'manage_branch' to allow Managers to see their team.
     */
    static async listStaff(actorId: string, branchId: string) {
        await this.authorize(actorId, branchId, "manage_branch");

        return db.staff.findMany({
            where: { branchId },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                    },
                },
            },
        });
    }
}
