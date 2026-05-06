import { config } from "dotenv";

const envFile = process.argv[2] ?? ".env";

config({ path: envFile, override: true });

type KeyMode = "missing" | "development/test" | "production/live" | "mixed" | "unknown";

function getKeyMode(publishableKey?: string, secretKey?: string): KeyMode {
    const pkMode = publishableKey?.startsWith("pk_live_")
        ? "production/live"
        : publishableKey?.startsWith("pk_test_")
            ? "development/test"
            : publishableKey
                ? "unknown"
                : "missing";
    const skMode = secretKey?.startsWith("sk_live_")
        ? "production/live"
        : secretKey?.startsWith("sk_test_")
            ? "development/test"
            : secretKey
                ? "unknown"
                : "missing";

    if (pkMode === "missing" && skMode === "missing") return "missing";
    if (pkMode === skMode) return pkMode;
    if (pkMode === "missing" || skMode === "missing") return "missing";
    if (pkMode === "unknown" || skMode === "unknown") return "unknown";
    return "mixed";
}

function status(label: string, ok: boolean, detail: string) {
    const marker = ok ? "OK" : "MISSING";
    console.log(`${marker.padEnd(7)} ${label}: ${detail}`);
}

const databaseUrl = process.env.DATABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const secretKey = process.env.CLERK_SECRET_KEY;
const keyMode = getKeyMode(publishableKey, secretKey);
const hasDatabase = Boolean(databaseUrl);
const hasPublishableKey = Boolean(publishableKey);
const hasSecretKey = Boolean(secretKey);
const isTestEnv = envFile.includes("test");
const authBypassEnabled = process.env.NODE_ENV !== "production"
    && process.env.NEXT_PUBLIC_AUTH_BYPASS_ENABLED === "true";

console.log(`Checking auth environment from ${envFile}`);
status("DATABASE_URL", hasDatabase, hasDatabase ? "set" : "not set");
status("Clerk publishable key", hasPublishableKey, hasPublishableKey ? "set" : "not set");
status("Clerk secret key", hasSecretKey, hasSecretKey ? "set" : "not set");
status("Local auth bypass", authBypassEnabled, authBypassEnabled ? `enabled for ${process.env.AUTH_BYPASS_EMAIL || "alice@lablord.com"}` : "disabled");
console.log(`MODE    Clerk key mode: ${keyMode}`);

if (authBypassEnabled) {
    console.log("NOTE    Local auth bypass skips Clerk only outside production. Do not use it for deployment.");
}

if (keyMode === "development/test") {
    console.log("NOTE    Clerk will show its development-mode banner with test keys. That is expected for local dev.");
}

if (keyMode === "production/live") {
    console.log("NOTE    Live Clerk keys are production credentials. Use them only with the production Clerk instance and production-safe data.");
}

if (isTestEnv) {
    console.log("NOTE    Vitest does not require Clerk keys because Clerk is mocked in tests.");
}

if (!hasDatabase || (!isTestEnv && !authBypassEnabled && (!hasPublishableKey || !hasSecretKey))) {
    process.exitCode = 1;
}
