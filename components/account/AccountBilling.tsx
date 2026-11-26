"use client";
import { useEffect } from "react";
import { BranchBillingSummary } from "./BranchBillingSummary";
import { useRouter, useSearchParams } from "next/navigation";
import { SettingsField, SettingsSelect } from "@/components/settings/SettingsWorkspace";
import { OrganizationBillingContent } from "@/components/billing/OrganizationBillingContent";
import { useTranslation } from "@/components/settings/LocalizedText";
import type { WorkspaceDirectoryOrganization } from "@/types";
import { accountBillingContext, accountBillingHref, accountWorkspaceReturn } from "@/lib/accountNavigation";

export function AccountBilling({ organizations, organizationId, branchId }: {
    organizations: WorkspaceDirectoryOrganization[]; organizationId: string; branchId?: string;
}) {
    const router = useRouter(), search = useSearchParams(), t = useTranslation();
    const { organization, branch } = accountBillingContext(organizations, { organizationId, branchId, returnTo: search.get("returnTo") })!;
    const returnPath = accountBillingHref(organization.id, branch?.id, accountWorkspaceReturn(organization, branch?.id, search.get("returnTo")));
    useEffect(() => {
        const refresh = () => router.refresh();
        window.addEventListener("focus", refresh);
        window.addEventListener("billing-access-changed", refresh);
        window.addEventListener("workspace-directory-changed", refresh);
        return () => {
            window.removeEventListener("focus", refresh);
            window.removeEventListener("billing-access-changed", refresh);
            window.removeEventListener("workspace-directory-changed", refresh);
        };
    }, [router]);
    function select(org: string, selectedBranch?: string) {
        const selected = organizations.find(item => item.id === org);
        if (!selected) return;
        router.push(accountBillingHref(org, selectedBranch, accountWorkspaceReturn(selected, selectedBranch)));
    }
    return <div className="mx-auto max-w-6xl space-y-4">
        {organizations.length > 1 && <SettingsField label={t("Organization")}><SettingsSelect value={organizationId} onValueChange={value => select(value)} options={organizations.map(org => ({ value: org.id, label: org.name }))} /></SettingsField>}
        <BranchBillingSummary organization={organization} selectedBranchId={branch?.id} returnTo={search.get("returnTo")} />
        {branch && <OrganizationBillingContent key={organization.id + ":" + branch.id} orgId={organization.id} branchId={branch.id} branchName={branch.name} returnPath={returnPath} />}
    </div>;
}
