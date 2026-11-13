import { execFileSync, spawn } from "node:child_process";
import { Client } from "pg";

// An empty, unique disposable DB is enough for a production compilation. No
// schema, seed, existing container or saved application configuration is changed.
const image = "postgres:16-alpine";
const database = "lab_lords_visual_build_browser_test";
const name = `lab-lords-visual-build-${Date.now()}-test`;
const docker = (...args) => execFileSync("docker", args, { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }).trim();
docker("image", "inspect", image, "--format", "{{.Id}}"); // never pull a new image
let id;
try {
    id = docker("run", "--detach", "--rm", "--pull", "never", "--name", name,
        "--label", "lablords-purpose=visual-build-test", "--publish", "127.0.0.1:0:5432",
        "--env", "POSTGRES_HOST_AUTH_METHOD=trust", "--env", `POSTGRES_DB=${database}`, image);
    if (!/^[a-f0-9]{64}$/.test(id)) throw new Error("Unexpected disposable container identity");
    const describe = JSON.parse(docker("inspect", id, "--format",
        '{"id":{{json .Id}},"image":{{json .Config.Image}},"ports":{{json .HostConfig.PortBindings}}}'));
    const binding = describe.ports?.["5432/tcp"];
    const mapped = JSON.parse(docker("inspect", id, "--format", '{{json .NetworkSettings.Ports}}'))?.["5432/tcp"];
    if (describe.id !== id || describe.image !== image || binding?.length !== 1 || binding[0].HostIp !== "127.0.0.1"
        || mapped?.length !== 1 || mapped[0].HostIp !== "127.0.0.1" || !/^\d+$/.test(mapped[0].HostPort))
        throw new Error("Disposable container scope could not be proven");
    const connectionString = `postgresql://postgres@127.0.0.1:${mapped[0].HostPort}/${database}`;
    let ready = false;
    for (let attempt = 0; attempt < 20 && !ready; attempt++) {
        const db = new Client({ connectionString, connectionTimeoutMillis: 1000 });
        try {
            await db.connect();
            const result = await db.query("SELECT current_database() AS name");
            if (result.rows[0]?.name !== database) throw new Error("Unexpected database identity");
            ready = true;
        } catch { if (attempt === 19) throw new Error("Disposable build database did not become ready"); }
        finally { await db.end(); }
        if (!ready) await new Promise(resolve => setTimeout(resolve, 500));
    }
    console.log("Verified a new isolated loopback database. Running the existing read-only, provider-disabled build wrapper.");
    const child = spawn(process.execPath, ["tests/dashboard-connected/build.mjs"], {
        windowsHide: true, stdio: "inherit", env: { ...process.env, TEST_DATABASE_URL: connectionString, TEST_DATABASE_RESET_CONFIRM: database },
    });
    for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
    process.exitCode = await new Promise(resolve => child.on("exit", code => resolve(code ?? 1)));
} finally {
    if (id && /^[a-f0-9]{64}$/.test(id)) {
        docker("stop", id);
        console.log("Removed only the disposable database created for this build.");
    }
}
