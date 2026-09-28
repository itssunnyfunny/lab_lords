import fs from 'node:fs';
import { chromium, expect } from '@playwright/test';

const phase = process.argv[2];
if (!['before', 'after'].includes(phase)) throw new Error('Choose before or after');
const output = `docs/redesign/student-card-evidence/${phase}`;
if (phase === 'before' && fs.existsSync(`${output}/measurements.json`)) throw new Error('Frozen card review baseline already exists');
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 2000 }, deviceScaleFactor: 1, locale: 'en-IN', timezoneId: 'Asia/Kolkata' });
const errors = []; page.on('pageerror', error => errors.push(error.message));
// Identical synthetic records in both phases; no production data changes.
await page.route('**/api/branches/pilot/students?**', async route => {
    const response = await route.fetch(); const data = await response.json();
    data.items = data.items.map(row => row.id === 'student-meera' ? { ...row, phone: null } : row);
    if (new URL(page.url()).searchParams.get('scenario') === 'card-long') data.items = data.items.map(row => row.id === 'student-nisha' ? { ...row,
        name: 'सिंथेटिक छात्रा आराध्या शर्मा बहुत लंबा छात्र नाम', seatAllocations: [...row.seatAllocations, { ...row.seatAllocations[0], id: 'synthetic-extra-allocation', seat: { id: 'seat-a1', label: 'A1' }, shift: { ...row.seatAllocations[0].shift, name: 'Morning extended study session' } }] } : row);
    await route.fulfill({ response, json: data });
});
async function open(query = '') {
    const params = new URLSearchParams({ mode: 'after', lang: 'en' });
    for (const [key, value] of new URLSearchParams(query.replace(/^&/, ''))) params.set(key, value);
    await page.goto(`http://127.0.0.1:4187/branch/pilot/students?${params}`);
    await expect(page.locator('[data-record-list] [aria-busy="true"]')).toHaveCount(0);
    await expect(page.locator('p:visible').filter({ hasText: /^Aarav Mehta$/ }).first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
}
async function rosterShot(name) {
    const grid = page.locator('.ui-record-results > div:visible > .grid').first();
    await expect(grid.locator(':scope > div')).toHaveCount(3);
    await grid.screenshot({ path: `${output}/${name}.png` });
    return grid.locator(':scope > div').evaluateAll(rows => rows.map(row => ({ name: row.querySelector('.ui-record-card-name')?.textContent ?? row.innerText.split('\n')[1], height: row.getBoundingClientRect().height })));
}
await open(); const cards = await rosterShot('roster-en-390');
await page.setViewportSize({ width: 1491, height: 1055 }); await open();
await page.locator('.ui-table--compact').screenshot({ path: `${output}/desktop-table.png` });
// Dashboard logic/CSS is unchanged. Freeze/check one full native frame only.
await page.setViewportSize({ width: 1491, height: 1076 });
await page.goto('http://127.0.0.1:4187/branch/pilot?mode=after&lang=en');
await expect(page.locator('.rd-priorities article')).toHaveCount(5);
await page.evaluate(async () => { await document.fonts.ready; await Promise.all(Array.from(document.images).map(img => img.decode().catch(() => {}))); });
await page.screenshot({ path: `${output}/dashboard.png`, clip: { x: 0, y: 21, width: 1491, height: 1055 } });
if (phase === 'after') {
    for (const lang of ['en', 'hi', 'hinglish']) for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 2000 }); await open(`&lang=${lang}`);
        await rosterShot(`roster-${lang}-${width}`);
    }
    await page.setViewportSize({ width: 320, height: 2200 }); await open('&lang=hi&scenario=card-long'); await rosterShot('long-multiple-hi-320');
    await page.setViewportSize({ width: 390, height: 844 }); await open();
    await page.locator('button[aria-label="Actions"]:visible').first().click(); await page.getByRole('menuitem', { name: /Edit Details/ }).click();
    const edit = page.getByRole('dialog'); await edit.getByLabel('Full Name *').fill('Aarav review draft');
    await page.screenshot({ path: `${output}/edit-en-390.png`, animations: 'disabled' });
    await edit.getByLabel('Interface language', { exact: true }).selectOption('hi');
    await expect(edit.locator('#edit-student-name')).toHaveValue('Aarav review draft');
    await page.screenshot({ path: `${output}/edit-hi-390.png`, animations: 'disabled' });
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 1491, height: 1055 }); await open();
    await page.locator('button[aria-label="Actions"]:visible').first().click(); await page.getByRole('menuitem', { name: /Edit Details/ }).click();
    await page.getByRole('dialog').getByLabel('Full Name *').fill('Aarav review draft');
    await page.screenshot({ path: `${output}/edit-en-desktop.png`, animations: 'disabled' });
    await page.goto('http://127.0.0.1:4187/branch/pilot/gallery?mode=after&lang=en');
    await page.setViewportSize({ width: 390, height: 2000 }); await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('[data-student-record-card]').first()).toBeVisible();
    await page.screenshot({ path: `${output}/gallery-390.png` });
}
await browser.close();
fs.writeFileSync(`${output}/measurements.json`, JSON.stringify({ phase, viewport: { width: 390, height: 2000, scale: 1 }, cards, errors }, null, 2));
if (errors.length) throw new Error(JSON.stringify(errors));
console.log(`${phase}: same three cards, desktop table and native dashboard captured; no page errors`);
