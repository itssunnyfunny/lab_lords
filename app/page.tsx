import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Building2, Check, Settings2 } from "lucide-react";
import { MarketingShell } from "@/components/landing/MarketingShell";
import { WorkspaceCTA } from "@/components/landing/MarketingActions";
import { LibraryExample } from "@/components/landing/LibraryExample";
import { HomeReferencePreview } from "@/components/landing/HomeReferencePreview";
import { PublicFaqList } from "@/components/landing/PublicFaqList";
import { homeFaqIds } from "@/lib/publicFaqs";
import { LandingPricing } from "@/components/landing/LandingPricing";
import { NatureDetail } from "@/components/landing/NatureDetail";
import copy from "@/lib/marketingCopy.json";
import { absoluteUrl, siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: siteConfig.homeTitle },
  description: copy.hero.description,
  alternates: { canonical: absoluteUrl("/") },
  openGraph: { title: siteConfig.homeTitle, description: copy.hero.description, url: absoluteUrl("/") },
  twitter: { card: "summary_large_image", title: siteConfig.homeTitle, description: copy.hero.description },
};
const benefitIcons = [BookOpen, Settings2, Building2];

export default function RootPage() {
  return <MarketingShell><div className="marketing-home">
    <HomeReferencePreview />
    <section className="marketing-section marketing-benefits"><div className="marketing-container marketing-benefits-grid"><div><p className="marketing-eyebrow">Why Lab Lords</p><h2 className="marketing-title">{copy.home.benefits.title}</h2><p className="marketing-lead">{copy.home.benefits.description}</p><NatureDetail className="benefit-nature" variant="books" /></div><div className="marketing-benefit-list">{copy.home.benefits.items.map((item, index) => { const Icon = benefitIcons[index]; return <div key={item.title}><span><Icon size={22} strokeWidth={1.7} aria-hidden="true" /></span><div><h3>{item.title}</h3><p>{item.description}</p></div></div>; })}</div></div></section>
    <section id="product-tour" className="marketing-section marketing-proof"><div className="marketing-container marketing-proof-grid"><div><p className="marketing-eyebrow">A look inside</p><h2 className="marketing-title">{copy.home.proof.title}</h2><p className="marketing-lead">{copy.home.proof.description}</p><p className="marketing-proof-note"><Check size={18} aria-hidden="true" />Choose a view to explore the example.</p><Link href="/features" className="marketing-text-link">Explore the features <ArrowRight size={17} aria-hidden="true" /></Link></div><LibraryExample /></div></section>
    <section id="how-it-works" className="marketing-section"><span id="workflow" className="marketing-anchor" /><div className="marketing-container"><div className="marketing-section-heading"><p className="marketing-eyebrow">Getting started</p><h2 className="marketing-title">{copy.home.setup.title}</h2><p className="marketing-lead">{copy.home.setup.description}</p></div><ol className="marketing-steps">{copy.home.setup.steps.map((step, index) => <li key={step.title}><span className="marketing-step-number">0{index + 1}</span><h3>{step.title}</h3><p>{step.description}</p></li>)}</ol><div className="marketing-center-action"><WorkspaceCTA source="landing_setup" label={copy.home.setup.primaryLabel} /></div><p className="marketing-trial-note text-center mt-4">{copy.home.setup.trialNote}</p><p className="marketing-trial-note text-center mt-4">See what to prepare and review. <Link href="/how-it-works" className="marketing-text-link">Read the setup walkthrough.</Link></p></div></section>
    <LandingPricing summary />
    <section id="faqs" className="marketing-section"><div className="marketing-container marketing-faq-layout"><div><p className="marketing-eyebrow">Common questions</p><h2 className="marketing-title">{copy.home.questions.title}</h2><p className="marketing-lead">{copy.home.questions.description}</p><Link href="/faq" className="marketing-text-link">Read all FAQs <ArrowRight size={17} aria-hidden="true" /></Link></div><PublicFaqList ids={homeFaqIds} /></div></section>
    <section id="get-started" className="marketing-closing"><div className="marketing-container"><NatureDetail /><p className="marketing-eyebrow">A little more organised, every day</p><h2>{copy.home.closing.title}</h2><p>{copy.home.closing.description}</p><div className="marketing-actions"><WorkspaceCTA source="landing_closing" label={copy.home.closing.primaryLabel} /><Link href={copy.home.closing.secondaryHref} className="marketing-button-secondary">{copy.home.closing.secondaryLabel} <ArrowRight size={16} aria-hidden="true" /></Link></div><p className="marketing-trial-note">{copy.home.closing.trialNote}</p></div></section>
  </div></MarketingShell>;
}
