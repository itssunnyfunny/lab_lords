import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { installStaffFixture } from '../application-design-pilot/staff-family-fixture.ts';
import { installTasksFixture } from '../application-design-pilot/tasks-family-fixture.ts';
import { installSettingsFixture } from '../application-design-pilot/settings-family-fixture.ts';
import { installSettingsRouteFixture } from '../application-design-pilot/settings-route-closeout-fixture.ts';

const output = path.resolve(process.env.VISUAL_AUDIT_RUN_ROOT ? path.join(process.env.VISUAL_AUDIT_RUN_ROOT, 'sweep') : 'test-results/visual-consistency-sweep-2026-11-07');
fs.mkdirSync(output, { recursive: true });
console.log('Launching audit browser');
const browser = await chromium.launch({channel:'chrome',timeout:20000});
console.log('Audit browser ready');
const routes = [
 ['dashboard','/branch/pilot'], ['students','/branch/pilot/students'],
 ['staff','/branch/pilot/staff'], ['tasks','/branch/pilot/tasks'],
 ['follow-ups','/branch/pilot/follow-ups'], ['renewals','/branch/pilot/renewals'],
 ['overdue','/branch/pilot/overdue'], ['payments','/branch/pilot/payments'],
 ['seats','/branch/pilot/seats'], ['allocations','/branch/pilot/allocations'], ['shifts','/branch/pilot/shifts'],
 ['attendance','/branch/pilot/attendance'], ['reports','/branch/pilot/reports'], ['analytics','/branch/pilot/analytics'],
 ['ai-reports','/branch/pilot/ai/reports'], ['settings','/branch/pilot/settings'],
 ['dashboard-settings','/branch/pilot/dashboard-settings'], ['account','/account'],
 ['account-profile','/account/profile'], ['account-preferences','/account/preferences'],
 ['account-billing','/account/billing?organizationId=org-pilot&branchId=pilot&returnTo=%2Fbranch%2Fpilot'],
 ['organization','/org/org-pilot'], ['org-settings','/org/org-pilot/settings'], ['billing','/org/org-pilot/billing'],
 ['onboarding','/onboarding'], ['invite','/invite/invite-pilot'], ['import','/branch/pilot/onboarding/import'],
 ['basic-overview','/branch/pilot?plan=BASIC&legacy=1'], ['basic-students','/branch/pilot/students?plan=BASIC&legacy=1'],
 ['basic-seats','/branch/pilot/seats?plan=BASIC&legacy=1'], ['basic-fees','/branch/pilot/fees?plan=BASIC&legacy=1'],
 ['basic-setup','/branch/pilot/setup?plan=BASIC&legacy=1'], ['basic-student-detail','/branch/pilot/students/student-aarav?plan=BASIC&legacy=1'],
];
const records=fs.existsSync(path.join(output,'inventory.json'))?JSON.parse(fs.readFileSync(path.join(output,'inventory.json'),'utf8')):[];
for (const width of (process.env.AUDIT_WIDTHS||'1440,834,390,320').split(',').map(Number)) {
 const context = await browser.newContext({viewport:{width,height:width===1440?1024:844},locale:'en-IN',timezoneId:'Asia/Kolkata',isMobile:width<640,hasTouch:width<640,reducedMotion:'reduce'});
 await context.route('**/*', route => new URL(route.request().url()).hostname==='127.0.0.1' ? route.continue() : route.abort());
 for (const [name,route] of routes) {
  if(process.env.AUDIT_ROUTES&&!process.env.AUDIT_ROUTES.split(',').includes(name))continue;
  if(!process.env.AUDIT_ROUTES&&records.some(r=>r.name===name&&r.width===width&&!r.error&&!r.errors?.length&&!r.failedApi?.length&&!r.contrast?.length&&r.scrollWidth<=r.viewport))continue;
  const prior=records.findIndex(r=>r.name===name&&r.width===width);if(prior>=0)records.splice(prior,1);
  const page=await context.newPage(); const errors=[]; const failedApi=[];
  page.on('pageerror',e=>{if(errors.length<10&&!errors.includes(e.stack||e.message))errors.push(e.stack||e.message);});
  page.on('response',r=>{if(r.status()>=400&&r.url().includes('/api/'))failedApi.push({path:new URL(r.url()).pathname,status:r.status()});});
  await installStaffFixture(page); await installTasksFixture(page); await installSettingsFixture(page); await installSettingsRouteFixture(page);
  // This isolated visual sweep uses the provider-disabled WhatsApp state.
  // Explicit GET fixtures prevent missing harness endpoints becoming error UI.
  const whatsappDisabled = {
   '**/api/organizations/org-pilot/whatsapp/config': {enabled:false,providerMode:'TEST',appId:null,embeddedSignupConfigId:null,graphApiVersion:null,connectionAvailability:'DISABLED',safeReason:null},
   '**/api/organizations/org-pilot/whatsapp/branch-assignments?**': {enabled:false,canManage:false,operationsUiEnabled:false,serviceNoticesEnabled:false,safeReason:null,assignment:null,availableSenders:[]},
   '**/api/branches/pilot/whatsapp/settings': {branchId:'pilot',enabled:false,automationEnabled:false,automationEnabledAt:null,defaultLanguage:'en_IN',defaultTone:'polite',sendTimeLocal:'10:00',dailyAutomaticMessageLimit:20,maxAutomaticCollectionMessagesPerCycle:3,configurationRevision:1,monthlyBudgetMinor:null,timeZone:'Asia/Kolkata',sender:null,rules:[],templateHealth:[],budget:null,consentCoverage:{activeStudents:0,missingPhone:0,associated:0,optedIn:0,optedOut:0,stale:0,recipientStatusCounts:{}},deliveryHealth:{},deliveryHealthWindowDays:30,lastWebhookReceivedAt:null,lastPlannedAt:null,lastPlannerErrorCode:null},
   '**/api/branches/pilot/whatsapp/report-subscription': {operationsUiEnabled:false,subscription:null},
  };
  for (const [pattern,json] of Object.entries(whatsappDisabled)) await page.route(pattern,r=>r.request().method()==='GET'?r.fulfill({json}):r.abort());
  await page.route('**/api/branches/pilot/shifts',async r=>{const response=await r.fetch();await r.fulfill({response,json:(await response.json()).map(row=>({...row,status:'ACTIVE'}))});});
  await page.route('**/api/branches/pilot/basic-overview',r=>r.fulfill({json:{branchId:'pilot',today:'2026-09-22',activeStudents:3,money:{collectedThisMonth:1900,pendingDues:2400}}}));
  await page.route('**/api/branches/pilot/dashboard/follow-ups**',r=>r.fulfill({json:{items:[{id:'followup-local-1',studentId:'student-aarav',studentName:'Aarav Mehta',phone:'+919876543210',type:'MONTHLY',periodStart:'2026-09-01T00:00:00.000Z',note:'Agreed to call again',outcome:'PROMISED_PAYMENT',nextFollowUpAt:'2026-09-29T00:00:00.000Z',completedAt:null,updatedAt:'2026-09-23T09:00:00.000Z'}],counts:{pending:1,dueToday:1,completed:0},nextCursor:null}}));
  await page.route('**/api/branches/pilot/reports?*',r=>r.fulfill({json:{columns:['Student','Amount','Status'],rows:[['Aarav Mehta',1000,'Due']],count:1,asOf:'2026-09-28T06:00:00.000Z'}}));
  await page.route('**/api/organizations/org-pilot/branches',r=>r.fulfill({json:[{id:'pilot',organizationId:'org-pilot',name:'Shanti Study Library',city:'Indore',defaultFee:1400,_count:{students:3,seats:8,shifts:2}}]}));
  await page.route('**/api/organizations/org-pilot/billing/invoices*',r=>r.fulfill({json:{items:[],nextCursor:null}}));
  await page.route('**/api/branches/pilot/import-sessions',r=>r.fulfill({json:[]}));
  await page.route('**/api/ai/branch/pilot',r=>r.fulfill({json:{report:{healthScore:'MODERATE_RISK',executiveSummary:'Collections need follow-up while available shifts can serve more students.',priorityFocus:'Contact students with overdue dues before planning new capacity.',keyFindings:['Two due periods need review','Open shift capacity remains available'],financialAnalysis:{observation:'Collections are below the current billed amount.',riskLevel:'MODERATE'},utilizationAnalysis:{observation:'Two of sixteen shift slots are used.',riskLevel:'MODERATE'},studentActivityAnalysis:{observation:'Three active students are enrolled.',riskLevel:'LOW'},suggestedActions:[{action:'FOLLOW_UP_OVERDUE_PAYMENTS',reason:'Review the two recorded due periods.'}],generatedAt:'2026-09-28T06:00:00.000Z'},meta:{branchId:'pilot',branchName:'Shanti Study Library',generatedAt:'2026-09-28T06:00:00.000Z'},snapshot:{branchName:'Shanti Study Library',asOf:'2026-09-28T06:00:00.000Z',seats:{total:16,occupied:2,available:14,utilizationPercent:13,shiftBreakdown:[{shiftName:'Morning',used:2,capacity:8,occupancyPercent:25}]},students:{total:3,active:3,inactive:0},payments:{dueCount:2,paidCount:2,overdueCount:2,overdueAmount:2400}},hasPendingChanges:false,risks:{total:1,items:[{type:'OVERDUE_COLLECTIONS',severity:'MEDIUM',explanation:'Two recorded due periods need owner review.'}]}}}));
  const url='http://127.0.0.1:4193'+route+(route.includes('?')?'&':'?')+'mode=after&lang=en';
  try {
   console.log('Opening '+name+' '+width);
   await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
   await page.locator('h1,h2').first().waitFor({timeout:15000});
   await page.waitForTimeout(1200);
   await page.evaluate(()=>Promise.race([document.fonts.ready,new Promise(resolve=>setTimeout(resolve,5000))]));
   const metrics=await page.evaluate(()=>{
    const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none';};
    const inspect=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {tag:e.tagName,text:(e.getAttribute('aria-label')||e.textContent||'').trim().replace(/\s+/g,' ').slice(0,100),class:e.className,font:s.fontFamily,size:s.fontSize,weight:s.fontWeight,lineHeight:s.lineHeight,color:s.color,bg:s.backgroundColor,radius:s.borderRadius,x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)};};
    const controls=[...document.querySelectorAll('button,a[href],input,select,[role="combobox"]')].filter(visible);
    return {viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,htmlLang:document.documentElement.lang,headings:[...document.querySelectorAll('h1,h2,h3')].filter(visible).map(inspect),controls:controls.map(inspect),overflow:[...document.querySelectorAll('main *')].filter(visible).filter(e=>{const r=e.getBoundingClientRect();return r.right>innerWidth+1||r.left< -1;}).slice(0,25).map(inspect),fonts:[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family),bodyText:document.body.innerText.slice(0,5000)};
   });
   let contrast=[];
   if(width===390) {
    const axe=await new AxeBuilder({page}).withRules(['color-contrast']).analyze();
    contrast=axe.violations.flatMap(v=>v.nodes.map(n=>({impact:v.impact,target:n.target,html:n.html,summary:n.failureSummary})));
   }
   await page.screenshot({path:path.join(output,`${name}-${width}.png`),animations:'disabled',fullPage:false});
   records.push({name,width,url,errors,failedApi,...metrics,contrast});
   console.log(JSON.stringify({name,width,overflow:metrics.scrollWidth>metrics.viewport,errors:errors.length,failedApi,contrast:contrast.length,heading:metrics.headings[0]?.text}));
  } catch(error) { records.push({name,width,url,error:String(error),errors,failedApi}); console.log(JSON.stringify({name,width,error:String(error)})); }
  finally { await page.close(); fs.writeFileSync(path.join(output,'inventory.json'),JSON.stringify(records,null,2)); }
 }
 await context.close();
}
await browser.close();

const failures=records.filter(r=>r.error||r.errors?.length||r.failedApi?.length||r.contrast?.length||r.scrollWidth>r.viewport);
const summary={captures:records.length,routes:new Set(records.map(r=>r.name)).size,widths:[...new Set(records.map(r=>r.width))],captureErrors:records.filter(r=>r.error).length,runtimeErrors:records.reduce((n,r)=>n+(r.errors?.length||0),0),failedApiResponses:records.reduce((n,r)=>n+(r.failedApi?.length||0),0),horizontalOverflow:records.filter(r=>r.scrollWidth>r.viewport).length,contrastViolations:records.reduce((n,r)=>n+(r.contrast?.length||0),0),contrastScope:'33 route views at 390px',whatsAppState:'Provider-disabled synthetic fixtures',status:failures.length?'failed':'passed'};
fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary));
if(failures.length)process.exitCode=1;
