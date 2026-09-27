import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const output = path.resolve('docs/redesign/reference-dashboard-evidence');
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:1491,height:1076},deviceScaleFactor:1,locale:'en-IN',timezoneId:'Asia/Kolkata'});
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('http://127.0.0.1:4187/branch/pilot?mode=after&lang=en', {waitUntil:'domcontentloaded',timeout:90000});
await page.locator('.rd-priorities article').first().waitFor();
await page.evaluate(() => document.fonts.ready);
await page.screenshot({path:path.join(output,'desktop-with-label.png')});
const ribbon = await page.getByTestId('synthetic-pilot-label').boundingBox();
await page.screenshot({path:path.join(output,'desktop.png'),clip:{x:0,y:ribbon?.height??0,width:1491,height:1055}});
const regions = {};
for (const [key, selector] of Object.entries({header:'.rd-heading',actions:'.rd-action-center',metrics:'.rd-metrics',collections:'.rd-collections',seating:'.rd-seating',activity:'.rd-activity',quick:'.rd-quick',worklists:'.rd-worklists'})) {
    regions[key] = await page.locator(selector).boundingBox();
}
for (const [key, selector] of Object.entries({header:'.rd-heading',actions:'.rd-action-center',metrics:'.rd-metrics',collections:'.rd-collections',seating:'.rd-seating',activity:'.rd-activity',quick:'.rd-quick',worklists:'.rd-worklists'})) await page.locator(selector).screenshot({path:path.join(output,`${key}.png`)});
const fonts = await page.evaluate(() => ({loaded:Array.from(document.fonts).filter(f=>f.status==='loaded').map(f=>f.family),head:getComputedStyle(document.querySelector('h1')).fontFamily,body:getComputedStyle(document.querySelector('.reference-dashboard')).fontFamily,script:getComputedStyle(document.querySelector('.rd-heading blockquote')).fontFamily}));
fs.writeFileSync(path.join(output,'desktop-measurements.json'), JSON.stringify({width:1491,height:1055,ribbon: ribbon?.height,regions,fonts,errors},null,2));
console.log(JSON.stringify({errors,fonts,regions}));
console.log(await page.evaluate(() => Object.fromEntries(['.rd-heading-aside','.rd-heading blockquote','.rd-primary-actions','.rd-collections > .rd-panel-heading','.rd-chart-top','.rd-chart-summary','.rd-chart-details','.rd-worklists .rd-panel-heading','.rd-worklists table','.rd-worklists th','.rd-worklists td','.rd-worklists tbody'].map(s => {const e=document.querySelector(s);const c=getComputedStyle(e);return [s,{height:e.getBoundingClientRect().height,font:c.font,lineHeight:c.lineHeight,padding:c.padding,margin:c.margin}]}))));
await browser.close();
