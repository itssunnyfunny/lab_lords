import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Building2, Check, FileInput, ShieldCheck } from "lucide-react";
import { MarketingShell } from "@/components/landing/MarketingShell";
import { WorkspaceCTA } from "@/components/landing/MarketingActions";
import { LibraryExample } from "@/components/landing/LibraryExample";
import { HomeReferencePreview } from "@/components/landing/HomeReferencePreview";
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
const benefitIcons = [BookOpen, FileInput, Building2, ShieldCheck];

export default function RootPage() {
  return <MarketingShell><div className="marketing-home">
    <HomeReferencePreview />
    <section className="marketing-section marketing-benefits"><div className="marketing-container marketing-benefits-grid"><div><p className="marketing-eyebrow">Made for your library</p><h2 className="marketing-title">{copy.home.benefits.title}</h2><p className="marketing-lead">{copy.home.benefits.description}</p><NatureDetail className="benefit-nature" variant="books" /></div><div className="marketing-benefit-list">{copy.home.benefits.items.map((item, index) => { const Icon = benefitIcons[index]; return <div key={item.title}><span><Icon size={22} strokeWidth={1.7} aria-hidden="true" /></span><div><h3>{item.title}</h3><p>{item.description}</p></div></div>; })}</div></div></section>
    <section id="how-it-works" className="marketing-section"><span id="workflow" className="marketing-anchor" /><div className="marketing-container"><div className="marketing-section-heading"><p className="marketing-eyebrow">A simple start</p><h2 className="marketing-title">{copy.home.setup.title}</h2><p className="marketing-lead">{copy.home.setup.description}</p></div><ol className="marketing-steps">{copy.home.setup.steps.map((step, index) => <li key={step.title}><span className="marketing-step-number">0{index + 1}</span><h3>{step.title}</h3><p>{step.description}</p></li>)}</ol><div className="marketing-center-action"><WorkspaceCTA source="landing_setup" /></div></div></section>
    <section id="product-tour" className="marketing-section marketing-proof"><div className="marketing-container marketing-proof-grid"><div><p className="marketing-eyebrow">A look inside</p><h2 className="marketing-title">{copy.home.proof.title}</h2><p className="marketing-lead">{copy.home.proof.description}</p><p className="marketing-proof-note"><Check size={18} aria-hidden="true" />Choose a view to explore the example.</p><Link href="/features" className="marketing-text-link">Explore the features <ArrowRight size={17} aria-hidden="true" /></Link></div><LibraryExample /></div></section>
    <section className="marketing-section"><div className="marketing-container marketing-faq-layout"><div><p className="marketing-eyebrow">Here to help</p><h2 className="marketing-title">{copy.home.questions.title}</h2><p className="marketing-lead">{copy.home.questions.description}</p><Link href="/contact" className="marketing-text-link">Have another question? Contact us <ArrowRight size={17} aria-hidden="true" /></Link></div><div className="marketing-faq">{copy.home.questions.items.map(item => <details key={item.question}><summary>{item.question}<span aria-hidden="true">+</span></summary><p>{item.answer}{item.href && <> <Link href={item.href}>Compare plans.</Link></>}</p></details>)}</div></div></section>
    <section id="pricing" className="marketing-closing"><div className="marketing-container"><NatureDetail /><p className="marketing-eyebrow">Your library, a little simpler.</p><h2>{copy.home.closing.title}</h2><p>{copy.home.closing.description}</p><div className="marketing-actions"><WorkspaceCTA source="landing_closing" /><Link href="/pricing" className="marketing-button-secondary">View pricing <ArrowRight size={16} aria-hidden="true" /></Link></div><p className="marketing-trial-note">{copy.home.closing.trialNote}</p></div></section>
  </div></MarketingShell>;
}
