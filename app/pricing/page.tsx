import { publicAlternates } from "@/lib/public-i18n/routes";
import { publicStrings } from "@/lib/public-i18n/server";
import { publicOpenGraph, publicTwitter } from "@/lib/publicSocialMetadata";
import type { Metadata } from "next";
import Link from "next/link";
import { publicRich } from "@/lib/public-i18n/rich";
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
  title: "Plans & Pricing",
  description,
  alternates: { canonical: absoluteUrl("/pricing"), languages: publicAlternates("/pricing", absoluteUrl) },
  openGraph: { ...publicOpenGraph, type: "website", url: absoluteUrl("/pricing"), siteName: siteConfig.name, title: "Plans & Pricing | Lab Lords", description },
  twitter: { ...publicTwitter, card: "summary_large_image", title: "Plans & Pricing | Lab Lords", description },
};

export default async function PricingPage() {
  const { t, href: localHref } = await publicStrings();
  const plans = publicBillingPlans();
  const [trial, trialEnd, cancel] = getPublicFaqs(["trial", "trial-end", "cancel"]);
  return (
    <MarketingShell>
      <div className="public-reference-page public-pricing">
      <section className="marketing-page-hero">
        <div className="marketing-container">
          <p className="marketing-eyebrow">{t("Pricing")}</p>
          <h1 className="marketing-title mt-4">{t("Simple plans for your library.")}</h1>
          <p className="marketing-lead mt-5 max-w-2xl">{t("Start with a 30-day Standard trial. Then choose the plan that fits your everyday work.")}</p>
          <p className="marketing-plan-note mt-4">{t("For eligible new owners, the trial starts after setting up the first branch. No card needed.")}</p>
        </div>
      </section>
    <LandingPricing showIntroduction={false} showComparisonLink={false} />
      <section id="comparison" className="marketing-section">
        <div className="marketing-container">
          <p className="marketing-eyebrow">{t("Compare the daily tools")}</p>
          <h2 className="marketing-title mt-3">{t("Choose by the work you need to do.")}</h2>
          <p className="marketing-lead mt-4">{t("Both plans cover student records, seats and fees. Standard adds tools for your team and a more detailed view of your branches.")}</p>
          <p className="marketing-lead mt-4">{t("Both plans include full or partial payments, receipts, fee follow-ups, attendance and language preferences. Staff access still requires Standard, with the permissions needed for each task. Report language preferences do not add access to reports outside your plan.")}</p>
          <table className="public-comparison">
            <caption className="sr-only">{t("Public plan feature comparison")}</caption>
            <thead><tr><th scope="col">{t("Feature")}</th>{plans.map(plan => <th key={plan.id} scope="col">{plan.shortName}</th>)}</tr></thead>
            <tbody>{plans[0]?.capabilities.map(capability => <tr key={capability.id}><th scope="row">{t(capability.label)}</th>{plans.map(plan => <td key={plan.id}>{t(plan.capabilities.find(item => item.id === capability.id)?.included ? "Included" : "Not included")}</td>)}</tr>)}</tbody>
          </table>
          <Link href={localHref("/features")} className="marketing-text-link mt-6">{t("Read what each feature does")}</Link>
        </div>
      </section>
      <section id="branch-billing" className="marketing-section public-plan-guidance">
        <div className="marketing-container public-two-column grid gap-8 md:grid-cols-2">
          <div>
            <p className="marketing-eyebrow">{t("Your monthly plan")}</p>
            <h2 className="mt-3 text-2xl font-semibold">{t("Clear pricing for each branch")}</h2>
            <p className="marketing-lead mt-4">{t("Each billable branch has a separate monthly charge. Your total depends on your plan and billable branch count.")}</p>
            <p className="marketing-plan-note mt-4">{t("Taxes, if applicable, are shown at checkout.")}</p>
            <p className="marketing-lead mt-4">{t("This is your subscription to Lab Lords. Fees that your library charges students are separate records in your workspace.")}</p>
          </div>
          <div className="marketing-card p-6 sm:p-8">
            <h2 className="text-2xl font-semibold">{t("Example: three billable branches")}</h2>
            <ul className="mt-4 space-y-3 text-sm leading-7">{plans.map(plan => <li key={plan.id}><strong>{plan.shortName}:</strong> {t("3 × ₹{amount} = ₹{total} per month, before tax.", { amount: plan.amount ?? 0, total: new Intl.NumberFormat("en-IN").format((plan.amount ?? 0) * 3) })}</li>)}</ul>
            <p className="marketing-lead mt-4">{t("This is a monthly estimate for three billable branches on the same plan, not a checkout quote. Review your actual branch count, any pending changes and the amount in billing settings before authorizing.")}</p>
            <Link href={localHref("/contact")} className="marketing-text-link mt-4">{t("Ask about your branch setup")}</Link>
          </div>
        </div>
      </section>
      <section id="trial" className="marketing-section public-questions"><div className="marketing-container">
        <p className="marketing-eyebrow">{t("From trying it to using it")}</p><h2 className="marketing-title mt-3">{t("Know what happens next.")}</h2>
        <div className="grid gap-6 mt-8">
          <article className="marketing-card p-7"><h3>{t("1. Confirm your first setup")}</h3><p className="marketing-lead mt-4">{t(`${trial.answer.replace(/^No\. /, "")} No card is needed.`)}</p><Link href={localHref("/how-it-works")} className="marketing-text-link mt-4">{t("See the setup steps")}</Link></article>
          <article className="marketing-card p-7"><h3>{t("2. Review and authorize a paid plan")}</h3><p className="marketing-lead mt-4">{t(trialEnd.answer)}</p><p className="marketing-lead mt-4">{t("Paid access depends on payment and subscription confirmation. See the delivery policy for activation timing and what to do if access is delayed.")}</p><Link href={localHref("/shipping-delivery-policy")} className="marketing-text-link mt-4">{t("Read the activation policy")}</Link></article>
          <article className="marketing-card p-7"><h3>{t("3. Manage future renewal")}</h3><p className="marketing-lead mt-4">{t(cancel.answer)}</p><Link href={localHref("/refund-policy")} className="marketing-text-link mt-4">{t("Read cancellation and refund terms")}</Link></article>
        </div>
      </div></section>
      <section className="marketing-section public-questions">
        <div className="marketing-container">
          <p className="marketing-eyebrow">{t("Common questions")}</p>
          <h2 className="marketing-title mt-3">{t("Questions about plans and payment")}</h2>
          <div className="mt-8"><PublicFaqList ids={pricingFaqIds} /></div>
          <Link href={localHref("/faq")} className="marketing-text-link mt-6">{t("Read all FAQs")}</Link>
          <p className="mt-6 text-sm leading-7 text-[color:var(--text-secondary)]">{publicRich(t, "Read our {terms} and {refund} for subscription conditions.", { terms: <Link href="/terms" className="underline underline-offset-4">{t("Terms of Service")}</Link>, refund: <Link href="/refund-policy" className="underline underline-offset-4">{t("Cancellation and Refund Policy")}</Link> })}</p>
        </div>
      </section>
      <section className="marketing-section public-closing">
        <div className="marketing-container">
          <h2 className="marketing-title">{t(copy.home.closing.title)}</h2>
          <p className="marketing-lead mt-4">{t(copy.home.closing.description)}</p>
          <div className="marketing-actions mt-7">
            <WorkspaceCTA source="pricing_close" />
            <Link href={localHref("/contact")} className="marketing-button-secondary">{t("Contact us")}</Link>
          </div>
        </div>
      </section>
      </div>
    </MarketingShell>
  );
}
