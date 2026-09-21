import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ContactPage from "@/app/contact/page";
import RefundPolicyPage from "@/app/refund-policy/page";
import ShippingDeliveryPolicyPage from "@/app/shipping-delivery-policy/page";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { siteConfig } from "@/lib/site";

vi.mock("@clerk/nextjs", () => ({ useUser: () => ({ isLoaded: true, isSignedIn: false }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/" }));
// Next compiles font imports during its build; this server-markup test needs only the CSS variable.
vi.mock("next/font/google", () => ({ Playfair_Display: () => ({ variable: "public-display-font" }) }));

describe("Razorpay public review pages", () => {
  it("renders concrete cancellation and refund terms", () => {
    const html = renderToStaticMarkup(<RefundPolicyPage />);

    expect(html).toContain("Cancellation and Refund Policy");
    expect(html).toContain("7 calendar days");
    expect(html).toContain("business days after approval");
    expect(html).toContain("end of the current paid billing period");
  });

  it("renders digital delivery timing and delayed-activation instructions", () => {
    const html = renderToStaticMarkup(<ShippingDeliveryPolicyPage />);

    expect(html).toContain("do not sell or ship physical products");
    expect(html).toContain("up to 15 minutes");
    expect(html).toContain("Razorpay payment ID");
  });

  it("renders public business contact details", () => {
    const html = renderToStaticMarkup(<ContactPage />);

    expect(html).toMatch(/Let(?:&#x27;|’|')s talk about your library\./);
    expect(html).toContain(siteConfig.supportEmail);
    expect(html).toContain(siteConfig.businessAddress);
    expect(html).toContain(`href="mailto:${siteConfig.supportEmail}"`);
  });

  it("links every required policy from the public footer", () => {
    const html = renderToStaticMarkup(<LandingFooter />);

    for (const path of ["/privacy", "/terms", "/refund-policy", "/shipping-delivery-policy", "/contact", "/cookies", "/support"]) {
      expect(html).toContain(`href="${path}"`);
    }
  });

  it("indexes and allows the public review routes", () => {
    const sitemapUrls = sitemap().map(entry => entry.url);
    const publicPaths = ["/features", "/pricing", "/refund-policy", "/shipping-delivery-policy", "/contact"];
    const rules = robots().rules;
    const publicRule = Array.isArray(rules) ? rules.find(rule => rule.userAgent === "*") : rules;
    expect(publicRule?.allow).toContain("/");
    const disallowed = typeof publicRule?.disallow === "string" ? [publicRule.disallow] : publicRule?.disallow ?? [];

    for (const path of publicPaths) {
      expect(sitemapUrls.some(url => url.endsWith(path))).toBe(true);
      expect(disallowed.some(prefix => path.startsWith(prefix)), `${path} is crawlable`).toBe(false);
    }
  });
});
