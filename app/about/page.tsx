import Link from "next/link";
import { MarketingShell } from "@/components/landing/MarketingShell";
import { PublicIntro, PublicClosing } from "@/components/landing/PublicPageSections";
import { NatureDetail } from "@/components/landing/NatureDetail";
import { publicMetadata } from "@/lib/publicMetadata";

export const metadata = publicMetadata("/about", "About", "Lab Lords helps self-study library, study-hall, reading-room and study-room owners keep student records, seats, shifts and fees together.");
const audiences = [
  ["Self-study libraries", "Keep the details of a study space together: who uses it, which shift they use and which fees are recorded.", "/software/library-management"],
  ["Study halls", "Organise seats across shifts and check a student's assignment when the next person arrives at the desk.", "/software/study-hall-management"],
  ["Reading rooms", "Keep student and fee administration with the right branch, and give staff access to the work they handle.", "/software/library-management"],
  ["Study rooms", "Start with student records and fee tracking, with separate branch records as your study room grows.", "/software/study-hall-management"],
];

export default function AboutPage() {
  return <MarketingShell><div className="public-reference-page public-about">
    <PublicIntro eyebrow="About Lab Lords" title="For the people who keep learning spaces running." description="Lab Lords brings student records, seats, shifts and fees into one workspace for self-study libraries, study halls, reading rooms and study rooms in India." />
    <section className="marketing-section"><div className="marketing-container public-two-column grid">
      <div><p className="marketing-eyebrow">Our focus</p><h2 className="marketing-title mt-3">Less searching. A clearer daily record.</h2><p className="marketing-lead mt-4">A library owner often needs to answer simple questions: which seats are available, what a student has paid, and which branch a record belongs to. Lab Lords keeps these connected details close to the work.</p><p className="marketing-lead mt-4">The aim is to make everyday administration easier to follow, so owners and staff can spend less time piecing together notes.</p></div>
      <div className="marketing-card p-8"><NatureDetail variant="books" /><h3 className="mt-5">Built around your daily records</h3><p className="marketing-lead mt-4">Start with one branch, set the shifts and fees your space uses, and add students as you go. Choose staff access and detailed reports when your work calls for them.</p><Link className="marketing-text-link mt-5" href="/features">Explore the features</Link></div>
    </div></section>
    <section className="marketing-section public-questions"><div className="marketing-container"><h2 className="marketing-title">Where Lab Lords fits</h2><div className="grid gap-6 md:grid-cols-2 mt-8">{audiences.map(([title, description, href]) => <article key={title} className="marketing-card p-7"><h3>{title}</h3><p className="marketing-lead mt-3">{description}</p><Link href={href} className="marketing-text-link mt-4">Explore {title.toLowerCase()}</Link></article>)}</div></div></section>
    <section className="marketing-section"><div className="marketing-container"><h2 className="marketing-title">Know what you are choosing.</h2><p className="marketing-lead mt-4 max-w-3xl">Lab Lords focuses on managing your learning space and its records. It does not replace a book-lending catalogue, teaching platform or examination system. The examples on this website use sample data so you can explore the layout before creating an account.</p><div className="marketing-actions mt-6"><Link href="/how-it-works" className="marketing-button-secondary">How it works</Link><Link href="/pricing" className="marketing-button-secondary">Compare plans</Link></div></div></section>
    <PublicClosing source="about_close" title="Tell us about your learning space." />
  </div></MarketingShell>;
}
