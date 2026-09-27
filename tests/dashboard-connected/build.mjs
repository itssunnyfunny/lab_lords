import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { parse } from "dotenv";
import { Client } from "pg";

// Local verification only. Does not persist environment changes or bypass auth.
const target = new URL(process.env.TEST_DATABASE_URL || "invalid:");
const database = decodeURIComponent(target.pathname.slice(1));
if (!["postgres:", "postgresql:"].includes(target.protocol)
    || !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname)
    || !database.includes("browser_test") || process.env.TEST_DATABASE_RESET_CONFIRM !== database) {
    throw new Error("Build verification requires the exactly confirmed local browser_test target");
}
target.searchParams.set("options", "-c default_transaction_read_only=on");
const db = new Client({ connectionString: target.href });
await db.connect();
try {
    const identity = await db.query("SELECT current_database() AS name");
    const mode = await db.query("SHOW transaction_read_only");
    if (identity.rows[0]?.name !== database || mode.rows[0]?.transaction_read_only !== "on")
        throw new Error("Build verification could not prove exact local read-only database scope");
} finally { await db.end(); }

const localFiles = [".env", ".env.local", ".env.production", ".env.production.local"];
const local = Object.assign({}, ...localFiles.filter(existsSync).map(file => parse(readFileSync(file))));
const env = { ...process.env };
for (const key of new Set([...Object.keys(local), ...Object.keys(env)])) {
    if (/^(?:NEXT_PUBLIC_)?(?:RAZORPAY|META_|WHATSAPP|GEMINI|GOOGLE_API|IMPORT_|CRON_|WORKFLOW_|VERCEL_|OPENAI_|ANTHROPIC_|RESEND_)/.test(key)) env[key] = "";
}
for (const key of ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"]) {
    env[key] = process.env[key] || local[key];
    const prefix = key.startsWith("NEXT_PUBLIC") ? "pk_test_" : "sk_test_";
    if (!env[key]?.startsWith(prefix)) throw new Error("Build verification requires existing Clerk development configuration");
}
Object.assign(env, {
    NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", NEXT_DISABLE_TURBOPACK: "1",
    DATABASE_URL: target.href, DIRECT_URL: target.href, ACCELERATE_URL: "",
    RAZORPAY_MODE: "TEST", RAZORPAY_BILLING_WRITES_ENABLED: "false", META_WHATSAPP_MODE: "TEST",
    WHATSAPP_INTEGRATION_ENABLED: "false", IMPORT_V2_ENABLED: "false", WORKSPACE_BRANCH_BILLING_V2_ENABLED: "false",
});
const pnpm = join(process.env.APPDATA || "", "npm", "node_modules", "pnpm", "bin", "pnpm.cjs");
if (!existsSync(pnpm)) throw new Error("Expected local pnpm CLI was not found");
mkdirSync("test-results", { recursive: true });
const log = "test-results/dashboard-build.log";
writeFileSync(log, "Verified exact local read-only database; development authentication; external providers held.\nCommand: pnpm build\n");
console.log("Verified exact local read-only database; development authentication retained; external providers held. Running pnpm build.");
const privateValues = [...new Set(Object.entries({ ...local, ...env })
    .filter(([key, value]) => /KEY|SECRET|TOKEN|PASSWORD|DATABASE_URL|DIRECT_URL|ACCELERATE_URL/.test(key) && typeof value === "string" && value.length >= 8)
    .map(([, value]) => value))];
const child = spawn(process.execPath, [pnpm, "build"], { env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
for (const stream of [child.stdout, child.stderr]) {
    createInterface({ input: stream }).on("line", line => {
        for (const value of privateValues) line = line.replaceAll(value, "[redacted]");
        appendFileSync(log, `${line}\n`);
        console.log(line);
    });
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", code => {
    appendFileSync(log, `Build exit code: ${code ?? 1}\n`);
    process.exitCode = code ?? 1;
});
