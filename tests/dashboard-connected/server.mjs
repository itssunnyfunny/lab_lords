import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { parse } from "dotenv";
import { Client } from "pg";

// Test runner only: never imported by the application or its production build.
// It leaves Clerk middleware intact and holds every non-authentication provider.
const target = new URL(process.env.TEST_DATABASE_URL || "invalid:");
const database = decodeURIComponent(target.pathname.slice(1));
if (!["postgres:", "postgresql:"].includes(target.protocol)
    || !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname)
    || !database.includes("browser_test") || process.env.TEST_DATABASE_RESET_CONFIRM !== database) {
    throw new Error("Connected server requires an explicitly confirmed local browser_test database");
}
const db = new Client({ connectionString: target.href });
await db.connect();
try {
    const result = await db.query("SELECT current_database() AS name");
    if (result.rows[0]?.name !== database) throw new Error("Connected database identity differs");
} finally { await db.end(); }

const onboardingConfirm = process.env.DASHBOARD_AUDIT_ONBOARDING_CONFIRM;
const auditOnboarding = onboardingConfirm === database
    && database === "lab_lords_dashboard_closeout_browser_test"
    && target.hostname === "127.0.0.1" && target.port === "59117";
if (onboardingConfirm && !auditOnboarding) {
    throw new Error("Audit onboarding opt-in requires the exact retained local synthetic fixture");
}
const messagingConfirm = process.env.DASHBOARD_AUDIT_MESSAGING_CONFIRM;
const auditMessaging = messagingConfirm === database
    && database === "lab_lords_dashboard_closeout_browser_test"
    && target.hostname === "127.0.0.1" && target.port === "59117";
if (messagingConfirm && !auditMessaging) {
    throw new Error("Audit messaging opt-in requires the exact retained local synthetic fixture");
}
const gaConfirm = process.env.DASHBOARD_AUDIT_GA_CONFIRM;
const auditGa = gaConfirm === database
    && database === "lab_lords_dashboard_closeout_browser_test"
    && target.hostname === "127.0.0.1" && target.port === "59117";
if (gaConfirm && !auditGa) {
    throw new Error("Audit GA opt-in requires the exact retained local synthetic fixture");
}

const env = { ...process.env };
const built = process.env.DASHBOARD_CONNECTED_MODE === "start";
const mode = built ? "production" : "development";
const localFiles = [".env", ".env.local", `.env.${mode}`, `.env.${mode}.local`];
const local = Object.assign({}, ...localFiles.filter(existsSync).map(file => parse(readFileSync(file))));
// Explicit empty values prevent Next's dotenv loading from restoring provider credentials.
for (const key of new Set([...Object.keys(local), ...Object.keys(env)])) {
    if (/^(?:NEXT_PUBLIC_)?(?:RAZORPAY|META_|WHATSAPP|GEMINI|GOOGLE_API|IMPORT_|CRON_|WORKFLOW_|VERCEL_|OPENAI_|ANTHROPIC_|RESEND_)/.test(key)) env[key] = "";
}
for (const key of ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"]) {
    env[key] = process.env[key] || local[key];
    const prefix = key.startsWith("NEXT_PUBLIC") ? "pk_test_" : "sk_test_";
    if (!env[key]?.startsWith(prefix)) throw new Error("Connected verification requires existing Clerk development keys");
}
Object.assign(env, {
    NODE_ENV: built ? "production" : "development", NEXT_TELEMETRY_DISABLED: "1", NEXT_DISABLE_TURBOPACK: "1",
    DATABASE_URL: target.href, DIRECT_URL: target.href, ACCELERATE_URL: "",
    RAZORPAY_MODE: "TEST", RAZORPAY_BILLING_WRITES_ENABLED: "false", META_WHATSAPP_MODE: "TEST",
    WHATSAPP_INTEGRATION_ENABLED: auditMessaging ? "true" : "false",
    WHATSAPP_REPORTS_ENABLED: auditMessaging ? "true" : "false",
    WHATSAPP_SERVICE_NOTICES_ENABLED: auditMessaging ? "true" : "false",
    WHATSAPP_OPERATIONS_UI_ENABLED: auditMessaging ? "true" : "false",
    NEXT_PUBLIC_GA_MEASUREMENT_ID: auditGa ? "G-0000000000" : "",
    IMPORT_V2_ENABLED: "false",
    WORKSPACE_BRANCH_BILLING_V2_ENABLED: auditOnboarding ? "true" : "false",
});
const port = process.env.DASHBOARD_CONNECTED_PORT || "3117";
if (!/^\d{4,5}$/.test(port)) throw new Error("Invalid local port");
console.log(`Verified local connected server; development authentication retained; billing, AI, import and messaging provider writes held; onboarding ${auditOnboarding ? "enabled for exact synthetic fixture" : "held"}; messaging panels ${auditMessaging ? "enabled for exact synthetic fixture" : "held"}; synthetic GA tag ${auditGa ? "enabled for intercepted network test" : "held"}.`);
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", ...(built ? ["start"] : ["dev", "--webpack"]), "--hostname", "localhost", "--port", port], {
    env, stdio: "inherit", windowsHide: true,
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", code => { process.exitCode = code ?? 1; });
