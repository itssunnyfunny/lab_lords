import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assertDisposableTestDatabaseTarget } from "@/tests/setup/testDatabaseSafety";

const migration = readFileSync("prisma/migrations/20261102120000_explicit_owner_trial_plan/migration.sql", "utf8");
describe("explicit trial-plan additive migration", () => {
    let client: Client;
    let schema: string | undefined;
    beforeEach(async () => {
        const target = assertDisposableTestDatabaseTarget(process.env.DATABASE_URL);
        client = new Client({ connectionString: process.env.DATABASE_URL });
        await client.connect();
        expect((await client.query("SELECT current_database() AS name")).rows[0].name).toBe(target.databaseName);
        schema = `trial_plan_fixture_${randomUUID().replaceAll("-", "")}`;
        await client.query(`CREATE SCHEMA "${schema}"; SET search_path TO "${schema}";
            CREATE TYPE "SaasPlan" AS ENUM ('BASIC','STANDARD','PRO');
            CREATE TABLE "OwnerTrialGrant" ("ownerId" TEXT PRIMARY KEY, status TEXT, "trialStartedAt" TIMESTAMP, "trialEndsAt" TIMESTAMP);
            CREATE TABLE "Organization" ("ownerId" TEXT, "selectedPostTrialPlan" "SaasPlan");
            INSERT INTO "OwnerTrialGrant" VALUES ('a','ACTIVE','2026-01-01','2026-01-31'),('b','EXPIRED','2025-01-01','2025-01-31'),('c','REVOKED','2026-01-01','2026-01-31'),('d','AVAILABLE',NULL,NULL);
            INSERT INTO "Organization" VALUES ('a','BASIC'),('b','PRO'),('c','STANDARD'),('d','PRO');`);
    });
    afterEach(async () => {
        if (client) {
            if (schema) await client.query(`DROP SCHEMA "${schema}" CASCADE`);
            await client.end();
        }
        schema = undefined;
    });
    it("preserves every historical grant and preference while recording Standard, never a reinterpreted tier", async () => {
        const before = (await client.query('SELECT * FROM "OwnerTrialGrant" ORDER BY "ownerId"')).rows;
        const selections = (await client.query('SELECT * FROM "Organization" ORDER BY "ownerId"')).rows;
        await client.query(migration);
        const after = (await client.query('SELECT * FROM "OwnerTrialGrant" ORDER BY "ownerId"')).rows;
        expect(after.map(({ trialPlan, ...row }) => { expect(trialPlan).toBe("STANDARD"); return row; })).toEqual(before);
        expect((await client.query('SELECT * FROM "Organization" ORDER BY "ownerId"')).rows).toEqual(selections);
        await expect(client.query('UPDATE "OwnerTrialGrant" SET "trialPlan"=NULL WHERE "ownerId"=\'a\'')).rejects.toMatchObject({ code: "23502" });
    });
});
