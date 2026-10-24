import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const evidence = path.resolve('docs/audits/evidence-ui-features-2026-10-22');
fs.mkdirSync(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const viewport of [{ width: 1440, height: 1024 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport, locale: 'en-IN', timezoneId: 'Asia/Kolkata' });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    await page.goto('http://127.0.0.1:4187/branch/pilot?mode=after&lang=en');
    await page.getByRole('heading', { name: 'Shanti Study Library', exact: true }).waitFor();
    const shell = await page.evaluate(() => ({
      accountLinks: [...document.querySelectorAll('a[href="/account"]')].length,
      visibleAccountButtons: [...document.querySelectorAll('button')].filter(e => e.checkVisibility() && /Workspace User|Set up profile/.test(e.textContent)).length,
      organizationOptions: [...document.querySelector('[aria-label="Switch organization"]').options].map(e => ({ text: e.text, value: e.value })),
      quickActions: [...document.querySelectorAll('.rd-quick nav a')].map(e => ({ text: e.textContent.trim(), href: e.getAttribute('href') })),
      overflow: document.documentElement.scrollWidth > innerWidth,
    }));
    const searchModel = await page.evaluate(async () => {
      const { buildTopSearchResults } = await import('/@fs/C:/Users/shani yadav/Desktop/lab_lords/lib/topSearch.ts');
      const actions = permissions => buildTopSearchResults({ branchId: 'pilot', query: '', access: { permissions }, limitPerGroup: 50 })
        .flatMap(group => group.results).filter(result => result.type === 'action').map(({ title, href }) => ({ title, href }));
      return {
        owner: actions({ students: true, view_payments: true, manage_branch: true, generate_payments: true, seat_allocation: true, analytics: true }),
        studentsOnly: actions({ students: true }),
      };
    });
    if (viewport.width < 1024) await page.screenshot({ path: path.join(evidence, `header-${viewport.width}.png`), animations: 'disabled' });
    if (viewport.width < 1024) await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
    const navigation = page.getByLabel('Branch navigation', { exact: true });
    await navigation.waitFor({ state: 'visible' });
    const links = await navigation.locator('a').evaluateAll(anchors => anchors.map(e => ({ text: e.textContent.trim(), href: e.getAttribute('href') })));
    await page.screenshot({ path: path.join(evidence, `navigation-${viewport.width}.png`), animations: 'disabled' });
    if (viewport.width < 1024) {
      await navigation.getByRole('link', { name: 'Staff & Permissions', exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(evidence, `navigation-${viewport.width}-bottom.png`), animations: 'disabled' });
    }
    if (viewport.width < 1024) await page.getByRole('button', { name: 'Close navigation', exact: true }).click();
    await page.goto('http://127.0.0.1:4187/branch/pilot/students?mode=after&lang=en');
    await page.getByLabel('Search students by name or phone', { exact: true }).waitFor();
    await page.locator('button[aria-label="Actions"]:visible').first().click();
    const studentActions = await page.getByRole('menuitem').allTextContents();
    await page.route(/\/api\/branches\/pilot\/dashboard\/follow-ups(?:\?.*)?$/, route => route.fulfill({ json: { items: [], counts: { pending: 2, dueToday: 1, completed: 0 }, nextCursor: null } }));
    await page.route(/\/api\/branches\/pilot\/dashboard\/notifications(?:\?.*)?$/, route => route.fulfill({ json: { items: [{ key: 'audit-follow-up', kind: 'FOLLOW_UP', count: 1, href: '/branch/pilot/follow-ups?filter=DUE', read: false, dismissed: false, snoozedUntil: null }], unreadCount: 1 } }));
    await page.goto('http://127.0.0.1:4187/branch/pilot/follow-ups?mode=after&lang=en');
    await page.getByRole('heading', { name: 'Follow-ups', exact: true }).waitFor();
    const followUpStatusBefore = await page.getByRole('combobox', { name: 'Status', exact: true }).innerText();
    await page.getByRole('button', { name: 'Notifications', exact: true }).click();
    await page.getByRole('dialog', { name: 'Notifications', exact: true }).locator('a[href="/branch/pilot/follow-ups?filter=DUE"]').click();
    const followUpNavigation = { before: followUpStatusBefore, url: new URL(page.url()).pathname + new URL(page.url()).search,
      after: await page.getByRole('combobox', { name: 'Status', exact: true }).innerText() };
    results.push({ viewport, shell, searchModel, links, studentActions, followUpNavigation, pageErrors: errors,
      limitation: 'Synthetic component harness; Clerk menu, real authentication, database, provider gates and production deployment are not exercised.' });
    await page.close();
  }
  fs.writeFileSync(path.join(evidence, 'browser-observations.json'), JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify(results.map(r => ({ viewport: r.viewport.width, ...r.shell, navigationLinks: r.links.length, studentActions: r.studentActions, followUpNavigation: r.followUpNavigation, pageErrors: r.pageErrors })), null, 2));
} finally {
  await browser.close();
}
