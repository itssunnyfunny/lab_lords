import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown } from "lucide-react";
import { MarketingShell } from "@/components/landing/MarketingShell";
import { WorkspaceCTA } from "@/components/landing/MarketingActions";
import { publicBillingPlans, type BillingCapabilityId } from "@/lib/billingPlans";
import { absoluteUrl, siteConfig } from "@/lib/site";

const description = "Explore Lab Lords features for library student records, seats and shifts, fees, imports, branches, staff access and reports.";

export const metadata: Metadata = {
  title: "Library Management Features",
  description,
  alternates: { canonical: absoluteUrl("/features") },
  openGraph: { type: "website", url: absoluteUrl("/features"), siteName: siteConfig.name, title: "Lab Lords Features", description },
  twitter: { card: "summary_large_image", title: "Lab Lords Features", description },
};

type FeatureGroup = {
  id: string;
  nav: string;
  title: string;
  description: string;
  capability: BillingCapabilityId;
  items: { title: string; description: string }[];
};

const groups: FeatureGroup[] = [
  {
    id: "students", nav: "Students", title: "Student management", capability: "STUDENT_RECORDS_IMPORT",
    description: "Keep each student's details and library records together.",
    items: [
      { title: "Student details", description: "Add contact information and find a student's record when you need it." },
      { title: "Seats and fees", description: "Check assigned seats, shifts and fee records from the student's information." },
      { title: "Student status", description: "Keep track of active and inactive students without losing their history." },
    ],
  },
  {
    id: "seats-shifts", nav: "Seats & shifts", title: "Seats and shifts", capability: "SEATS_SHIFTS_ALLOCATIONS",
    description: "Set up the seating and timings that match your library.",
    items: [
      { title: "Seat availability", description: "Check which seats are available for the selected shift." },
      { title: "Assign seats", description: "Give students a seat and shift, with checks for overlapping assignments." },
      { title: "Shift timings and fees", description: "Set your timings and prices, including supported combined shifts." },
    ],
  },
  {
    id: "fees", nav: "Fees", title: "Fees and pending payments", capability: "PAYMENTS_DUES_AUDIT",
    description: "Keep payment records and pending fees easy to check.",
    items: [
      { title: "Record payments", description: "Enter received payments and check the remaining fee balance." },
      { title: "Pending fees", description: "See unpaid fees and save notes from fee follow-ups." },
      { title: "Payment history", description: "Review recorded payments and their details when you need to check an amount." },
    ],
  },
  {
    id: "imports", nav: "Imports", title: "Import student records", capability: "STUDENT_RECORDS_IMPORT",
    description: "Start with the student list you already have.",
    items: [
      { title: "Bring in your list", description: "Upload a supported student file rather than enter every record again." },
      { title: "Review before adding", description: "Check the mapped fields and rows before confirming the import." },
      { title: "Track progress", description: "Follow the import result and check any rows that need attention." },
    ],
  },
  {
    id: "branches", nav: "Branches", title: "Branch management", capability: "MULTIPLE_BRANCHES",
    description: "Manage more than one location from your account.",
    items: [
      { title: "Separate branch records", description: "Keep students, seats, shifts and fees with the correct branch." },
      { title: "Switch branches", description: "Open the location you need without mixing its records with another." },
      { title: "Clear pricing", description: "Each billable branch is charged separately under the chosen plan." },
    ],
  },
  {
    id: "staff", nav: "Staff", title: "Staff access", capability: "STAFF_CONTROLS",
    description: "Give your team access to the work they need to do.",
    items: [
      { title: "Add staff", description: "Invite staff to the appropriate branch." },
      { title: "Choose permissions", description: "Control what each staff member can view or change." },
    ],
  },
  {
    id: "reports", nav: "Reports", title: "Reports", capability: "ADVANCED_ANALYTICS",
    description: "Review seat usage and fee collection across your library.",
    items: [
      { title: "Branch reports", description: "Look at the branch's recorded figures and trends." },
      { title: "Cross-branch reports", description: "Compare seat usage and fee collection across your branches." },
    ],
  },
  {
    id: "ai-assistance", nav: "AI assistance", title: "AI assistance", capability: "AI_ASSISTANCE",
    description: "Get help reviewing recorded information and preparing follow-ups.",
    items: [
      { title: "AI-assisted reports", description: "Read summaries of recorded figures and review them alongside your library's records." },
      { title: "Message drafting", description: "Prepare a draft for review before you decide what to send." },
    ],
  },
];

export default function FeaturesPage() {
  const plans = publicBillingPlans();

  return (
    <MarketingShell>
      <div className="public-reference-page public-features">
      <section className="marketing-page-hero">
        <div className="marketing-container">
          <p className="marketing-eyebrow">Features</p>
          <h1 className="marketing-title mt-4">Library tools for your daily work</h1>
          <p className="marketing-lead mt-5 max-w-2xl">From student records to fee collection, explore what you can manage with Lab Lords.</p>
          <div className="marketing-actions mt-7">
            <WorkspaceCTA source="features_hero" />
            <Link href="/pricing" className="marketing-button-secondary">View pricing</Link>
          </div>
          <nav aria-label="Feature groups" className="public-feature-navigation mt-10 flex flex-wrap gap-2">
            {groups.map(group => (
              <a key={group.id} href={`#${group.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[color:var(--ui-panel-border)] px-4 text-sm hover:bg-[color:var(--ui-form-muted-surface-bg)]">
                {group.nav}<ArrowDown size={13} aria-hidden="true" />
              </a>
            ))}
          </nav>
        </div>
      </section>
      {groups.map(group => {
        const includedPlans = plans.filter(plan => plan.capabilities.some(capability => capability.id === group.capability && capability.included));
        return (
          <section key={group.id} id={group.id} className="marketing-section public-feature-section scroll-mt-24">
            <div className="marketing-container public-feature-layout">
              <header className="public-feature-introduction">
              <p className="marketing-eyebrow">{group.nav}</p>
              <h2 className="marketing-title mt-3">{group.title}</h2>
              <p className="marketing-lead mt-4">{group.description}</p>
              <p className="marketing-plan-note mt-3">Included in {includedPlans.map(plan => plan.shortName).join(" and ")}.</p>
              </header>
              <div className="marketing-grid public-feature-items mt-8">
                {group.items.map(item => (
                  <article key={item.title} className="marketing-card p-6">
                    <h3 className="text-lg font-semibold">{item.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-[color:var(--text-secondary)]">{item.description}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        );
      })}
      <section className="marketing-section public-questions">
        <div className="marketing-container">
          <h2 className="marketing-title">Common questions</h2>
          <div className="marketing-faq mt-8">
            <details><summary>Can I set my own shifts?<span aria-hidden="true">+</span></summary><p>Yes. Set the shift timings and fees that your library uses.</p></details>
            <details><summary>Where can I compare plans?<span aria-hidden="true">+</span></summary><p>The <Link href="/pricing" className="underline underline-offset-4">Pricing page</Link> shows what Basic and Standard include.</p></details>
          </div>
        </div>
      </section>
      <section className="marketing-section public-closing">
        <div className="marketing-container">
          <h2 className="marketing-title">Ready to use Lab Lords in your library?</h2>
          <p className="marketing-lead mt-4">Start a trial and explore the tools with your own records.</p>
          <div className="marketing-actions mt-7">
            <WorkspaceCTA source="features_close" />
            <Link href="/pricing" className="marketing-button-secondary">View pricing</Link>
          </div>
        </div>
      </section>
      </div>
    </MarketingShell>
  );
}
