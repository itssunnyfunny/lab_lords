import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import { OnboardingService } from "../services/onboarding.service";
import { assertDisposableTestDatabaseTarget } from "../tests/setup/testDatabaseSafety";

/** Give each local audit a new owner and the same branch agreement and trial as signup. */
export async function createAuditWorkspace(audit: string, defaultFee = 0) {
    const target = assertDisposableTestDatabaseTarget(process.env.DATABASE_URL);
    if (process.env.ACCELERATE_URL) throw new Error("Local audits require a direct test database");
    const [connection] = await prisma.$queryRaw<Array<{ databaseName: string }>>`SELECT current_database() AS "databaseName"`;
    if (connection?.databaseName !== target.databaseName) throw new Error("Local audit database identity mismatch");

    const user = await prisma.user.create({
        data: { email: `audit-${audit}-${randomUUID()}@example.test`, name: "Audit User" },
    });
    const { org, branch } = await OnboardingService.createNetwork({
        userId: user.id,
        idempotencyKey: randomUUID(),
        ownerPhone: "9900000000",
        orgData: { name: "Audit Org" },
        branchData: { name: "Audit Branch", defaultFee },
        selectedPostTrialPlan: "STANDARD",
        trialPlan: "STANDARD",
        seatCount: 0,
        shifts: [{ name: "Audit time slot", startTime: "09:00", endTime: "17:00", price: 0 }],
        multiShifts: [],
    });
    return { user, org, branch };
}
