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

// Create a fresh local database and apply repository migrations, including
// migration-owned identity records. Never copy or alter the retained fixture.
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
const target = `postgresql://postgres@127.0.0.1:${config.port}/${database}`;
const db = new Client({ connectionString: target });
await db.connect();
try {
    const proof = await db.query("SELECT current_database() AS name, (SELECT count(*)::int FROM information_schema.tables WHERE table_schema = 'public') AS tables");
    if (proof.rows[0]?.name !== database || proof.rows[0]?.tables !== 0)
        throw new Error("Fresh empty database isolation could not be proved");
} finally { await db.end(); }
// Credentials remain in process environment and migration output stays local.
execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: target, DIRECT_URL: target, ACCELERATE_URL: "" },
    windowsHide: true, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 16 * 1024 * 1024,
});
mkdirSync("test-results/billing-verification", { recursive: true });
writeFileSync(`test-results/billing-verification/${proofName}`, JSON.stringify({ database, containerId: config.containerId,
    repositoryMigrationsApplied: true, emptyBeforeMigrations: true, mode: "TEST", provider: "injected synthetic adapter" }, null, 2));
const allowedFiles = ["billing.test.ts", "billing-mutation.test.ts", "billing-provider-action.test.ts",
    "billing-deadline.test.ts", "billing-cancellation-undo-race.test.ts", "branch-billing-lifecycle.test.ts", "entitlement.test.ts", "whatsapp-delivery.test.ts", "onboarding.test.ts"];
const operationalFiles = ["basic-workspace.test.ts", "dashboard.test.ts", "student.test.ts", "seatAllocation.test.ts", "payment.test.ts", "allocation-tenancy.test.ts", "shift-hardening.test.ts"];
const fullCI = process.argv.includes("--ci");
const retryFailures = process.argv.includes("--failed");
const requestedFiles = process.argv.slice(2).filter(arg=>!["--ci", "--failed"].includes(arg));
if (requestedFiles.some(file => ![...allowedFiles, ...operationalFiles].includes(file))) throw new Error("Choose an allowlisted billing integration file");
const failedFiles = retryFailures ? JSON.parse(readFileSync("test-results/billing-verification/basic-full-ci.json", "utf8")).testResults.filter(r => r.status === "failed").map(r => r.name.replaceAll("\\", "/").split("/tests/")[1]).filter(p => p?.startsWith("integration/")) : [];
if (failedFiles.some(p => p.includes("..") || !/^integration\/[a-zA-Z0-9_/-]+\.test\.ts$/.test(p))) throw new Error("Invalid failed test path");
const files = retryFailures ? failedFiles.map(p => "tests/" + p) : (requestedFiles.length ? requestedFiles : allowedFiles).map(f => "tests/integration/services/" + f);
const temporaryRoot = resolve("node_modules/.cache/billing-verification");
mkdirSync(temporaryRoot, { recursive: true });
const env = { ...process.env, TEMP: temporaryRoot, TMP: temporaryRoot, TZ: "UTC", NODE_ENV: "test", VERCEL_ENV: "development", DATABASE_URL: target,
    TEST_DATABASE_URL: target, TEST_DATABASE_RESET_CONFIRM: database, DIRECT_URL: target, ACCELERATE_URL: "",
    RAZORPAY_MODE: "TEST", RAZORPAY_KEY_ID: "rzp_test_billing_verification", RAZORPAY_KEY_SECRET: "synthetic-test-secret",
    RAZORPAY_BILLING_WRITES_ENABLED: "true", RAZORPAY_LIVE_CANARY_ORG_IDS: "" };
console.log("Verified a fresh empty local billing database with repository migrations; Razorpay calls use the synthetic Test adapter.");
const child = spawn(process.execPath, ["node_modules/vitest/vitest.mjs", "run", ...(fullCI ? [] : files),
    "--pool=threads", "--hookTimeout=60000",
    ...(process.env.BILLING_TEST_NAME_PATTERN ? ["--testNamePattern", process.env.BILLING_TEST_NAME_PATTERN] : []),
    "--reporter=default", "--reporter=json", `--outputFile=test-results/billing-verification/${reportName}`],
{ env, stdio: "inherit", windowsHide: true });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", code => { process.exitCode = code ?? 1; });
