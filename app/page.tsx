import { publicAlternates } from "@/lib/public-i18n/routes";
import { publicStrings } from "@/lib/public-i18n/server";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Building2, Check, Settings2 } from "lucide-react";
import { MarketingShell } from "@/components/landing/MarketingShell";
import { WorkspaceCTA } from "@/components/landing/MarketingActions";
import { LibraryExample } from "@/components/landing/LibraryExample";
import { HomeReferencePreview } from "@/components/landing/HomeReferencePreview";
import { PublicFaqList } from "@/components/landing/PublicFaqList";
import { homeFaqIds } from "@/lib/publicFaqs";
import { PublicProofSection } from "@/components/landing/PublicProofSection";
import { NatureDetail } from "@/components/landing/NatureDetail";
import copy from "@/lib/marketingCopy.json";
import { absoluteUrl, siteConfig } from "@/lib/site";
import { publicOpenGraph, publicTwitter } from "@/lib/publicSocialMetadata";

export const metadata: Metadata = {
  title: { absolute: siteConfig.homeTitle },
  description: siteConfig.description,
  alternates: { canonical: absoluteUrl("/"), languages: publicAlternates("/", absoluteUrl) },
  openGraph: { ...publicOpenGraph, type: "website", title: siteConfig.homeTitle, description: siteConfig.description, url: absoluteUrl("/") },
  twitter: { ...publicTwitter, card: "summary_large_image", title: siteConfig.homeTitle, description: siteConfig.description },
};
const benefitIcons = [BookOpen, Settings2, Building2];

export default async function RootPage() {
  const { t, href: localHref } = await publicStrings();
  return <MarketingShell preservePricingAnchor><div className="marketing-home">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "WebSite", name: siteConfig.name, alternateName: "lablords.in", url: absoluteUrl("/") }).replace(/</g, "\\u003c") }} />
    <HomeReferencePreview />
    <section className="marketing-section marketing-benefits"><div className="marketing-container marketing-benefits-grid"><div><p className="marketing-eyebrow">{t("Why Lab Lords")}</p><h2 className="marketing-title">{t(copy.home.benefits.title)}</h2><p className="marketing-lead">{t(copy.home.benefits.description)}</p><NatureDetail className="benefit-nature" variant="books" /></div><div className="marketing-benefit-list">{copy.home.benefits.items.map((item, index) => { const Icon = benefitIcons[index]; return <div key={item.title}><span><Icon size={22} strokeWidth={1.7} aria-hidden="true" /></span><div><h3>{t(item.title)}</h3><p>{t(item.description)}</p></div></div>; })}</div></div></section>
    <section id="product-tour" className="marketing-section marketing-proof"><div className="marketing-container marketing-proof-grid"><div><p className="marketing-eyebrow">{t("A look inside")}</p><h2 className="marketing-title">{t(copy.home.proof.title)}</h2><p className="marketing-lead">{t(copy.home.proof.description)}</p><p className="marketing-proof-note"><Check size={18} aria-hidden="true" />{t("Choose a view to explore the example.")}</p><Link href={localHref("/features")} className="marketing-text-link">{t("Explore the features")} <ArrowRight size={17} aria-hidden="true" /></Link></div><LibraryExample /></div></section>
    <section id="how-it-works" className="marketing-section"><span id="workflow" className="marketing-anchor" /><div className="marketing-container"><div className="marketing-section-heading"><p className="marketing-eyebrow">{t("Getting started")}</p><h2 className="marketing-title">{t(copy.home.setup.title)}</h2><p className="marketing-lead">{t(copy.home.setup.description)}</p></div><ol className="marketing-steps">{copy.home.setup.steps.map((step, index) => <li key={step.title}><span className="marketing-step-number">0{index + 1}</span><h3>{t(step.title)}</h3><p>{t(step.description)}</p></li>)}</ol><div className="marketing-center-action"><WorkspaceCTA source="landing_setup" label={t(copy.home.setup.primaryLabel)} /></div><p className="marketing-trial-note text-center mt-4">{t(copy.home.setup.trialNote)}</p><p className="marketing-trial-note text-center mt-4">{t("See what to prepare and review.")} <Link href={localHref("/how-it-works")} className="marketing-text-link">{t("Read the setup walkthrough.")}</Link></p></div></section>
    <PublicProofSection />
    <section id="faqs" className="marketing-section"><div className="marketing-container marketing-faq-layout"><div><p className="marketing-eyebrow">{t("Common questions")}</p><h2 className="marketing-title">{t(copy.home.questions.title)}</h2><p className="marketing-lead">{t(copy.home.questions.description)}</p><Link href={localHref("/faq")} className="marketing-text-link">{t("Read all FAQs")} <ArrowRight size={17} aria-hidden="true" /></Link></div><PublicFaqList ids={homeFaqIds} /></div></section>
    <section id="get-started" className="marketing-closing"><div className="marketing-container"><NatureDetail /><p className="marketing-eyebrow">{t("A little more organised, every day")}</p><h2>{t(copy.home.closing.title)}</h2><p>{t(copy.home.closing.description)}</p><div className="marketing-actions"><WorkspaceCTA source="landing_closing" label={t(copy.home.closing.primaryLabel)} /><Link href={localHref(copy.home.closing.secondaryHref)} className="marketing-button-secondary">{t(copy.home.closing.secondaryLabel)} <ArrowRight size={16} aria-hidden="true" /></Link></div><p className="marketing-trial-note">{t(copy.home.closing.trialNote)}</p></div></section>
  </div></MarketingShell>;
}
