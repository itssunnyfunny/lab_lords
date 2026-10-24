import fs from 'node:fs';
import path from 'node:path';

const review = 'docs/redesign/navigation-restoration-review.md';
const content = fs.readFileSync(review, 'utf8');
const findings = [...content.matchAll(/^\| ((?:N\d{2}|G\d{2})) \|/gm)].map(match => match[1]);
if (findings.length !== 20 || new Set(findings).size !== 20) throw new Error('Expected 20 unique audit closures');
const docs = [review, 'docs/ai/current-state.md', 'docs/ai/application-design-system.md', 'docs/ai/dashboard-operations.md',
    'docs/redesign/page-family-migration.md', 'docs/product/public-claims.md'];
for (const file of docs) {
    for (const match of fs.readFileSync(file, 'utf8').matchAll(/\]\(([^)]+)\)/g)) {
        const href = match[1];
        if (/^(?:https?:|#|mailto:)/.test(href)) continue;
        if (!fs.existsSync(path.resolve(path.dirname(file), href.split('#')[0]))) throw new Error(`${file}: missing ${href}`);
    }
}
const files = ['components/billing/BranchBillingControls.tsx', 'components/dashboard-features/AttendanceGaps.tsx',
    'components/dashboard/DashboardOperationalPreviews.tsx', 'components/imports/ImportRecipeManager.tsx',
    'lib/i18n/navigationRestoration.ts', 'app/api/branches/[branchId]/dashboard/attendance-gaps/route.ts', review,
    ...fs.readdirSync('tests/navigation-restoration', { withFileTypes: true }).filter(entry => entry.isFile()).map(entry => `tests/navigation-restoration/${entry.name}`)];
for (const file of files) {
    if (fs.readFileSync(file, 'utf8').split(/\r?\n/).some(line => /[\t ]+$/.test(line))) throw new Error(`${file}: trailing whitespace`);
}
console.log('20 unique audit closures, documentation targets and new-text whitespace passed.');
