import fs from 'node:fs';
import path from 'node:path';
import { chromium, expect } from '@playwright/test';
import { installCompletionImport } from './completion-import-fixture.mjs';
const output=path.resolve(process.env.VISUAL_AUDIT_RUN_ROOT||'test-results/design-completion-2026-11-12/before','workflow');
fs.mkdirSync(output,{recursive:true});
const inventory=[];
const browser=await chromium.launch({channel:'chrome'});
try {
  for(const width of (process.env.AUDIT_WIDTHS||'1440,834,390,320').split(',').map(Number)) {
    const context=await browser.newContext({viewport:{width,height:width===1440?1024:844},reducedMotion:'reduce',locale:'en-IN',timezoneId:'Asia/Kolkata'});
    await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
    const page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await installCompletionImport(page);
    await installCompletionImport(page,'legacy');
    async function shot(name) {
      await page.evaluate(()=>document.fonts.ready);
      await page.screenshot({path:path.join(output,`${name}-${width}.png`),animations:'disabled'});
      const dimensions=await page.evaluate(()=>({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
      inventory.push({name,width,...dimensions,errors:[...errors]});
      fs.writeFileSync(path.join(output,'inventory.json'),JSON.stringify(inventory,null,2));
      console.log(name,width,errors.length);
      expect(errors).toEqual([]);
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.viewport);
    }
    await page.goto('http://127.0.0.1:4193/branch/pilot/onboarding/import/session-guided?mode=after&lang=en');
    await expect(page.getByRole('heading',{name:'Check your students',exact:true})).toBeVisible();
    await expect(page.getByRole('article').filter({hasText:'Anaya Rao'})).toBeVisible();
    await shot('guided-records');
    await page.getByRole('article').filter({hasText:'Anaya Rao'}).getByRole('button',{name:'Confirm joining date',exact:true}).click();
    await expect(page.getByLabel('Joined date',{exact:true})).toBeVisible();
    await shot('guided-field-correction');
    await page.getByRole('tab',{name:'Seat and timings',exact:true}).click();
    await expect(page.getByRole('button',{name:/Morning,/})).toBeVisible();
    await shot('guided-seating-editor');
    await page.getByRole('tab',{name:"This month's fees",exact:true}).click();
    await shot('guided-payment-editor');
    await page.getByRole('button',{name:'Back to student list',exact:true}).last().click();
    if(width<768){await page.getByRole('combobox',{name:'Import step',exact:true}).click();await page.getByRole('option',{name:'Timings',exact:true}).click();} else await page.getByRole('navigation',{name:'Import steps',exact:true}).getByRole('button',{name:'Timings',exact:true}).click();
    await shot('guided-timings');
    if(width<768){await page.getByRole('combobox',{name:'Import step',exact:true}).click();await page.getByRole('option',{name:'Seats and assignments',exact:true}).click();} else await page.getByRole('navigation',{name:'Import steps',exact:true}).getByRole('button',{name:'Seats and assignments',exact:true}).click();
    await shot('guided-assignments');
    if(width<768){await page.getByRole('combobox',{name:'Import step',exact:true}).click();await page.getByRole('option',{name:'Review and import',exact:true}).click();} else await page.getByRole('button',{name:/^Review and save/}).click();
    await expect(page.getByRole('heading',{name:'Check what will be saved',exact:true})).toBeVisible();
    await shot('guided-final-review');
    await page.getByRole('button',{name:'Confirm and save',exact:true}).click();
    await shot('guided-confirmation');
    await page.getByRole('button',{name:'Confirm import',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Your import results',exact:true})).toBeVisible();
    await shot('guided-recovery');
    await page.goto('http://127.0.0.1:4193/branch/pilot/onboarding/import/session-legacy?mode=after&lang=en');
    await expect(width<640?page.getByRole('combobox',{name:'Import step',exact:true}):page.getByRole('navigation',{name:'Import progress',exact:true})).toBeVisible();
    await shot('legacy-review');
    if(width<640){await page.getByRole('combobox',{name:'Import step',exact:true}).click();await page.getByRole('option',{name:/^Rows/}).click();}
    else await page.getByRole('navigation',{name:'Fix import issues',exact:true}).getByRole('button',{name:/Rows/}).click();
    await shot('legacy-rows');
    await context.close();
  }
} finally {await browser.close();}
console.log(JSON.stringify({captures:inventory.length,status:'passed'}));
