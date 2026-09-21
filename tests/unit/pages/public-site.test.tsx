import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import About from "@/app/about/page";
import Faq from "@/app/faq/page";
import Setup from "@/app/how-it-works/page";
import Pricing from "@/app/pricing/page";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
import { faqGroups, getPublicFaqs, publicFaqs } from "@/lib/publicFaqs";
import { publicBillingPlans } from "@/lib/billingPlans";
import { publicMetadata } from "@/lib/publicMetadata";

vi.mock("@clerk/nextjs", () => ({ useUser: () => ({ isLoaded: true, isSignedIn: false }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/faq" }));
vi.mock("next/font/google", () => ({ Playfair_Display: () => ({ variable: "public-display-font" }) }));

describe("complete public marketing journey", () => {
  it("renders new explanatory pages without tenant or provider calls", () => {
    for (const Page of [About, Faq, Setup]) {
      const html = renderToStaticMarkup(<Page />);
      expect(html.match(/<h1\b/g)).toHaveLength(1);
      for (const path of ["/features", "/pricing", "/contact", "/support", "/faq", "/about", "/how-it-works"]) expect(html).toContain(`href="${path}"`);
      expect(html).not.toMatch(/aggregateRating|reviewCount|24\/7 support|Message sent|Ticket created/);
    }
  });
  it("keeps every shared answer discoverable in exactly one FAQ group", () => {
    const ids = faqGroups.flatMap(group => group.ids);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(publicFaqs.map(faq => faq.id).sort());
    for (const answer of getPublicFaqs(ids)) expect(answer.href).toMatch(/^\//);
  });
  it("uses the public billing catalogue in the FAQ and comparison, including Standard's internal PRO identity", () => {
    const html = renderToStaticMarkup(<Pricing />);
    const [answer] = getPublicFaqs(["plans"]);
    for (const plan of publicBillingPlans()) {
      expect(html).toContain(plan.shortName);
      expect(answer.answer).toContain(String(plan.amount));
      expect(html).toContain(`Choose ${plan.shortName}`);
    }
    expect(publicBillingPlans().find(plan => plan.id === "PRO")?.shortName).toBe("Standard");
    expect(html).not.toMatch(/Agent Control|WhatsApp automation|Forever free|Annual discount/);
  });
  it("keeps public additions crawlable and operational routes out of the sitemap", () => {
    const paths = sitemap().map(entry => new URL(entry.url).pathname);
    expect(paths).toHaveLength(20);
    expect(new Set(paths).size).toBe(20);
    for (const path of ["/about", "/faq", "/how-it-works"]) expect(paths).toContain(path);
    expect(paths.some(path => /^\/(app|org|branch|api|onboarding|sign-in|sign-up)/.test(path))).toBe(false);
    const rules = robots().rules;
    const rule = Array.isArray(rules) ? rules[0] : rules;
    expect(rule.disallow).toEqual(expect.arrayContaining(["/app", "/api", "/branch", "/onboarding", "/org"]));
  });
  it("gives public metadata its own canonical and sharing identity", () => {
    const metadata = publicMetadata("/faq", "Frequently Asked Questions", "Answers about library work.");
    expect(metadata.alternates?.canonical).toBe("https://lablords.in/faq");
    expect(metadata.openGraph).toMatchObject({ url: "https://lablords.in/faq", title: "Lab Lords Frequently Asked Questions", description: metadata.description });
    expect(metadata.twitter).toMatchObject({ description: metadata.description });
  });
});
