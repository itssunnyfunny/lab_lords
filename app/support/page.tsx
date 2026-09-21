import { publicAlternates } from "@/lib/public-i18n/routes";
import { publicStrings } from "@/lib/public-i18n/server";
import { publicOpenGraph, publicTwitter } from "@/lib/publicSocialMetadata";
import type { Metadata } from "next";
import Link from "next/link";
import { publicRich } from "@/lib/public-i18n/rich";
import { Mail } from "lucide-react";
import { BugReportForm } from "@/components/feedback/BugReportForm";
import { MarketingShell } from "@/components/landing/MarketingShell";
import { absoluteUrl, siteConfig } from "@/lib/site";

const supportDescription = "Find help with your Lab Lords account, students, seats, fees and subscription, or prepare a bug-report email draft.";
const supportTasks = [
  { title: "Account and access", text: "Check that you are using the account connected to your workspace or staff invitation. Tell us the workspace name and the screen where you cannot continue. Never send a password or sign-in code.", href: "/faq#team", link: "Branches and staff questions" },
  { title: "Set up your library", text: "Check your first branch details, seat numbering and shift times before confirming setup. Tell us which step needs clarification.", href: "/how-it-works", link: "Read the setup walkthrough" },
  { title: "Add or import students", text: "Review flagged fields before confirming an import. For an issue, share the error text and row number first, with personal information removed.", href: "/features#imports", link: "Review the import steps" },
  { title: "Seats and shifts", text: "Check the selected branch, shift and assignment dates. If an assignment is rejected, describe the timing and error without sharing unnecessary student details.", href: "/features#seats-shifts", link: "Understand seat assignments" },
  { title: "Student fee records", text: "Check the student record, fee period and amount recorded. Explain which value looks wrong. Student fee records are separate from your Lab Lords subscription charges.", href: "/features#fees", link: "Understand fee records" },
  { title: "Subscription and renewal", text: "The owner can review the plan, subscription status and renewal in organization billing settings. Use the billing guidance below if payment succeeded but access is missing.", href: "#billing-help", link: "Get billing help" },
];

export const metadata: Metadata = {
  title: "Support",
  description: supportDescription,
  alternates: { canonical: absoluteUrl("/support"), languages: publicAlternates("/support", absoluteUrl) },
  openGraph: { ...publicOpenGraph, type: "website", url: absoluteUrl("/support"), siteName: siteConfig.name, title: "Lab Lords Support", description: supportDescription },
  twitter: { ...publicTwitter, card: "summary", title: "Lab Lords Support", description: supportDescription },
};

export default async function SupportPage() {
  const { t, href: localHref } = await publicStrings();
  return (
    <MarketingShell>
      <div className="public-reference-page public-support">
      <section className="marketing-page-hero">
        <div className="marketing-container">
          <p className="marketing-eyebrow">{t("Support")}</p>
          <h1 className="marketing-title mt-4">{t("Help with Lab Lords.")}</h1>
          <p className="marketing-lead mt-5 max-w-2xl">{t("Need help with your library or account? Email us with your workspace name and what you need to do.")}</p>
          <div className="marketing-actions mt-7">
            <a className="marketing-button" href={`mailto:${siteConfig.supportEmail}`}><Mail size={17} aria-hidden="true" />{t("Open email")}</a>
            <a className="marketing-button-secondary" href="#report-a-bug">{t("Report a bug")}</a>
          </div>
          <p className="marketing-lead mt-5">{publicRich(t, "Email actions open a draft for you to review and send. If no email app opens, copy {email} into your email service. Still choosing a product or plan? {contact}.", { email: <a href={`mailto:${siteConfig.supportEmail}`} className="underline underline-offset-4 break-all">{siteConfig.supportEmail}</a>, contact: <Link href={localHref("/contact")} className="underline underline-offset-4">{t("Contact us")}</Link> })}</p>
        </div>
      </section>
      <section className="marketing-section public-support-topics">
        <div className="marketing-container">
          <h2 className="marketing-title">{t("What would you like help with?")}</h2>
          <p className="marketing-lead mt-4">{t("Start with the relevant guidance, then include the useful details when you email us.")}</p>
          <div className="marketing-grid mt-8">
            {supportTasks.map(task => (
              <article key={task.title} className="marketing-card p-7"><h3>{t(task.title)}</h3><p className="marketing-lead mt-4">{t(task.text)}</p><Link href={localHref(task.href)} className="marketing-text-link mt-5">{t(task.link)}</Link></article>
            ))}
          </div>
        </div>
      </section>
      <section id="billing-help" className="marketing-section public-questions"><div className="marketing-container">
        <h2 className="marketing-title">{t("Help with billing and paid access")}</h2>
        <p className="marketing-lead mt-4">{t("If a successful subscription payment has not activated access within 15 minutes, email us with your organization name, account email, Razorpay payment ID, payment time and a redacted payment screenshot. We normally respond within one business day, as set out in the activation policy.")}</p>
        <p className="marketing-lead mt-4">{t("For an incorrect charge or refund request, also include the charge date, amount and what went wrong. The refund policy explains eligibility, the 7-calendar-day request window and processing after approval.")}</p>
        <div className="marketing-actions mt-6"><Link href={localHref("/shipping-delivery-policy")} className="marketing-button-secondary">{t("Activation and delivery policy")}</Link><Link href={localHref("/refund-policy")} className="marketing-button-secondary">{t("Cancellation and refunds")}</Link></div>
      </div></section>
      <section id="report-a-bug" className="marketing-section public-bug-report scroll-mt-24">
        <div className="marketing-container public-two-column grid gap-8 lg:grid-cols-2">
          <div>
            <p className="marketing-eyebrow">{t("Product support")}</p>
            <h2 className="marketing-title mt-3">{t("Tell us what happened")}</h2>
            <p className="marketing-lead mt-4">{t("The form prepares an email with your report. Review it in your email app before sending.")}</p>
            <ul className="mt-6 list-disc space-y-3 pl-5 text-sm leading-7 text-[color:var(--text-secondary)]">
              <li>{t("The page or task where the issue happened.")}</li>
              <li>{t("What you expected and what happened instead.")}</li>
              <li>{t("Screenshots, error text, browser details and timestamps when available.")}</li>
              <li>{t("Remove passwords, authentication codes, tokens and student personal details before sharing a screenshot or report.")}</li>
            </ul>
            <a href={`mailto:${siteConfig.supportEmail}`} className="mt-6 inline-block break-all underline underline-offset-4">{siteConfig.supportEmail}</a>
            <p className="marketing-lead mt-4">{t("If the draft does not open, copy your report into an email to this address. This form does not submit a ticket or send a message from the website.")}</p>
          </div>
          <BugReportForm supportEmail={siteConfig.supportEmail} />
        </div>
      </section>
      </div>
    </MarketingShell>
  );
}
