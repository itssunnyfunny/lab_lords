import { Building2, CheckCircle2, MonitorSmartphone, TrendingUp, UserPlus } from "lucide-react";
import {
  landingContainerClass,
  landingDescriptionClass,
  landingEyebrowClass,
  landingInsetClass,
  landingMutedTextClass,
  landingPanelClass,
  landingSectionClass,
  landingSubtleTextClass,
  landingTitleClass,
} from "@/components/ui/landingSurface";

const steps = [
  {
    step: "01",
    title: "Set up your branches",
    description: "Define your physical branch locations, operating hours, and create the exact floor plan mapping your physical seats to the digital workspace.",
    icon: Building2,
  },
  {
    step: "02",
    title: "Add your students",
    description: "Onboard students in seconds. Capture essential contact details, ID proofs, and preferences all in one secure, searchable database.",
    icon: UserPlus,
  },
  {
    step: "03",
    title: "Allocate seats dynamically",
    description: "Assign students to specific seats based on shifts. Our system automatically prevents double-booking while optimizing your floor capacity.",
    icon: MonitorSmartphone,
  },
  {
    step: "04",
    title: "Track revenue & grow",
    description: "Monitor payments, detect upcoming dues, and leverage AI analytics to understand your business health and utilization metrics.",
    icon: TrendingUp,
  },
];

export function LandingHowItWorks() {
  return (
    <section id="how-it-works" className={landingSectionClass}>
      <div className={landingContainerClass}>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-12">
          <div>
            <p className={landingEyebrowClass}>How it Works</p>
            <h2 className={`${landingTitleClass} mt-3`}>From chaos to complete control.</h2>
            <p className={`${landingDescriptionClass} mt-4 max-w-xl`}>
              Our refined workflow is designed to map exactly to the real-world operations of your study hall or offline education business.
            </p>

            <div className={`${landingPanelClass} mt-8 flex items-start gap-3 p-5`}>
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[color:var(--ui-tone-success-text)]" />
              <p className="text-sm leading-6 text-[color:var(--text-secondary)]">
                <strong className="text-[color:var(--text-primary)]">Join 500+</strong> owners managing their businesses today.
              </p>
            </div>
          </div>

          <div className={`${landingPanelClass} p-4 sm:p-5`}>
            <div className="space-y-4">
              {steps.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div key={item.step} className="relative flex gap-4">
                    {index !== steps.length - 1 && (
                      <div className="absolute bottom-[-16px] left-5 top-11 w-px bg-[color:var(--ui-form-section-divider)]" />
                    )}
                    <div className={`${landingInsetClass} z-10 flex h-10 w-10 shrink-0 items-center justify-center text-[color:var(--ui-form-accent)]`}>
                      <Icon size={17} />
                    </div>
                    <div className="min-w-0 pb-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={landingSubtleTextClass + " text-xs font-semibold"}>{item.step}</span>
                        <h3 className="text-base font-semibold text-[color:var(--text-primary)]">{item.title}</h3>
                      </div>
                      <p className={`${landingMutedTextClass} mt-1 text-sm leading-6`}>{item.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
