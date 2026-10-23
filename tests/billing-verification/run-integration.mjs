import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { Client } from "pg";

const reportName = process.env.BILLING_REPORT_NAME || "integration.json";
if (!/^[a-z0-9][a-z0-9-]{0,63}\.json$/.test(reportName)) {
    throw new Error("BILLING_REPORT_NAME must be a simple lowercase JSON filename");
}
const proofName = reportName === "integration.json"
    ? "database-proof.json" : `${reportName.slice(0, -5)}-database-proof.json`;

// Build an empty billing-test database from the schema of the independently
// verified local fixture. Never truncate or copy data from the fixture itself.
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
const sourceUrl = `postgresql://postgres@127.0.0.1:${config.port}/${config.database}`;
const source = new Client({ connectionString: sourceUrl });
const database = `lab_lords_billing_${randomBytes(6).toString("hex")}_test`;
await source.connect();
try {
    const identity = await source.query("SELECT current_database() AS name");
    if (identity.rows[0]?.name !== config.database) throw new Error("Fixture database identity changed");
    await source.query(`CREATE DATABASE "${database}" TEMPLATE template0`);
} finally { await source.end(); }
const schema = execFileSync("docker", ["exec", config.containerId, "pg_dump", "--schema-only", "--no-owner", "--no-privileges", "-U", "postgres", "-d", config.database],
    { windowsHide: true, maxBuffer: 16 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
execFileSync("docker", ["exec", "-i", config.containerId, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database],
    { input: schema, windowsHide: true, maxBuffer: 16 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"] });
const target = `postgresql://postgres@127.0.0.1:${config.port}/${database}`;
const db = new Client({ connectionString: target });
await db.connect();
try {
    const proof = await db.query('SELECT current_database() AS name, (SELECT count(*)::int FROM "User") AS users, (SELECT count(*)::int FROM "Organization") AS organizations');
    if (proof.rows[0]?.name !== database || proof.rows[0]?.users !== 0 || proof.rows[0]?.organizations !== 0)
        throw new Error("Fresh billing database isolation could not be proved");
    // The target is new, empty, independently identified, and contains schema only.
    await db.query(readFileSync("prisma/migrations/20261023090000_three_plan_catalogue/migration.sql", "utf8"));
} finally { await db.end(); }
mkdirSync("test-results/billing-verification", { recursive: true });
writeFileSync(`test-results/billing-verification/${proofName}`, JSON.stringify({ database, containerId: config.containerId,
    schemaOnly: true, emptyBeforeTests: true, mode: "TEST", provider: "injected synthetic adapter" }, null, 2));
const allowedFiles = ["billing.test.ts", "billing-mutation.test.ts", "billing-provider-action.test.ts",
    "billing-deadline.test.ts", "billing-cancellation-undo-race.test.ts", "branch-billing-lifecycle.test.ts", "entitlement.test.ts", "whatsapp-delivery.test.ts"];
const requestedFiles = process.argv.slice(2);
if (requestedFiles.some(file => !allowedFiles.includes(file))) throw new Error("Choose an allowlisted billing integration file");
const files = requestedFiles.length ? requestedFiles : allowedFiles;
const temporaryRoot = resolve("node_modules/.cache/billing-verification");
mkdirSync(temporaryRoot, { recursive: true });
const env = { ...process.env, TEMP: temporaryRoot, TMP: temporaryRoot, NODE_ENV: "test", VERCEL_ENV: "development", DATABASE_URL: target,
    TEST_DATABASE_URL: target, TEST_DATABASE_RESET_CONFIRM: database, DIRECT_URL: target, ACCELERATE_URL: "",
    RAZORPAY_MODE: "TEST", RAZORPAY_KEY_ID: "rzp_test_billing_verification", RAZORPAY_KEY_SECRET: "synthetic-test-secret",
    RAZORPAY_BILLING_WRITES_ENABLED: "true", RAZORPAY_LIVE_CANARY_ORG_IDS: "" };
console.log("Verified a fresh empty local billing database with schema only; Razorpay calls use the synthetic Test adapter.");
const child = spawn(process.execPath, ["node_modules/vitest/vitest.mjs", "run", ...files.map(f => `tests/integration/services/${f}`),
    "--pool=threads", "--hookTimeout=60000",
    ...(process.env.BILLING_TEST_NAME_PATTERN ? ["--testNamePattern", process.env.BILLING_TEST_NAME_PATTERN] : []),
    "--reporter=default", "--reporter=json", `--outputFile=test-results/billing-verification/${reportName}`],
{ env, stdio: "inherit", windowsHide: true });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", code => { process.exitCode = code ?? 1; });
