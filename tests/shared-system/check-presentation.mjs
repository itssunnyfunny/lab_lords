import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

function presentationIssues(patch) {
    let file = ''; const issues = []; const paletteBalances = new Map();
    for (const line of patch.split('\n')) {
        if (line.startsWith('+++ ')) { file = line.startsWith('+++ b/') ? line.slice(6) : ''; continue; }
        if (line.startsWith('+++') || line.startsWith('---') || !/^(app|components|styles)\//.test(file) || file === 'styles/tokens.css') continue;
        if (line.startsWith('+') || line.startsWith('-')) {
            const balance = paletteBalances.get(file) ?? new Map();
            for (const [value] of line.matchAll(/(?:#[0-9a-f]{3,8}\b|(?:bg|text|border)-(?:green|emerald|cyan|amber|red|violet)-\d+)/gi)) {
                const key = value.toLowerCase();
                balance.set(key, (balance.get(key) ?? 0) + (line.startsWith('+') ? 1 : -1));
            }
            paletteBalances.set(file, balance);
        }
        if (line.startsWith('+') && file.startsWith('styles/') && !['styles/shared-ui.css', 'styles/reference-dashboard.css'].includes(file) && /box-shadow:\s*(?!var\()[\d#]/.test(line)) issues.push(`${file}: new shared surface styling needs an existing owner`);
    }
    // A modified JSX line may retain existing chart colors. Compare literal
    // counts within each file so retained values pass and new usages still fail.
    for (const [name, balance] of paletteBalances) {
        if ([...balance.values()].some(count => count > 0)) issues.push(`${name}: new literal palette value; use semantic tokens or document a reviewed exception`);
    }
    return [...new Set(issues)];
}

if (process.argv[2] === '--self-test') {
    const patch = (file, removed, added) => `+++ b/${file}\n-${removed}\n+${added}`;
    assert.deepEqual(presentationIssues(patch('components/chart.tsx', '<g fill="#35a66b">old</g>', '<g fill="#35a66b">new</g>')), []);
    assert.equal(presentationIssues(patch('components/chart.tsx', '<g fill="#35a66b" />', '<g fill="#123456" />')).length, 1);
    assert.equal(presentationIssues(patch('components/chart.tsx', '<g fill="#35a66b" />', '<g fill="#35a66b" /><g fill="#35a66b" />')).length, 1);
    assert.equal(presentationIssues(patch('components/old.tsx', '<g fill="#35a66b" />', '') + '\n' + patch('components/new.tsx', '', '<g fill="#35a66b" />')).length, 1);
    assert.equal(presentationIssues(patch('components/new.tsx', '', '<g fill="#35a66b" />') + '\n--- a/components/deleted.tsx\n+++ /dev/null\n-<g fill="#35a66b" />').length, 1);
    assert.deepEqual(presentationIssues(patch('styles/tokens.css', '', '--new-token: #123456;')), []);
    assert.equal(presentationIssues(patch('styles/feature.css', '', 'box-shadow: 0 1px 2px;')).length, 1);
    assert.deepEqual(presentationIssues(patch('styles/shared-ui.css', '', 'box-shadow: 0 1px 2px;')), []);
    assert.equal(presentationIssues(patch('components/card.tsx', '', 'className="bg-emerald-600"')).length, 1);
    assert.deepEqual(presentationIssues(patch('components/chart.tsx', '<g fill="#35a66b" />', '')), []);
    console.log('Presentation guard: 10 regression cases passed.');
    process.exit(0);
}

const base = process.argv[2] || '3d58864';
execFileSync('git', ['rev-parse', '--verify', `${base}^{commit}`], { stdio: 'pipe' });
const patch = execFileSync('git', ['diff', '--no-ext-diff', '--unified=0', base, '--', '*.tsx', '*.ts', '*.css'], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
const issues = presentationIssues(patch);
if (issues.length) { console.error([...new Set(issues)].join('\n')); process.exitCode = 1; }
else console.log(`Changed-file presentation guard passed against ${base}; existing geometry and inherited styles are not audited.`);
