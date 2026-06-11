import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AnalyticsProvider } from "@/components/analytics/AnalyticsProvider";

const navigation = vi.hoisted(() => ({
  pathname: "/app",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(),
}));

describe("AnalyticsProvider", () => {
  it.each(["/app", "/branch/branch-1", "/sign-in"])(
    "asks for cookie consent on %s when no choice is stored",
    pathname => {
      navigation.pathname = pathname;

      const html = renderToStaticMarkup(
        <AnalyticsProvider measurementId="G-TEST123" />
      );

      expect(html).toContain('aria-label="Cookie preferences"');
      expect(html).not.toContain("googletagmanager.com");
    }
  );

  it("does not show analytics consent controls when analytics is disabled", () => {
    const html = renderToStaticMarkup(<AnalyticsProvider />);

    expect(html).not.toContain('aria-label="Cookie preferences"');
  });
});
