import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDatabase, disconnectDatabase, testPrisma } from "@/tests/setup/db";
import { createBranch, createOrg, createStudent, createUser } from "@/tests/factories";
import { PaymentService } from "@/services/payment.service";
import { BranchService } from "@/services/branch.service";
import { RenewalsService } from "@/services/renewals.service";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";

beforeEach(resetDatabase);
afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
});
afterAll(disconnectDatabase);

function date(month: number, day: number) {
    return new Date(2026, month - 1, day);
}

function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>(complete => { resolve = complete; });
    return { promise, resolve };
}

async function scheduledBranchRemoval() {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(date(4, 1));
    const owner = await createUser();
    const organization = await createOrg({ ownerId: owner.id, billingModelVersion: "WORKSPACE_V2" });
    const branch = await createBranch({ organizationId: organization.id });
    await createBranch({ organizationId: organization.id });
    const closure = date(5, 10);
    await testPrisma.ownerTrialGrant.create({
        data: {
            ownerId: owner.id, organizationId: organization.id, source: "ONBOARDING", status: "ACTIVE",
            trialStartedAt: date(4, 1), trialEndsAt: closure, consumedAt: date(4, 1),
        },
    });
    const student = await createStudent({ branchId: branch.id, joinedAt: date(3, 10), monthlyFee: 900 });
    const { change } = await BranchService.scheduleBillingRemoval(owner.id, branch.id, "monthly-fees-removal");
    expect(change).toMatchObject({ status: "SCHEDULED", effectiveAt: closure });
    return { owner, branch, student, change, closure };
}

function dues(studentId: string) {
    return testPrisma.payment.findMany({
        where: { studentId }, select: { dueDate: true, amount: true, status: true }, orderBy: { dueDate: "asc" },
    });
}

async function waitForBranchLock() {
    await expect.poll(async () => {
        const [blocked] = await testPrisma.$queryRaw<Array<{ waiting: boolean }>>`
            SELECT EXISTS (
                SELECT 1 FROM pg_stat_activity
                WHERE datname = current_database() AND wait_event_type = 'Lock'
                  AND query LIKE '%"Branch"%' AND query LIKE '%FOR UPDATE%'
            ) AS waiting
        `;
        return blocked.waiting;
    }, { timeout: 3000 }).toBe(true);
}

describe("system-owned monthly fee generation and branch closures", () => {
    it("generates only for active students in operating branches without granting staff writes or SaaS access", async () => {
        const owner = await createUser();
        const organization = await createOrg({ ownerId: owner.id, billingModelVersion: "WORKSPACE_V2" });
        const branch = await createBranch({ organizationId: organization.id });
        const student = await createStudent({ branchId: branch.id, joinedAt: new Date("2026-01-31T00:00:00Z"), monthlyFee: 1100 });
        const inactive = await createStudent({ branchId: branch.id, joinedAt: student.joinedAt, monthlyFee: 1100 });
        await testPrisma.student.update({ where: { id: inactive.id }, data: { status: "INACTIVE" } });
        const foreignOwner = await createUser();
        const foreignOrganization = await createOrg({ ownerId: foreignOwner.id, billingModelVersion: "WORKSPACE_V2" });
        const pendingBranch = await createBranch({ organizationId: foreignOrganization.id });
        const archivedBranch = await createBranch({ organizationId: foreignOrganization.id });
        await testPrisma.branch.update({ where: { id: pendingBranch.id }, data: { billingStatus: "PENDING_ACTIVATION" } });
        await testPrisma.branch.update({ where: { id: archivedBranch.id }, data: { billingStatus: "ARCHIVED" } });
        const pending = await createStudent({ branchId: pendingBranch.id, joinedAt: student.joinedAt, monthlyFee: 1100 });
        const archived = await createStudent({ branchId: archivedBranch.id, joinedAt: student.joinedAt, monthlyFee: 1100 });
        const asOf = new Date("2026-03-31T00:00:00Z");
        const orgBefore = await testPrisma.organization.findUniqueOrThrow({ where: { id: organization.id } });
        await expect(PaymentService.generateDuePaymentsForBranch(owner.id, branch.id, asOf)).rejects.toThrow(/paid subscription/i);
        await expect(PaymentService.generateDuePaymentsForBranch(foreignOwner.id, branch.id, asOf)).rejects.toThrow();
        const initial = await PaymentService.generateDuePaymentsForAllActiveStudents(new Date("2026-02-28T00:00:00Z"));
        expect(initial.updatedBranchIds).toEqual([branch.id]);
        const first = await testPrisma.payment.findMany({ where: { studentId: student.id } });
        expect(first.length).toBeGreaterThan(0);
        expect(first.every(row => row.status === "DUE")).toBe(true);
        await PaymentService.generateDuePaymentsForAllActiveStudents(asOf);
        const later = await testPrisma.payment.findMany({ where: { studentId: student.id }, orderBy: { dueDate: "asc" } });
        expect(later.length).toBeGreaterThan(first.length);
        const indiaDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });
        expect(later.map(row => indiaDay.format(row.dueDate))).toEqual(["2026-02-28", "2026-03-31"]);
        expect(later.every(row => row.status === "DUE")).toBe(true);
        const repeat = await PaymentService.generateDuePaymentsForAllActiveStudents(asOf);
        expect(repeat.generatedCount).toBe(0);
        expect(await testPrisma.payment.findMany({ where: { studentId: student.id }, orderBy: { dueDate: "asc" } })).toEqual(later);
        expect(await testPrisma.organization.findUniqueOrThrow({ where: { id: organization.id } })).toEqual(orgBefore);
        expect(await testPrisma.billingProviderAction.count()).toBe(0);
        expect(await testPrisma.organizationSubscriptionHistory.count()).toBe(0);
        expect(await testPrisma.payment.count({ where: { studentId: { in: [inactive.id, pending.id, archived.id] } } })).toBe(0);
    });

    it("stops at the effective closure even if the archive worker runs late", async () => {
        const { owner, branch, student, closure } = await scheduledBranchRemoval();
        await expect(PaymentService.generateDuePaymentsForBranch(owner.id, branch.id, date(4, 10)))
            .rejects.toThrow(/read.only/i);
        await expect(PaymentService.generateDuePaymentsForAllActiveStudents(date(4, 10)))
            .resolves.toMatchObject({ generatedCount: 1, updatedBranchIds: [branch.id] });
        await expect(PaymentService.generateDuePaymentsForAllActiveStudents(closure))
            .resolves.toMatchObject({ generatedCount: 0 });
        await expect(PaymentService.generateDuePaymentsForAllActiveStudents(date(6, 10)))
            .resolves.toMatchObject({ generatedCount: 0 });
        expect(await testPrisma.branch.findUniqueOrThrow({ where: { id: branch.id }, select: { billingStatus: true } }))
            .toEqual({ billingStatus: "REMOVAL_SCHEDULED" });
        await expect(BranchService.archiveDueBillingRemovals(date(6, 11))).resolves.toMatchObject({ archived: 1 });
        await expect(PaymentService.generateDuePaymentsForAllActiveStudents(date(7, 10)))
            .resolves.toMatchObject({ generatedCount: 0 });
        expect(await dues(student.id)).toEqual([{ dueDate: date(4, 10), amount: 900, status: "DUE" }]);
    });

    it("keeps the same anniversary after the owner undoes a scheduled removal before closure", async () => {
        const { owner, branch, student, change } = await scheduledBranchRemoval();
        await PaymentService.generateDuePaymentsForAllActiveStudents(date(4, 10));
        vi.setSystemTime(date(4, 11));
        await expect(BranchService.undoBillingRemoval(owner.id, branch.id, change.id)).resolves.toMatchObject({ undone: true });
        await expect(PaymentService.generateDuePaymentsForAllActiveStudents(date(6, 10)))
            .resolves.toMatchObject({ generatedCount: 2, updatedBranchIds: [branch.id] });
        expect(await dues(student.id)).toEqual([date(4, 10), date(5, 10), date(6, 10)].map(dueDate =>
            ({ dueDate, amount: 900, status: "DUE" })));
    });

    it("shows only pre-closure projections and still lists existing debts in read-only Renewals", async () => {
        const { owner, branch, student, closure } = await scheduledBranchRemoval();
        await PaymentService.generateDuePaymentsForAllActiveStudents(date(4, 10));
        const dueBefore = await createStudent({ branchId: branch.id, joinedAt: date(4, 9), monthlyFee: 600 });
        const query = { filter: "ALL" as const, days: 7 as const, limit: 20, search: "" };

        const before = await RenewalsService.list(owner.id, branch.id, query, date(5, 8));
        expect(before.items.filter(row => row.expected).map(row => row.studentId)).toEqual([dueBefore.id]);
        expect(before.items).toContainEqual(expect.objectContaining({ studentId: student.id, dueDate: date(4, 10).toISOString(), expected: false }));
        const closed = await RenewalsService.list(owner.id, branch.id, query, closure);
        expect(closed.items.map(row => [row.studentId, row.expected])).toEqual([[student.id, false]]);
    });

    it("resumes fees on the day a closed branch reopens without backfilling its closed gap", async () => {
        const { branch, student, closure } = await scheduledBranchRemoval();
        await PaymentService.generateDuePaymentsForAllActiveStudents(date(4, 10));
        await expect(BranchService.archiveDueBillingRemovals(closure)).resolves.toMatchObject({ archived: 1 });

        const reopensAt = new Date(2026, 6, 10, 12);
        // Fixture the branch fields written by confirmed reactivation. The
        // payment job only consumes the resulting operational state.
        await testPrisma.branch.update({
            where: { id: branch.id },
            data: { billingStatus: "ACTIVE", billingActivatedAt: reopensAt, billingArchivedAt: null },
        });
        const firstActivation = await createBranch({ organizationId: branch.organizationId });
        await testPrisma.branch.update({ where: { id: firstActivation.id }, data: { billingActivatedAt: reopensAt } });
        const imported = await createStudent({ branchId: firstActivation.id, joinedAt: date(3, 10), monthlyFee: 700 });

        await expect(PaymentService.generateDuePaymentsForAllActiveStudents(reopensAt)).resolves.toMatchObject({ generatedCount: 5 });
        expect(await dues(student.id)).toEqual([date(4, 10), date(7, 10)].map(dueDate =>
            ({ dueDate, amount: 900, status: "DUE" })));
        expect((await dues(imported.id)).map(payment => payment.dueDate)).toEqual([date(4, 10), date(5, 10), date(6, 10), date(7, 10)]);
    });

    it("skips a staged batch when the effective deadline passes while the branch is locked before archival", async () => {
        const { branch, student, closure } = await scheduledBranchRemoval();
        vi.setSystemTime(new Date(closure.getTime() - 1));
        const locked = deferred();
        const release = deferred();
        const holder = testPrisma.$transaction(async tx => {
            await tx.$queryRaw`SELECT "id" FROM "Branch" WHERE "id" = ${branch.id} FOR UPDATE`;
            locked.resolve();
            await release.promise;
        }, { timeout: 15_000 });
        let generated: ReturnType<typeof PaymentService.generateDuePaymentsForAllActiveStudents> | undefined;
        try {
            await Promise.race([locked.promise, holder]);
            generated = PaymentService.generateDuePaymentsForAllActiveStudents();
            void generated.catch(() => undefined);
            await waitForBranchLock();
            vi.setSystemTime(closure);
        } finally {
            release.resolve();
            await Promise.allSettled([holder, ...(generated ? [generated] : [])]);
        }
        await expect(holder).resolves.toBeUndefined();
        await expect(generated).resolves.toMatchObject({ generatedCount: 0 });
        expect(await dues(student.id)).toEqual([]);
        expect(await testPrisma.branch.findUniqueOrThrow({ where: { id: branch.id } }))
            .toMatchObject({ billingStatus: "REMOVAL_SCHEDULED" });
    });

    it("rechecks a staged batch when an archival transaction wins the branch row lock", async () => {
        const { student, closure } = await scheduledBranchRemoval();
        const archiveWritten = deferred();
        const releaseArchive = deferred();
        const transaction = prisma.$transaction.bind(prisma);
        vi.spyOn(prisma, "$transaction").mockImplementationOnce(
            ((operation: (tx: Prisma.TransactionClient) => Promise<unknown>) => transaction(async tx => {
                const result = await operation(tx);
                archiveWritten.resolve();
                await releaseArchive.promise;
                return result;
            }, { timeout: 15_000 })) as typeof prisma.$transaction,
        );
        const archive = BranchService.archiveDueBillingRemovals(closure);
        let generated: ReturnType<typeof PaymentService.generateDuePaymentsForAllActiveStudents> | undefined;
        try {
            await Promise.race([archiveWritten.promise, archive]);
            generated = PaymentService.generateDuePaymentsForAllActiveStudents(date(5, 9));
            void generated.catch(() => undefined);
            // Wait for the generation transaction to reach the row lock while
            // the real archive write is uncommitted and its older state is visible.
            await waitForBranchLock();
        } finally {
            releaseArchive.resolve();
            await Promise.allSettled([archive, ...(generated ? [generated] : [])]);
        }
        await expect(archive).resolves.toMatchObject({ archived: 1 });
        await expect(generated).resolves.toMatchObject({ generatedCount: 0 });
        expect(await dues(student.id)).toEqual([]);
    });
});
