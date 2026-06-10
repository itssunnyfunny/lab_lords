import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  BookOpen,
  Building2,
  CreditCard,
  Grid3X3,
  GraduationCap,
  Library,
} from "lucide-react";
import { LandingReveal } from "@/components/landing/LandingReveal";
import {
  landingContainerClass,
  landingDescriptionClass,
  landingEyebrowClass,
  landingMutedTextClass,
  landingPanelClass,
  landingSectionClass,
  landingTitleClass,
} from "@/components/ui/landingSurface";
import {
  getSoftwarePagePath,
  softwarePageSlugs,
  softwarePages,
} from "@/lib/softwarePages";

const icons = [
  BookOpen,
  Library,
  Grid3X3,
  CreditCard,
  BellRing,
  Building2,
  GraduationCap,
];

export function LandingSoftware() {
  return (
    <section id="software" className={`${landingSectionClass} overflow-hidden`}>
      <span className="landing-section-glow right-[8%] top-24 h-52 w-52 bg-cyan-400/10 [animation-delay:1.4s]" aria-hidden="true" />
      <div className={`${landingContainerClass} relative`}>
        <LandingReveal variant="left">
          <p className={landingEyebrowClass}>Software by workflow</p>
          <h2 className={`${landingTitleClass} mt-3`}>
            Practical operations software for offline education businesses
          </h2>
          <p className={`${landingDescriptionClass} mt-4 max-w-3xl`}>
            See how Lab Lords supports the specific work inside study halls, reading-room libraries, coaching centres and tuition centres without hiding the product behind generic ERP language.
          </p>
        </LandingReveal>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {softwarePageSlugs.map((slug, index) => {
            const page = softwarePages[slug];
            const Icon = icons[index] ?? BookOpen;

            return (
              <LandingReveal
                key={slug}
                delay={60 + index * 50}
                className={`${landingPanelClass} landing-animated-card ${index === 0 ? "lg:col-span-2" : ""}`}
              >
                <Link href={getSoftwarePagePath(slug)} className="block h-full p-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[var(--ui-radius-control)] border border-[color:var(--ui-badge-cyan-border)] bg-[color:var(--ui-badge-cyan-bg)] text-[color:var(--ui-badge-cyan-text)]">
                    <Icon size={19} />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-[color:var(--text-primary)]">
                    {page.shortName}
                  </h3>
                  <p className={`${landingMutedTextClass} mt-3 text-sm leading-6`}>
                    {page.metaDescription}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--ui-form-accent)]">
                    Explore software
                    <ArrowRight size={14} />
                  </span>
                </Link>
              </LandingReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
