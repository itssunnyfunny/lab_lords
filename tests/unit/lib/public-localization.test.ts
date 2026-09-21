import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { publicCatalog } from "@/lib/public-i18n/catalog";
import requiredKeys from "@/lib/public-i18n/required-keys.json";
import { publicUiKeys } from "@/lib/public-i18n/ui-keys";
import { publicLocales, publicLanguageTags, translatedPublicPaths, policyPaths, retiredPublicPaths, publicRoute, publicHref, languageHref, publicAlternates } from "@/lib/public-i18n/routes";
import { messagesFor, publicTranslator } from "@/lib/public-i18n/translate";
import { publicFaqAnswer } from "@/lib/public-i18n/content";
import { publicFaqs } from "@/lib/publicFaqs";
import { publicBillingPlans } from "@/lib/billingPlans";
import { activeSoftwarePageSlugs, softwarePages } from "@/lib/softwarePages";
import { localizedPublicMetadata } from "@/lib/public-i18n/metadata";
import { publicMetadata } from "@/lib/publicMetadata";
import sitemap from "@/app/sitemap";

const catalog: Record<string, readonly string[]> = publicCatalog;
const placeholders = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();

describe("public language contracts", () => {
  it("has complete prepared dictionaries with identical named placeholders", () => {
    expect(Object.keys(catalog).sort()).toEqual([...requiredKeys].sort());
    for (const key of requiredKeys) {
      expect(catalog[key], key).toHaveLength(2);
      for (const value of catalog[key]) {
        expect(value.trim(), key).not.toBe("");
        expect(placeholders(value), key).toEqual(placeholders(key));
      }
    }
    for (const key of publicUiKeys) expect(catalog[key], key).toBeDefined();
  });
  it("requires translations when a rendered source message or active solution changes", () => {
    const files = ["app/page.tsx", ...["features", "pricing", "how-it-works", "about", "faq", "contact", "support"].map(name => `app/${name}/page.tsx`),
      ...fs.readdirSync("components/landing").filter(name => /^(HomeReferencePreview|MarketingShell|LandingFooter|LandingPricing|Public|Library|Botanical|MarketingActions|ReferenceNavbar).*\.tsx$/.test(name)).map(name => `components/landing/${name}`),
      "components/software/SoftwareLandingPage.tsx", "components/feedback/BugReportForm.tsx"];
    for (const file of files) {
      const source = ts.createSourceFile(file, fs.readFileSync(path.resolve(file), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      function visit(node: ts.Node) {
        if (ts.isCallExpression(node) && ["t", "publicRich"].includes(node.expression.getText(source))) {
          const key = node.arguments[node.expression.getText(source) === "t" ? 0 : 1];
          if (key && ts.isStringLiteral(key)) expect(catalog[key.text], `${file}: ${key.text}`).toBeDefined();
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
    for (const slug of activeSoftwarePageSlugs) {
      const page = softwarePages[slug];
      for (const text of [page.shortName, page.metaTitle, page.metaDescription, page.h1, page.eyebrow, page.heroDescription, page.featureTitle, page.featureDescription, page.useCaseTitle, page.useCaseDescription, page.example, page.ctaTitle, page.ctaDescription,
        ...page.audience, ...[...page.heroHighlights, ...page.features, ...page.useCases].flatMap(item => [item.title, item.description]), ...page.faqs.flatMap(item => [item.question, item.answer])]) expect(catalog[text], text).toBeDefined();
    }
    for (const faq of publicFaqs.filter(item => item.id !== "plans")) {
      for (const text of [faq.question, faq.answer, faq.link]) expect(catalog[text], text).toBeDefined();
    }
  });
  it("inserts visitor text once without interpreting braces or markup", () => {
    const t = publicTranslator(messagesFor(publicCatalog, "hi"));
    expect(t("Summary: {summary}", { summary: "Original {summary} <script>" })).toBe("सारांश: Original {summary} <script>");
    expect(t("unexpected readable source")).toBe("unexpected readable source");
  });
  it("keeps commercial values sourced from the catalogue in all languages", () => {
    const faq = publicFaqs.find(item => item.id === "plans")!;
    for (const locale of publicLocales) {
      const answer = publicFaqAnswer(faq, publicTranslator(messagesFor(publicCatalog, locale)));
      for (const plan of publicBillingPlans()) {
        expect(answer).toContain(plan.shortName);
        expect(answer).toContain(String(plan.amount));
      }
      expect(answer).not.toMatch(/\{\w+\}/);
    }
    expect(publicFaqAnswer(faq, publicTranslator())).toBe(faq.answer);
  });
  it("maps exactly the supported pages and never prefixes protected or external destinations", () => {
    expect(translatedPublicPaths).toHaveLength(13);
    for (const locale of publicLocales) for (const path of translatedPublicPaths) {
      const target = publicHref(locale, path);
      expect(publicRoute(target)).toEqual({ locale, path, translated: true });
      expect(publicLanguageTags[locale]).not.toBe("hinglish");
    }
    for (const href of ["/app", "/api/users/me", "/branch/x", "/org/x", "/account", "/onboarding", "/sign-in", "/sign-up?billingPlan=PRO", "/_next/static/x.js", "/.well-known/workflow/v1/flow", "/logo.svg", "mailto:help@example.test", "https://example.test", "//example.test", ...policyPaths, ...retiredPublicPaths]) {
      expect(publicHref("hi", href)).toBe(href);
      expect(publicRoute(`/hi${href}`)).toBeNull();
    }
    for (const path of ["/en", "/fr/pricing", "/HI", "/hi/unknown", "/hi/hi", "/hinglish/api", "/hi//pricing", "/hi/%2e%2e/app"]) expect(publicRoute(path)).toBeNull();
  });
  it("preserves equivalent pages, stable fragments and recognized plan choice without personal or redirect parameters", () => {
    expect(languageHref("hinglish", "/hi/pricing", "?billingPlan=PRO&email=private&redirect=https://evil.test", "#comparison")).toBe("/hinglish/pricing?billingPlan=PRO#comparison");
    expect(languageHref("en", "/hi", "?billingPlan=BASIC", "#pricing")).toBe("/?billingPlan=BASIC#pricing");
    expect(languageHref("hi", "/privacy")).toBeNull();
    expect(languageHref("hi", "/pricing", "?billingPlan=evil", "#private%20data")).toBe("/hi/pricing");
  });
  it("generates reciprocal alternates and a 44-page sitemap without policy or retired translations", () => {
    const urls = sitemap().map(item => item.url);
    expect(urls).toHaveLength(44);
    expect(new Set(urls).size).toBe(44);
    for (const path of translatedPublicPaths) {
      const languages = publicAlternates(path, value => `https://lablords.in${value}`)!;
      expect(Object.keys(languages)).toEqual(["en-IN", "hi-IN", "hi-Latn-IN", "x-default"]);
      for (const value of Object.values(languages)) expect(urls).toContain(value);
      for (const locale of publicLocales) {
        const metadata = localizedPublicMetadata(locale, path, publicMetadata(path, "Features", "A description."));
        expect(metadata.alternates?.languages).toEqual(languages);
        expect(metadata.alternates?.canonical).toBe(`https://lablords.in${publicHref(locale, path)}`);
      }
    }
    for (const path of [...policyPaths, ...retiredPublicPaths]) {
      expect(publicAlternates(path, value => value)).toBeUndefined();
      expect(urls.some(url => url.endsWith(`/hi${path}`) || url.endsWith(`/hinglish${path}`))).toBe(false);
    }
  });
});
