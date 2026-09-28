import { execFileSync } from 'node:child_process';
const base = process.argv[2] || '3d58864';
execFileSync('git', ['rev-parse', '--verify', `${base}^{commit}`], { stdio: 'pipe' });
const patch = execFileSync('git', ['diff', '--no-ext-diff', '--unified=0', base, '--', '*.tsx', '*.ts', '*.css'], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
let file = ''; const issues = [];
for (const line of patch.split('\n')) {
    if (line.startsWith('+++ b/')) { file = line.slice(6); continue; }
    if (!line.startsWith('+') || line.startsWith('+++') || !/^(app|components|styles)\//.test(file)) continue;
    if (file === 'styles/tokens.css') continue;
    if (/(?:#[0-9a-f]{3,8}\b|(?:bg|text|border)-(?:green|emerald|cyan|amber|red|violet)-\d)/i.test(line)) issues.push(`${file}: new literal palette value; use semantic tokens or document a reviewed exception`);
    if (file.startsWith('styles/') && !['styles/shared-ui.css', 'styles/reference-dashboard.css'].includes(file) && /box-shadow:\s*(?!var\()[\d#]/.test(line)) issues.push(`${file}: new shared surface styling needs an existing owner`);
}
if (issues.length) { console.error([...new Set(issues)].join('\n')); process.exitCode = 1; }
else console.log(`Changed-file presentation guard passed against ${base}; existing geometry and inherited styles are not audited.`);
