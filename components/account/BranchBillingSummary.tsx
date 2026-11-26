"use client";

import Link from "next/link";
import { appActionClassName } from "@/components/ui/AppButton";
import { AppPanel } from "@/components/ui";
import { useTranslation } from "@/components/settings/LocalizedText";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { accountBillingHref, accountWorkspaceReturn } from "@/lib/accountNavigation";
import type { WorkspaceDirectoryOrganization } from "@/types";
import { branchAccessLabel, branchPlanLabel } from "@/lib/branchBillingLabels";

export function BranchBillingSummary({ organization, selectedBranchId, returnTo }: {
    organization: WorkspaceDirectoryOrganization;
    selectedBranchId?: string;
    returnTo?: string | null;
}) {
    const t = useTranslation();
    const { formatDate, formatNumber } = useUserPreferences();
    const money = (subunits: number) => formatNumber(subunits / 100, { style: "currency", currency: "INR" });
    const total = organization.branches.reduce<number | null>((sum, branch) => {
        const confirmed = branch.billing?.monthlyCommitment;
        return sum === null || confirmed == null ? null : sum + confirmed;
    }, 0);
    return <AppPanel density="compact" title={organization.name} description={t.owned("Each branch has its own subscription, charge date and invoices.")}>
        <p className="mb-3 text-sm">{t.owned("Confirmed monthly commitments")} <strong>{total === null ? t.owned("Awaiting confirmation") : money(total)}</strong></p>
        <ul className="divide-y divide-[color:var(--ui-panel-border)]">
            {organization.branches.map(branch => {
                const details = branch.billing;
                return <li key={branch.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="space-y-1 text-sm">
                        <strong>{branch.name}</strong>
                        {details ? <>
                            <p>{t.owned(branchPlanLabel(details.effectivePlan))} · {t.owned(branchAccessLabel(details.customerState))}{details.billingStatus !== "ACTIVE" && ` · ${t.owned(branchAccessLabel(details.billingStatus))}`}</p>
                            {details.selectedPlan && <p>{t.owned("Future paid plan")} · {t.owned(branchPlanLabel(details.selectedPlan))}</p>}
                            <p>{t.owned("Subscription status")} · {details.subscriptionStatus ? t.owned(details.subscriptionStatus) : t.owned("No subscription")}</p>
                            {details.trialEndsAt && <p>{t.owned("Trial ends")} · {formatDate(details.trialEndsAt)}</p>}
                            {details.paidThrough && <p>{t.owned("Paid through")} · {formatDate(details.paidThrough)}</p>}
                            <p>{t.owned("Monthly commitment")} · {details.monthlyCommitment == null ? t.owned("Awaiting confirmation") : money(details.monthlyCommitment)}</p>
                            {details.nextChargeAt && <p>{t.owned("Next charge")} · {formatDate(details.nextChargeAt)}{details.nextChargeAmount != null && ` · ${money(details.nextChargeAmount)}`}</p>}
                            {details.pendingPlan && <p>{t.owned("Pending plan change")} · {t.owned(branchPlanLabel(details.pendingPlan))}{details.effectiveAt && ` · ${formatDate(details.effectiveAt)}`}</p>}
                        </> : <p>{t.owned("Branch billing details are unavailable. Refresh to try again.")}</p>}
                    </div>
                    {branch.id === selectedBranchId ? <span className="text-sm">{t.owned("Selected branch")}</span> :
                        <Link className={appActionClassName("secondary")} href={accountBillingHref(organization.id, branch.id, accountWorkspaceReturn(organization, branch.id, returnTo))}>{t.owned("Manage branch plan")}</Link>}
                </li>;
            })}
        </ul>
    </AppPanel>;
}
