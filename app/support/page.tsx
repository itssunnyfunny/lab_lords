import type { Metadata } from "next";
import { ArrowUpRight, Mail } from "lucide-react";
import { BugReportForm } from "@/components/feedback/BugReportForm";
import { MarketingShell } from "@/components/landing/MarketingShell";
import { absoluteUrl, siteConfig } from "@/lib/site";

const supportDescription = "Contact Lab Lords support or send a bug report with page, browser, and timestamp context.";
const supportTasks = ["Set up your library", "Add students", "Manage seats and shifts", "Record a fee", "Check your plan"];

export const metadata: Metadata = {
  title: "Support",
  description: supportDescription,
  alternates: { canonical: absoluteUrl("/support") },
  openGraph: { type: "website", url: absoluteUrl("/support"), siteName: siteConfig.name, title: "Lab Lords Support", description: supportDescription },
  twitter: { card: "summary", title: "Lab Lords Support", description: supportDescription },
};

export default function SupportPage() {
  return (
    <MarketingShell>
      <div className="public-reference-page public-support">
      <section className="marketing-page-hero">
        <div className="marketing-container">
          <p className="marketing-eyebrow">Support</p>
          <h1 className="marketing-title mt-4">Help with Lab Lords.</h1>
          <p className="marketing-lead mt-5 max-w-2xl">Need help with your library or account? Email us with your workspace name and what you need to do.</p>
          <div className="marketing-actions mt-7">
            <a className="marketing-button" href={`mailto:${siteConfig.supportEmail}`}><Mail size={17} aria-hidden="true" />Email support</a>
            <a className="marketing-button-secondary" href="#report-a-bug">Report a bug</a>
          </div>
        </div>
      </section>
      <section className="marketing-section public-support-topics">
        <div className="marketing-container">
          <h2 className="marketing-title">What would you like help with?</h2>
          <p className="marketing-lead mt-4">Choose a topic to open an email to support.</p>
          <div className="marketing-grid mt-8">
            {supportTasks.map(task => (
              <a key={task} className="marketing-card flex min-h-24 items-center justify-between gap-4 p-6" href={`mailto:${siteConfig.supportEmail}?subject=${encodeURIComponent(`[Lab Lords help] ${task}`)}`}>
                <span className="font-semibold">{task}</span><ArrowUpRight size={18} className="shrink-0" aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>
      </section>
      <section id="report-a-bug" className="marketing-section public-bug-report scroll-mt-24">
        <div className="marketing-container public-two-column grid gap-8 lg:grid-cols-2">
          <div>
            <p className="marketing-eyebrow">Product support</p>
            <h2 className="marketing-title mt-3">Tell us what happened</h2>
            <p className="marketing-lead mt-4">The form prepares an email with your report. Review it in your email app before sending.</p>
            <ul className="mt-6 list-disc space-y-3 pl-5 text-sm leading-7 text-[color:var(--text-secondary)]">
              <li>The page or task where the issue happened.</li>
              <li>What you expected and what happened instead.</li>
              <li>Screenshots, error text, browser details and timestamps when available.</li>
            </ul>
            <a href={`mailto:${siteConfig.supportEmail}`} className="mt-6 inline-block break-all underline underline-offset-4">{siteConfig.supportEmail}</a>
          </div>
          <BugReportForm supportEmail={siteConfig.supportEmail} />
        </div>
      </section>
      </div>
    </MarketingShell>
  );
}
