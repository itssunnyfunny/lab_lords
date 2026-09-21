import { publicStrings } from "@/lib/public-i18n/server";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { PlanCTA } from "@/components/landing/MarketingActions";
import { publicBillingPlans, type BillingPlan } from "@/lib/billingPlans";

function formatPrice(plan: Pick<BillingPlan, "amount" | "currency" | "custom">) {
  if (plan.amount == null || plan.custom) return "Custom";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: plan.currency,
    maximumFractionDigits: 0,
  }).format(plan.amount);
}

export async function LandingPricing({ showIntroduction = true, showComparisonLink = true, summary = false }: { showIntroduction?: boolean; showComparisonLink?: boolean; summary?: boolean }) {
  const { t, href: localHref } = await publicStrings();
  const plans = publicBillingPlans();

  return (
    <section id="pricing" className="marketing-section">
      <div className="marketing-container">
        {showIntroduction && (
          <div className="mb-10 max-w-3xl">
            <p className="marketing-eyebrow">{t("Simple monthly pricing")}</p>
            <h2 className="marketing-title mt-3">{t("Choose what your library needs.")}</h2>
            <p className="marketing-lead mt-4">{t("Two plans. Clear monthly pricing for each billable branch.")}</p>
            <p className="marketing-plan-note mt-3">{t("Eligible new owners can try Standard features for 30 days after setting up their first branch. No card needed.")}</p>
          </div>
        )}
        <div className="grid gap-6 md:grid-cols-2">
          {plans.map(plan => (
            <article key={plan.id} className="marketing-card flex flex-col p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-semibold">{plan.shortName}</h2>
                {plan.capabilities.some(capability => capability.id === "STAFF_CONTROLS" && capability.included) && (
                  <span className="rounded-full border border-[color:var(--ui-panel-border)] px-3 py-1 text-xs font-medium">{t("For your team")}</span>
                )}
              </div>
              <p className="mt-3 min-h-12 text-sm leading-6 text-[color:var(--text-secondary)]">
                {t(plan.id === "BASIC"
                  ? t("For your student records, seats and daily fee tracking.")
                  : plan.id === "PRO"
                    ? t("For staff access, detailed reports and AI assistance.")
                    : t(plan.description))}
              </p>
              <div className="mb-6 mt-7">
                <p className="text-4xl font-semibold tracking-tight">{formatPrice(plan)}</p>
                {!plan.custom && <p className="marketing-plan-note mt-2">{t("Per billable branch / month")}</p>}
              </div>
              <PlanCTA planId={plan.id} active={plan.active} label={t("Choose {plan}", { plan: plan.shortName })} />
              {!summary && <><h3 className="mb-4 mt-8 border-t border-[color:var(--ui-panel-border)] pt-6 text-sm font-semibold">{t("What's included?")}</h3>
              <ul className="space-y-3">
                {plan.capabilities.map(capability => (
                  <li key={capability.id} className="flex items-start gap-3 text-sm leading-6">
                    {capability.included
                      ? <Check size={17} className="mt-1 shrink-0 text-[color:var(--ui-form-accent)]" aria-hidden="true" />
                      : <Minus size={17} className="mt-1 shrink-0 text-[color:var(--text-muted)]" aria-hidden="true" />}
                    <span className="text-[color:var(--text-secondary)]">
                      {t(capability.label)}
                      {!capability.included && <span className="block text-xs">{t("Not included in {plan}", { plan: plan.shortName })}</span>}
                    </span>
                  </li>
                ))}
              </ul></>}
            </article>
          ))}
        </div>
        {showComparisonLink && (
          <div className="marketing-actions mt-8">
            <Link href={localHref("/pricing")} className="marketing-button-secondary">{t("View pricing")}</Link>
          </div>
        )}
      </div>
    </section>
  );
}
