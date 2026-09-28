import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const directory = path.resolve('docs/redesign/reference-dashboard-evidence');
const original = process.argv[2];
if (!original || !fs.existsSync(original)) throw new Error('Pass the original dashboard PNG path.');
fs.copyFileSync(original, path.join(directory,'original.png'));
const meta = JSON.parse(fs.readFileSync(path.join(directory,'desktop-measurements.json'),'utf8'));
const regions = {
    header:{x:247,y:75,width:1222,height:126}, actions:{x:247,y:214,width:1222,height:190}, metrics:{x:247,y:415,width:1222,height:106},
    collections:{x:247,y:532,width:556,height:323}, seating:{x:813,y:532,width:367,height:323}, activity:{x:1190,y:532,width:279,height:259},
    quick:{x:1190,y:799,width:279,height:241}, worklists:{x:247,y:865,width:932,height:179},
};
const img = name => `data:image/png;base64,${fs.readFileSync(path.join(directory,name)).toString('base64')}`;
const originals = img('original.png'); const rendered = img('desktop.png');
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:3022,height:1130},deviceScaleFactor:1});
const style = '<style>*{box-sizing:border-box}body{margin:0;background:#e8eee8;font:14px Arial;color:#17392a}.pair{display:flex;gap:16px;padding:16px;width:max-content}figure{margin:0}figcaption{height:28px;font-weight:bold}.crop{position:relative;overflow:hidden;background:white}.crop img{position:absolute;width:1491px;height:1055px;max-width:none}</style>';
const crop = (src, box) => `<div class="crop" style="width:${box.width}px;height:${box.height}px"><img src="${src}" style="left:${-box.x}px;top:${-box.y}px" /></div>`;
await page.setContent(`${style}<div class="pair"><figure><figcaption>Original selected design · 1491 × 1055</figcaption><img src="${originals}" width="1491" height="1055"></figure><figure><figcaption>Implemented application · isolated populated fixture · native scale</figcaption><img src="${rendered}" width="1491" height="1055"></figure></div>`);
await page.locator('.pair').screenshot({path:path.join(directory,'original-versus-rendered.png')});
const comparisons=[];
for (const [key, target] of Object.entries(regions)) {
    const actual={...meta.regions[key],y:meta.regions[key].y-meta.ribbon};
    const html=`${style}<div class="pair"><figure><figcaption>Original · ${key}</figcaption>${crop(originals,target)}</figure><figure><figcaption>Implemented · ${key}</figcaption>${crop(rendered,actual)}</figure></div>`;
    await page.setContent(html);
    await page.locator('.pair').screenshot({path:path.join(directory,`compare-${key}.png`)});
    comparisons.push({key,target,actual});
}
fs.writeFileSync(path.join(directory,'comparison-regions.json'),JSON.stringify({nativeWidth:1491,nativeHeight:1055,ribbonRemoved:meta.ribbon,comparisons},null,2));
fs.writeFileSync(path.join(directory,'review.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lab Lords dashboard comparison</title><style>body{font:15px system-ui;margin:24px;background:#f6f8f2;color:#143e2b}img{max-width:100%;height:auto;border:1px solid #dae4da}nav{display:flex;flex-wrap:wrap;gap:12px;margin:20px 0}figure{margin:20px 0}figcaption{margin-bottom:8px}a{color:#15513b}</style><h1>Original and implemented dashboard</h1><p>The application render uses a labelled isolated synthetic fixture. Both sides were captured at 1491px, 100% zoom, device scale 1. The 21px fixture ribbon is removed from the comparison only. Final acceptance belongs to the owner.</p><nav>${Object.keys(regions).map(key=>`<a href="#${key}">${key}</a>`).join('')}</nav><img src="original-versus-rendered.png" alt="Original and rendered full dashboard, side by side">${Object.keys(regions).map(key=>`<figure id="${key}"><figcaption>${key} · original left, implementation right, same native scale</figcaption><img src="compare-${key}.png" alt="${key} comparison"></figure>`).join('')}</html>`);
await browser.close(); console.log('Saved full and eight component comparisons at native scale.');
