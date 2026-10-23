import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { Client } from "pg";
import { readVerifiedSyntheticFixtures, validateResumeProof } from "./real-test-resume-guard.mjs";
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

const folder = "test-results/billing-verification";
mkdirSync(folder, { recursive: true });
const proof = JSON.parse(readFileSync(`${folder}/real-test-database-proof.json`, "utf8"));
const oldDatabase = validateResumeProof(proof, config.containerId);
const old = new Client({ connectionString: `postgresql://postgres@127.0.0.1:${config.port}/${oldDatabase}` });
const tables = ["SaasRazorpayPlan", "RazorpayPlanProvisioning", "BillingOffer", "OrganizationSubscription", "OrganizationBillingChange", "OrganizationBillingChangeAudit", "OrganizationSubscriptionInvoice", "OrganizationSubscriptionHistory", "BillingProviderAction", "RazorpayWebhookEvent"];
await old.connect();
const inventory = {};
try {
  await old.query("BEGIN READ ONLY");
  await readVerifiedSyntheticFixtures(oldDatabase, async sql => (await old.query(sql)).rows);
  for (const table of tables) inventory[table] = (await old.query(`SELECT count(*)::int AS count FROM "${table}"`)).rows[0].count;
  inventory.subscriptions = (await old.query('SELECT "providerMode", plan::text, status::text, amount, count(*)::int AS rows FROM "OrganizationSubscription" GROUP BY 1,2,3,4 ORDER BY 1,2,3,4')).rows;
  inventory.unresolvedChanges = (await old.query(`SELECT status::text, "failureCategory"::text, count(*)::int AS rows FROM "OrganizationBillingChange" WHERE status IN ('QUEUED','PROCESSING','AWAITING_PAYMENT','SCHEDULED','FAILED') GROUP BY 1,2 ORDER BY 1,2`)).rows;
} finally { await old.query("ROLLBACK"); await old.end(); }
const database = `lab_lords_catalog_cutover_${randomBytes(6).toString("hex")}_test`;
const admin = new Client({ connectionString: `postgresql://postgres@127.0.0.1:${config.port}/${config.database}` });
await admin.connect();
try { await admin.query(`CREATE DATABASE "${database}" TEMPLATE template0`); } finally { await admin.end(); }
const schema = execFileSync("docker", ["exec", config.containerId, "pg_dump", "--schema-only", "--no-owner", "--no-privileges", "-U", "postgres", "-d", config.database], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 16 * 1024 * 1024 });
execFileSync("docker", ["exec", "-i", config.containerId, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database], { input: schema, windowsHide: true, stdio: ["pipe", "pipe", "pipe"], maxBuffer: 16 * 1024 * 1024 });
const db = new Client({ connectionString: `postgresql://postgres@127.0.0.1:${config.port}/${database}` });
const migration = readFileSync("prisma/migrations/20261023090000_three_plan_catalogue/migration.sql", "utf8");
await db.connect();
try {
  const identity = (await db.query('SELECT current_database() AS name, (SELECT count(*)::int FROM "User") AS users, (SELECT count(*)::int FROM "Organization") AS organizations')).rows[0];
  if (identity.name !== database || identity.users !== 0 || identity.organizations !== 0) throw new Error("Fresh empty database proof failed");
  await db.query(`INSERT INTO "SaasRazorpayPlan" (id,"providerMode","catalogKey",plan,amount,"amountSubunits","razorpayPlanId","updatedAt") VALUES ('cutover-probe','TEST','old-catalogue-probe','PRO',499,49900,'plan_synthetic_cutover_probe',now())`);
  let blocked = false;
  try { await db.query(migration); } catch (error) { blocked = error.message.includes("Three-plan cutover blocked: SaasRazorpayPlan"); await db.query("ROLLBACK"); }
  const original = (await db.query(`SELECT plan::text, amount, "catalogKey" FROM "SaasRazorpayPlan" WHERE id='cutover-probe'`)).rows;
  if (!blocked || original.length !== 1 || original[0].plan !== "PRO" || original[0].amount !== 499 || original[0].catalogKey !== "old-catalogue-probe") throw new Error("Blocked migration changed old evidence");
  await db.query(`DELETE FROM "SaasRazorpayPlan" WHERE id='cutover-probe'`);
  await db.query(`INSERT INTO "User" (id,email) VALUES ('cutover-owner','cutover@example.test'); INSERT INTO "Organization" (id,name,"ownerId","selectedPostTrialPlan") VALUES ('cutover-org','Synthetic cutover','cutover-owner','PRO'); INSERT INTO "Branch" (id,name,"organizationId") VALUES ('cutover-branch','Preserved branch','cutover-org')`);
  const counts = async () => (await db.query('SELECT (SELECT count(*)::int FROM "User") AS users, (SELECT count(*)::int FROM "Organization") AS organizations, (SELECT count(*)::int FROM "Branch") AS branches')).rows[0];
  const before = await counts();
  await db.query(migration);
  const after = await counts();
  const selection = (await db.query(`SELECT "selectedPostTrialPlan"::text AS plan FROM "Organization" WHERE id='cutover-org'`)).rows[0].plan;
  const labels = (await db.query(`SELECT enumlabel FROM pg_enum WHERE enumtypid='"SaasPlan"'::regtype ORDER BY enumsortorder`)).rows.map(r => r.enumlabel);
  if (JSON.stringify(before) !== JSON.stringify(after) || selection !== "STANDARD" || labels.join() !== "BASIC,STANDARD,PRO") throw new Error("Cutover postconditions failed");
  const evidence = { at: new Date().toISOString(), oldDatabase, oldDatabaseReadOnly: true, inventory, rehearsalDatabase: database, blockedLegacyEvidenceUnchanged: blocked, before, after, selectedOldPublicStandard: selection, labels, productionAccessed: false };
  writeFileSync(`${folder}/three-plan-cutover.json`, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ legacyTestCounts: inventory, rehearsal: { blockedLegacyEvidenceUnchanged: blocked, before, after, selection, labels }, productionAccessed: false }, null, 2));
} finally { await db.end(); }
