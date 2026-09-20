import type { Metadata } from "next";
import Link from "next/link";
import { LandingPricing } from "@/components/landing/LandingPricing";
import { MarketingShell } from "@/components/landing/MarketingShell";
import { WorkspaceCTA } from "@/components/landing/MarketingActions";
import { absoluteUrl, siteConfig } from "@/lib/site";

const description = "Compare Lab Lords Basic and Standard for students, seats, shifts and fees. Monthly pricing for each billable branch, with a 30-day trial for eligible new owners.";

export const metadata: Metadata = {
  title: "Pricing for Library Management Software",
  description,
  alternates: { canonical: absoluteUrl("/pricing") },
  openGraph: { type: "website", url: absoluteUrl("/pricing"), siteName: siteConfig.name, title: "Lab Lords Pricing", description },
  twitter: { card: "summary_large_image", title: "Lab Lords Pricing", description },
};

const questions = [
  { question: "Is the price for all my branches?", answer: "No. Each billable branch is charged separately. Your total depends on your plan and the number of billable branches." },
  { question: "Will I need a card for the trial?", answer: "No. Eligible new owners can start the 30-day Standard trial without a card." },
  { question: "Does adding a branch restart the trial?", answer: "No. Your branches share the same trial end date." },
  { question: "Is there a free plan after the trial?", answer: "After the trial, choose Basic or Standard to continue with a paid plan." },
];

export default function PricingPage() {
  return (
    <MarketingShell>
      <div className="public-reference-page public-pricing">
      <section className="marketing-page-hero">
        <div className="marketing-container">
          <p className="marketing-eyebrow">Pricing</p>
          <h1 className="marketing-title mt-4">Choose a plan for your library</h1>
          <p className="marketing-lead mt-5 max-w-2xl">Compare Basic and Standard. Both are billed monthly for each billable branch.</p>
          <p className="marketing-plan-note mt-4">New eligible owners can start with 30 days of Standard features. No card is needed.</p>
        </div>
      </section>
      <LandingPricing showIntroduction={false} />
      <section className="marketing-section public-plan-guidance">
        <div className="marketing-container public-two-column grid gap-8 md:grid-cols-2">
          <div>
            <p className="marketing-eyebrow">Your monthly plan</p>
            <h2 className="mt-3 text-2xl font-semibold">Clear pricing for each branch</h2>
            <p className="marketing-lead mt-4">A billable branch is a branch included in your Lab Lords subscription. Adding one can change your monthly total.</p>
            <p className="marketing-plan-note mt-4">Taxes, if applicable, are shown at checkout.</p>
          </div>
          <div className="marketing-card p-6 sm:p-8">
            <h2 className="text-2xl font-semibold">Need staff access and more detailed reports?</h2>
            <p className="marketing-lead mt-4">Standard adds staff permissions, advanced branch reports and AI assistance to the daily tools in Basic.</p>
            <Link href="/features" className="marketing-button-secondary mt-6">View features</Link>
          </div>
        </div>
      </section>
      <section className="marketing-section public-questions">
        <div className="marketing-container">
          <p className="marketing-eyebrow">Common questions</p>
          <h2 className="marketing-title mt-3">Plans, branches and your trial</h2>
          <div className="marketing-faq mt-8">
            {questions.map(({ question, answer }) => (
              <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>
            ))}
          </div>
          <p className="mt-6 text-sm leading-7 text-[color:var(--text-secondary)]">Read our <Link href="/terms" className="underline underline-offset-4">Terms of Service</Link> and <Link href="/refund-policy" className="underline underline-offset-4">Cancellation and Refund Policy</Link> for subscription conditions.</p>
        </div>
      </section>
      <section className="marketing-section public-closing">
        <div className="marketing-container">
          <h2 className="marketing-title">Start with a free trial</h2>
          <p className="marketing-lead mt-4">Try Standard features in your library before choosing a paid plan.</p>
          <div className="marketing-actions mt-7">
            <WorkspaceCTA source="pricing_close" />
            <Link href="/contact" className="marketing-button-secondary">Contact us</Link>
          </div>
        </div>
      </section>
      </div>
    </MarketingShell>
  );
}
