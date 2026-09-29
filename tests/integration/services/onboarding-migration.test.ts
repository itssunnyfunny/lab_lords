import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assertDisposableTestDatabaseTarget } from "@/tests/setup/testDatabaseSafety";

const migration = readFileSync("prisma/migrations/20260929120000_onboarding_request_receipts/migration.sql", "utf8");
describe("onboarding receipt additive migration", () => {
    let client: Client;
    let schema: string | undefined;
    beforeEach(async () => {
        const target = assertDisposableTestDatabaseTarget(process.env.DATABASE_URL);
        client = new Client({ connectionString: process.env.DATABASE_URL });
        await client.connect();
        expect((await client.query("SELECT current_database() AS name")).rows[0].name).toBe(target.databaseName);
        schema = `onboarding_fixture_${randomUUID().replaceAll("-", "")}`;
        await client.query(`CREATE SCHEMA "${schema}"; SET search_path TO "${schema}";
            CREATE TABLE "User" (id TEXT PRIMARY KEY);
            CREATE TABLE "Organization" (id TEXT PRIMARY KEY);
            CREATE TABLE "Branch" (id TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, UNIQUE (id, "organizationId"));
            INSERT INTO "User" VALUES ('owner_a'), ('owner_b');
            INSERT INTO "Organization" VALUES ('org_a'), ('org_b');
            INSERT INTO "Branch" VALUES ('branch_a', 'org_a'), ('branch_b', 'org_b');`);
        await client.query(migration);
    });
    afterEach(async () => {
        if (client) {
            if (schema) await client.query(`DROP SCHEMA "${schema}" CASCADE`);
            await client.end();
        }
        schema = undefined;
    });
    const insert = (owner = "owner_a", key = "command", org = "org_a", branch = "branch_a") => client.query(
        'INSERT INTO "OnboardingRequest" ("ownerId", "idempotencyKey", "requestHash", "organizationId", "branchId") VALUES ($1,$2,$3,$4,$5)',
        [owner, key, "v1:synthetic", org, branch]
    );
    it("preserves historical parents, starts empty, and enforces per-owner keys", async () => {
        for (const table of ["User", "Organization", "Branch"]) {
            expect((await client.query(`SELECT count(*)::int AS count FROM "${table}"`)).rows[0].count).toBe(2);
        }
        expect((await client.query('SELECT count(*)::int AS count FROM "OnboardingRequest"')).rows[0].count).toBe(0);
        await insert();
        await expect(insert()).rejects.toMatchObject({ code: "23505" });
        await insert("owner_b");
        expect((await client.query('SELECT count(*)::int AS count FROM "OnboardingRequest"')).rows[0].count).toBe(2);
    });
    it("rejects a branch belonging to a different result organization", async () => {
        await expect(insert("owner_a", "wrong-result", "org_a", "branch_b")).rejects.toMatchObject({ code: "23503" });
    });
    it.each([["User", "owner_a"], ["Organization", "org_a"], ["Branch", "branch_a"]])("restricts deletion of the receipt's %s result/owner", async (table, id) => {
        await insert();
        await expect(client.query(`DELETE FROM "${table}" WHERE id = $1`, [id])).rejects.toMatchObject({ code: "23503" });
        expect((await client.query('SELECT count(*)::int AS count FROM "OnboardingRequest"')).rows[0].count).toBe(1);
    });
});
