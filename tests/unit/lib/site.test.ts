import { describe, expect, it } from "vitest";
import { absoluteUrl, siteConfig } from "@/lib/site";

describe("site SEO configuration", () => {
  it("keeps the homepage search metadata focused on self-study libraries", () => {
    expect(siteConfig.homeTitle).toBe("Lab Lords — Library & Study Hall Management Software");
    expect(siteConfig.description).toBe(
      "Manage students, seats, attendance and fees for your self-study library. Keep payments, receipts and upcoming fee dates organised with Lab Lords.",
    );
    expect(absoluteUrl("/")).toBe("https://lablords.in/");
  });
});
