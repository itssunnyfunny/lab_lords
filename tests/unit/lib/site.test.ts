import { describe, expect, it } from "vitest";
import { absoluteUrl, siteConfig } from "@/lib/site";

describe("site SEO configuration", () => {
  it("keeps the homepage search metadata focused on self-study libraries", () => {
    expect(siteConfig.homeTitle).toBe("Lab Lords — Study Hall & Library Management Software");
    expect(siteConfig.description).toBe(
      "Manage seats, shifts, students, fees, dues, staff, and branches for self-study libraries, study halls, reading rooms, and study rooms in India.",
    );
    expect(absoluteUrl("/")).toBe("https://lablords.in/");
  });
});
