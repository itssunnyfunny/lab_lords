import { describe, expect, it } from "vitest";
import {
  getSoftwarePagePath,
  softwarePageSlugs,
  softwarePages,
} from "@/lib/softwarePages";

describe("software landing page configuration", () => {
  it("defines the seven requested public software routes", () => {
    expect(softwarePageSlugs).toEqual([
      "study-hall-management",
      "library-management",
      "seat-management",
      "student-fee-management",
      "fee-reminder",
      "coaching-management",
      "tuition-management",
    ]);

    expect(softwarePageSlugs.map(getSoftwarePagePath)).toEqual([
      "/software/study-hall-management",
      "/software/library-management",
      "/software/seat-management",
      "/software/student-fee-management",
      "/software/fee-reminder",
      "/software/coaching-management",
      "/software/tuition-management",
    ]);
  });

  it("keeps metadata, headings, FAQs, and internal links unique and complete", () => {
    const pages = softwarePageSlugs.map(slug => softwarePages[slug]);

    expect(new Set(pages.map(page => page.metaTitle)).size).toBe(pages.length);
    expect(new Set(pages.map(page => page.metaDescription)).size).toBe(pages.length);
    expect(new Set(pages.map(page => page.h1)).size).toBe(pages.length);

    for (const page of pages) {
      expect(page.features).toHaveLength(6);
      expect(page.problems).toHaveLength(3);
      expect(page.useCases).toHaveLength(3);
      expect(page.faqs.length).toBeGreaterThanOrEqual(4);
      expect(page.relatedSlugs).toHaveLength(3);
      expect(page.relatedSlugs).not.toContain(page.slug);
      expect(page.metaDescription.length).toBeGreaterThanOrEqual(100);
      expect(page.metaDescription.length).toBeLessThanOrEqual(170);
    }
  });
});
