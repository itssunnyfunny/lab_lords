import type { Metadata } from "next";
import Link from "next/link";
import { LandingPricing } from "@/components/landing/LandingPricing";
import { MarketingShell } from "@/components/landing/MarketingShell";
import { WorkspaceCTA } from "@/components/landing/MarketingActions";
import { PublicFaqList } from "@/components/landing/PublicFaqList";
import { getPublicFaqs, pricingFaqIds } from "@/lib/publicFaqs";
import { publicBillingPlans } from "@/lib/billingPlans";
import copy from "@/lib/marketingCopy.json";
import { absoluteUrl, siteConfig } from "@/lib/site";

const description = "Compare Lab Lords Basic and Standard for students, seats, shifts and fees. Monthly pricing for each billable branch, with a 30-day trial for eligible new owners.";

export const metadata: Metadata = {
  title: "Pricing for Library Management Software",
  description,
  alternates: { canonical: absoluteUrl("/pricing") },
  openGraph: { type: "website", url: absoluteUrl("/pricing"), siteName: siteConfig.name, title: "Lab Lords Pricing", description },
  twitter: { card: "summary_large_image", title: "Lab Lords Pricing", description },
};

export default function PricingPage() {
  const plans = publicBillingPlans();
  const [trial, trialEnd, cancel] = getPublicFaqs(["trial", "trial-end", "cancel"]);
  return (
    <MarketingShell>
      <div className="public-reference-page public-pricing">
      <section className="marketing-page-hero">
        <div className="marketing-container">
          <p className="marketing-eyebrow">Pricing</p>
          <h1 className="marketing-title mt-4">Simple plans for your library.</h1>
          <p className="marketing-lead mt-5 max-w-2xl">Start with a 30-day Standard trial. Then choose the plan that fits your everyday work.</p>
          <p className="marketing-plan-note mt-4">For eligible new owners, the trial starts after setting up the first branch. No card needed.</p>
        </div>
      </section>
    <LandingPricing showIntroduction={false} showComparisonLink={false} />
      <section id="comparison" className="marketing-section">
        <div className="marketing-container">
          <p className="marketing-eyebrow">Compare the daily tools</p>
          <h2 className="marketing-title mt-3">Choose by the work you need to do.</h2>
          <p className="marketing-lead mt-4">Both plans cover student records, seats and fees. Standard adds tools for your team and a more detailed view of your branches.</p>
          <table className="public-comparison">
            <caption className="sr-only">Public plan feature comparison</caption>
            <thead><tr><th scope="col">Feature</th>{plans.map(plan => <th key={plan.id} scope="col">{plan.shortName}</th>)}</tr></thead>
            <tbody>{plans[0]?.capabilities.map(capability => <tr key={capability.id}><th scope="row">{capability.label}</th>{plans.map(plan => <td key={plan.id}>{plan.capabilities.find(item => item.id === capability.id)?.included ? "Included" : "Not included"}</td>)}</tr>)}</tbody>
          </table>
          <Link href="/features" className="marketing-text-link mt-6">Read what each feature does</Link>
        </div>
      </section>
      <section id="branch-billing" className="marketing-section public-plan-guidance">
        <div className="marketing-container public-two-column grid gap-8 md:grid-cols-2">
          <div>
            <p className="marketing-eyebrow">Your monthly plan</p>
            <h2 className="mt-3 text-2xl font-semibold">Clear pricing for each branch</h2>
            <p className="marketing-lead mt-4">Each billable branch has a separate monthly charge. Your total depends on your plan and billable branch count.</p>
            <p className="marketing-plan-note mt-4">Taxes, if applicable, are shown at checkout.</p>
            <p className="marketing-lead mt-4">This is your subscription to Lab Lords. Fees that your library charges students are separate records in your workspace.</p>
          </div>
          <div className="marketing-card p-6 sm:p-8">
            <h2 className="text-2xl font-semibold">Example: three billable branches</h2>
            <ul className="mt-4 space-y-3 text-sm leading-7">{plans.map(plan => <li key={plan.id}><strong>{plan.shortName}:</strong> 3 × ₹{plan.amount} = ₹{new Intl.NumberFormat("en-IN").format((plan.amount ?? 0) * 3)} per month, before tax.</li>)}</ul>
            <p className="marketing-lead mt-4">This is a monthly estimate for three billable branches on the same plan, not a checkout quote. Review your actual branch count, any pending changes and the amount in billing settings before authorizing.</p>
            <Link href="/contact" className="marketing-text-link mt-4">Ask about your branch setup</Link>
          </div>
        </div>
      </section>
      <section id="trial" className="marketing-section public-questions"><div className="marketing-container">
        <p className="marketing-eyebrow">From trying it to using it</p><h2 className="marketing-title mt-3">Know what happens next.</h2>
        <div className="grid gap-6 mt-8">
          <article className="marketing-card p-7"><h3>1. Confirm your first setup</h3><p className="marketing-lead mt-4">{trial.answer.replace(/^No\. /, "")} No card is needed.</p><Link href="/how-it-works" className="marketing-text-link mt-4">See the setup steps</Link></article>
          <article className="marketing-card p-7"><h3>2. Review and authorize a paid plan</h3><p className="marketing-lead mt-4">{trialEnd.answer}</p><p className="marketing-lead mt-4">Paid access depends on payment and subscription confirmation. See the delivery policy for activation timing and what to do if access is delayed.</p><Link href="/shipping-delivery-policy" className="marketing-text-link mt-4">Read the activation policy</Link></article>
          <article className="marketing-card p-7"><h3>3. Manage future renewal</h3><p className="marketing-lead mt-4">{cancel.answer}</p><Link href="/refund-policy" className="marketing-text-link mt-4">Read cancellation and refund terms</Link></article>
        </div>
      </div></section>
      <section className="marketing-section public-questions">
        <div className="marketing-container">
          <p className="marketing-eyebrow">Common questions</p>
          <h2 className="marketing-title mt-3">Questions about plans and payment</h2>
          <div className="mt-8"><PublicFaqList ids={pricingFaqIds} /></div>
          <Link href="/faq" className="marketing-text-link mt-6">Read all FAQs</Link>
          <p className="mt-6 text-sm leading-7 text-[color:var(--text-secondary)]">Read our <Link href="/terms" className="underline underline-offset-4">Terms of Service</Link> and <Link href="/refund-policy" className="underline underline-offset-4">Cancellation and Refund Policy</Link> for subscription conditions.</p>
        </div>
      </section>
      <section className="marketing-section public-closing">
        <div className="marketing-container">
          <h2 className="marketing-title">{copy.home.closing.title}</h2>
          <p className="marketing-lead mt-4">{copy.home.closing.description}</p>
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
