import { renderPublic } from "../helpers/public-render";
import { describe, expect, it, vi } from "vitest";
import About from "@/app/about/page";
import Faq from "@/app/faq/page";
import Setup from "@/app/how-it-works/page";
import Pricing from "@/app/pricing/page";
import Features from "@/app/features/page";
import Home, { metadata as homeMetadata } from "@/app/page";
import Contact from "@/app/contact/page";
import SoftwareRoute, { generateMetadata as softwareMetadata } from "@/app/software/[slug]/page";
import { activeSoftwarePageSlugs, legacySoftwarePageSlugs, softwarePages } from "@/lib/softwarePages";
import copy from "@/lib/marketingCopy.json";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
import { faqGroups, getPublicFaqs, publicFaqs } from "@/lib/publicFaqs";
import { publicBillingPlans } from "@/lib/billingPlans";
import { publicMetadata } from "@/lib/publicMetadata";

vi.mock("@clerk/nextjs", () => ({ useUser: () => ({ isLoaded: true, isSignedIn: false }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/faq", useSearchParams: () => new URLSearchParams() }));
vi.mock("next/font/google", () => ({ Playfair_Display: () => ({ variable: "public-display-font" }) }));


vi.mock("@/lib/public-i18n/server", () => ({ publicStrings: async () => ({ locale: "en", t: (value: string, params?: Record<string, string | number>) => params ? value.replace(/\{(\w+)\}/g, (match, key) => String(params[key] ?? match)) : value, href: (path: string) => path, uiMessages: {} }) }));

describe("complete public marketing journey", () => {
  it("keeps approved hero wording and targets only self-study spaces in active promotion", async () => {
    expect(copy.hero.title).toBe("A simpler way to manage your library.");
    expect(copy.hero.description).toBe("Students, seats, shifts and fees — all in one place. Keep your library organised with an easy-to-use dashboard.");
    expect(copy.hero.primaryLabel).toBe("Start your free trial");
    expect(copy.hero.secondaryLabel).toBe("Explore features");
    for (const Page of [Home, About, Contact, Features, Pricing, Faq, Setup]) {
      expect(await renderPublic(<Page />)).not.toMatch(/coaching|tuition/i);
    }
    for (const slug of activeSoftwarePageSlugs) {
      expect(JSON.stringify(softwarePages[slug])).not.toMatch(/coaching|tuition/i);
    }
    expect(copy.home.questions.items[0].answer).toContain("self-study libraries, study halls, reading rooms and study rooms");
  });
  it("explains released capabilities without promising automated money collection or unattended attendance", async () => {
    const features = await renderPublic(<Features />);
    const home = await renderPublic(<Home />);
    for (const title of ["Receipts", "Attendance", "English, Hindi &amp; Hinglish"]) {
      expect(features).toContain(title);
      expect(home).toContain(title);
    }
    expect(features).toContain("full or partial");
    expect(features).toContain("a follow-up date does not change the fee date");
    expect(getPublicFaqs(["partial-payments"])[0].answer).toContain("does not transfer or verify a bank payment");
    expect(getPublicFaqs(["attendance"])[0].answer).toContain("not unattended self-check-in or identity verification");
    expect(getPublicFaqs(["receipts"])[0].answer).toContain("Historical imported payments do not get a new receipt");
    expect(getPublicFaqs(["language"])[0].answer).toContain("existing AI-written text keep their own language");
  });
  it("keeps older audience URLs useful without advertising them or producing product structured data", async () => {
    const paths = sitemap().map(entry => new URL(entry.url).pathname);
    for (const slug of legacySoftwarePageSlugs) {
      const params = Promise.resolve({ slug });
      const metadata = await softwareMetadata({ params });
      expect(metadata.robots).toEqual({ index: false, follow: true });
      expect(metadata.alternates?.canonical).toBe(`https://lablords.in/software/${slug}`);
      expect(paths).not.toContain(`/software/${slug}`);
      const html = await renderPublic(await SoftwareRoute({ params }));
      expect(html).toContain("This older page is here for visitors with a saved link");
      expect(html).toContain('href="/software/library-management"');
      expect(html).not.toContain("application/ld+json");
    }
  });
  it("renders new explanatory pages without tenant or provider calls", async () => {
    for (const Page of [About, Faq, Setup]) {
      const html = await renderPublic(<Page />);
      expect(html.match(/<h1\b/g)).toHaveLength(1);
      for (const path of ["/features", "/pricing", "/contact", "/support", "/faq", "/about", "/how-it-works"]) expect(html).toContain(`href="${path}"`);
      expect(html).not.toMatch(/aggregateRating|reviewCount|24\/7 support|Message sent|Ticket created/);
    }
  });
  it("keeps every shared answer discoverable in exactly one FAQ group", async () => {
    const ids = faqGroups.flatMap(group => group.ids);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(publicFaqs.map(faq => faq.id).sort());
    for (const answer of getPublicFaqs(ids)) expect(answer.href).toMatch(/^\//);
  });
  it("uses the public billing catalogue in the FAQ and comparison, including Standard's internal PRO identity", async () => {
    const html = await renderPublic(<Pricing />);
    const [answer] = getPublicFaqs(["plans"]);
    for (const plan of publicBillingPlans()) {
      expect(html).toContain(plan.shortName);
      expect(answer.answer).toContain(String(plan.amount));
      expect(html).toContain(`Choose ${plan.shortName}`);
    }
    expect(publicBillingPlans().find(plan => plan.id === "PRO")?.shortName).toBe("Standard");
    expect(html).not.toMatch(/Agent Control|WhatsApp automation|Forever free|Annual discount/);
  });
  it("keeps public additions crawlable and operational routes out of the sitemap", async () => {
    const paths = sitemap().map(entry => new URL(entry.url).pathname);
    expect(paths).toHaveLength(44);
    expect(new Set(paths).size).toBe(44);
    for (const path of ["/about", "/faq", "/how-it-works"]) expect(paths).toContain(path);
    expect(paths.some(path => /^\/(app|org|branch|api|onboarding|sign-in|sign-up)/.test(path))).toBe(false);
    const rules = robots().rules;
    const rule = Array.isArray(rules) ? rules[0] : rules;
    expect(rule.disallow).toEqual(expect.arrayContaining(["/app", "/api", "/branch", "/onboarding", "/org"]));
  });
  it("gives public metadata its own canonical and sharing identity", async () => {
    const metadata = publicMetadata("/faq", "Frequently Asked Questions", "Answers about library work.");
    expect(metadata.alternates?.canonical).toBe("https://lablords.in/faq");
    expect(metadata.openGraph).toMatchObject({ url: "https://lablords.in/faq", title: "Lab Lords Frequently Asked Questions", description: metadata.description });
    expect(metadata.twitter).toMatchObject({ description: metadata.description, images: [expect.objectContaining({ url: "/twitter-image.png", alt: expect.stringContaining("Lab Lords") })] });
    expect(metadata.openGraph).toMatchObject({ siteName: "Lab Lords", images: [expect.objectContaining({ url: "/opengraph-image.png", alt: expect.stringContaining("Lab Lords") })] });
  });
  it("names the website once without review claims and keeps the homepage pricing bookmark meaningful", async () => {
    const html = await renderPublic(<Home />);
    const nodes = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(match => JSON.parse(match[1]));
    expect(nodes).toEqual([{ "@context": "https://schema.org", "@type": "WebSite", name: "Lab Lords", alternateName: "lablords.in", url: "https://lablords.in/" }]);
    expect(html).not.toMatch(/Choose Basic|Choose Standard|Choose what your library needs/);
    expect(html).toContain('<a id="pricing" href="/pricing">Pricing</a>');
    expect(homeMetadata.description).toBe("Manage students, seats, attendance and fees for your self-study library. Keep payments, receipts and upcoming fee dates organised with Lab Lords.");
  });
  it("allows an exact search title without adding a duplicate brand suffix", async () => {
    const metadata = publicMetadata("/how-it-works", "How It Works", "Setup description.", "How Lab Lords Works | Library Setup Guide");
    expect(metadata.title).toEqual({ absolute: "How Lab Lords Works | Library Setup Guide" });
    expect(metadata.openGraph).toMatchObject({ title: "How Lab Lords Works | Library Setup Guide" });
    expect(metadata.twitter).toMatchObject({ title: "How Lab Lords Works | Library Setup Guide" });
  });
});
