import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assertDisposableTestDatabaseTarget } from "@/tests/setup/testDatabaseSafety";

const migrations = ["20261024130000_audit_recovery_and_membership_history", "20261024133000_membership_cancellation"]
    .map(name => readFileSync(`prisma/migrations/${name}/migration.sql`, "utf8"));

describe("audit closeout additive migration compatibility", () => {
    let client: Client; let schema: string;
    beforeEach(async () => {
        const target = assertDisposableTestDatabaseTarget(process.env.DATABASE_URL);
        client = new Client({ connectionString: process.env.DATABASE_URL }); await client.connect();
        expect((await client.query("SELECT current_database() AS name")).rows[0].name).toBe(target.databaseName);
        schema = `closeout_${randomUUID().replaceAll("-", "")}`;
        await client.query(`CREATE SCHEMA "${schema}"; SET search_path TO "${schema}";
            CREATE TABLE "User" (id TEXT PRIMARY KEY);
            CREATE TABLE "Organization" (id TEXT PRIMARY KEY, "ownerId" TEXT NOT NULL);
            CREATE TABLE "Branch" (id TEXT PRIMARY KEY);
            CREATE TABLE "Student" (id TEXT PRIMARY KEY, "branchId" TEXT NOT NULL, UNIQUE(id,"branchId"));
            CREATE TABLE "MembershipTerm" (id TEXT PRIMARY KEY, "branchId" TEXT NOT NULL, "studentId" TEXT NOT NULL,
                label TEXT NOT NULL, "startDate" TEXT NOT NULL, "endDate" TEXT NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now());
            CREATE UNIQUE INDEX "MembershipTerm_studentId_startDate_endDate_key" ON "MembershipTerm"("studentId","startDate","endDate");
            CREATE TABLE "Payment" (id TEXT PRIMARY KEY, amount INTEGER NOT NULL, status TEXT NOT NULL);
            INSERT INTO "User" VALUES ('owner');
            INSERT INTO "Organization" VALUES ('legacy_one','owner'),('legacy_two','owner');
            INSERT INTO "Branch" VALUES ('branch_a'),('branch_b');
            INSERT INTO "Student" VALUES ('student_a','branch_a'),('student_b','branch_b');
            INSERT INTO "MembershipTerm" (id,"branchId","studentId",label,"startDate","endDate") VALUES
                ('term_a','branch_a','student_a','Existing membership','2026-01-01','2026-12-31');
            INSERT INTO "Payment" VALUES ('prior_payment',900,'DUE');`);
        for (const migration of migrations) await client.query(migration);
    });
    afterEach(async () => { if (client) { if (schema) await client.query(`DROP SCHEMA "${schema}" CASCADE`); await client.end(); } });

    it("preserves legacy organizations, dates and financial values and records an honest baseline without guessing an author", async () => {
        expect((await client.query('SELECT * FROM "Payment"')).rows).toEqual([{ id: "prior_payment", amount: 900, status: "DUE" }]);
        expect((await client.query('SELECT id FROM "Organization" ORDER BY id')).rows.map(row => row.id)).toEqual(["legacy_one", "legacy_two"]);
        const term = (await client.query('SELECT * FROM "MembershipTerm"')).rows[0];
        expect(term).toMatchObject({ label: "Existing membership", startDate: "2026-01-01", endDate: "2026-12-31", status: "ACTIVE", revision: 1 });
        const baseline = (await client.query('SELECT * FROM "MembershipTermRevision"')).rows[0];
        expect(baseline).toMatchObject({ termId: "term_a", action: "BASELINE", actorId: null, revision: 1,
            after: { label: "Existing membership", startDate: "2026-01-01", endDate: "2026-12-31", status: "ACTIVE" } });
        expect((await client.query('SELECT count(*)::int AS count FROM "AllocationMoveCommand"')).rows[0].count).toBe(0);
    });
    it("enforces immutable revisions, valid statuses and tenant-scoped term relationships", async () => {
        await expect(client.query('UPDATE "MembershipTermRevision" SET reason=$1', ["overwrite"])).rejects.toThrow("immutable");
        await expect(client.query('DELETE FROM "MembershipTermRevision"')).rejects.toThrow("immutable");
        await expect(client.query('UPDATE "MembershipTerm" SET status=$1', ["UNSUPPORTED"])).rejects.toMatchObject({ code: "23514" });
        await expect(client.query(`INSERT INTO "MembershipTermRevision" (id,"termId","branchId",revision,action,reason,"after")
            VALUES ('foreign','term_a','branch_b',2,'CORRECTED','Wrong branch','{}')`)).rejects.toMatchObject({ code: "23503" });
        await client.query('UPDATE "MembershipTerm" SET status=$1', ["CANCELLED"]);
        expect((await client.query('SELECT status FROM "MembershipTerm"')).rows[0].status).toBe("CANCELLED");
    });
    it("keeps command keys scoped and receipts immutable with same-branch student references", async () => {
        const insert = (id: string, branch: string, student: string, key: string) => client.query(`INSERT INTO "AllocationMoveCommand"
            (id,"actorId","branchId","studentId","commandKey","requestHash","sourceIds","resultIds")
            VALUES ($1,'owner',$2,$3,$4,'v1:fixture',ARRAY['source'],ARRAY['result'])`, [id, branch, student, key]);
        await insert("command_a", "branch_a", "student_a", "same-key");
        await insert("command_b", "branch_b", "student_b", "same-key");
        await expect(insert("duplicate", "branch_a", "student_a", "same-key")).rejects.toMatchObject({ code: "23505" });
        await expect(insert("foreign", "branch_a", "student_b", "other-key")).rejects.toMatchObject({ code: "23503" });
        await expect(client.query('UPDATE "AllocationMoveCommand" SET "requestHash"=$1', ["overwrite"])).rejects.toThrow("immutable");
        await expect(client.query('DELETE FROM "AllocationMoveCommand"')).rejects.toThrow("immutable");
    });
});
