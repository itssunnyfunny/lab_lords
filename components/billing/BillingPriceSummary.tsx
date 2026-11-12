"use client";

import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { useTranslation } from "@/components/settings/LocalizedText";
import { billingPlanName, isBillingPlanId } from "@/lib/billingPlans";
import type { OrganizationSubscriptionDto } from "@/lib/api/billing";
import { getProviderPaymentMethodLabel } from "@/lib/billingPaymentMethods";
import type { BillingExperience } from "@/types/billingExperience";

type BillingPriceSummaryProps = {
  experience: BillingExperience;
  current: OrganizationSubscriptionDto | null;
};

function SummaryRow({
  label,
  value,
  detail,
  emphasis = false,
}: {
  label: string;
  value: string;
  detail?: string;
  emphasis?: boolean;
}) {
  const t = useTranslation();
  return (
    <div className="min-w-0 py-2">
      <dt className="text-xs font-medium text-[color:var(--text-muted)]">{t.owned(label)}</dt>
      <dd className={`mt-1 font-semibold text-[color:var(--text-primary)] ${emphasis ? "text-base" : "text-sm"}`}>{t.owned(value)}</dd>
      {detail ? <p className="mt-0.5 text-xs text-[color:var(--text-secondary)]">{t.owned(detail)}</p> : null}
    </div>
  );
}

export function BillingPriceSummary({ experience, current }: BillingPriceSummaryProps) {
  const t = useTranslation();
  const { formatNumber, formatDate: preferenceDate } = useUserPreferences();
  const formatDate = (value: string) => preferenceDate(value, { day: "numeric", month: "long", year: "numeric" });
  const formatInr = (amount: number) => formatNumber(amount, { style: "currency", currency: "INR", maximumFractionDigits: 0 });
  const trialActive = experience.effectivePlan === "STANDARD_TRIAL"
    || (experience.trialDaysRemaining != null && experience.trialDaysRemaining > 0);
  const paidPlanActive = isBillingPlanId(experience.effectivePlan)
    && (experience.billingAccessSource === undefined || experience.billingAccessSource === "PAID" || experience.billingAccessSource === "PAYMENT_RETRY")
    && experience.paidThrough != null;
  const selectedPlanName = experience.selectedPostTrialPlan ? billingPlanName(experience.selectedPostTrialPlan) : null;
  const authorizationLabel = experience.authorizationStatus === "AUTHORIZED"
    ? "Authorized"
    : experience.authorizationStatus === "VERIFYING"
      ? "Verifying with Razorpay"
      : "Not authorized";
  const firstCharge = experience.nextChargeAt
    ? formatDate(experience.nextChargeAt)
    : experience.authorizationStatus === "AUTHORIZED"
      ? "Authorized — Razorpay charge date pending"
      : experience.authorizationStatus === "VERIFYING"
        ? "Waiting for Razorpay confirmation"
        : "Not scheduled — authorize a payment method first";
  const paymentMethodLabel = getProviderPaymentMethodLabel(current?.providerPaymentMethod);

  if (paidPlanActive) {
    // Effective features can include a complimentary replacement grant. The
    // paid subscription and its amounts remain on the source until cutover.
    const billedPlanName = current ? billingPlanName(current.plan) : selectedPlanName ?? "Provider confirmation pending";
    const effectivePlanName = billingPlanName(experience.effectivePlan);
    return (
      <section className="space-y-4 px-5 pt-4" aria-label={t.owned("Current subscription")}>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryRow label="Billed plan" value={billedPlanName} emphasis />
          <SummaryRow label="Current access" value={effectivePlanName}
            detail={billedPlanName !== effectivePlanName ? t("You can use {access}; your subscription is still billed as {plan}.", {access:effectivePlanName,plan:billedPlanName}) : undefined} />
          <SummaryRow
            label="Monthly branch billing"
            value={t("{formatInr}/month", { formatInr: formatInr(experience.currentMonthlyTotal) })}
            detail={t("{count} branch(s) × {amount}", { count: experience.confirmedQuantity, amount: formatInr(experience.currentUnitAmount) })}
            emphasis
          />
          <SummaryRow
            label="Payment method"
            value={current ? paymentMethodLabel : "Provider confirmation pending"}
            detail={current ? "Recurring mandate managed securely by Razorpay" : undefined}
          />
          <SummaryRow label="Paid through" value={experience.paidThrough ? formatDate(experience.paidThrough) : "Awaiting paid invoice"} />
          <SummaryRow label="Next charge" value={experience.nextChargeAt ? formatDate(experience.nextChargeAt) : "Not scheduled"} />
        </dl>
        <p className="text-xs text-[color:var(--text-secondary)]">{t.owned("Your current subscription and renewal dates.")}</p>
      </section>
    );
  }

  return (
    <section
      className="grid gap-4 px-5 pt-4 lg:grid-cols-2"
      aria-label={t.owned(trialActive ? "Trial and post-trial billing summary" : "Billing authorization summary")}
    >
      <div className="rounded-[var(--ui-radius-panel)] border border-[color:var(--ui-badge-cyan-border)] bg-[color:var(--ui-badge-cyan-bg)] p-4">
        <h3 className="text-base font-semibold text-[color:var(--text-primary)]">{t.owned("Current access")}</h3>
        <p className="mt-1 text-xs text-[color:var(--text-secondary)]">{t.owned("What your workspace can use right now.")}</p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <SummaryRow label="Access now" value={trialActive ? experience.effectivePlan === "BASIC" ? "Basic trial" : experience.effectivePlan === "PRO" ? experience.trialPlan === "PRO" ? "Pro trial" : "Pro complimentary access during trial" : "Standard trial" : "No active paid plan"} emphasis />
          {trialActive ? (
            <SummaryRow label="Plan fee today" value={formatInr(experience.planFeeDueToday)} />
          ) : (
            <SummaryRow label="Billing status" value="No paid subscription period confirmed yet" />
          )}
          {trialActive && experience.trialEndsAt ? (
            <SummaryRow label="Trial ends" value={formatDate(experience.trialEndsAt)} />
          ) : null}
          <SummaryRow
            label="Workspace access"
            value={experience.accessMode === "READ_ONLY" ? "Read-only" : trialActive && experience.effectivePlan === "BASIC" ? "Basic features" : trialActive && experience.effectivePlan !== "PRO" ? "Full Standard features" : "Full access"}
          />
        </dl>
      </div>

      <div className="rounded-[var(--ui-radius-panel)] border border-[color:var(--ui-form-surface-border)] bg-[color:var(--ui-form-muted-surface-bg)] p-4">
        <h3 className="text-base font-semibold text-[color:var(--text-primary)]">
          {t.owned(trialActive ? "After the trial" : "Plan authorization")}
        </h3>
        <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
          {t.owned(trialActive ? "The plan and recurring billing that begin after your trial." : "Authorize recurring billing before paid access can begin.")}
        </p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <SummaryRow label="Selected plan" value={selectedPlanName ?? "Choose a plan"} emphasis />
          <SummaryRow
            label="Payment mandate"
            value={authorizationLabel}
            detail={current ? t("Recurring method: {method}", { method: t.owned(paymentMethodLabel) }) : undefined}
          />
          <SummaryRow
            label="Estimated monthly total"
            value={selectedPlanName ? t("{formatInr}/month", { formatInr: formatInr(experience.projectedMonthlyTotal) }) : "Choose a plan"}
            detail={selectedPlanName
              ? t("{count} branch(s) × {amount}", { count: experience.projectedQuantity, amount: formatInr(experience.projectedUnitAmount) })
              : undefined}
          />
          <SummaryRow label="First plan charge" value={firstCharge} />
        </dl>
        <p className="mt-3 text-xs leading-5 text-[color:var(--text-secondary)]">
          {t.owned(trialActive
            ? "No plan fee is charged during your trial. Any payment authorization is a separate choice."
            : "Paid access starts only after Razorpay confirms the subscription payment. Your existing data remains preserved while access is inactive.")}
        </p>
      </div>
    </section>
  );
}
