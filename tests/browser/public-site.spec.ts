import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { getSoftwarePagePath, softwarePageSlugs } from "../../lib/softwarePages";
import { publicRoute } from "../../lib/public-i18n/routes";

const publicRoutes = ["/", "/features", "/pricing", "/about", "/faq", "/how-it-works", "/contact", "/support", "/privacy", "/terms", "/refund-policy", "/shipping-delivery-policy", "/cookies", ...softwarePageSlugs.map(getSoftwarePagePath)];

test("library audience and released features stay clear while old audience bookmarks remain useful", async ({ page }) => {
  await page.goto("/");
  const audience = page.getByRole("region", { name: "Who Lab Lords is for" });
  for (const name of ["Self-study libraries", "Study halls", "Reading rooms", "Study rooms"]) await expect(audience.getByRole("heading", { name, exact: true })).toBeVisible();
  for (const name of ["Receipts", "Attendance", "English, Hindi & Hinglish"]) await expect(page.locator("#features").getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(page.locator('footer a[href*="coaching"], footer a[href*="tuition"]')).toHaveCount(0);
  for (const slug of ["coaching-management", "tuition-management"]) {
    const response = await page.goto(`/software/${slug}`);
    expect(response?.status()).toBe(200);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
    await expect(page.getByText("This older page is here", { exact: false })).toBeVisible();
    await expect(page.getByRole("link", { name: "Explore library management", exact: true })).toHaveAttribute("href", "/software/library-management");
  }
});

test("every public destination has unique metadata, valid fragments and no runtime errors", async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const titles = new Set<string>();
  const descriptions = new Set<string>();
  const internalLinks = new Set<string>();
  const idsByPath = new Map<string, Set<string>>();
  for (const route of publicRoutes) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);
    await expect(page.locator("main h1")).toHaveCount(1);
    const canonical = new URL((await page.locator('link[rel="canonical"]').getAttribute("href"))!);
    expect(canonical.origin).toBe("https://lablords.in");
    expect(canonical.pathname).toBe(route);
    const title = await page.title();
    const description = await page.locator('meta[name="description"]').getAttribute("content");
    const expectedTitles: Record<string, string> = {
      "/": "Lab Lords — Library & Study Hall Management Software",
      "/features": "Library Management Features | Lab Lords",
      "/pricing": "Plans & Pricing | Lab Lords",
      "/how-it-works": "How Lab Lords Works | Library Setup Guide",
      "/contact": "Contact Us | Lab Lords",
    };
    if (expectedTitles[route]) expect(title).toBe(expectedTitles[route]);
    expect(title).not.toContain("Lab Lords | Lab Lords");
    expect(titles.has(title), route).toBe(false); titles.add(title);
    expect(descriptions.has(description!), route).toBe(false); descriptions.add(description!);
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute("content", description!);
    await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute("content", description!);
    await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute("content", "Lab Lords");
    const ogUrl = new URL((await page.locator('meta[property="og:url"]').getAttribute("content"))!);
    expect(ogUrl.origin).toBe(canonical.origin);
    expect(ogUrl.pathname).toBe(route);
    for (const selector of ['meta[property="og:image"]', 'meta[name="twitter:image"]']) {
      await expect(page.locator(selector)).toHaveAttribute("content", /^https:\/\/lablords\.in\/(opengraph|twitter)-image\.png/);
    }
    for (const selector of ['meta[property="og:image:alt"]', 'meta[name="twitter:image:alt"]']) {
      await expect(page.locator(selector)).toHaveAttribute("content", /Lab Lords — A simpler way to manage your library\. lablords\.in/);
    }
    if (!route.match(/coaching|tuition/)) expect(`${title} ${description}`).not.toMatch(/coaching|tuition|education centres/i);
    for (const lockup of [page.locator(".reference-header .reference-lockup").first(), page.locator("footer .reference-lockup")]) {
      await expect(lockup).toHaveText("Lab Lords");
      await expect(lockup).toHaveAccessibleName("Lab Lords home");
    }
    const builtResponse = await page.request.get(route, { headers: { "User-Agent": "Googlebot" } });
    expect(builtResponse.ok()).toBe(true);
    const builtHead = await page.evaluate(html => {
      const head = new DOMParser().parseFromString(html, "text/html").head;
      const selectors = ['title', 'meta[name="description"]', 'link[rel="canonical"]', 'meta[property="og:url"]', 'meta[property="og:site_name"]', 'meta[property="og:image"]', 'meta[property="og:image:alt"]', 'meta[name="twitter:image"]', 'meta[name="twitter:image:alt"]'];
      return selectors.map(selector => { const el = head.querySelector(selector); return el?.getAttribute("content") ?? el?.getAttribute("href") ?? el?.textContent ?? null; });
    }, await builtResponse.text());
    expect(builtHead[0]).toBe(title);
    expect(builtHead[1]).toBe(description);
    expect(new URL(builtHead[2]!).href).toBe(canonical.href);
    expect(builtHead.every(value => Boolean(value)), `${route} built HTML head`).toBe(true);
    const document = await page.evaluate(() => ({ ids: [...window.document.querySelectorAll('[id]')].map(x => x.id), hrefs: [...window.document.querySelectorAll('a[href]')].map(x => x.getAttribute('href')!) }));
    idsByPath.set(route, new Set(document.ids));
    for (const href of document.hrefs) if (href.startsWith("/") || href.startsWith("#")) internalLinks.add(href.startsWith("#") ? route + href : href);
    expect(await page.locator('main').innerText()).not.toMatch(/Message sent|Ticket created|24\/7 support|guaranteed results/i);
  }
  for (const href of internalLinks) {
    const url = new URL(href, "https://lablords.in");
    const destination = publicRoute(url.pathname);
    expect(destination, `${href} destination`).not.toBeNull();
    expect(publicRoutes, `${href} base destination`).toContain(destination!.path);
    if (url.hash) expect(idsByPath.get(destination!.path)?.has(decodeURIComponent(url.hash.slice(1))), `${href} fragment`).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("homepage site identity and approved public assets are available without review claims", async ({ page }) => {
  await page.goto("/");
  const schema = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(schema.map(text => JSON.parse(text))).toEqual([{ "@context": "https://schema.org", "@type": "WebSite", name: "Lab Lords", alternateName: "lablords.in", url: "https://lablords.in/" }]);
  const favicons = await page.locator('link[rel="icon"]').evaluateAll(links => links.filter(link => new URL((link as HTMLLinkElement).href).pathname === "/favicon.ico").length);
  expect(favicons).toBe(1);
  for (const path of ["/favicon.ico", "/icon.png", "/apple-icon.png", "/opengraph-image.png", "/twitter-image.png", "/brand-reference/open-book-leaf.svg"]) {
    const response = await page.request.get(path);
    expect(response.ok(), path).toBe(true);
    expect(response.headers()["content-type"], path).toMatch(/^image\//);
  }
});

test("desktop Resources works with keyboard, focus, Escape and outside click", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/about");
  const menu = page.locator(".reference-resources");
  await menu.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(menu).toHaveAttribute("open", "");
  await expect(menu.getByRole("link", { name: "About Lab Lords" })).toHaveAttribute("aria-current", "page");
  await page.keyboard.press("Tab");
  await expect(menu.getByRole("link", { name: "About Lab Lords" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).not.toHaveAttribute("open", "");
  await expect(menu.locator("summary")).toBeFocused();
  await menu.locator("summary").click();
  await page.locator("h1").click();
  await expect(menu).not.toHaveAttribute("open", "");
  await menu.locator("summary").click();
  await menu.getByRole("link", { name: "FAQs", exact: true }).click();
  await expect(page).toHaveURL(/\/faq$/);
  await expect(menu).not.toHaveAttribute("open", "");
});

test("FAQ topics and cross-page feature fragments respect the sticky header", async ({ page }) => {
  await page.goto("/faq");
  await page.getByRole("navigation", { name: "FAQ topics" }).getByRole("link", { name: "Setup and imports" }).click();
  await expect(page).toHaveURL(/\/faq#setup$/);
  const question = page.locator("#setup details").filter({ hasText: "Can I check an import" });
  await question.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(question).toHaveAttribute("open", "");
  await question.getByRole("link", { name: "Reviewing imported information" }).click();
  await expect(page).toHaveURL(/\/features#imports$/);
  await expect(page.locator("#imports h2")).toBeInViewport();
  await expect.poll(async () => {
    const section = await page.locator("#imports").boundingBox();
    const header = await page.locator(".reference-header").boundingBox();
    return section!.y >= header!.height - 2;
  }).toBe(true);
  await page.reload();
  await expect(page.locator("#imports h2")).toBeInViewport();
});

test("contact offers email drafts while support validates without sending a real message", async ({ page }) => {
  await page.goto("/contact");
  const email = page.getByRole("link", { name: "Open email", exact: true });
  await expect(email).toHaveAttribute("href", /^mailto:/);
  await expect(page.getByText(/This opens a draft in your email app/)).toBeVisible();
  await page.getByRole("link", { name: "Get support", exact: true }).click();
  const form = page.locator("form").filter({ has: page.getByLabel("Summary", { exact: true }) });
  const writes: string[] = [];
  page.on("request", req => { if (["POST", "PUT"].includes(req.method()) && new URL(req.url()).pathname.startsWith("/api/")) writes.push(req.url()); });
  await form.getByRole("button", { name: "Open email" }).click();
  await expect(form.getByLabel("Summary", { exact: true })).toBeFocused();
  expect(await form.evaluate(el => (el as HTMLFormElement).checkValidity())).toBe(false);
  await form.getByLabel("Summary", { exact: true }).fill("Sample browser issue");
  await form.getByLabel("Details", { exact: true }).fill("A sample description for validation only.");
  await form.getByLabel("Contact email", { exact: true }).fill("invalid-email");
  expect(await form.evaluate(el => (el as HTMLFormElement).checkValidity())).toBe(false);
  await form.getByLabel("Contact email", { exact: true }).fill("owner@example.test");
  expect(await form.evaluate(el => (el as HTMLFormElement).checkValidity())).toBe(true);
  // Valid submission is unit-tested against a fake location object, never a real email client.
  expect(writes).toEqual([]);
  await expect(page.getByText(/This form does not submit a ticket/)).toBeVisible();
});

test("new pages and expanded pricing/contact/support meet accessibility checks", async ({ page }) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const route of ["/", "/about", "/faq", "/how-it-works", "/features", "/pricing", "/contact", "/support"]) {
    await page.goto(route);
    await expect(page.locator("main h1")).toBeVisible();
    const result = await new AxeBuilder({ page }).include('[data-brand="botanical-reference"]').analyze();
    expect(result.violations.filter(item => ["serious", "critical"].includes(item.impact ?? "")), route).toEqual([]);
  }
});
