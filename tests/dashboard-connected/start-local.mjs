import { existsSync, readFileSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { Client } from "pg";

// Private local convenience configuration, never an application environment file.
const configPath = ".clerk/dashboard-local-runtime.json";
if (!existsSync(configPath)) throw new Error("Verified local runtime configuration is missing. Follow the connected README's independent disposable setup first.");
const config = JSON.parse(readFileSync(configPath, "utf8"));
const fixture = JSON.parse(readFileSync(".clerk/dashboard-fixture.json", "utf8"));
if (!/^lab-lords-dashboard-test-\d{8}$/.test(config.container)
    || !/^[a-f0-9]{64}$/.test(config.containerId)
    || !/^lab_lords_dashboard_[a-z_]*browser_test$/.test(config.database)
    || config.database !== fixture.databaseName
    || !Number.isInteger(config.port) || config.port < 1024 || config.port > 65535)
    throw new Error("Local runtime configuration does not identify the expected isolated fixture");
const describe = () => JSON.parse(execFileSync("docker", ["inspect", config.container, "--format",
    '{"id":{{json .Id}},"image":{{json .Config.Image}},"running":{{json .State.Running}},"ports":{{json .HostConfig.PortBindings}}}'],
{ encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }));
let container;
try { container = describe(); } catch { throw new Error("The verified disposable container is unavailable. Start Docker Desktop and retry; no other database will be used."); }
const ports = container.ports?.["5432/tcp"];
if (container.id !== config.containerId || container.image !== "postgres:16-alpine"
    || ports?.length !== 1 || ports[0].HostIp !== "127.0.0.1" || ports[0].HostPort !== String(config.port))
    throw new Error("Disposable container identity or loopback binding changed; refusing fallback");
if (!container.running) execFileSync("docker", ["start", config.containerId], { stdio: "pipe", windowsHide: true });
const connectionString = `postgresql://postgres@127.0.0.1:${config.port}/${config.database}`;
let ready = false;
for (let attempt = 0; attempt < 10 && !ready; attempt++) {
    const db = new Client({ connectionString, connectionTimeoutMillis: 1000 });
    try {
        await db.connect();
        const identity = await db.query("SELECT current_database() AS name");
        if (identity.rows[0]?.name !== config.database) throw new Error("Connected database identity changed");
        ready = true;
    } catch { if (attempt === 9) throw new Error("Verified local database did not become ready; no fallback is allowed"); }
    finally { await db.end(); }
    if (!ready) await new Promise(resolve => setTimeout(resolve, 500));
}
const mode = process.argv[2] || "start";
const commands = {
    start: ["tests/dashboard-connected/server.mjs"],
    test: ["node_modules/@playwright/test/cli.js", "test", "--config", "tests/dashboard-connected/playwright.config.ts"],
    capture: ["tests/dashboard-connected/capture.mjs"],
    counts: ["tests/dashboard-connected/counts.mjs"],
    build: ["tests/dashboard-connected/build.mjs"],
    "students-test": ["node_modules/@playwright/test/cli.js", "test", "--config", "tests/shared-system/connected.playwright.config.ts"],
};
if (!Object.hasOwn(commands, mode)) throw new Error("Choose start, test, capture, counts, build or students-test");
console.log("Verified the exact disposable container and local fixture. No saved application environment or shared database is used.");
const child = spawn(process.execPath, commands[mode], { env: { ...process.env, TEST_DATABASE_URL: connectionString,
    TEST_DATABASE_RESET_CONFIRM: config.database, DASHBOARD_CONNECTED_MODE: "start" }, stdio: "inherit", windowsHide: true });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", code => { process.exitCode = code ?? 1; });
