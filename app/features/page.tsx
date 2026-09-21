import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown } from "lucide-react";
import { MarketingShell } from "@/components/landing/MarketingShell";
import { WorkspaceCTA } from "@/components/landing/MarketingActions";
import { PublicFaqList } from "@/components/landing/PublicFaqList";
import { featureFaqIds } from "@/lib/publicFaqs";
import { publicBillingPlans, type BillingCapabilityId } from "@/lib/billingPlans";
import copy from "@/lib/marketingCopy.json";
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

const featureCopy = Object.fromEntries(copy.home.features.items.map(item => [item.id, item]));

const groups: FeatureGroup[] = [
  {
    id: "students", nav: "Students", title: featureCopy.students.title, capability: "STUDENT_RECORDS_IMPORT",
    description: featureCopy.students.description,
    items: [
      { title: "Student details", description: "Add contact information and find a student's record when you need it." },
      { title: "Seats and fees", description: "Check assigned seats, shifts and fee records from the student's information." },
      { title: "Student status", description: "Keep track of active and inactive students without losing their history." },
    ],
  },
  {
    id: "seats-shifts", nav: "Seats & shifts", title: featureCopy.seats.title, capability: "SEATS_SHIFTS_ALLOCATIONS",
    description: featureCopy.seats.description,
    items: [
      { title: "Seat availability", description: "Check which seats are available for the selected shift." },
      { title: "Assign seats", description: "Give students a seat and shift, with checks for overlapping assignments." },
      { title: "Shift timings and fees", description: "Set your shift timings and fees to match how your library runs." },
    ],
  },
  {
    id: "fees", nav: "Fees & dues", title: featureCopy.fees.title, capability: "PAYMENTS_DUES_AUDIT",
    description: featureCopy.fees.description,
    items: [
      { title: "Record payments", description: "Enter a full or partial payment and check the remaining fee balance." },
      { title: "Pending fees", description: "See unpaid fees and use the remaining balance to decide which student needs a follow-up." },
      { title: "Payment history", description: "Review recorded payments and their details when you need to check an amount." },
      { title: "Receipts", description: "Download or print a receipt for a recorded payment, and find it again in the student's collection history. Historical imported payments do not get a new receipt." },
      { title: "Upcoming fees and follow-ups", description: "See today's fees, upcoming fee dates and pending amounts. Save a note, contact outcome and the next date to follow up. Expected fees stay separate from amounts already due; a follow-up date does not change the fee date." },
    ],
  },
  {
    id: "attendance", nav: "Attendance", title: featureCopy.attendance.title, capability: "ATTENDANCE",
    description: featureCopy.attendance.description,
    items: [
      { title: "Daily attendance", description: "Mark students present or absent, record check-in and check-out, and review their attendance history. A day without a mark stays unmarked." },
      { title: "Staff-assisted QR", description: "Staff scan a student's QR code, check the displayed name and confirm check-in or check-out. If the camera is unavailable, find the student and record attendance manually." },
      { title: "Corrections", description: "An owner or staff member with the required permission can correct a mark or visit with a reason. The history keeps the original record and the change." },
    ],
  },
  {
    id: "languages", nav: "Languages", title: featureCopy.languages.title, capability: "DISPLAY_LANGUAGES",
    description: featureCopy.languages.description,
    items: [
      { title: "Your interface language", description: "Use the interface in English, Hindi or Hinglish. Each person chooses their own language, without changing saved names or notes." },
      { title: "Receipt and report language", description: "Choose the language for receipt and report labels separately. Existing AI-written text and provider-hosted screens keep their own language; WhatsApp message language is a separate setting." },
    ],
  },
  {
    id: "imports", nav: "Student imports", title: featureCopy.imports.title, capability: "STUDENT_RECORDS_IMPORT",
    description: featureCopy.imports.description,
    items: [
      { title: "Bring in your list", description: "Upload your student spreadsheet to bring in existing records." },
      { title: "Review before adding", description: "Review your information and resolve any flagged issues before confirming an import." },
      { title: "Track progress", description: "Follow the import result and check any rows that need attention." },
    ],
  },
  {
    id: "branches", nav: "Branches", title: featureCopy.branches.title, capability: "MULTIPLE_BRANCHES",
    description: featureCopy.branches.description,
    items: [
      { title: "Separate branch records", description: "Keep students, seats, shifts and fees with the correct branch." },
      { title: "Switch branches", description: "Open the location you need without mixing its records with another." },
      { title: "Clear pricing", description: "Each billable branch is charged separately under the chosen plan." },
    ],
  },
  {
    id: "staff", nav: "Staff", title: featureCopy.staff.title, capability: "STAFF_CONTROLS",
    description: featureCopy.staff.description,
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

const examples: Record<string, { text: string; href: string; link: string }> = {
  students: { text: "A student asks which shift they are assigned to. Find their record, check the current seat and shift, and refer to the recorded fee details without searching a separate list.", href: "/software/library-management", link: "For reading-room libraries" },
  "seats-shifts": { text: "A student wants an afternoon seat. Check availability for that shift and the intended dates, then choose an assignment that fits. An occupied morning seat does not by itself tell you whether the afternoon slot is free.", href: "/software/seat-management", link: "Explore seat management" },
  fees: { text: "Before following up on a due fee, open the student's recorded payment details and confirm the amount. Record money actually received through your library's payment method; saving a record does not collect money online.", href: "/software/student-fee-management", link: "Explore student fee records" },
  attendance: { text: "A student arrives for their shift. Find them in Attendance or scan their QR with staff supervision, check their name and record check-in. Record check-out when they leave. Attendance does not change their fees or seat assignment.", href: "/faq#features", link: "Read about attendance" },
  languages: { text: "Use Hindi for your daily screen and English for receipt labels, or choose Hinglish for both. Your choice does not change another staff member's preference or the student's saved details.", href: "/faq#help", link: "Read about language choices" },
  imports: { text: "Start with your existing spreadsheet. Match its fields to the import, check names and branch details, and resolve flagged rows before confirmation. After the import runs, review the result and any rows needing attention.", href: "/how-it-works", link: "Prepare for your first import" },
  branches: { text: "Your morning desk handles one location while you review another. Each branch has its own students, seats and fee records. Switch to the right branch before entering information; every billable branch contributes to the subscription charge.", href: "/pricing#branch-billing", link: "Understand branch billing" },
  staff: { text: "Invite a staff member to the branch where they work and choose the allowed actions. Someone who helps with daily student records should not need to share the owner's account or manage organization billing.", href: "/pricing#comparison", link: "Compare Standard with Basic" },
  reports: { text: "Use recorded collection and seat-usage figures to review a branch, then compare locations where your access allows it. These reports reflect the information entered in Lab Lords; check incomplete records before drawing conclusions.", href: "/software/library-management", link: "For libraries with branch records" },
  "ai-assistance": { text: "Ask for a summary of recorded figures or prepare a follow-up draft. Review amounts and wording yourself. AI output can be wrong and remains advisory; a draft does not mean that a message was delivered or a payment confirmed.", href: "/software/fee-reminder", link: "Understand fee follow-up" },
};

export default function FeaturesPage() {
  const plans = publicBillingPlans();

  return (
    <MarketingShell>
      <div className="public-reference-page public-features">
      <section className="marketing-page-hero">
        <div className="marketing-container">
          <p className="marketing-eyebrow">Features</p>
          <h1 className="marketing-title mt-4">Tools for everyday library work.</h1>
          <p className="marketing-lead mt-5 max-w-2xl">From your first student record to your next branch, keep the daily details together.</p>
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
      {groups.map((group, index) => {
        const includedPlans = plans.filter(plan => plan.capabilities.some(capability => capability.id === group.capability && capability.included));
        return (
          <section key={group.id} id={group.id} className="marketing-section public-feature-section scroll-mt-24">
            {index === 0 && (
              <header className="marketing-container mb-10">
                <h2 className="marketing-title">{copy.home.features.title}</h2>
                <p className="marketing-lead mt-4">{copy.home.features.description}</p>
              </header>
            )}
            <div className="marketing-container public-feature-layout">
              <header className="public-feature-introduction">
              <p className="marketing-eyebrow">{group.nav}</p>
              <h2 className="marketing-title mt-3">{group.title}</h2>
              <p className="marketing-lead mt-4">{group.description}</p>
              <p className="marketing-plan-note mt-3">Included in {includedPlans.map(plan => plan.shortName).join(" and ")}.</p>
              <Link href="/pricing#comparison" className="marketing-text-link mt-4">Compare plan details</Link>
              </header>
              <div className="marketing-grid public-feature-items mt-8">
                {group.items.map(item => (
                  <article key={item.title} className="marketing-card p-6">
                    <h3 className="text-lg font-semibold">{item.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-[color:var(--text-secondary)]">{item.description}</p>
                  </article>
                ))}
              </div>
              <div className="public-feature-example"><p className="public-example"><strong>In everyday work: </strong>{examples[group.id].text}</p><Link href={examples[group.id].href} className="marketing-text-link mt-4">{examples[group.id].link}</Link></div>
            </div>
          </section>
        );
      })}
      <section className="marketing-section public-questions">
        <div className="marketing-container">
          <h2 className="marketing-title">A closer look at the features</h2>
          <div className="mt-8">
            <PublicFaqList ids={featureFaqIds} />
          </div>
          <div className="marketing-actions mt-6"><Link href="/faq" className="marketing-text-link">Read all FAQs</Link><Link href="/how-it-works" className="marketing-text-link">See how setup works</Link></div>
        </div>
      </section>
      <section className="marketing-section public-closing">
        <div className="marketing-container">
          <h2 className="marketing-title">{copy.home.closing.title}</h2>
          <p className="marketing-lead mt-4">{copy.home.closing.description}</p>
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
