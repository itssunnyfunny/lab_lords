import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { readVerifiedSyntheticFixtures, validateResumeProof } from "./real-test-resume-guard.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
process.chdir(root);
if (process.argv.slice(2).some(arg => !["--resume", "--inspect", "--add-basic-retest", "--verify-completed"].includes(arg))) throw new Error("Use only --resume, --inspect or --add-basic-retest.");
const verifyCompleted = process.argv.includes("--verify-completed");
const inspectOnly = process.argv.includes("--inspect");
const addBasicRetest = process.argv.includes("--add-basic-retest");
if (addBasicRetest) throw new Error("Legacy fixture extensions are disabled for catalogue v2.");
if (inspectOnly && addBasicRetest) throw new Error("Read-only inspection cannot add fixtures.");
const resume = verifyCompleted || inspectOnly || addBasicRetest || process.argv.includes("--resume");

// Read only the allowlisted Razorpay credential assignments. Never load an env
// file into process.env, print its contents, or inherit another provider's keys.
const credentialNames = new Set(["RAZORPAY_MODE", "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_TEST_KEY_ID", "RAZORPAY_TEST_KEY_SECRET"]);
const credentials = {};
const credentialRoot = resolve(process.env.BILLING_TEST_CREDENTIAL_DIR || root);
for (const name of [".env", ".env.local"]) {
    const path = resolve(credentialRoot, name);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
        const match = line.match(/^\s*(?:export\s+)?([A-Z_]+)\s*=\s*(.*?)\s*$/);
        if (!match || !credentialNames.has(match[1])) continue;
        let value = match[2];
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
        else value = value.replace(/\s+#.*$/, "").trim();
        credentials[match[1]] = value;
    }
}
const explicitTestPair = credentials.RAZORPAY_TEST_KEY_ID && credentials.RAZORPAY_TEST_KEY_SECRET;
const keyId = explicitTestPair ? credentials.RAZORPAY_TEST_KEY_ID : credentials.RAZORPAY_KEY_ID;
const keySecret = explicitTestPair ? credentials.RAZORPAY_TEST_KEY_SECRET : credentials.RAZORPAY_KEY_SECRET;
if (!keyId?.startsWith("rzp_test_") || !keySecret || (!explicitTestPair && credentials.RAZORPAY_MODE?.toUpperCase() !== "TEST")) {
    throw new Error("A complete, explicitly Test-mode Razorpay credential pair is required; Live keys are refused.");
}

const config = JSON.parse(readFileSync(resolve(root, ".clerk/dashboard-local-runtime.json"), "utf8"));
const fixture = JSON.parse(readFileSync(resolve(root, ".clerk/dashboard-fixture.json"), "utf8"));
if (!/^lab-lords-dashboard-test-\d{8}$/.test(config.container)
    || !/^[a-f0-9]{64}$/.test(config.containerId)
    || !/^lab_lords_dashboard_[a-z_]*browser_test$/.test(config.database)
    || config.database !== fixture.databaseName
    || !Number.isInteger(config.port) || config.port < 1024 || config.port > 65535) {
    throw new Error("The independently verified disposable fixture identity is unavailable.");
}
const container = JSON.parse(execFileSync("docker", ["inspect", config.containerId, "--format",
    '{"id":{{json .Id}},"image":{{json .Config.Image}},"running":{{json .State.Running}},"ports":{{json .HostConfig.PortBindings}}}'],
{ encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }));
const ports = container.ports?.["5432/tcp"];
if (container.id !== config.containerId || container.image !== "postgres:16-alpine" || !container.running
    || ports?.length !== 1 || ports[0].HostIp !== "127.0.0.1" || ports[0].HostPort !== String(config.port)) {
    throw new Error("Disposable container identity or loopback binding changed.");
}
const artifactDir = resolve(root, "test-results/billing-verification");
mkdirSync(artifactDir, { recursive: true });
const proofPath = resolve(artifactDir, "three-plan-real-test-database-proof.json");
const database = resume
    ? validateResumeProof(JSON.parse(readFileSync(proofPath, "utf8")), config.containerId)
    : `lab_lords_billing_real_${randomBytes(6).toString("hex")}_browser_test`;
if (!resume && existsSync(proofPath)) throw new Error("Existing v2 proof found; use --resume instead of duplicating fixtures.");
if (!resume) {
    const source = new Client({ connectionString: `postgresql://postgres@127.0.0.1:${config.port}/${config.database}` });
    await source.connect();
    try {
        const identity = await source.query("SELECT current_database() AS name");
        if (identity.rows[0]?.name !== config.database) throw new Error("Fixture database identity changed.");
        await source.query(`CREATE DATABASE "${database}" TEMPLATE template0`);
    } finally { await source.end(); }
    const schema = execFileSync("docker", ["exec", config.containerId, "pg_dump", "--schema-only", "--no-owner", "--no-privileges", "-U", "postgres", "-d", config.database],
        { windowsHide: true, maxBuffer: 16 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
    execFileSync("docker", ["exec", "-i", config.containerId, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database],
        { input: schema, windowsHide: true, maxBuffer: 16 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"] });
}
const target = `postgresql://postgres@127.0.0.1:${config.port}/${database}`;
const db = new Client({ connectionString: target });
await db.connect();
try {
    if (!resume) await db.query(readFileSync("prisma/migrations/20261023090000_three_plan_catalogue/migration.sql", "utf8"));
    await db.query("BEGIN READ ONLY");
    if (resume) {
        if (JSON.parse(readFileSync(proofPath, "utf8")).catalogVersion !== 2) throw new Error("Catalogue v2 proof required.");
        await readVerifiedSyntheticFixtures(database, async sql => (await db.query(sql)).rows, 2);
    }
    else {
        const proof = await db.query('SELECT current_database() AS name, (SELECT count(*)::int FROM "User") AS users, (SELECT count(*)::int FROM "Organization") AS organizations');
        if (proof.rows[0]?.name !== database || proof.rows[0]?.users !== 0 || proof.rows[0]?.organizations !== 0) throw new Error("Fresh billing database isolation could not be proved.");
    }
} finally { await db.query("ROLLBACK"); await db.end(); }
if (!resume) writeFileSync(proofPath, JSON.stringify({ database, containerId: config.containerId,
    catalogVersion: 2, schemaOnly: true, emptyBeforeSeed: true, mode: "TEST", provider: "real Razorpay Test API", startupProviderMutations: 0 }, null, 2));
const temporaryRoot = resolve(root, "node_modules/.cache/billing-real-test");
mkdirSync(temporaryRoot, { recursive: true });
const env = {};
for (const name of ["SystemRoot", "SYSTEMROOT", "WINDIR", "SystemDrive", "ComSpec", "COMSPEC", "PATHEXT", "PATH", "Path", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "ProgramFiles", "ProgramFiles(x86)", "NUMBER_OF_PROCESSORS"]) {
    if (process.env[name]) env[name] = process.env[name];
}
Object.assign(env, { TEMP: temporaryRoot, TMP: temporaryRoot, NODE_ENV: "test", VERCEL_ENV: "development",
    DATABASE_URL: target, DIRECT_URL: target, ACCELERATE_URL: "", BILLING_REAL_TEST_DATABASE: database,
    BILLING_REAL_TEST_HARNESS: "1", BILLING_REAL_TEST_RESUME: resume ? "1" : "0", BILLING_REAL_TEST_CONTAINER_ID: config.containerId, RAZORPAY_MODE: "TEST", RAZORPAY_KEY_ID: keyId, RAZORPAY_KEY_SECRET: keySecret,
    RAZORPAY_BILLING_WRITES_ENABLED: "true", RAZORPAY_MULTI_METHOD_SUBSCRIPTIONS_ENABLED: "false",
    RAZORPAY_LIVE_CANARY_ORG_IDS: "", WORKSPACE_BRANCH_BILLING_V2_ENABLED: "true" });
console.log(resume ? "Original synthetic Test database and exact fixtures verified read-only; no provider mutations." : "Fresh schema-only disposable database verified. Test credentials loaded in memory; no provider writes on startup.");
const child = spawn(process.execPath, ["--import", "tsx", "tests/billing-verification/real-test-server.ts", ...(verifyCompleted ? ["--verify-completed"] : inspectOnly ? ["--inspect"] : addBasicRetest ? ["--add-basic-retest"] : [])],
    { cwd: root, env, stdio: "inherit", windowsHide: true });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", code => { process.exitCode = code ?? 1; });
