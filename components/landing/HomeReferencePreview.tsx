import { publicStrings } from "@/lib/public-i18n/server";
import Image from "next/image";
import { publicRich } from "@/lib/public-i18n/rich";
import Link from "next/link";
import { ArrowRight, BookOpen, Building2, CalendarCheck, Check, FileInput, GraduationCap, IndianRupee, Languages, ReceiptText, School, Armchair, Users, UserRoundCog, type LucideIcon } from "lucide-react";
import { WorkspaceCTA } from "./MarketingActions";
import { BotanicalDashboard } from "./BotanicalDashboard";
import copy from "@/lib/marketingCopy.json";
import "@/styles/botanical-home.css";

const featureIcons: Record<string, LucideIcon> = {
  students: Users,
  seats: Armchair,
  fees: IndianRupee,
  branches: Building2,
  imports: FileInput,
  staff: UserRoundCog,
  receipts: ReceiptText,
  attendance: CalendarCheck,
  languages: Languages,
};

const audiences = [
  { title: "Self-study libraries", description: "Keep your space running smoothly", icon: BookOpen },
  { title: "Study halls", description: "Manage more students easily", icon: Users },
  { title: "Reading rooms", description: "Keep students and fees organised", icon: GraduationCap },
  { title: "Study rooms", description: "Simple tools for everyday work", icon: School },
];

/** Public introduction. The dashboard is an interactive example with no tenant data. */
export async function HomeReferencePreview() {
  const { t, href: localHref } = await publicStrings();
  return <div className="botanical-home">
    <section className="botanical-hero" aria-labelledby="reference-hero-title">
      <div className="botanical-container botanical-hero-grid">
        <div className="botanical-hero-copy">
          <p className="botanical-eyebrow">{t(copy.hero.eyebrow)}</p>
          <h1 id="reference-hero-title">{publicRich(t, "A simpler way to manage your {library}", { library: <em>{t("library.")}</em> })}</h1>
          <p className="botanical-hero-description">{t(copy.hero.description)}</p>
          <div className="botanical-hero-actions">
            <WorkspaceCTA source="landing_hero" label={t(copy.hero.primaryLabel)} />
            <Link className="botanical-button-secondary" href={localHref(copy.hero.secondaryHref)}>{t(copy.hero.secondaryLabel)}</Link>
          </div>
          <ul className="botanical-trial-proof" aria-label={t("Trial details")}>
            <li><Check size={12} strokeWidth={3} aria-hidden="true" />{t("30-day Standard trial")}</li>
            <li><Check size={12} strokeWidth={3} aria-hidden="true" />{t("No card needed")}</li>
          </ul>
        </div>
        <div className="botanical-hero-visual">
          <div className="botanical-hero-wash" aria-hidden="true" />
          <Image className="botanical-foliage botanical-foliage-top" src="/brand-reference/botanical-accent.webp" alt="" width={720} height={720} sizes="(max-width: 760px) 140px, 280px" priority />
          <Image className="botanical-foliage botanical-foliage-bottom" src="/brand-reference/botanical-accent.webp" alt="" width={720} height={720} sizes="(max-width: 760px) 130px, 300px" priority />
          <BotanicalDashboard />
        </div>
      </div>
    </section>
    <section className="botanical-audience botanical-container" aria-label={t("Who Lab Lords is for")}>
      <ul>{audiences.map(({ title, description, icon: Icon }) => <li key={title}><Icon size={36} strokeWidth={1.5} aria-hidden="true" /><div><h2>{t(title)}</h2><p>{t(description)}</p></div></li>)}</ul>
    </section>
    <section id="features" className="botanical-features relative" aria-labelledby="reference-features-title">
      <span id="platform" className="marketing-anchor" />
      <div className="botanical-container">
        <div className="botanical-section-heading">
          <p className="botanical-eyebrow">{t("Features")}</p>
          <h2 id="reference-features-title">{t(copy.home.features.title)}</h2>
          <p>{t(copy.home.features.description)}</p>
        </div>
        <div className="botanical-feature-grid">{copy.home.features.items.map(feature => {
          const Icon = featureIcons[feature.id] ?? BookOpen;
          return <Link href={localHref(feature.href)} key={feature.id} className="botanical-feature-card">
            <Icon className="botanical-feature-icon" size={37} strokeWidth={1.5} aria-hidden="true" />
            <h3>{t(feature.title)}</h3><p>{t(feature.description)}</p>
            {feature.planNote && <span className="botanical-plan-note">{t(feature.planNote)}</span>}
            <span className="botanical-learn-more">{t("Learn more")} <ArrowRight size={15} aria-hidden="true" /></span>
          </Link>;
        })}</div>
        <div className="botanical-feature-footer"><p>{t("Compare what’s included in Basic and Standard.")}</p><Link href={localHref("/features")}>{t("View all features")} <ArrowRight size={16} aria-hidden="true" /></Link></div>
      </div>
    </section>
  </div>;
}
