import { readFileSync, existsSync, mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { Client } from 'pg';
import { approvedBasicClerkEnvironment } from '../dashboard-connected/basic-clerk.mjs';
const sourceRoot = resolve(process.env.ACCOUNT_FIXTURE_SOURCE || resolve(execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8', windowsHide: true }).trim(), '..'));
const source = JSON.parse(readFileSync(resolve(sourceRoot, 'test-results/owner-setup/correction-runtime.json'), 'utf8'));
if (source.database !== 'lab_lords_correction_browser_test' || !/^[a-f0-9]{64}$/.test(source.containerId) || !Number.isInteger(source.port)) throw new Error('Unrecognized disposable source');
const container = JSON.parse(execFileSync('docker', ['inspect', source.containerId, '--format', '{"id":{{json .Id}},"image":{{json .Config.Image}},"ports":{{json .NetworkSettings.Ports}},"bindings":{{json .HostConfig.PortBindings}}}'], { encoding: 'utf8', windowsHide: true }));
const ports = container.ports?.['5432/tcp'];
const bindings = container.bindings?.['5432/tcp'];
const dynamicLoopbackPort = bindings?.length === 1 && bindings[0].HostIp === '127.0.0.1' && bindings[0].HostPort === '';
const currentPort = Number(ports?.[0]?.HostPort);
// Docker may allocate another port after restarting this exact disposable container.
// A changed port is accepted only for its original dynamic, loopback-only binding.
if (container.id !== source.containerId || container.image !== 'postgres:16-alpine' || ports?.length !== 1 || ports[0].HostIp !== '127.0.0.1' || !Number.isInteger(currentPort) || currentPort < 1 || currentPort > 65535 || (currentPort !== source.port && !dynamicLoopbackPort)) throw new Error('Disposable container identity changed');
const database = 'lab_lords_account_20261106_browser_test';
const mode = process.argv[2];
mkdirSync('.clerk', { recursive: true });
if (mode === 'prepare') {
 if (existsSync('.clerk/account-runtime.json')) throw new Error('Fixture exists; no automatic reset');
 const db = new Client({ host: '127.0.0.1', port: currentPort, user: 'postgres', database: source.database }); await db.connect();
 try { if ((await db.query('SELECT current_database() AS name')).rows[0].name !== source.database) throw new Error('Source identity mismatch'); await db.query(`CREATE DATABASE "${database}" TEMPLATE template0`); } finally { await db.end(); }
 const dump = execFileSync('docker', ['exec', source.containerId, 'pg_dump', '--no-owner', '--no-privileges', '-U', 'postgres', '-d', source.database], { windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
 execFileSync('docker', ['exec', '-i', source.containerId, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database], { input: dump, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
 copyFileSync(resolve(sourceRoot, '.clerk/dashboard-owner-auth.json'), '.clerk/dashboard-owner-auth.json');
 writeFileSync('.clerk/account-runtime.json', JSON.stringify({ ...source, database }));
 console.log('Created separate Account browser database from verified disposable local fixture; source unchanged.'); process.exit(0);
}
const proof = JSON.parse(readFileSync('.clerk/account-runtime.json', 'utf8'));
if (proof.database !== database || proof.containerId !== source.containerId || proof.port !== source.port) throw new Error('Account fixture proof changed');
const connection = `postgresql://postgres@127.0.0.1:${currentPort}/${database}`;
const db = new Client({ connectionString: connection }); await db.connect();
try { if ((await db.query('SELECT current_database() AS name')).rows[0].name !== database) throw new Error('Target identity mismatch'); } finally { await db.end(); }
const clerk = await approvedBasicClerkEnvironment();
const env = { ...process.env, ...clerk, DATABASE_URL: connection, TEST_DATABASE_URL: connection, TEST_DATABASE_RESET_CONFIRM: database, DASHBOARD_CONNECTED_PORT: '3161', DASHBOARD_CONNECTED_BUILD_WEBPACK: mode === 'build' ? '1' : '', DASHBOARD_CONNECTED_MODE: mode === 'start' ? 'start' : 'dev' };
const commands = { seed: ['node_modules/tsx/dist/cli.mjs', 'tests/account-navigation/seed.ts'], dev: ['tests/dashboard-connected/server.mjs'], start: ['tests/dashboard-connected/server.mjs'], build: ['tests/dashboard-connected/build.mjs'] };
if (!commands[mode]) throw new Error('Choose prepare, seed, dev, build or start');
console.log('Verified separate Account fixture; business providers held.');
const child = spawn(process.execPath, commands[mode], { env, stdio: 'inherit', windowsHide: true });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => { process.exitCode = code ?? 1; });
