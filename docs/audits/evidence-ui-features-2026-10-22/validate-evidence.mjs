import fs from 'node:fs';
import path from 'node:path';

const report = 'docs/audits/ui-feature-discoverability-2026-10-22.md';
const directory = 'docs/audits/evidence-ui-features-2026-10-22';
const text = fs.readFileSync(report, 'utf8');
const issues = [];
let linksChecked = 0;
for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
  if (/^(https?:|#)/.test(match[1])) continue;
  const [target, fragment] = match[1].split('#');
  const file = path.resolve(path.dirname(report), target);
  linksChecked++;
  if (!fs.existsSync(file)) issues.push(`Missing ${target}`);
  else if (fragment && /^L\d+$/.test(fragment) && Number(fragment.slice(1)) > fs.readFileSync(file, 'utf8').split('\n').length) issues.push(`Invalid line ${match[1]}`);
}
const inventory = JSON.parse(fs.readFileSync(path.join(directory, 'route-inventory.json'), 'utf8'));
const observations = JSON.parse(fs.readFileSync(path.join(directory, 'browser-observations.json'), 'utf8'));
const findings = (text.match(/^\| (N\d\d|G\d\d) /gm) ?? []).length;
if (findings !== 20) issues.push(`Finding count mismatch: ${findings}`);
if (inventory.count !== 29 || inventory.pages.some(page => !fs.existsSync(page.source))) issues.push('Route inventory mismatch');
if (observations.length !== 2 || observations.some(result => result.pageErrors.length || result.shell.overflow)) issues.push('Browser observation failure');
if (observations.some(result => result.followUpNavigation?.after !== 'Follow-ups pending' || !result.followUpNavigation?.url.endsWith('filter=DUE'))) issues.push('Missing Follow-ups reproduction');
for (const file of [report, ...fs.readdirSync(directory).filter(file => /\.(mjs|json)$/.test(file)).map(file => path.join(directory, file))]) {
  if (fs.readFileSync(file, 'utf8').split('\n').some(line => /[\t ]+$/.test(line))) issues.push(`Trailing whitespace: ${file}`);
}
console.log(JSON.stringify({ linksChecked, pages: inventory.count, findings, browserWidths: observations.map(result => result.viewport.width), issues }, null, 2));
if (issues.length) process.exitCode = 1;
