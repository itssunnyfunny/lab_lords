import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { config, isProtectedRoute } from "@/proxy";

describe("proxy matcher", () => {
  it.each([
    "https://lablords.in/sitemap.xml",
    "https://lablords.in/robots.txt",
    "https://lablords.in/favicon.ico",
    "https://lablords.in/icon.png",
    "https://lablords.in/apple-icon.png",
    "https://lablords.in/opengraph-image.png",
    "https://lablords.in/twitter-image.png",
    "https://lablords.in/feed.xml",
    "https://lablords.in/security.txt",
    "https://lablords.in/nested/catalog.xml?version=1",
    "https://lablords.in/nested/readme.txt?version=1",
  ])("does not run Clerk for public metadata route %s", url => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
  });

  it.each([
    "https://lablords.in/account",
    "https://lablords.in/account/preferences",
    "https://lablords.in/app",
    "https://lablords.in/app/open",
    "https://lablords.in/branch",
    "https://lablords.in/branch/example",
    "https://lablords.in/branch/example/payments",
    "https://lablords.in/org",
    "https://lablords.in/org/example",
    "https://lablords.in/org/example/settings",
    "https://lablords.in/onboarding",
    "https://lablords.in/invite",
    "https://lablords.in/invite/example-token",
  ])("runs Clerk and requires authentication for private route %s", url => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
    expect(isProtectedRoute(new NextRequest(url))).toBe(true);
  });

  it.each([
    "https://lablords.in/",
    "https://lablords.in/privacy",
    "https://lablords.in/terms",
    "https://lablords.in/cookies",
    "https://lablords.in/support",
  ])("keeps public page %s accessible without authentication", url => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
    expect(isProtectedRoute(new NextRequest(url))).toBe(false);
  });

  it.each([
    "https://lablords.in/api/example",
    "https://lablords.in/api/branches/example",
    "https://lablords.in/trpc/example",
  ])("continues running Clerk for API route %s", url => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
  });
});
