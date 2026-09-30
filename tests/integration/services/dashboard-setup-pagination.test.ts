import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { DashboardService } from "@/services/dashboard.service";
import { createStudent, createTestWorld } from "@/tests/factories";
import { disconnectDatabase, resetDatabase, testPrisma as db } from "@/tests/setup/db";

const STUDENT_COUNT = 505;
const idAt = (index: number) => `setup-student-${String(index).padStart(4, "0")}`;

async function allRecordPages<T extends { id: string }>(read: (cursor?: string) => Promise<{ items: T[]; nextCursor: string | null }>) {
    const pages: T[][] = [];
    let cursor: string | undefined;
    for (let index = 0; index < 7; index++) {
        const page = await read(cursor);
        pages.push(page.items);
        if (!page.nextCursor) break;
        cursor = page.nextCursor;
    }
    return pages;
}

describe("Dashboard setup pagination — real disposable PostgreSQL", () => {
    beforeEach(resetDatabase);
    afterAll(disconnectDatabase);

    it("reaches every record and active student past 500 with independent scoped pages and a saved distant selection", async () => {
        const { user, org, branch } = await createTestWorld();
        await db.organization.update({ where: { id: org.id }, data: { billingModelVersion: "WORKSPACE_V2" } });
        await db.ownerTrialGrant.create({ data: { ownerId: user.id, organizationId: org.id,
            source: "ONBOARDING", status: "ACTIVE", trialStartedAt: new Date(),
            trialEndsAt: new Date(Date.now() + 7 * 86_400_000) } });
        const foreign = await createTestWorld();
        await db.student.createMany({ data: Array.from({ length: STUDENT_COUNT }, (_, index) => ({
            id: idAt(index), branchId: branch.id, name: `Synthetic ${index}`, monthlyFee: 0,
        })) });
        await db.attendanceExpectation.createMany({ data: Array.from({ length: 503 }, (_, index) => ({
            id: `a-setup-expectation-${String(index).padStart(4, "0")}`, branchId: branch.id,
            studentId: idAt(index), weekdays: [1, 2, 3, 4, 5], expectedBy: "08:00",
        })) });
        await db.membershipTerm.createMany({ data: Array.from({ length: 501 }, (_, index) => ({
            id: `a-setup-term-${String(index).padStart(4, "0")}`, branchId: branch.id,
            studentId: idAt(index), label: "Synthetic term", startDate: "2026-10-01", endDate: "2026-10-31",
        })) });
        const foreignStudent = await createStudent({ branchId: foreign.branch.id });
        await db.attendanceExpectation.create({ data: { branchId: foreign.branch.id, studentId: foreignStudent.id,
            weekdays: [1], expectedBy: "09:00" } });
        await db.membershipTerm.create({ data: { branchId: foreign.branch.id, studentId: foreignStudent.id,
            label: "Foreign term", startDate: "2026-10-01", endDate: "2026-10-31" } });

        const selectedId = idAt(504);
        const savedExpectation = await DashboardService.saveExpectation(user.id, branch.id, {
            studentId: selectedId, weekdays: [0, 6], expectedBy: "10:15", enabled: true,
        });
        const savedTerm = await DashboardService.saveTerm(user.id, branch.id, {
            studentId: selectedId, label: "Distant student term", startDate: "2026-10-01", endDate: "2026-10-31",
        });
        const now = new Date("2026-10-01T00:00:00Z");
        const firstExpectations = await DashboardService.expectations(user.id, branch.id, { limit: 100 });
        const firstTerms = await DashboardService.terms(user.id, branch.id, now, { limit: 100 });
        expect(firstExpectations).toMatchObject({ total: 504, studentTotal: STUDENT_COUNT });
        expect(firstTerms).toMatchObject({ total: 502, studentTotal: STUDENT_COUNT });
        expect(firstExpectations.items).toHaveLength(100);
        expect(firstTerms.items).toHaveLength(100);
        expect(firstExpectations.students).toHaveLength(100);
        expect(firstTerms.students).toEqual(firstExpectations.students);

        const secondRecords = await DashboardService.expectations(user.id, branch.id, {
            limit: 100, cursor: firstExpectations.nextCursor!,
        });
        const secondStudents = await DashboardService.expectations(user.id, branch.id, {
            limit: 100, studentCursor: firstExpectations.studentNextCursor!,
        });
        expect(secondRecords.students).toEqual(firstExpectations.students);
        expect(secondRecords.items[0]?.id).not.toBe(firstExpectations.items[0]?.id);
        expect(secondStudents.items).toEqual(firstExpectations.items);
        expect(secondStudents.students[0]?.id).toBe(idAt(100));
        const secondTermRecords = await DashboardService.terms(user.id, branch.id, now, {
            limit: 100, cursor: firstTerms.nextCursor!,
        });
        const secondTermStudents = await DashboardService.terms(user.id, branch.id, now, {
            limit: 100, studentCursor: firstTerms.studentNextCursor!,
        });
        expect(secondTermRecords.students).toEqual(firstTerms.students);
        expect(secondTermStudents.items).toEqual(firstTerms.items);
        expect(secondTermStudents.students[0]?.id).toBe(idAt(100));
        await db.student.update({ where: { id: idAt(99) }, data: { name: "Renamed page anchor" } });
        expect((await DashboardService.expectations(user.id, branch.id, {
            limit: 100, studentCursor: firstExpectations.studentNextCursor!,
        })).students[0]?.id).toBe(idAt(100));
        expect((await DashboardService.terms(user.id, branch.id, now, {
            limit: 100, studentCursor: firstTerms.studentNextCursor!,
        })).students[0]?.id).toBe(idAt(100));

        const expectationPages = await allRecordPages(cursor => DashboardService.expectations(user.id, branch.id, { limit: 100, ...(cursor ? { cursor } : {}) }));
        const termPages = await allRecordPages(cursor => DashboardService.terms(user.id, branch.id, now, { limit: 100, ...(cursor ? { cursor } : {}) }));
        expect(expectationPages.map(page => page.length)).toEqual([100, 100, 100, 100, 100, 4]);
        expect(termPages.map(page => page.length)).toEqual([100, 100, 100, 100, 100, 2]);
        expect(expectationPages.at(-1)?.map(item => item.id)).toContain(savedExpectation.id);
        expect(termPages.at(-1)?.map(item => item.id)).toContain(savedTerm.id);
        expect(expectationPages.flat().map(item => item.id)).toEqual((await db.attendanceExpectation.findMany({
            where: { branchId: branch.id }, select: { id: true }, orderBy: { id: "asc" },
        })).map(item => item.id));
        expect(termPages.flat().map(item => item.id)).toEqual((await db.membershipTerm.findMany({
            where: { branchId: branch.id }, select: { id: true }, orderBy: [{ endDate: "desc" }, { id: "asc" }],
        })).map(item => item.id));

        const studentPages: string[][] = [];
        let studentCursor: string | undefined;
        for (let index = 0; index < 7; index++) {
            const page = await DashboardService.expectations(user.id, branch.id, { limit: 100, ...(studentCursor ? { studentCursor } : {}) });
            studentPages.push(page.students.map(student => student.id));
            if (!page.studentNextCursor) break;
            studentCursor = page.studentNextCursor;
        }
        expect(studentPages.map(page => page.length)).toEqual([100, 100, 100, 100, 100, 5]);
        expect(studentPages.flat()).toEqual(Array.from({ length: STUDENT_COUNT }, (_, index) => idAt(index)));

        const focusedExpectation = await DashboardService.expectations(user.id, branch.id, { studentId: selectedId });
        const focusedTerm = await DashboardService.terms(user.id, branch.id, now, { studentId: selectedId });
        expect(focusedExpectation).toMatchObject({ total: 1, selectedStudent: { id: selectedId },
            selectedItem: { id: savedExpectation.id, studentId: selectedId, weekdays: [0, 6] } });
        expect(focusedTerm).toMatchObject({ total: 1, selectedStudent: { id: selectedId },
            selectedItem: { id: savedTerm.id, studentId: selectedId, label: "Distant student term" } });
        await expect(DashboardService.expectations(user.id, branch.id, { studentId: foreignStudent.id })).rejects.toThrow("Not found");
        await expect(DashboardService.terms(user.id, branch.id, now, { studentId: foreignStudent.id })).rejects.toThrow("Not found");
    }, 45_000);
});
