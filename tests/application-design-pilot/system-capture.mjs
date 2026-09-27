import fs from 'node:fs';
import path from 'node:path';
import { chromium, expect } from '@playwright/test';

const phase = process.argv[2];
if (!['before', 'extracted', 'after'].includes(phase)) throw new Error('Choose before, extracted or after');
const output = path.resolve('docs/redesign/shared-system-evidence', phase);
if (phase === 'before' && fs.existsSync(path.join(output, 'measurements.json'))) throw new Error('The frozen baseline already exists');
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1491, height: 1076 }, deviceScaleFactor: 1, locale: 'en-IN', timezoneId: 'Asia/Kolkata' });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
async function open(route, query = '') {
    const params = new URLSearchParams({ mode: 'after', lang: 'en' });
    for (const [key, value] of new URLSearchParams(query)) params.set(key, value);
    await page.goto(`http://127.0.0.1:4187/branch/pilot${route}?${params}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await expect(page.locator(route ? '[data-record-list], main p' : '.rd-priorities article').first()).toBeVisible({ timeout: 60000 });
    await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(Array.from(document.images).map(img => img.decode().catch(() => {})));
    });
}
await open('');
await expect(page.locator('.rd-priorities article')).toHaveCount(5);
const ribbon = await page.getByTestId('synthetic-pilot-label').boundingBox();
await page.screenshot({ path: path.join(output, 'dashboard.png'), clip: { x: 0, y: ribbon.height, width: 1491, height: 1055 } });
const regions = {};
for (const [key, selector] of Object.entries({ header: '.rd-heading', actions: '.rd-action-center', metrics: '.rd-metrics', collections: '.rd-collections', seating: '.rd-seating', activity: '.rd-activity', quick: '.rd-quick', worklists: '.rd-worklists' })) {
    const element = page.locator(selector);
    regions[key] = await element.boundingBox();
    await element.screenshot({ path: path.join(output, `${key}.png`) });
}
const fonts = await page.evaluate(() => ({ loaded: Array.from(document.fonts).filter(font => font.status === 'loaded').map(font => font.family), heading: getComputedStyle(document.querySelector('h1')).fontFamily, body: getComputedStyle(document.querySelector('.reference-dashboard')).fontFamily }));
if (phase !== 'extracted') {
    for (const language of phase === 'before' ? ['en', 'hi'] : ['en', 'hi', 'hinglish']) {
        for (const width of language === 'en' ? [1491, 390] : [1491, 320]) {
            await page.setViewportSize({ width, height: width === 1491 ? 1076 : 844 });
            await open('/students', `&lang=${language}`);
            await expect(page.locator('button[aria-label]:visible').first()).toBeVisible();
            await page.screenshot({ path: path.join(output, `students-${language}-${width}.png`), fullPage: true });
        }
    }
    await page.setViewportSize({ width: 1491, height: 1076 });
    await open('/students');
    await page.locator('button[aria-label="Actions"]:visible').first().click();
    await page.getByRole('menuitem', { name: /Edit Details/ }).click();
    await expect(page.getByRole('dialog', { name: 'Edit student' })).toBeVisible();
    await page.screenshot({ path: path.join(output, 'students-edit.png') });
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.locator('button[aria-label="Actions"]:visible').first().click();
    await page.getByRole('menuitem', { name: /View Fees/ }).click();
    await expect(page.getByText('Payment history', { exact: true })).toBeVisible();
    await page.screenshot({ path: path.join(output, 'students-fees.png') });
}
fs.writeFileSync(path.join(output, 'measurements.json'), JSON.stringify({ phase, fixture: 'isolated production-component harness; fixed September 22 fixture; scale 1', width: 1491, height: 1055, regions, fonts, errors }, null, 2));
await browser.close();
if (errors.length) throw new Error(JSON.stringify(errors));
console.log(`${phase}: captured dashboard, eight component crops${phase === 'extracted' ? '' : ', Students lists and overlays'}; no page errors`);
