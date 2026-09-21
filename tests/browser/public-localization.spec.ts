import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { publicLocales, translatedPublicPaths, policyPaths, retiredPublicPaths, publicHref, publicLanguageTags, publicRoute } from "../../lib/public-i18n/routes";
import { publicCatalog } from "../../lib/public-i18n/catalog";
import { messagesFor, publicTranslator } from "../../lib/public-i18n/translate";
import { getBillingSignUpPath } from "../../lib/billingFlow";

async function languageLink(page: Page, name: string) {
  const menu = page.locator(".public-language-menu");
  if (await menu.getAttribute("open") === null) await menu.locator("summary").click();
  return menu.getByRole("link", { name, exact: true });
}

test("all 39 language pages render complete initial HTML with reciprocal metadata and no cache leakage", async ({ page, request }) => {
  test.setTimeout(240_000);
  const titles = new Set<string>();
  for (const basePath of translatedPublicPaths) for (const locale of publicLocales) {
    const path = publicHref(locale, basePath);
    const response = await request.get(path, { headers: { "User-Agent": "Googlebot", "x-lablords-public-language": locale === "en" ? "hi" : "en", "x-lablords-public-path": basePath === "/support" ? "/" : "/support" } });
    expect(response.status(), path).toBe(200);
    const result = await page.evaluate(html => {
      const document = new DOMParser().parseFromString(html, "text/html");
      const content = (selector: string) => document.querySelector(selector)?.getAttribute("content");
      document.querySelectorAll("script,style").forEach(element => element.remove());
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const textNodes: string[] = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode.textContent?.trim().replace(/\s+/g, " ") ?? "");
      return { lang: document.documentElement.lang, title: document.title, text: document.querySelector("main")?.textContent, textNodes,
        links: [...document.querySelectorAll('a[href]')].map(element => element.getAttribute("href")!),
        canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href"),
        description: content('meta[name="description"]'), ogDescription: content('meta[property="og:description"]'), twitterDescription: content('meta[name="twitter:description"]'),
        ogTitle: content('meta[property="og:title"]'), twitterTitle: content('meta[name="twitter:title"]'), siteName: content('meta[property="og:site_name"]'),
        ogUrl: content('meta[property="og:url"]'), image: content('meta[property="og:image"]'), imageAlt: content('meta[property="og:image:alt"]'),
        twitterImage: content('meta[name="twitter:image"]'), twitterImageAlt: content('meta[name="twitter:image:alt"]'),
        languages: Object.fromEntries([...document.querySelectorAll('link[rel="alternate"][hreflang]')].map(element => [element.getAttribute("hreflang"), element.getAttribute("href")])) };
    }, await response.text());
    expect(result.lang, path).toBe(publicLanguageTags[locale]);
    expect(result.text?.length, path).toBeGreaterThan(500);
    if (locale === "hi") expect(result.text).toMatch(/[\u0900-\u097f]/);
    expect(result.text).not.toMatch(/\{(?:plan|count|seat|shift|summary|audiences)\}/);
    if (locale !== "en") {
      const messages = messagesFor(publicCatalog, locale);
      const untranslated = result.textNodes.filter(text => text.length > 12 && messages[text] && messages[text] !== text);
      expect(untranslated, `${path} untranslated visible messages`).toEqual([]);
    }
    for (const href of result.links.filter(href => href.startsWith("/"))) {
      const target = publicRoute(new URL(href, "https://lablords.in").pathname);
      // The three explicit language links are the only cross-language marketing links.
      if (target?.translated && target.locale !== locale) expect(target.path, `${path}: ${href}`).toBe(basePath);
    }
    expect(new URL(result.canonical!).href).toBe(new URL(`https://lablords.in${path}`).href);
    expect(new URL(result.ogUrl!).href).toBe(new URL(result.canonical!).href);
    expect(result.description).toBeTruthy();
    expect(result.ogDescription).toBe(result.description);
    expect(result.twitterDescription).toBe(result.description);
    expect(result.ogTitle).toBeTruthy(); expect(result.twitterTitle).toBe(result.ogTitle);
    expect(result.siteName).toBe("Lab Lords");
    expect(result.title).not.toContain("Lab Lords | Lab Lords");
    expect(titles.has(`${locale}:${result.title}`), path).toBe(false); titles.add(`${locale}:${result.title}`);
    expect(Object.fromEntries(Object.entries(result.languages).map(([lang, url]) => [lang, new URL(url!).href]))).toEqual({ "en-IN": `https://lablords.in${basePath}`, "hi-IN": `https://lablords.in${publicHref("hi", basePath)}`, "hi-Latn-IN": `https://lablords.in${publicHref("hinglish", basePath)}`, "x-default": `https://lablords.in${basePath}` });
    expect(result.image).toBe(`https://lablords.in${locale === "en" ? "/opengraph-image.png" : `/public-social/${locale}.png`}`);
    expect(result.imageAlt).toBe(publicTranslator(messagesFor(publicCatalog, locale))("Lab Lords — A simpler way to manage your library. lablords.in"));
    expect(result.twitterImage).toBe(`https://lablords.in${locale === "en" ? "/twitter-image.png" : `/public-social/${locale}.png`}`);
    expect(result.twitterImageAlt).toBe(result.imageAlt);
  }
  const xml = await (await request.get("/sitemap.xml")).text();
  expect([...xml.matchAll(/<loc>/g)]).toHaveLength(44);
  for (const path of [...policyPaths, ...retiredPublicPaths]) expect(xml).not.toContain(`/hi${path}`);
});

test("unknown localized routes return real 404 responses and policies remain English", async ({ page, request }) => {
  for (const path of ["/en", "/fr/features", "/hi/unknown", "/hinglish/unknown", "/hi/app", "/hi/account", "/hi/api/users/me", "/hi/org/example", "/hi/sign-in", "/hi/sign-up", "/hi/privacy", "/hinglish/cookies", "/hi/software/coaching-management", "/hinglish/software/tuition-management"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(404);
    expect(await response.text()).not.toContain('data-brand="botanical-reference"');
  }
  for (const path of policyPaths) {
    await page.goto(path);
    await expect(page.locator("html")).toHaveAttribute("lang", "en-IN");
    await expect(page.getByText("This policy is available in English.")).toBeVisible();
    await expect(page.locator('link[hreflang]')).toHaveCount(0);
  }
  for (const path of retiredPublicPaths) {
    expect((await request.get(path)).status()).toBe(200);
  }
});

test("language links preserve the page, plan, anchors, browser history and support draft without writes", async ({ page, context }) => {
  const writes: string[] = [];
  page.on("request", request => { if (/^(POST|PATCH|PUT|DELETE)$/.test(request.method()) && new URL(request.url()).pathname.startsWith("/api/")) writes.push(request.url()); });
  await page.goto("/pricing?billingPlan=PRO&email=private#comparison");
  const hindi = await languageLink(page, "हिंदी");
  await expect(hindi).toHaveAttribute("href", "/hi/pricing?billingPlan=PRO#comparison");
  await hindi.focus(); await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/hi\/pricing\?billingPlan=PRO#comparison$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "hi-IN");
  await (await languageLink(page, "Hinglish")).click();
  await expect(page).toHaveURL(/\/hinglish\/pricing\?billingPlan=PRO#comparison$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "hi-Latn-IN");
  await page.goBack(); await expect(page.locator("html")).toHaveAttribute("lang", "hi-IN");
  await page.goForward(); await expect(page.locator("html")).toHaveAttribute("lang", "hi-Latn-IN");
  const newTab = await context.newPage();
  await newTab.goto((await (await languageLink(page, "English")).getAttribute("href"))!);
  await expect(newTab.locator("html")).toHaveAttribute("lang", "en-IN"); await newTab.close();
  await page.goto("/support");
  await page.getByLabel("Summary", { exact: true }).fill("Private sample {summary}");
  await page.getByLabel("Details", { exact: true }).fill("Original visitor text remains untouched.");
  await page.getByLabel("Contact email", { exact: true }).fill("sample@example.test");
  for (const [name, lang] of [["हिंदी", "hi-IN"], ["Hinglish", "hi-Latn-IN"], ["English", "en-IN"]]) {
    await (await languageLink(page, name)).click();
    await expect(page.locator("html")).toHaveAttribute("lang", lang);
    await expect(page.locator('form input[maxlength="160"]')).toHaveValue("Private sample {summary}");
    await expect(page.locator("form textarea")).toHaveValue("Original visitor text remains untouched.");
    await expect(page.locator('form input[type="email"]')).toHaveValue("sample@example.test");
    expect(page.url()).not.toContain("sample");
  }
  expect(await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, cookie: document.cookie }))).not.toContain("Private sample");
  expect(writes).toEqual([]);
});

for (const locale of publicLocales) {
  const t = publicTranslator(messagesFor(publicCatalog, locale));
  test(`${locale}: home examples, pricing and contact/support remain usable at 320, 390 and desktop`, async ({ page }) => {
    test.setTimeout(180_000);
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const basePath of ["/", "/pricing", "/contact", "/support", "/software/seat-management"]) {
        await page.goto(publicHref(locale, basePath));
        await expect(page.locator("html")).toHaveAttribute("lang", publicLanguageTags[locale]);
        await expect(page.locator("main h1")).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${locale} ${basePath} ${width}`).toBe(true);
        await expect(page.locator(".reference-header .reference-lockup")).toHaveAttribute("href", publicHref(locale, "/"));
        await expect(page.locator('footer a[href="/privacy"]')).toContainText(locale === "en" ? "Privacy Policy" : "English");
      }
    }
    await page.goto(publicHref(locale, "/"));
    const tabs = page.locator("#product-tour [role=tab]");
    await tabs.first().focus(); await page.keyboard.press("End");
    await expect(tabs.last()).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("#product-tour")).toContainText(t("Example amounts only. Recording a fee does not charge a student."));
    for (const amount of ["₹1,200", "₹700", "₹500"]) await expect(page.locator(".public-proof-receipt")).toContainText(amount);
    await page.goto(`${publicHref(locale, "/features")}#imports`);
    await expect.poll(async () => {
      const section = await page.locator("#imports").boundingBox();
      const header = await page.locator(".reference-header").boundingBox();
      return section!.y >= header!.height - 2;
    }).toBe(true);
    await page.reload();
    await expect(page.locator("#imports h2")).toBeInViewport();
    await page.goto(publicHref(locale, "/pricing"));
    for (const amount of ["₹299", "₹499"]) await expect(page.locator("#pricing")).toContainText(amount);
    await expect(page.getByRole("button", { name: t("Choose {plan}", { plan: "Standard" }), exact: true })).toBeVisible();
    await page.goto(publicHref(locale, "/contact"));
    await expect(page.getByRole("link", { name: t("Open email"), exact: true })).toHaveAttribute("href", /^mailto:/);
    await page.goto(publicHref(locale, "/support"));
    await page.locator("form button[type=submit]").click();
    const summary = page.locator('form input[maxlength="160"]');
    await expect(summary).toBeFocused();
    expect(await summary.evaluate(element => (element as HTMLInputElement).validationMessage)).toBe(t("Enter a short summary."));
    for (const basePath of ["/", "/pricing", "/support", "/software/seat-management"]) {
      await page.goto(publicHref(locale, basePath));
      const result = await new AxeBuilder({ page }).include('[data-brand="botanical-reference"]').analyze();
      expect(result.violations.filter(item => ["serious", "critical"].includes(item.impact ?? "")), basePath).toEqual([]);
    }
    expect(errors).toEqual([]);
  });
  test(`${locale}: read-only public content works without JavaScript`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    for (const basePath of translatedPublicPaths) {
      const response = await page.goto(`${test.info().project.use.baseURL}${publicHref(locale, basePath)}`);
      expect(response?.status()).toBe(200);
      await expect(page.locator("main h1")).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("lang", publicLanguageTags[locale]);
    }
    await context.close();
  });
  test(`${locale}: selected plans retain their sign-up continuation`, async ({ page }) => {
    for (const [plan, label] of [["BASIC", "Basic"], ["PRO", "Standard"]] as const) {
      await page.goto(publicHref(locale, "/pricing"));
      const button = page.getByRole("button", { name: t("Choose {plan}", { plan: label }), exact: true });
      await expect(button).toBeEnabled(); await button.click();
      await expect(page).toHaveURL(url => `${url.pathname}${url.search}` === getBillingSignUpPath(plan));
    }
  });
}
