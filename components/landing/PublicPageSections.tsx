import Link from "next/link";
import { WorkspaceCTA } from "./MarketingActions";

export function PublicIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <section className="marketing-page-hero"><div className="marketing-container">
    <p className="marketing-eyebrow">{eyebrow}</p>
    <h1 className="marketing-title mt-4">{title}</h1>
    <p className="marketing-lead mt-5 max-w-2xl">{description}</p>
  </div></section>;
}

export function PublicClosing({ source, title = "Ready to bring your records together?", description = "Start with your first branch, or talk to us about what your library needs." }: { source: string; title?: string; description?: string }) {
  return <section className="marketing-section public-closing"><div className="marketing-container">
    <h2 className="marketing-title">{title}</h2><p className="marketing-lead mt-4">{description}</p>
    <div className="marketing-actions mt-7"><WorkspaceCTA source={source} /><Link href="/contact" className="marketing-button-secondary">Contact us</Link></div>
  </div></section>;
}
