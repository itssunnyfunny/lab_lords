import { publicStrings } from "@/lib/public-i18n/server";
import Link from "next/link";
import { publicRich } from "@/lib/public-i18n/rich";
import { Mail, MapPin } from "lucide-react";
import { MarketingShell } from "@/components/landing/MarketingShell";
import { siteConfig } from "@/lib/site";
import { publicMetadata } from "@/lib/publicMetadata";

export const metadata = publicMetadata("/contact", "Contact Us", "Ask Lab Lords about product fit, plans and getting started with your library. Open an email draft or find help for an existing account.");
const questions = [
  { title: "Is it right for my space?", text: "Tell us whether you run a self-study library, study hall, reading room or study room, and which student, seat or fee tasks you need help with.", href: "/features", link: "Explore the features" },
  { title: "Which plan should I choose?", text: "Share your branch count and whether staff access, detailed reports or AI assistance matter to your work. You do not need to send student records to ask about plans.", href: "/pricing", link: "Compare pricing" },
  { title: "What do I need to get started?", text: "Ask about setting up seats and shifts, bringing in an existing student list or checking a workflow before signup. Tell us where you would like guidance.", href: "/how-it-works", link: "Read the setup walkthrough" },
];

export default async function ContactPage() {
  const { t, href: localHref } = await publicStrings();
  return <MarketingShell><div className="public-reference-page public-contact">
    <section className="marketing-page-hero"><div className="marketing-container">
      <p className="marketing-eyebrow">{t("Contact")}</p>
      <h1 className="marketing-title mt-4">{t("Let's talk about your library.")}</h1>
      <p className="marketing-lead mt-5 max-w-2xl">{t("Have a question about Lab Lords? Tell us what you need to manage and we'll help you understand the available features.")}</p>
      <div className="marketing-actions mt-7"><a href={`mailto:${siteConfig.supportEmail}`} className="marketing-button"><Mail size={17} aria-hidden="true" />{t("Open email")}</a><Link href={localHref("/support")} className="marketing-button-secondary">{t("Get support")}</Link></div>
      <p className="marketing-lead mt-5">{publicRich(t, "This opens a draft in your email app. Review it and send it yourself. If no email app opens, copy {email} into your preferred email service.", { email: <a className="underline underline-offset-4 break-all" href={`mailto:${siteConfig.supportEmail}`}>{siteConfig.supportEmail}</a> })}</p>
    </div></section>
    <section className="marketing-section"><div className="marketing-container">
      <h2 className="marketing-title">{t("What would you like to know?")}</h2>
      <div className="marketing-grid mt-8">{questions.map(item => <article key={item.href} className="marketing-card p-7"><h3>{t(item.title)}</h3><p className="marketing-lead mt-4">{t(item.text)}</p><Link className="marketing-text-link mt-5" href={localHref(item.href)}>{t(item.link)}</Link></article>)}</div>
      <p className="marketing-lead mt-7">{publicRich(t, "You may find your answer in the {faqs}. For an existing account or billing issue, {support}.", { faqs: <Link href={localHref("/faq")} className="underline underline-offset-4">{t("FAQs")}</Link>, support: <Link href={localHref("/support")} className="underline underline-offset-4">{t("visit Support")}</Link> })}</p>
    </div></section>
    <section className="marketing-section public-contact-details"><div className="marketing-container public-two-column grid gap-6 md:grid-cols-2">
      <article className="marketing-card p-6 sm:p-8"><Mail size={24} className="text-[color:var(--ui-form-accent)]" aria-hidden="true" /><h2 className="mt-5 text-xl font-semibold">{t("Contact {brand}", { brand: siteConfig.name })}</h2><a href={`mailto:${siteConfig.supportEmail}`} className="mt-4 inline-block break-all underline underline-offset-4">{siteConfig.supportEmail}</a><p className="mt-4 text-sm leading-7 text-[color:var(--text-secondary)]">{t("For account, billing, refund, privacy or product questions.")}</p></article>
      <article className="marketing-card p-6 sm:p-8"><MapPin size={24} className="text-[color:var(--ui-form-accent)]" aria-hidden="true" /><h2 className="mt-5 text-xl font-semibold">{t("Business and operational address")}</h2><p className="marketing-lead mt-4">{siteConfig.businessAddress === "Business address available on request" ? t("Business address available on request") : siteConfig.businessAddress}</p></article>
    </div></section>
  </div></MarketingShell>;
}
