import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PublicProofSection } from "@/components/landing/PublicProofSection";
import { approvedPublicProof, type PublicProof } from "@/lib/publicProof";

describe("public customer proof", () => {
  it("ships only the labelled product example while customer evidence is unapproved", () => {
    expect(approvedPublicProof).toEqual({ metrics: [], feedback: [] });
    const html = renderToStaticMarkup(<PublicProofSection />);
    expect(html).toContain("See how it works in your library");
    expect(html).toContain("Sample data");
    expect(html).toContain("Sample receipt summary");
    expect(html).toContain("₹1,200");
    expect(html).toContain("₹700");
    expect(html).toContain("₹500");
    expect(html).toContain('href="/how-it-works"');
    expect(html).not.toMatch(/What library owners say|<blockquote|aggregateRating|reviewCount/);
  });

  it("renders explicit approved public fields instead of the fallback (synthetic test fixture only)", () => {
    const fixture: PublicProof & { privateConsentNote: string } = {
      metrics: [{ id: "test-metric", value: "12", label: "Active customer organisations", definition: "Paid organisations, excluding trials and test accounts", asOf: "20 September 2026" }],
      feedback: [{ id: "test-quote", quote: "A synthetic quote for this test only.", attribution: "Test owner", library: "Test library", logo: { src: "/brand-reference/open-book-leaf.svg", alt: "Test library logo", width: 64, height: 42 } }],
      privateConsentNote: "PRIVATE_TEST_CONTACT_DO_NOT_PUBLISH",
    };
    const html = renderToStaticMarkup(<PublicProofSection proof={fixture} />);
    for (const text of ["What library owners say", "12", "Active customer organisations", "Paid organisations, excluding trials and test accounts", "20 September 2026", "A synthetic quote for this test only.", "Test owner", "Test library logo"]) expect(html).toContain(text);
    expect(html).not.toMatch(/Sample data|See how it works in your library|PRIVATE_TEST_CONTACT|aggregateRating|reviewCount/);
  });

  it("does not promise owner feedback when only an approved metric is supplied", () => {
    const html = renderToStaticMarkup(<PublicProofSection proof={{ metrics: [{ id: "test", value: "2", label: "Paid branches", definition: "Excludes trials", asOf: "20 September 2026" }], feedback: [] }} />);
    expect(html).toContain("Libraries using Lab Lords");
    expect(html).not.toMatch(/What library owners say|<blockquote|Sample data/);
  });
});
