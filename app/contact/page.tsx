import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MapPin } from "lucide-react";
import { MarketingShell } from "@/components/landing/MarketingShell";
import { absoluteUrl, siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Contact Lab Lords for account, billing, refund, privacy, product, or operational support.",
  alternates: { canonical: absoluteUrl("/contact") },
};

export default function ContactPage() {
  return (
    <MarketingShell>
      <div className="public-reference-page public-contact">
      <section className="marketing-page-hero">
        <div className="marketing-container">
          <p className="marketing-eyebrow">Contact</p>
          <h1 className="marketing-title mt-4">Let&apos;s talk about your library.</h1>
          <p className="marketing-lead mt-5 max-w-2xl">Have a question about Lab Lords? Tell us what you need to manage and we&apos;ll help you understand the available features.</p>
          <div className="marketing-actions mt-7">
            <a href={`mailto:${siteConfig.supportEmail}`} className="marketing-button"><Mail size={17} aria-hidden="true" />Email us</a>
            <Link href="/support" className="marketing-button-secondary">Get support</Link>
          </div>
        </div>
      </section>
      <section className="marketing-section public-contact-details">
        <div className="marketing-container public-two-column grid gap-6 md:grid-cols-2">
          <article className="marketing-card p-6 sm:p-8">
            <Mail size={24} className="text-[color:var(--ui-form-accent)]" aria-hidden="true" />
            <h2 className="mt-5 text-xl font-semibold">Contact {siteConfig.name}</h2>
            <a href={`mailto:${siteConfig.supportEmail}`} className="mt-4 inline-block break-all underline underline-offset-4">{siteConfig.supportEmail}</a>
            <p className="mt-4 text-sm leading-7 text-[color:var(--text-secondary)]">For account, billing, refund, privacy or product questions.</p>
          </article>
          <article className="marketing-card p-6 sm:p-8">
            <MapPin size={24} className="text-[color:var(--ui-form-accent)]" aria-hidden="true" />
            <h2 className="mt-5 text-xl font-semibold">Business and operational address</h2>
            <p className="marketing-lead mt-4">{siteConfig.businessAddress}</p>
          </article>
          <article className="marketing-card p-6 sm:p-8">
            <h2 className="text-xl font-semibold">Billing and refund requests</h2>
            <p className="mt-4 text-sm leading-7 text-[color:var(--text-secondary)]">Email support with your organization name, account email, Razorpay payment ID, charge date and amount, and a description of the billing or access issue.</p>
            <p className="mt-4 text-sm leading-7 text-[color:var(--text-secondary)]">Refund requests are handled under the <Link href="/refund-policy" className="underline underline-offset-4">Cancellation and Refund Policy</Link>.</p>
          </article>
          <article className="marketing-card p-6 sm:p-8">
            <h2 className="text-xl font-semibold">Product support and bug reports</h2>
            <p className="mt-4 text-sm leading-7 text-[color:var(--text-secondary)]">Include the affected page, what you expected, what happened, the approximate time, browser details and screenshots.</p>
            <Link href="/support#report-a-bug" className="marketing-button-secondary mt-6">Prepare a bug report</Link>
          </article>
        </div>
      </section>
      </div>
    </MarketingShell>
  );
}
