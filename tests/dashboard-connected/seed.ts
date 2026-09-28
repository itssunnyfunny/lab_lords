import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../app/generated/prisma/client";
import { assertDisposableTestDatabaseTarget } from "../setup/testDatabaseSafety";
import type { FeeReceiptSnapshot } from "../../lib/feeCollections";

/** Explicit synthetic fixture. Never imported by application code or prisma/seed.ts. */
const target = assertDisposableTestDatabaseTarget(process.env.TEST_DATABASE_URL, process.env);
if (!target.databaseName.includes("browser_test")) throw new Error("A separate disposable browser_test database is required");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL! }) });
function clerkSubject(file: string) {
    const state = JSON.parse(readFileSync(file, "utf8")) as { cookies: { name: string; value: string }[] };
    const value = state.cookies.find(cookie => cookie.name === "__session")?.value;
    if (!value) throw new Error("Existing saved development session is required");
    const subject = JSON.parse(Buffer.from(value.split(".")[1], "base64url").toString()).sub;
    if (typeof subject !== "string" || !subject.startsWith("user_")) throw new Error("Existing development session has no subject");
    return subject;
}
const now = new Date();
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
const date = (days: number) => new Date(new Date(`${today}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);
const month = today.slice(0, 7);
const day = (number: number) => `${month}-${String(number).padStart(2, "0")}`;
const anchors = [1, 5, 9, 13, 17, 20, 23, 25];
const priorMonthDay = (months: number, anchor: number) => new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1 - months, anchor)).toISOString().slice(0, 10);

try {
    const identity = await db.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
    if (identity[0]?.name !== target.databaseName) throw new Error("Live database identity mismatch");
    if (await db.user.count() || await db.organization.count()) throw new Error("Fixture refuses any database containing application users or organizations");
    const fixture = await db.$transaction(async db => {
    const owner = await db.user.create({ data: { id: "dashboard-owner", clerkId: clerkSubject(process.env.PLAYWRIGHT_OWNER_AUTH_STATE || ".clerk/rc-owner.json"),
        name: "Ananya Sharma", email: "dashboard-owner@example.invalid", interfaceLanguage: "en", documentLanguage: "en" } });
    const staff = await db.user.create({ data: { id: "dashboard-staff", clerkId: clerkSubject(process.env.PLAYWRIGHT_STAFF_AUTH_STATE || ".clerk/rc-staff.json"),
        name: "Sample Staff", email: "dashboard-staff@example.invalid" } });
    const outsider = await db.user.create({ data: { id: "dashboard-outsider", name: "Synthetic other owner", email: "dashboard-other@example.invalid" } });
    const organization = await db.organization.create({ data: { id: "dashboard-organization", name: "Lab Lords", ownerId: owner.id, billingModelVersion: "WORKSPACE_V2" } });
    await db.ownerTrialGrant.create({ data: { ownerId: owner.id, organizationId: organization.id, source: "ONBOARDING", status: "ACTIVE",
        claimedAt: now, trialStartedAt: now, trialEndsAt: new Date(now.getTime() + 7 * 86_400_000) } });
    const branch = await db.branch.create({ data: { id: "dashboard-shanti", organizationId: organization.id, name: "Shanti Study Library", city: "Lucknow, Uttar Pradesh", aiEnabled: false } });
    const otherBranch = await db.branch.create({ data: { id: "dashboard-north", organizationId: organization.id, name: "North Reading Room", aiEnabled: false } });
    const foreignOrg = await db.organization.create({ data: { id: "dashboard-foreign-org", ownerId: outsider.id, name: "Other synthetic organization" } });
    const foreignBranch = await db.branch.create({ data: { id: "dashboard-foreign", organizationId: foreignOrg.id, name: "Other synthetic branch", aiEnabled: false } });
    const readonlyOrg = await db.organization.create({ data: { id: "dashboard-readonly-org", ownerId: owner.id, name: "Read-only synthetic workspace", billingModelVersion: "WORKSPACE_V2" } });
    const readonlyBranch = await db.branch.create({ data: { id: "dashboard-readonly", organizationId: readonlyOrg.id, name: "Read-only branch", aiEnabled: false } });
    const staffMembership = await db.staff.create({ data: { userId: staff.id, branchId: branch.id, role: "STAFF" } });
    await db.staffPermissionOverride.create({ data: { staffId: staffMembership.id, action: "VIEW_PAYMENTS", allowed: false } });
    const shifts = await Promise.all([
        ["Morning", "06:00", "11:59"], ["Afternoon", "12:00", "17:59"], ["Evening", "18:00", "23:59"],
    ].map(([name, startTime, endTime], i) => db.shift.create({ data: { id: `dashboard-shift-${i}`, branchId: branch.id, name, startTime, endTime, price: 1000 } })));
    const seats = await Promise.all(Array.from({ length: 16 }, (_, i) => db.seat.create({ data: { id: `dashboard-seat-${i}`, branchId: branch.id, label: `A${i + 1}` } })));
    const names = ["Rahul Verma", "Priya Singh", "Aman Khan", "Sneha Yadav", "Karan Patel", "Neha Sharma", "Rohit Mehta", "Meera Gupta"];
    const students = await Promise.all(names.map((name, i) => db.student.create({ data: { id: `dashboard-student-${i}`, branchId: branch.id, name,
        phone: null, monthlyFee: [1200, 1400, 900, 500, 300, 1000, 1000, 1000][i],
        joinedAt: new Date(`${priorMonthDay(2, anchors[i])}T00:00:00+05:30`), createdAt: new Date(`${priorMonthDay(2, anchors[i])}T09:00:00+05:30`) } })));
    for (let i = 0; i < 6; i++) {
        await db.seatAllocation.create({ data: { branchId: branch.id, studentId: students[i].id, seatId: seats[Math.floor(i / 3)].id, shiftId: shifts[i % 3].id, startDate: new Date(`${date(-10)}T00:00:00+05:30`) } });
        await db.attendanceExpectation.create({ data: { branchId: branch.id, studentId: students[i].id, weekdays: [0, 1, 2, 3, 4, 5, 6], expectedBy: "00:01" } });
        if (i < 5) await db.attendanceMark.create({ data: { branchId: branch.id, studentId: students[i].id, date: new Date(`${today}T00:00:00Z`), status: "PRESENT", actorId: owner.id } });
    }
    const amounts = [1200, 1400, 900, 500, 300];
    const collections = [700, 600, 300, 200, 100];
    const payments = [];
    let eventDay = 1;
    for (let i = 0; i < amounts.length; i++) {
        const periodStart = new Date(`${priorMonthDay(1, anchors[i])}T00:00:00+05:30`), periodEnd = new Date(`${day(anchors[i])}T00:00:00+05:30`);
        const payment = await db.payment.create({ data: { id: `dashboard-payment-${i}`, branchId: branch.id, studentId: students[i].id,
            amount: amounts[i], collectedAmount: collections[i], ledgerBacked: true, status: "DUE", type: "MONTHLY", periodStart, periodEnd,
            dueDate: periodEnd } });
        payments.push(payment);
        for (let amount = 100; amount <= collections[i]; amount += 100) {
            const collectedAt = new Date(`${day(Math.min(eventDay++, Number(today.slice(-2))))}T09:00:00+05:30`);
            const receiptNumber = `LL-SYNTHETIC-${i}-${amount}`;
            const snapshot: FeeReceiptSnapshot = { version: 1, branchName: branch.name, organizationName: organization.name, address: branch.city,
                contactPhone: null, studentName: students[i].name, studentId: students[i].id, recordedBy: owner.name!, recordedById: owner.id,
                collectedAt: collectedAt.toISOString(), amount: 100, method: "CASH", reference: "Synthetic fixture", note: "Synthetic historical fixture only",
                remainingBalance: amounts[i] - amount, allocations: [{ paymentId: payment.id, type: "MONTHLY", periodStart: periodStart.toISOString(),
                    periodEnd: periodEnd.toISOString(), amount: 100, remaining: amounts[i] - amount }] };
            const collection = await db.feeCollection.create({ data: { branchId: branch.id, studentId: students[i].id, actorId: owner.id,
                amount: 100, method: "CASH", collectedAt, receiptNumber, idempotencyKey: randomUUID(), requestHash: "synthetic-seed-only", snapshot } });
            await db.feeCollectionAllocation.create({ data: { collectionId: collection.id, paymentId: payment.id, studentId: students[i].id, branchId: branch.id, amount: 100 } });
        }
    }
    for (let i = 0; i < 2; i++) await db.renewalFollowUp.create({ data: { id: `dashboard-followup-${i}`, branchId: branch.id, studentId: students[i].id,
        periodStart: payments[i].periodStart, type: "MONTHLY", note: i ? "Discuss membership renewal" : "Discuss remaining fee", outcome: "CALL_BACK",
        nextFollowUpAt: new Date(`${today}T00:00:00Z`), authorId: owner.id } });
    for (let i = 0; i < 3; i++) await db.membershipTerm.create({ data: { branchId: branch.id, studentId: students[i].id,
        label: "Study membership", startDate: date(-24), endDate: date([1, 3, 6][i]) } });
    for (let back = 6; back >= 1; back--) for (let s = 0; s < shifts.length; s++) await db.occupancySnapshot.create({ data: {
        branchId: branch.id, date: date(-back), timezone: "Asia/Kolkata", shiftId: shifts[s].id, shiftName: shifts[s].name,
        startTime: shifts[s].startTime, endTime: shifts[s].endTime, capacity: 16, occupied: (back * 3 + s * 5) % 17,
        recordedAt: new Date(`${date(-back)}T20:00:00+05:30`),
    } });
    await db.dashboardSettings.create({ data: { branchId: branch.id, utilizationThreshold: 35 } });
    await db.dashboardTask.create({ data: { id: "dashboard-task-first", branchId: branch.id, creatorId: owner.id, assigneeId: owner.id,
        title: "Review tomorrow's study-space setup", dueAt: new Date(`${today}T18:00:00+05:30`) } });
    await db.dashboardEvent.create({ data: { branchId: branch.id, actorId: owner.id, kind: "CONFIGURATION", sourceId: branch.id,
        detail: "Synthetic expected-attendance schedule configured", occurredAt: new Date(now.getTime() - 60 * 60 * 1000) } });
    return { databaseName: target.databaseName, branchId: branch.id, orgId: organization.id, ownerId: owner.id, staffId: staff.id,
        otherBranchId: otherBranch.id, foreignBranchId: foreignBranch.id, readonlyBranchId: readonlyBranch.id,
        students: students.map(student => ({ id: student.id, name: student.name })), today, month,
        expected: { billed: 4300, collected: 1900, pending: 2400, active: 8, physicalSeats: 16, shifts: 3, capacity: 48, occupied: 6, attended: 5, expectedAttendance: 6, followUps: 2, terms: 3 } };
    }, { timeout: 60_000 });
    mkdirSync(".clerk", { recursive: true });
    writeFileSync(".clerk/dashboard-fixture.json", JSON.stringify(fixture, null, 2));
    console.log("Synthetic connected fixture created: 8 students, 16 seats, 3 shifts, 5 fees, 19 immutable synthetic receipts; billed4300/collected1900/pending2400; 6 expectations/5 marks; 2 follow-ups/3 terms. No provider records or calls.");
} finally { await db.$disconnect(); }
