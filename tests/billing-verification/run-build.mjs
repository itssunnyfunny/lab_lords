import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

// In-memory allowlist only; no saved environment files or production credentials.
const credentialRoot = resolve(process.env.BILLING_TEST_CREDENTIAL_DIR || process.cwd());
const allowed = new Set(["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"]);
const credentials = {};
for (const file of [".env", ".env.local"]) {
  const path = resolve(credentialRoot, file);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (!match || !allowed.has(match[1])) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, "").trim();
    credentials[match[1]] = value;
  }
}
if (!credentials.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_test_") || !credentials.CLERK_SECRET_KEY?.startsWith("sk_test_")) throw new Error("Existing Clerk development keys are required");
const child = spawn(process.execPath, ["tests/dashboard-connected/start-local.mjs", "build"], {
  env: { ...process.env, ...credentials }, stdio: "inherit", windowsHide: true,
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", code => { process.exitCode = code ?? 1; });
