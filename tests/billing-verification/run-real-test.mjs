import { readFileSync, mkdirSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readTestCredentials } from "./test-credentials.mjs";
import { Client } from "pg";
import { readVerifiedSyntheticFixtures, validateResumeProof } from "./real-test-resume-guard.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
process.chdir(root);
const args = process.argv.slice(2);
if (args.length !== 1 || !["--inspect", "--verify-completed"].includes(args[0])) {
    throw new Error("Use branch-preauthorization.ts --prepare for new branch Checkouts. Historical fixtures support --inspect and --verify-completed.");
}

const { keyId, keySecret } = readTestCredentials();

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
const proof = JSON.parse(readFileSync(proofPath, "utf8"));
if (proof.catalogVersion !== 2) throw new Error("Catalogue v2 proof required.");
const database = validateResumeProof(proof, config.containerId);
const target = `postgresql://postgres@127.0.0.1:${config.port}/${database}`;
const db = new Client({ connectionString: target });
await db.connect();
try {
    await db.query("BEGIN READ ONLY");
    await readVerifiedSyntheticFixtures(database, async sql => (await db.query(sql)).rows, 2);
} finally { await db.query("ROLLBACK"); await db.end(); }
const temporaryRoot = resolve(root, "node_modules/.cache/billing-real-test");
mkdirSync(temporaryRoot, { recursive: true });
const env = {};
for (const name of ["SystemRoot", "SYSTEMROOT", "WINDIR", "SystemDrive", "ComSpec", "COMSPEC", "PATHEXT", "PATH", "Path", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "ProgramFiles", "ProgramFiles(x86)", "NUMBER_OF_PROCESSORS"]) {
    if (process.env[name]) env[name] = process.env[name];
}
Object.assign(env, { TEMP: temporaryRoot, TMP: temporaryRoot, NODE_ENV: "test", VERCEL_ENV: "development",
    DATABASE_URL: target, DIRECT_URL: target, ACCELERATE_URL: "", BILLING_REAL_TEST_DATABASE: database,
    BILLING_REAL_TEST_HARNESS: "1", BILLING_REAL_TEST_RESUME: "1", BILLING_REAL_TEST_CONTAINER_ID: config.containerId, RAZORPAY_MODE: "TEST", RAZORPAY_KEY_ID: keyId, RAZORPAY_KEY_SECRET: keySecret,
    RAZORPAY_BILLING_WRITES_ENABLED: "false",
 });
console.log("Historical synthetic Test database and exact fixtures verified read-only.");
const child = spawn(process.execPath, ["--import", "tsx", "tests/billing-verification/real-test-server.ts", args[0]],
    { cwd: root, env, stdio: "inherit", windowsHide: true });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", code => { process.exitCode = code ?? 1; });
