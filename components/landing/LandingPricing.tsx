import { ArrowRight, Check } from "lucide-react";
import {
  landingContainerClass,
  landingDescriptionClass,
  landingEyebrowClass,
  landingMutedTextClass,
  landingPanelClass,
  landingPrimaryButtonClass,
  landingSecondaryButtonClass,
  landingSectionClass,
  landingSubtleTextClass,
  landingTitleClass,
} from "@/components/ui/landingSurface";

const plans = [
  {
    name: "Starter",
    price: "Free",
    suffix: "/ forever",
    description: "Perfect for a single starting branch.",
    featured: false,
    features: ["1 Branch Location", "Up to 50 Active Students", "Basic Seat Allocation", "Standard Dashboard", "Community Support"],
  },
  {
    name: "Professional",
    price: "Rs.999",
    suffix: "/ month",
    description: "For growing multi-branch businesses.",
    featured: true,
    features: ["Up to 3 Branch Locations", "Unlimited Active Students", "Advanced Seat Mapping", "Payment & Due Tracking", "Manager Role Access", "Priority Email Support"],
  },
  {
    name: "Enterprise",
    price: "Custom",
    suffix: "",
    description: "Bespoke limits for large operations.",
    featured: false,
    features: ["Unlimited Branch Locations", "Custom Roles & Permissions", "AI-Powered Insights Module", "Detailed audit history", "Dedicated Success Manager", "24/7 Phone Support"],
  },
];

export function LandingPricing({
  onDashboardClick,
}: {
  onDashboardClick: () => void;
}) {
  return (
    <section id="pricing" className={`${landingSectionClass} bg-[color:var(--ui-form-muted-surface-bg)]`}>
      <div className={landingContainerClass}>
        <div className="mb-10 max-w-3xl md:mb-14">
          <p className={landingEyebrowClass}>Simple Pricing</p>
          <h2 className={`${landingTitleClass} mt-3`}>Scale without limits.</h2>
          <p className={`${landingDescriptionClass} mt-4`}>
            Start for free, then choose a plan that perfectly fits the size of your operations. No hidden fees or complex contracts.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {plans.map(plan => (
            <div
              key={plan.name}
              className={`${landingPanelClass} flex flex-col p-5 ${plan.featured ? "border-[color:var(--ui-badge-cyan-border)] bg-[color:var(--ui-badge-cyan-bg)]" : ""}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-[color:var(--text-primary)]">{plan.name}</h3>
                  <p className={`${landingMutedTextClass} mt-2 text-sm leading-6`}>{plan.description}</p>
                </div>
                {plan.featured && (
                  <span className="rounded-full border border-[color:var(--ui-badge-cyan-border)] bg-[color:var(--ui-form-muted-surface-bg)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--ui-badge-cyan-text)]">
                    Most Popular
                  </span>
                )}
              </div>

              <div className="mt-6">
                <span className="text-3xl font-semibold tracking-tight text-[color:var(--text-primary)]">{plan.price}</span>
                <span className={`${landingSubtleTextClass} ml-2 text-sm`}>{plan.suffix}</span>
              </div>

              <button
                type="button"
                onClick={onDashboardClick}
                className={`${plan.featured ? landingPrimaryButtonClass : landingSecondaryButtonClass} mt-6 w-full`}
              >
                Get Started
                <ArrowRight size={15} />
              </button>

              <div className="mt-6 flex-1 space-y-3">
                {plan.features.map(feature => (
                  <div key={feature} className="flex items-center gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[color:var(--ui-badge-success-border)] bg-[color:var(--ui-badge-success-bg)] text-[color:var(--ui-badge-success-text)]">
                      <Check size={12} />
                    </span>
                    <span className="text-sm text-[color:var(--text-secondary)]">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
