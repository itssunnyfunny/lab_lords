import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { Client } from "pg";
const config = JSON.parse(readFileSync(".clerk/dashboard-local-runtime.json", "utf8"));
const fixture = JSON.parse(readFileSync(".clerk/dashboard-fixture.json", "utf8"));
if (!/^lab-lords-dashboard-test-\d{8}$/.test(config.container)
    || !/^[a-f0-9]{64}$/.test(config.containerId)
    || !/^lab_lords_dashboard_[a-z_]*browser_test$/.test(config.database)
    || config.database !== fixture.databaseName
    || !Number.isInteger(config.port) || config.port < 1024 || config.port > 65535)
    throw new Error("The verified disposable fixture identity is unavailable");
const container = JSON.parse(execFileSync("docker", ["inspect", config.containerId, "--format",
    '{"id":{{json .Id}},"image":{{json .Config.Image}},"running":{{json .State.Running}},"ports":{{json .HostConfig.PortBindings}}}'],
{ encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }));
const ports = container.ports?.["5432/tcp"];
if (container.id !== config.containerId || container.image !== "postgres:16-alpine" || !container.running
    || ports?.length !== 1 || ports[0].HostIp !== "127.0.0.1" || ports[0].HostPort !== String(config.port))
    throw new Error("Disposable container identity or loopback binding changed");

const database = `lab_lords_inventory_readiness_${randomBytes(6).toString("hex")}_test`;
const admin = new Client({ connectionString: `postgresql://postgres@127.0.0.1:${config.port}/${config.database}` });
await admin.connect();
try { await admin.query(`CREATE DATABASE "${database}" TEMPLATE template0`); } finally { await admin.end(); }
const schema = execFileSync("docker", ["exec", config.containerId, "pg_dump", "--schema-only", "--no-owner", "--no-privileges", "-U", "postgres", "-d", config.database], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 16 * 1024 * 1024 });
execFileSync("docker", ["exec", "-i", config.containerId, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database], { input: schema, windowsHide: true, stdio: ["pipe", "pipe", "pipe"], maxBuffer: 16 * 1024 * 1024 });
const db = new Client({ connectionString: `postgresql://postgres@127.0.0.1:${config.port}/${database}` });
// Only the freshly created, schema-only database below is queried or changed.
const sql = readFileSync("scripts/billing-three-plan-inventory.sql", "utf8");
const cases = [];
await db.connect();
try {
  const identity = (await db.query('SELECT current_database() AS name, (SELECT count(*)::int FROM "User") AS users, (SELECT count(*)::int FROM "Organization") AS organizations')).rows[0];
  assert.deepEqual(identity, { name: database, users: 0, organizations: 0 });
  const inspect = async (name, expected) => {
    const results = await db.query(sql);
    const report = results.flatMap(result => result.rows).find(row => row.cutover_readiness)?.cutover_readiness;
    assert.ok(report);
    assert.equal(report.readOnly, "on");
    assert.equal(report.isolation, "repeatable read");
    assert.equal(report.catalogueDataPrecondition, expected);
    assert.equal(report.releaseAuthorized, false);
    assert.equal(report.providerObligationsVerified, false);
    cases.push({ name, result: expected });
    return report;
  };
  await inspect("empty legacy schema", "EMPTY_LEDGER_PRECONDITION_MET");
  await db.query(`INSERT INTO "User" (id,email) VALUES ('inventory-owner','inventory@example.test'); INSERT INTO "Organization" (id,name,"ownerId","selectedPostTrialPlan") VALUES ('inventory-org','Synthetic inventory','inventory-owner','PRO')`);
  const selected = await inspect("old public Standard selection", "EMPTY_LEDGER_PRECONDITION_MET");
  assert.equal(selected.oldProSelections, 1);
  assert.equal(selected.operationalCounts.organizations, 1);
  await db.query(`INSERT INTO "SaasRazorpayPlan" (id,"providerMode","catalogKey",plan,amount,"amountSubunits","razorpayPlanId","updatedAt") VALUES ('inventory-plan','TEST','old-inventory-probe','PRO',499,49900,'plan_synthetic_inventory',now())`);
  const populated = await inspect("legacy billing evidence", "BLOCKED_LEGACY_LEDGER");
  assert.equal(populated.ledgerCounts.SaasRazorpayPlan, 1);
  assert.equal((await db.query(`SELECT plan::text FROM "SaasRazorpayPlan" WHERE id='inventory-plan'`)).rows[0].plan, "PRO");
  // Synthetic fixture changes, never cleanup of an existing ledger.
  await db.query(`DELETE FROM "SaasRazorpayPlan" WHERE id='inventory-plan'; UPDATE "Organization" SET "selectedPostTrialPlan"='CUSTOM' WHERE id='inventory-org'`);
  await inspect("obsolete selection", "BLOCKED_OBSOLETE_SELECTION");
  await db.query(`UPDATE "Organization" SET "selectedPostTrialPlan"='PRO' WHERE id='inventory-org'; INSERT INTO "_prisma_migrations" (id,checksum,migration_name,started_at,applied_steps_count) VALUES ('inventory-failed','synthetic','synthetic_failed',now(),0)`);
  await inspect("unfinished migration", "BLOCKED_MIGRATION_HISTORY");
  await db.query(`UPDATE "_prisma_migrations" SET rolled_back_at=now() WHERE id='inventory-failed'`);
  // Apply no migration. Change only the synthetic enum labels to test schema classification.
  await db.query(`ALTER TYPE "SaasPlan" RENAME VALUE 'CUSTOM' TO 'UNKNOWN_TEST'`);
  await inspect("unexpected schema", "BLOCKED_SCHEMA_REVIEW");
  await db.query(`ALTER TYPE "SaasPlan" RENAME VALUE 'UNKNOWN_TEST' TO 'CUSTOM'`);
  await db.query(`ALTER TYPE "SaasPlan" RENAME TO "SaasPlan_inventory_fixture"; CREATE TYPE "SaasPlan" AS ENUM ('BASIC','STANDARD','PRO')`);
  await inspect("v2 enum already present", "ALREADY_V2_DO_NOT_RERUN");
  mkdirSync("test-results/billing-verification", { recursive: true });
  writeFileSync("test-results/billing-verification/cutover-inventory-readiness.json", JSON.stringify({ cases, productionAccessed: false, providerCalls: 0 }, null, 2));
  console.log(JSON.stringify({ passed: cases.length, cases, productionAccessed: false, providerCalls: 0 }, null, 2));
} finally { await db.end(); }
