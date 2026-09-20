import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, Building2, ChartNoAxesCombined, Check, Clock3, CreditCard, FileInput, Grid2X2, NotebookPen, Users, UserRoundCog } from "lucide-react";
import { WorkspaceCTA } from "./MarketingActions";
import copy from "@/lib/marketingCopy.json";

const featureIcons = [Users, Grid2X2, Clock3, CreditCard, NotebookPen, FileInput, Building2, UserRoundCog, ChartNoAxesCombined];

/** Public homepage introduction and feature grid, sharing the public shell's type. */
export function HomeReferencePreview() {
  return <div className="brand-reference reference-preview">
    <section className="reference-hero" aria-labelledby="reference-hero-title">
      <div className="reference-container reference-hero-grid">
        <div className="reference-hero-copy">
          <p className="reference-eyebrow">{copy.hero.eyebrow}</p>
          <h1 id="reference-hero-title">Manage your library<br className="reference-wide-break" /> <span>in one place.</span></h1>
          <p className="reference-lead">{copy.hero.description}</p>
          <div className="reference-actions">
            <WorkspaceCTA source="landing_hero" />
            <Link className="reference-button-secondary" href="/features">View features<ArrowRight size={17} aria-hidden="true" /></Link>
          </div>
          <p className="reference-trial-note"><Check size={16} aria-hidden="true" />{copy.hero.trialNote}</p>
          <a href="#product-tour" className="reference-tour-link"><span className="reference-tour-icon"><BookOpen size={18} aria-hidden="true" /></span>Take a look inside<ArrowRight size={15} aria-hidden="true" /></a>
        </div>
        <div className="reference-hero-visual">
          <Image className="reference-hero-art" src="/brand-reference/hero-study-room.webp" alt="A reader in a peaceful study room with books, leafy plants, peach flowers and a blue bird." width={1254} height={1254} sizes="(max-width: 760px) 100vw, 50vw" priority />
          <div className="reference-library-summary" aria-label="Illustrative library summary">
            <div className="reference-summary-heading"><span><BookOpen size={17} aria-hidden="true" />Morning shift</span><span>Example data</span></div>
            <dl><div><dt>Students</dt><dd>12</dd></div><div><dt>Occupied seats</dt><dd>8</dd></div><div><dt>Available seats</dt><dd>4</dd></div></dl>
          </div>
        </div>
      </div>
    </section>
    <section className="reference-audience" aria-label="Who Lab Lords is for">
      <div className="reference-container"><p>Built for the way you run your space</p><ul><li>Study libraries</li><li>Study halls</li><li>Coaching centres</li><li>Tuition centres</li></ul></div>
    </section>
    <section id="features" className="reference-features" aria-labelledby="reference-features-title">
      <span id="platform" className="marketing-anchor" />
      <div className="reference-container">
        <div className="reference-section-heading">
          <p className="reference-eyebrow">Library features</p>
          <h2 id="reference-features-title">{copy.home.features.title}</h2>
          <p>{copy.home.features.description}</p>
        </div>
        <div className="reference-feature-grid">{copy.home.features.items.map((feature, index) => {
          const Icon = featureIcons[index];
          return <Link href={feature.href} key={feature.id} className="reference-feature-card">
            <span className={`reference-feature-icon reference-tone-${index % 3}`}><Icon size={25} strokeWidth={1.65} aria-hidden="true" /></span>
            <h3>{feature.title}</h3><p>{feature.description}</p>
            {"planNote" in feature && <span className="reference-plan-note">{feature.planNote}</span>}
            <ArrowRight className="reference-card-arrow" size={17} aria-hidden="true" />
          </Link>;
        })}</div>
        <div className="reference-feature-footer"><p>Compare what’s included in Basic and Standard.</p><Link href="/features" className="reference-text-link">View all features<ArrowRight size={17} aria-hidden="true" /></Link></div>
      </div>
    </section>
  </div>;
}
