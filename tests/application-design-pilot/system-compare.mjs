import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
const phase = process.argv[2] || 'after';
if (!['extracted', 'after'].includes(phase)) throw new Error('Choose extracted or after');
const directory = path.resolve('docs/redesign/shared-system-evidence');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 3030, height: 1200 }, deviceScaleFactor: 1 });
const keys = ['dashboard', 'header', 'actions', 'metrics', 'collections', 'seating', 'activity', 'quick', 'worklists'];
const measurements = [];
for (const key of keys) {
    const images = ['before', phase].map(part => `data:image/png;base64,${fs.readFileSync(path.join(directory, part, `${key}.png`)).toString('base64')}`);
    const result = await page.evaluate(async sources => {
        const images = await Promise.all(sources.map(src => new Promise(resolve => { const image = new Image(); image.onload = () => resolve(image); image.src = src; })));
        const arrays = images.map(image => { const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height; const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0); return ctx.getImageData(0, 0, canvas.width, canvas.height).data; });
        let pixels = 0;
        if (arrays[0].length !== arrays[1].length) return { sameSize: false, differingPixels: null };
        for (let i = 0; i < arrays[0].length; i += 4) if ([0, 1, 2, 3].some(c => arrays[0][i + c] !== arrays[1][i + c])) pixels++;
        return { sameSize: images[0].width === images[1].width && images[0].height === images[1].height, differingPixels: pixels, totalPixels: arrays[0].length / 4 };
    }, images);
    measurements.push({ key, ...result });
    await page.setContent(`<style>body{margin:0;background:#f4f8f2;color:#183e30;font:14px Arial}.pair{display:flex;gap:16px;padding:16px;width:max-content}figure{margin:0}figcaption{height:28px}img{display:block}</style><div class="pair"><figure><figcaption>Frozen selected implementation · before</figcaption><img src="${images[0]}"></figure><figure><figcaption>${phase} · same fixture, fonts and native scale</figcaption><img src="${images[1]}"></figure></div>`);
    await page.locator('.pair').screenshot({ path: path.join(directory, `compare-${phase}-${key}.png`) });
}
fs.writeFileSync(path.join(directory, `comparison-${phase}.json`), JSON.stringify(measurements, null, 2));
await browser.close();
console.log(JSON.stringify(measurements));
if (measurements.some(item => !item.sameSize || item.differingPixels)) throw new Error('Dashboard drift must be investigated; do not replace the frozen baseline.');
