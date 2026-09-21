import Link from "next/link";
import { MarketingShell } from "@/components/landing/MarketingShell";
import { PublicIntro } from "@/components/landing/PublicPageSections";

/** Existing bookmarks remain useful without advertising a retired audience. */
export function LegacyAudiencePage({ audience }: { audience: "coaching centres" | "tuition centres" }) {
  return <MarketingShell><div className="public-reference-page">
    <PublicIntro eyebrow="Our library focus" title={`Looking for software for ${audience}?`} description="Lab Lords now focuses on self-study libraries, study halls, reading rooms and study rooms in India." />
    <section className="marketing-section"><div className="marketing-container">
      <h2 className="marketing-title">Students, seats, shifts and fees — all in one place.</h2>
      <p className="marketing-lead mt-4 max-w-3xl">This older page is here for visitors with a saved link. Lab Lords does not provide teaching, course or examination management.</p>
      <p className="marketing-lead mt-4 max-w-3xl">If you run a self-study space, explore the library features or get in touch to check whether they fit your work.</p>
      <div className="marketing-actions mt-7"><Link href="/software/library-management" className="marketing-button">Explore library management</Link><Link href="/contact" className="marketing-button-secondary">Contact us</Link></div>
    </div></section>
  </div></MarketingShell>;
}
