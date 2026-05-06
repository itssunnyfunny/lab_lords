import { randomBytes } from "crypto";
import { prisma as db } from "@/lib/prisma";
import { StaffRole } from "@/types";
import { StaffService } from "@/services/staff.service";

const DEFAULT_INVITE_TTL_DAYS = 7;

function createInviteToken() {
    return randomBytes(32).toString("base64url");
}

function addDays(date: Date, days: number) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

function normalizeToken(token: string) {
    return token.trim();
}

export class StaffInviteService {
    static async createInvite(
        actorId: string,
        branchId: string,
        role: StaffRole,
        ttlDays = DEFAULT_INVITE_TTL_DAYS
    ) {
        await StaffService.authorize(actorId, branchId, "staff_management");

        if (ttlDays < 1 || ttlDays > 30) {
            throw new Error("Invite expiry must be between 1 and 30 days.");
        }

        return db.staffInvite.create({
            data: {
                branchId,
                role,
                token: createInviteToken(),
                expiresAt: addDays(new Date(), ttlDays),
            },
        });
    }

    static async getInvitePreview(token: string) {
        const invite = await db.staffInvite.findUnique({
            where: { token: normalizeToken(token) },
            include: {
                branch: {
                    select: {
                        id: true,
                        name: true,
                        city: true,
                        organization: { select: { name: true } },
                    },
                },
            },
        });

        if (!invite) {
            throw new Error("Invite not found");
        }

        return {
            ...invite,
            isExpired: invite.expiresAt.getTime() <= Date.now(),
        };
    }

    static async acceptInvite(userId: string, token: string) {
        return db.$transaction(async (tx) => {
            const invite = await tx.staffInvite.findUnique({
                where: { token: normalizeToken(token) },
                include: {
                    branch: { select: { id: true, name: true } },
                },
            });

            if (!invite) {
                throw new Error("Invite not found");
            }

            if (invite.acceptedAt) {
                throw new Error("Invite has already been accepted");
            }

            if (invite.expiresAt.getTime() <= Date.now()) {
                throw new Error("Invite has expired");
            }

            const existingStaff = await tx.staff.findUnique({
                where: {
                    userId_branchId: {
                        userId,
                        branchId: invite.branchId,
                    },
                },
            });

            const staff = existingStaff ?? (await tx.staff.create({
                data: {
                    userId,
                    branchId: invite.branchId,
                    role: invite.role,
                },
            }));

            await tx.staffInvite.update({
                where: { id: invite.id },
                data: { acceptedAt: new Date() },
            });

            return {
                branchId: invite.branchId,
                branchName: invite.branch.name,
                staff,
            };
        });
    }
}
