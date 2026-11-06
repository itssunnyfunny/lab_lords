import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { parse } from "dotenv";
import { Client } from "pg";
import { createConnection } from "node:net";

// This test-only runner cannot fall back to an application database. Its ignored
// proof file is recorded after independently creating an empty local container.
const correction = process.env.OWNER_SETUP_CORRECTION === "1";
const appPort = correction ? "3150" : "3149";
const proof = JSON.parse(readFileSync(`test-results/owner-setup/${correction ? "correction-runtime" : "runtime"}.json`, "utf8"));
if (!/^[a-f0-9]{64}$/.test(proof.containerId) || proof.database !== (correction ? "lab_lords_correction_browser_test" : "lab_lords_owner_setup_browser_test") || !Number.isInteger(proof.port)) throw new Error("Missing isolated setup proof");
const container = JSON.parse(execFileSync("docker", ["inspect", proof.containerId, "--format", '{"id":{{json .Id}},"image":{{json .Config.Image}},"ports":{{json .NetworkSettings.Ports}}}'], { encoding: "utf8", windowsHide: true }));
const ports = container.ports?.["5432/tcp"];
if (container.id !== proof.containerId || container.image !== "postgres:16-alpine" || ports?.length !== 1 || ports[0].HostIp !== "127.0.0.1" || ports[0].HostPort !== String(proof.port)) throw new Error("Isolated container binding changed");
const connection = `postgresql://postgres@127.0.0.1:${proof.port}/${proof.database}`;
const db = new Client({ connectionString: connection }); await db.connect();
try { if ((await db.query("SELECT current_database() AS name")).rows[0].name !== proof.database) throw new Error("Database identity changed"); } finally { await db.end(); }
const local = Object.assign({}, ...[".env", ".env.local", ".env.production", ".env.production.local"].filter(existsSync).map(file => parse(readFileSync(file))));
const env = { ...process.env };
for (const key of new Set([...Object.keys(local), ...Object.keys(env)])) if (/^(?:NEXT_PUBLIC_)?(?:RAZORPAY|META_|WHATSAPP|GEMINI|GOOGLE_API|IMPORT_|CRON_|WORKFLOW_|VERCEL_|OPENAI_|ANTHROPIC_|RESEND_)/.test(key)) env[key] = "";
for (const key of ["CLERK_SECRET_KEY", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"]) { env[key] = process.env[key] || local[key]; if (!env[key]?.startsWith(key === "CLERK_SECRET_KEY" ? "sk_test_" : "pk_test_")) throw new Error("Existing Clerk development configuration is required"); }
Object.assign(env, { DATABASE_URL: connection, DIRECT_URL: connection, TEST_DATABASE_URL: connection, TEST_DATABASE_RESET_CONFIRM: proof.database, ACCELERATE_URL: "",
    NEXT_TELEMETRY_DISABLED: "1", RAZORPAY_MODE: "TEST", RAZORPAY_BILLING_WRITES_ENABLED: "false", META_WHATSAPP_MODE: "TEST", WHATSAPP_INTEGRATION_ENABLED: "false",
    IMPORT_V2_ENABLED: "true", IMPORT_MAX_PLANNED_MUTATIONS: "2000", WORKSPACE_BRANCH_BILLING_V2_ENABLED: "true",
    PLAYWRIGHT_BASE_URL: `http://localhost:${appPort}`, PLAYWRIGHT_EXISTING_AUTH_STATE: ".clerk/dashboard-owner-auth.json", PLAYWRIGHT_REFRESHED_AUTH_STATE: ".clerk/owner-setup-auth.json",
    WORKFLOW_LOCAL_BASE_URL: `http://localhost:${appPort}`,
});
const mode = process.argv[2];
if (["browser", "retained-browser"].includes(mode) && !correction) throw new Error("The review database contains owner-saved records. Browser reset tests require OWNER_SETUP_CORRECTION=1 and the separate disposable correction database.");
if (mode === "retained-browser") {
    // Let Vitest's global setup supply its synthetic Test Mode billing keys.
    delete env.RAZORPAY_KEY_ID; delete env.RAZORPAY_KEY_SECRET;
}
const commands = { build: ["tests/dashboard-connected/build.mjs"], auth: ["tests/dashboard-connected/refresh-auth.mjs"],
    dev: ["node_modules/next/dist/bin/next", "dev", "--webpack", "--hostname", "localhost", "--port", appPort],
    start: ["node_modules/next/dist/bin/next", "start", "--hostname", "localhost", "--port", appPort],
    browser: ["node_modules/@playwright/test/cli.js", "test", "--config", "tests/owner-setup/playwright.config.ts", ...process.argv.slice(3)],
    "retained-browser": ["node_modules/vitest/vitest.mjs", "run", "--config", "tests/import-browser/vitest.config.ts", ...process.argv.slice(3)] };
if (!Object.hasOwn(commands, mode)) throw new Error("Choose build, auth, dev, start, browser or retained-browser");
// workflow/next 4.1.0 forces .next/workflow-data even when a different data
// directory is supplied. Concurrent previews would share its local queue.
if (["start", "dev", "build"].includes(mode)) {
    for (const port of mode === "build" ? [3149, 3150] : [correction ? 3149 : 3150]) {
        const listening = await new Promise(resolve => {
            const socket = createConnection({ host: "localhost", port });
            const finish = result => { socket.destroy(); resolve(result); };
            socket.once("connect", () => finish(true));
            socket.once("error", () => finish(false));
            socket.setTimeout(1000, () => finish(false));
        });
        if (listening) throw new Error(`Stop the owner-setup preview on port ${port} first; this Workflow version shares local storage between previews.`);
    }
}
env.NODE_ENV = mode === "start" || mode === "build" ? "production" : mode === "dev" ? "development" : "test";
mkdirSync("test-results/owner-setup", { recursive: true });
console.log("Verified exact isolated browser database; real Clerk development authentication; business provider credentials held.");
const child = spawn(process.execPath, commands[mode], { env, stdio: "inherit", windowsHide: true });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", code => { process.exitCode = code ?? 1; });
