import { spawn } from 'node:child_process';
import { once } from 'node:events';

// Start the inspected synthetic server and browser in the same loopback context.
// The fixture never connects to authentication, databases or business providers.
const server = spawn(process.execPath, ['tests/application-design-pilot/server.mjs'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
server.stdout.on('data', chunk => { output += chunk; });
server.stderr.on('data', chunk => { output += chunk; });
try {
    for (let i = 0; i < 200 && !output.includes('127.0.0.1:4187'); i++) {
        if (server.exitCode !== null) throw new Error(`Synthetic server exited: ${output}`);
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!output.includes('127.0.0.1:4187')) throw new Error('Synthetic server did not become ready');
    const browser = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--config', 'tests/navigation-restoration/playwright.config.ts', ...process.argv.slice(2)], { windowsHide: true, stdio: 'inherit' });
    process.exitCode = (await once(browser, 'exit'))[0] ?? 1;
} finally {
    server.kill();
    if (server.exitCode === null) await once(server, 'exit');
}
