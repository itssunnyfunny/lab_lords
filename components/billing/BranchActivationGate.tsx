"use client";

import Link from "next/link";
import { Archive, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "@/components/settings/LocalizedText";
import { useBillingExperience } from "@/components/billing/BillingExperienceProvider";
import { accountBillingHref } from "@/lib/accountNavigation";

export function BranchActivationGate({ children }: { children: ReactNode }) {
  const t = useTranslation();
  const billingContext = useBillingExperience();
  const branch = billingContext?.experience?.branch;
  if (billingContext?.loading && !branch) return <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!branch || branch.billingStatus === "ACTIVE" || branch.billingStatus === "REMOVAL_SCHEDULED") return <>{children}</>;

  const owner = billingContext?.experience?.viewer.canManageBilling;
  const organizationId = billingContext?.experience?.organizationId;
  const pending = branch.billingStatus === "PENDING_ACTIVATION";
  return (
    <div className="mx-auto flex min-h-96 max-w-xl flex-col items-center justify-center gap-4 text-center">
      <Archive className="h-10 w-10 text-amber-500" />
      <div>
        <h1 className="text-xl font-bold text-[color:var(--ui-text)]">{pending ? t("Branch activation is pending") : t("This branch is archived")}</h1>
        {owner && <p className="mt-2 text-sm text-[color:var(--ui-text-muted)]">{t.owned(pending ? "Confirm this branch subscription in Account billing to activate it." : "Open Account billing to review reactivation for this branch.")}</p>}
      </div>
      {owner && organizationId && <Link className="inline-flex items-center px-2 font-semibold text-[color:var(--ui-accent)] hover:underline" href={accountBillingHref(organizationId, branch.id, `/branch/${branch.id}`)}>{t.owned("Manage branch plan")}</Link>}
    </div>
  );
}
