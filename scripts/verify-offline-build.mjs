import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { parse } from "dotenv";

// Compile without a reachable database or provider writes. This verifies build
// output, not connected behavior. Development Clerk keys are still required by
// the app's build-time auth setup; no key value is printed.
const files = [".env", ".env.local", ".env.production", ".env.production.local"];
const local = Object.assign({}, ...files.filter(existsSync).map(path => parse(readFileSync(path))));
const env = { ...process.env };
for (const key of new Set([...Object.keys(local), ...Object.keys(env)])) {
    if (/^(?:NEXT_PUBLIC_)?(?:RAZORPAY|META_|WHATSAPP|GEMINI|GOOGLE_API|IMPORT_|CRON_|WORKFLOW_|VERCEL_|OPENAI_|ANTHROPIC_|RESEND_)/.test(key)) env[key] = "";
}
for (const key of ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"]) {
    env[key] = process.env[key] || local[key];
    if (!env[key]?.startsWith(key.startsWith("NEXT_PUBLIC") ? "pk_test_" : "sk_test_")) {
        throw new Error("Development authentication keys required for offline build");
    }
}
const unavailable = "postgresql://postgres@127.0.0.1:1/lab_lords_offline_build_test";
Object.assign(env, {
    NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", NEXT_DISABLE_TURBOPACK: "1",
    DATABASE_URL: unavailable, DIRECT_URL: unavailable, ACCELERATE_URL: "",
    RAZORPAY_MODE: "TEST", RAZORPAY_BILLING_WRITES_ENABLED: "false", META_WHATSAPP_MODE: "TEST",
    WHATSAPP_INTEGRATION_ENABLED: "false", IMPORT_V2_ENABLED: "false", WORKSPACE_BRANCH_BILLING_V2_ENABLED: "false",
});

const pnpm = join(process.env.APPDATA || "", "npm", "node_modules", "pnpm", "bin", "pnpm.cjs");
if (!existsSync(pnpm)) throw new Error("Expected local pnpm CLI missing");
const secrets = [...new Set(Object.entries({ ...local, ...env })
    .filter(([key, value]) => /KEY|SECRET|TOKEN|PASSWORD|DATABASE_URL|DIRECT_URL/.test(key) && typeof value === "string" && value.length >= 8)
    .map(([, value]) => value))];
const child = spawn(process.execPath, [pnpm, "build"], { env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
child.on("error", () => { process.stderr.write("Offline build process could not start\n"); process.exitCode = 1; });
for (const stream of [child.stdout, child.stderr]) stream.on("data", chunk => {
    let output = chunk.toString();
    for (const value of secrets) output = output.replaceAll(value, "[redacted]");
    process.stdout.write(output);
});
child.on("exit", code => { process.exitCode = code ?? 1; });
