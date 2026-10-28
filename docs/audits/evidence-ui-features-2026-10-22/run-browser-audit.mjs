import { spawn } from 'node:child_process';
import { once } from 'node:events';

const server = spawn(process.execPath, ['tests/application-design-pilot/server.mjs'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
server.stdout.on('data', chunk => { output += chunk; });
server.stderr.on('data', chunk => { output += chunk; });
try {
  for (let i = 0; i < 100 && !output.includes('127.0.0.1:4187'); i++) {
    if (server.exitCode !== null) throw new Error(`Synthetic server exited: ${output}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!output.includes('127.0.0.1:4187')) throw new Error('Synthetic server did not become ready');
  await import('./browser-audit.mjs');
} finally {
  server.kill();
  if (server.exitCode === null) await once(server, 'exit');
}
