import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppLogo, LogoMark } from "@/components/brand/AppLogo";
import { AccountSidebar } from "@/components/layout/AccountSidebar";

describe("application brand marks", () => {
  it("preserves the legacy mark for existing default callers", () => {
    expect(renderToStaticMarkup(<AppLogo />)).toContain('viewBox="0 0 64 64"');
    expect(renderToStaticMarkup(<LogoMark />)).toContain('viewBox="0 0 64 64"');
  });

  it("uses the natural botanical proportions when explicitly selected", () => {
    const markup = renderToStaticMarkup(<AppLogo markVariant="botanical" />);
    expect(markup).toContain('viewBox="0 0 180 116"');
    expect(markup).toContain("h-9 w-[56px]");
    expect(markup).not.toContain('viewBox="0 0 64 64"');
  });

  it("uses the botanical mark in account navigation", () => {
    const markup = renderToStaticMarkup(<AccountSidebar />);
    expect(markup).toContain('viewBox="0 0 180 116"');
    expect(markup).toContain("h-10 w-[62px]");
  });
});
