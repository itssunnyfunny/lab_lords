import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const directory = path.resolve('docs/redesign/student-card-evidence');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 3030, height: 1400 }, deviceScaleFactor: 1 });
const measurements = [];
for (const key of ['roster-en-390', 'desktop-table', 'dashboard']) {
    const sources = ['before', 'after'].map(phase => `data:image/png;base64,${fs.readFileSync(path.join(directory, phase, `${key}.png`)).toString('base64')}`);
    const result = await page.evaluate(async sources => {
        const pictures = await Promise.all(sources.map(src => new Promise(resolve => { const picture = new Image(); picture.onload = () => resolve(picture); picture.src = src; })));
        const sizes = pictures.map(picture => ({ width: picture.width, height: picture.height }));
        const sameSize = sizes[0].width === sizes[1].width && sizes[0].height === sizes[1].height;
        if (!sameSize) return { sizes, sameSize, differingPixels: null };
        const arrays = pictures.map(picture => { const canvas = document.createElement('canvas'); canvas.width = picture.width; canvas.height = picture.height; const ctx = canvas.getContext('2d'); ctx.drawImage(picture, 0, 0); return ctx.getImageData(0, 0, canvas.width, canvas.height).data; });
        let differingPixels = 0;
        for (let i = 0; i < arrays[0].length; i += 4) if ([0, 1, 2, 3].some(c => arrays[0][i + c] !== arrays[1][i + c])) differingPixels++;
        return { sizes, sameSize, differingPixels };
    }, sources);
    measurements.push({ key, ...result });
    await page.setContent(`<style>body{margin:0;background:#f4f8f2;color:#183e30;font:14px Arial}.pair{display:flex;gap:16px;padding:16px;width:max-content}figure{margin:0}figcaption{height:28px}img{display:block}</style><div class="pair"><figure><figcaption>Before · 0c7b80c · same records</figcaption><img src="${sources[0]}"></figure><figure><figcaption>Refined · same width, fonts and scale</figcaption><img src="${sources[1]}"></figure></div>`);
    await page.locator('.pair').screenshot({ path: path.join(directory, `compare-${key}.png`) });
}
fs.writeFileSync(path.join(directory, 'comparison.json'), JSON.stringify(measurements, null, 2));
await browser.close(); console.log(JSON.stringify(measurements));
if (measurements.filter(item => item.key !== 'roster-en-390').some(item => !item.sameSize || item.differingPixels)) throw new Error('Selected dashboard or desktop table drifted; keep the baseline and investigate.');
