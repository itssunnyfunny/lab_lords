import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { getBillingSignUpPath } from "../../lib/billingFlow";
import marketingCopy from "../../lib/marketingCopy.json" with { type: "json" };
import { getSoftwarePagePath, softwarePageSlugs } from "../../lib/softwarePages";

const homepageSections = [
  "Everything you need for everyday library work.",
  "Less paperwork. More clarity.",
  "Ready in four simple steps.",
  "See how it works in your library",
  "A few things you might be wondering.",
  "Give your library a simpler way to work.",
];

const hasClerkCredentials = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
);

async function hideDevelopmentOverlays(page: Page) {
  await page.waitForTimeout(750);

  const keylessPrompt = page.getByRole("button", { name: "Keyless prompt" });
  if (await keylessPrompt.count()) {
    await keylessPrompt.first().locator("..").evaluate(element => {
      if (element instanceof HTMLElement) element.style.display = "none";
    });
  }

  await page.evaluate(() => {
    const roots: Array<Document | ShadowRoot> = [document];

    while (roots.length > 0) {
      const root = roots.pop();
      if (!root) continue;

      for (const element of root.querySelectorAll("*")) {
        if (element.shadowRoot) roots.push(element.shadowRoot);

        if (element.localName === "nextjs-portal" && element instanceof HTMLElement) {
          element.style.display = "none";
        }

        if (element.textContent?.trim() !== "Configure your application") continue;

        let overlay: Element | null = element;
        while (overlay instanceof HTMLElement) {
          if (getComputedStyle(overlay).position === "fixed") {
            overlay.style.display = "none";
            break;
          }
          overlay = overlay.parentElement;
        }

        if (!overlay && root instanceof ShadowRoot && root.host instanceof HTMLElement) {
          root.host.style.display = "none";
        }
      }
    }
  });
}

test("public landing has no serious or critical accessibility violations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("main")).toBeVisible();
  await hideDevelopmentOverlays(page);
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(violation =>
    violation.impact === "serious" || violation.impact === "critical"
  );
  expect(blocking, blocking.map(item => `${item.id}: ${item.help}`).join("\n")).toEqual([]);
});

test("homepage uses the approved prototype messaging and section progression", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("A simpler way to manage your library.");
  await expect(page.locator(".botanical-hero-description")).toHaveText("Students, seats, shifts and fees — all in one place. Keep your library organised with an easy-to-use dashboard.");
  await expect(page.getByRole("link", { name: "Explore features", exact: true }).first()).toHaveAttribute("href", "/features");

  const headings = await page.getByRole("heading", { level: 2 }).allTextContents();
  let previousIndex = -1;
  for (const title of homepageSections) {
    const index = headings.indexOf(title);
    expect(index, `${title} follows the previous homepage section`).toBeGreaterThan(previousIndex);
    previousIndex = index;
  }
  await expect(page.locator("#features").getByRole("heading", { level: 3 })).toHaveCount(9);
  for (const [title, description] of [
    ["Student management", "Keep student details, seat assignments and fee records together."],
    ["Seats & shifts", "See available seats and assign them to students for the right shift."],
    ["Fees & dues", "Record full or partial payments and check how much each student has left to pay."],
    ["Multiple branches", "Manage your branches from one account, with separate records for each."],
    ["Student imports", "Bring in your existing student list and review the details before adding it."],
    ["Staff access", "Add your team and choose what each person can view or change."],
  ]) {
    await expect(page.locator("#features").getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(page.locator("#features").getByText(description, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: /^Choose (Basic|Standard)$/ })).toHaveCount(0);
  await expect(page.locator("main .marketing-pricing")).toHaveCount(0);
  const proof = page.getByRole("region", { name: "See how it works in your library" });
  await expect(proof.getByText("Sample data", { exact: true })).toBeVisible();
  await expect(proof.getByText("Receipt for the ₹700 recorded payment")).toBeVisible();
  await expect(proof.getByRole("link", { name: "How it works" })).toHaveAttribute("href", "/how-it-works");
});

test("botanical preview loads its headline font and finished illustration assets", async ({ page }) => {
  await page.goto("/");
  const hero = page.locator(".botanical-hero");
  await expect(hero.getByRole("heading", { level: 1 })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);

  const typography = await hero.evaluate(element => {
    const heading = element.querySelector("h1");
    const paragraph = element.querySelector("p");
    return {
      heading: heading ? getComputedStyle(heading).fontFamily : "",
      body: paragraph ? getComputedStyle(paragraph).fontFamily : "",
      loadedFamilies: Array.from(document.fonts)
        .filter(font => font.status === "loaded")
        .map(font => font.family),
    };
  });
  expect(typography.heading).toMatch(/playfair[ _]display/i);
  expect(typography.body).toMatch(/inter/i);
  expect(typography.loadedFamilies.some(family => /playfair[ _]display/i.test(family))).toBe(true);
  expect(typography.loadedFamilies.some(family => /inter/i.test(family))).toBe(true);

  for (const illustration of [
    hero.locator('img[src*="botanical-accent"]').first(),
    page.locator('.reference-header img[src*="open-book-leaf"]'),
  ]) {
    await expect(illustration).toBeVisible();
    await expect.poll(() => illustration.evaluate(element =>
      element instanceof HTMLImageElement && element.complete && element.naturalWidth > 0,
    )).toBe(true);
  }
  await expect(page.locator(".reference-header").getByRole("link", { name: "Lab Lords home", exact: true }))
    .toHaveAttribute("href", "/");
});

test("botanical hero trial action preserves the signed-out keyboard journey", async ({ page }) => {
  test.skip(!hasClerkCredentials, "Clerk credentials are required to verify the signed-out trial journey.");
  await page.goto("/");
  const trial = page.locator(".botanical-hero").getByRole("button", { name: "Start your free trial", exact: true });
  await expect(trial).toBeEnabled();
  await trial.focus();
  await expect(trial).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(url => url.pathname === "/sign-up");
});

test("botanical dashboard keeps sample shifts and seats keyboard accessible without product writes", async ({ page }) => {
  const productWrites: string[] = [];
  page.on("request", request => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method()) &&
      /^\/api\/(?:branches|students|payments|allocations)(?:\/|$)/.test(new URL(request.url()).pathname)) {
      productWrites.push(`${request.method()} ${new URL(request.url()).pathname}`);
    }
  });
  await page.goto("/");
  const sample = page.getByRole("region", { name: "Interactive library dashboard sample" });
  await expect(sample.getByText("Sample data", { exact: true })).toBeVisible();
  const shifts = sample.getByRole("group", { name: "Choose a sample shift" });
  const morning = shifts.getByRole("button", { name: /^Morning/ });
  const afternoon = shifts.getByRole("button", { name: /^Afternoon/ });
  await expect(morning).toHaveAttribute("aria-pressed", "true");
  const seats = sample.getByRole("group", { name: "Morning sample seats" });
  await expect(seats.getByRole("button")).toHaveCount(30);
  await expect(seats.getByRole("button", { name: "Sample seat 1, occupied", exact: true })).toBeDisabled();
  const availableSeat = seats.getByRole("button", { name: "Sample seat 3, available", exact: true });
  await availableSeat.focus();
  await page.keyboard.press("Enter");
  await expect(seats.getByRole("button", { name: "Sample seat 3, selected", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(sample.getByText("Seat 3 selected · morning sample", { exact: true })).toBeVisible();
  await afternoon.focus();
  await page.keyboard.press("Enter");
  await expect(afternoon).toHaveAttribute("aria-pressed", "true");
  await expect(morning).toHaveAttribute("aria-pressed", "false");
  const afternoonSeats = sample.getByRole("group", { name: "Afternoon sample seats" });
  await expect(afternoonSeats.getByRole("button", { name: "Sample seat 3, occupied", exact: true })).toBeDisabled();
  await expect(afternoonSeats.getByRole("button", { pressed: true })).toHaveCount(0);
  await expect(sample.getByText("17 seats available · Try a shift or a seat", { exact: true })).toBeVisible();
  expect(productWrites).toEqual([]);
});

for (const [route, title, description] of [
  ["/features", "Tools for everyday library work.", "From your first student record to your next branch, keep the daily details together."],
  ["/pricing", "Simple plans for your library.", "Start with a 30-day Standard trial. Then choose the plan that fits your everyday work."],
]) {
  test(`${route} stays accessible and reflows on a narrow phone`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(page.getByText(description, { exact: true })).toBeVisible();
    await hideDevelopmentOverlays(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(violation =>
      violation.impact === "serious" || violation.impact === "critical"
    );
    expect(blocking, blocking.map(item => `${item.id}: ${item.help}`).join("\n")).toEqual([]);
  });
}

test("public landing reflows at 320px and browser-style 400% zoom", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/");
  await expect(page.getByRole("main")).toBeVisible();
  await hideDevelopmentOverlays(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => { document.documentElement.style.zoom = "4"; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("public landing visual regression", async ({ page }, testInfo) => {
  const mobile = testInfo.project.name.includes("mobile");
  const width = mobile ? 390 : 1440;
  await page.setViewportSize({ width, height: mobile ? 844 : 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("main")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.getByRole("heading", { level: 1 }).evaluate(element =>
    getComputedStyle(element).fontFamily,
  )).toMatch(/playfair[ _]display/i);
  if (hasClerkCredentials) {
    await expect(page.locator(".botanical-hero").getByRole("button", { name: "Start your free trial", exact: true })).toBeEnabled();
  }
  await hideDevelopmentOverlays(page);
  for (const image of await page.locator(".marketing-root img").all()) {
    if (!await image.isVisible()) continue;
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate(element =>
      element instanceof HTMLImageElement && element.complete && element.naturalWidth > 0,
    )).toBe(true);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page).toHaveScreenshot(`landing-${width}.png`, {
    animations: "disabled",
    fullPage: true,
    timeout: 30_000,
  });
});

test("public pricing exposes only Basic and Standard branch pricing", async ({ page }, testInfo) => {
  await page.goto("/pricing");
  await expect(page.getByText("Basic", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Standard", { exact: true }).first()).toBeVisible();
  await expect(page.locator("#pricing").getByText(/\u20B9299/)).toBeVisible();
  await expect(page.locator("#pricing").getByText(/\u20B9499/)).toBeVisible();
  await expect(page.getByText(/Agent Control/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Choose Basic", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose Standard", exact: true })).toBeVisible();
  for (const capability of [
    "Student records and spreadsheet import",
    "Seats, shifts and allocations",
    "Payments, dues and audit history",
    "Multiple branches, each billed separately",
    "Staff invitations, roles and permission controls",
    "Branch and cross-branch advanced analytics",
    "AI reports and message drafting",
  ]) {
    await expect(page.locator("#pricing").getByText(capability, { exact: false })).toHaveCount(2);
    await expect(page.locator("#comparison").getByRole("rowheader", { name: capability, exact: true })).toBeVisible();
  }
  const basic = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Basic", exact: true }) });
  const standard = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Standard", exact: true }) });
  await expect(basic.getByText("Not included in Basic", { exact: true })).toHaveCount(3);
  await expect(standard.getByText(/Not included/)).toHaveCount(0);
  await expect(page.getByText(/billable branch \/ month/)).toHaveCount(2);
  await page.screenshot({ path: testInfo.outputPath("public-pricing.png"), fullPage: true });
});

for (const route of ["/", "/pricing"]) {
  for (const [label, planId] of [["Choose Basic", "BASIC"], ["Choose Standard", "PRO"]] as const) {
    test(`${route} ${label} preserves the signed-out selected-plan continuation`, async ({ page }) => {
      test.skip(!hasClerkCredentials, "Clerk credentials are required to verify the signed-out plan journey.");
      await page.goto(route);
      if (route === "/") await page.locator("footer").getByRole("link", { name: "Pricing", exact: true }).click();
      const button = page.getByRole("button", { name: label, exact: true });
      await expect(button).toBeEnabled();
      await button.click();
      await expect(page).toHaveURL(url => `${url.pathname}${url.search}` === getBillingSignUpPath(planId));
    });
  }
}

for (const route of ["/privacy", "/terms", "/refund-policy", "/shipping-delivery-policy", "/contact"]) {
  test(`${route} is public and linked from the footer`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator("main")).toBeVisible();
  });
}

test("public footer exposes all required trust links", async ({ page }) => {
  await page.goto("/");
  for (const route of ["/privacy", "/terms", "/refund-policy", "/shipping-delivery-policy", "/contact"]) {
    await expect(page.locator(`footer a[href="${route}"]`)).toBeVisible();
  }
});

test("mobile landing navigation exposes every primary section by keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const disclosure = page.locator("details").filter({ hasText: "Navigation menu" });
  const menuButton = disclosure.locator("summary");
  await expect(disclosure).not.toHaveAttribute("open", "");
  await menuButton.focus();
  await page.keyboard.press("Enter");
  await expect(disclosure).toHaveAttribute("open", "");

  const mobileNavigation = page.getByRole("navigation", { name: "Mobile navigation" });
  for (const [label, href] of [["Features", "/features"], ["Pricing", "/pricing"], ["How it works", "/how-it-works"], ["FAQs", "/faq"], ["Contact us", "/contact"], ["About Lab Lords", "/about"], ["Support", "/support"]]) {
    const link = mobileNavigation.getByRole("link", { name: label, exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", href);
  }

  await mobileNavigation.getByRole("link", { name: "Features", exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(disclosure).not.toHaveAttribute("open", "");
  await expect(menuButton).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(disclosure).toHaveAttribute("open", "");

  await mobileNavigation.getByRole("link", { name: "Features", exact: true }).click();
  await expect(page).toHaveURL(/\/features$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tools for everyday library work.");
});

test("tablet navigation keeps sign-in discoverable", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 1000 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
});

test("example views are labelled, user-controlled and keyboard accessible", async ({ page }) => {
  const productWrites: string[] = [];
  page.on("request", request => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method()) &&
      /^\/api\/(?:branches|students|payments|allocations)(?:\/|$)/.test(new URL(request.url()).pathname)) {
      productWrites.push(`${request.method()} ${new URL(request.url()).pathname}`);
    }
  });
  await page.goto("/");
  const example = page.locator("#product-tour");
  await expect(example.getByText("Sample data", { exact: true }).first()).toBeVisible();
  const students = example.getByRole("tab", { name: "Students", exact: true });
  const seats = example.getByRole("tab", { name: "Seats & shifts", exact: true });
  const fees = example.getByRole("tab", { name: "Fees", exact: true });
  await expect(students).toHaveAttribute("aria-selected", "true");
  await expect(seats).toHaveAttribute("tabindex", "-1");
  await expect(fees).toHaveAttribute("tabindex", "-1");

  const initialContent = await example.getByRole("tabpanel").innerText();
  await students.focus();
  await page.keyboard.press("ArrowRight");
  await expect(seats).toBeFocused();
  await expect(seats).toHaveAttribute("aria-selected", "true");
  await expect(example.getByRole("tabpanel")).not.toHaveText(initialContent);
  await page.keyboard.press("End");
  await expect(fees).toBeFocused();
  await expect(fees).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowRight");
  await expect(students).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(fees).toBeFocused();
  await page.keyboard.press("Home");
  await expect(students).toBeFocused();
  await expect(students).toHaveAttribute("aria-selected", "true");

  await fees.click();
  await expect(fees).toHaveAttribute("aria-selected", "true");
  const panel = example.getByRole("tabpanel");
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute("id", await fees.getAttribute("aria-controls") ?? "");
  await expect(panel).toHaveAttribute("aria-labelledby", await fees.getAttribute("id") ?? "");
  expect(productWrites).toEqual([]);
});

test("reduced motion keeps the complete homepage and example controls available", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await page.locator(".marketing-root").evaluateAll(roots => roots.flatMap(root =>
    root.getAnimations({ subtree: true }).filter(animation => animation.pending || animation.playState === "running"),
  ).length)).toBe(0);
  for (const title of homepageSections) {
    const heading = page.getByRole("heading", { name: title, exact: true });
    await expect(heading).toBeVisible();
    expect(await heading.evaluate(element => {
      for (let current: Element | null = element; current; current = current.parentElement) {
        if (Number(getComputedStyle(current).opacity) === 0) return false;
      }
      return true;
    })).toBe(true);
  }
  const example = page.locator("#product-tour");
  await example.getByRole("tab", { name: "Fees", exact: true }).click();
  await expect(example.getByRole("tabpanel")).toBeVisible();
  await expect(example.getByRole("tab", { name: "Fees", exact: true })).toHaveAttribute("aria-selected", "true");
});

test("homepage questions use the checked copy and open with the keyboard", async ({ page }) => {
  await page.goto("/");
  for (const question of marketingCopy.home.questions.items) {
    const disclosure = page.locator("details").filter({
      has: page.locator("summary", { hasText: question.question }),
    });
    await expect(disclosure).toHaveCount(1);
    const summary = disclosure.locator("summary");
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(disclosure).toHaveAttribute("open", "");
    await expect(disclosure.locator("p")).toContainText(question.answer);
    await expect(disclosure.locator("p")).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(disclosure).not.toHaveAttribute("open", "");
  }
  await expect(page.getByText(/Proposed replacement public copy|Implementation note|verification values|standalone design preview|owner-grade control surface|operational intelligence|model the branch|streamline your ecosystem|unlock growth/i)).toHaveCount(0);
});

test("legacy homepage anchors still lead to the matching content", async ({ page }) => {
  for (const [anchor, title] of [
    ["platform", "Everything you need for everyday library work."],
    ["workflow", "Ready in four simple steps."],
    ["product-tour", "See how Lab Lords works"],
    ["get-started", "Give your library a simpler way to work."],
  ]) {
    await page.goto(`/#${anchor}`);
    await expect(page.locator(`[id="${anchor}"]`)).toHaveCount(1);
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeInViewport();
  }
});

test("the old pricing bookmark reaches the footer Pricing link with keyboard access", async ({ page }) => {
  await page.goto("/#pricing");
  const link = page.locator("#pricing");
  await expect(link).toHaveCount(1);
  await expect(link).toHaveText("Pricing");
  await expect(link).toHaveAttribute("href", "/pricing");
  await expect(link).toBeInViewport();
  await link.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/pricing$/);
  await expect(page.locator("#pricing")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Choose Basic", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose Standard", exact: true })).toBeVisible();
});

test("standalone pages link to the setup walkthrough with working history", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/pricing");
  const setup = page.getByRole("link", { name: "How it works", exact: true }).first();
  await expect(setup).toHaveAttribute("href", "/how-it-works");
  await setup.click();
  await expect(page).toHaveURL(/\/how-it-works$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("From your first branch to everyday work.");
  await expect(page.locator('.reference-desktop-nav a[href="/how-it-works"]')).toHaveAttribute("aria-current", "page");
  await page.goBack();
  await expect(page).toHaveURL(/\/pricing$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/how-it-works$/);
});

test("footer legal links keep mobile-sized touch targets", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  for (const route of ["/privacy", "/terms", "/refund-policy", "/shipping-delivery-policy", "/contact", "/cookies"]) {
    const link = page.locator(`footer a[href="${route}"]`);
    await expect(link).toBeVisible();
    const box = await link.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
});

test("support and software routes expose route-specific metadata", async ({ page }) => {
  await page.goto("/support");
  await expect(page).toHaveTitle("Support | Lab Lords");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/support$/);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "Lab Lords Support");

  await page.goto("/software/seat-management");
  await expect(page).toHaveTitle(/Seat Management Software.*Lab Lords/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/software\/seat-management$/);
});

test("new public pages expose canonical metadata and sitemap entries", async ({ page }) => {
  for (const [route, title] of [["/features", /Features.*Lab Lords/], ["/pricing", /Pricing.*Lab Lords/]] as const) {
    await page.goto(route);
    await expect(page).toHaveTitle(title);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`${route}$`));
  }
  const response = await page.request.get("/sitemap.xml");
  expect(response.ok()).toBe(true);
  const xml = await response.text();
  expect(xml).toMatch(/<loc>[^<]+\/features<\/loc>/);
  expect(xml).toMatch(/<loc>[^<]+\/pricing<\/loc>/);
});

test("application routes still require authentication", async ({ page }) => {
  test.skip(!hasClerkCredentials, "Clerk credentials are required to verify the authentication redirect.");
  await page.goto("/app");
  await expect(page).toHaveURL(/\/sign-in/);
});

for (const route of ["/sign-in", "/sign-up"]) {
  test(`${route} keeps the public botanical design and reflows with Clerk`, async ({ page }, testInfo) => {
    test.skip(!hasClerkCredentials, "Clerk credentials are required to verify the public authentication forms.");
    await page.setViewportSize({ width: 1440, height: 900 });
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    const shell = page.locator("main.botanical-auth");
    await expect(shell).toBeVisible();
    await expect(shell.getByRole("link", { name: "Lab Lords home", exact: true })).toHaveAttribute("href", "/");
    await expect(shell.getByRole("link", { name: "Back to home", exact: true })).toHaveAttribute("href", "/");
    await expect(shell.locator(".cl-rootBox")).toBeVisible();
    await expect(shell.locator(".cl-headerTitle")).toHaveCSS("color", "rgb(23, 60, 50)");
    await expect(shell.locator(".cl-formButtonPrimary")).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(shell.locator(".cl-formButtonPrimary")).toHaveCSS("background-color", "rgb(22, 77, 56)");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await page.evaluate(() => document.fonts.ready);
    expect(await shell.locator(".botanical-auth-story h1").evaluate(element => getComputedStyle(element).fontFamily)).toMatch(/playfair[ _]display/i);
    await hideDevelopmentOverlays(page);
    await page.screenshot({ path: testInfo.outputPath(`${route.slice(1)}-desktop.png`), fullPage: true });
    await page.setViewportSize({ width: 320, height: 720 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await expect(shell.locator(".cl-rootBox")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`${route.slice(1)}-mobile.png`), fullPage: true });
  });
}

const publicBrandRoutes = [
  "/", "/features", "/pricing", "/contact", "/support", "/about", "/faq", "/how-it-works", "/privacy", "/terms",
  "/cookies", "/refund-policy", "/shipping-delivery-policy",
  ...softwarePageSlugs.map(getSoftwarePagePath),
];

test("feature groups keep readable full-width cards on narrow screens", async ({ page }) => {
  await page.goto("/features");
  const groups = page.locator(".public-feature-items");
  await expect(groups).toHaveCount(10);
  await expect(groups.first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  for (const width of [390, 760, 900, 1100]) {
    await page.setViewportSize({ width, height: 900 });
    const layouts = await groups.evaluateAll(elements => elements.map(group => {
      const cards = [...group.children].map(card => card.getBoundingClientRect());
      return cards.length >= 2 && cards.every((card, index) => card.width > 0 && card.height > 0 && (index === 0 || (
        card.top >= cards[index - 1].bottom && Math.abs(card.left - cards[index - 1].left) < 1
      )));
    }));
    expect(layouts, `Every Features group should stack its cards at ${width}px`).toEqual(Array(10).fill(true));
  }
});

for (const route of publicBrandRoutes) {
  test(`${route} shares the botanical public brand and reflows at 320px and 400% zoom`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    const shell = page.locator('[data-brand="botanical-reference"]');
    await expect(shell).toHaveCount(1);
    const typography = await shell.evaluate(element => ({
      forest: getComputedStyle(element).getPropertyValue("--reference-forest").trim().toLowerCase(),
      paper: getComputedStyle(element).getPropertyValue("--reference-paper").trim().toLowerCase(),
      headings: [...element.querySelectorAll("main h1, main h2")]
        .filter(heading => !heading.closest(".botanical-audience"))
        .map(heading => ({ text: heading.textContent, family: getComputedStyle(heading).fontFamily })),
      audienceHeadings: [...element.querySelectorAll(".botanical-audience h2")].map(heading => getComputedStyle(heading).fontFamily),
      controls: [...element.querySelectorAll("button, input, textarea, select")].map(control => getComputedStyle(control).fontFamily),
      body: getComputedStyle(element).fontFamily,
    }));
    expect(typography.forest).toBe("#164d38");
    expect(typography.paper).toBe("#fffbf4");
    expect(typography.body).toMatch(/^"?inter[",]/i);
    for (const family of typography.controls) expect(family).toMatch(/^"?inter[",]/i);
    expect(typography.headings.length).toBeGreaterThan(0);
    for (const heading of typography.headings) expect(heading.family, heading.text ?? "Public heading").toMatch(/playfair[ _]display/i);
    if (route === "/") expect(typography.audienceHeadings).toHaveLength(4);
    for (const family of typography.audienceHeadings) expect(family).toMatch(/^"?inter[",]/i);

    const logo = page.locator('.reference-header img[src*="open-book-leaf"]');
    await expect(logo).toBeVisible();
    await expect.poll(() => logo.evaluate(element =>
      element instanceof HTMLImageElement && element.complete && element.naturalWidth > 0,
    )).toBe(true);
    await expect(shell.locator(".lucide-crown")).toHaveCount(0);

    await page.setViewportSize({ width: 320, height: 720 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => { document.documentElement.style.zoom = "4"; });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
}
