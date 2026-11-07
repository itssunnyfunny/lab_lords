"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { SettingsField, SettingsSelect } from "@/components/settings/SettingsWorkspace";
import { OrganizationBillingContent } from "@/components/billing/OrganizationBillingContent";
import { BillingExperienceProvider } from "@/components/billing/BillingExperienceProvider";
import { useTranslation } from "@/components/settings/LocalizedText";
import type { WorkspaceDirectoryOrganization } from "@/types";
import { accountBillingContext, accountBillingHref, accountWorkspaceReturn } from "@/lib/accountNavigation";

export function AccountBilling({ organizations, organizationId, branchId }: {
    organizations: WorkspaceDirectoryOrganization[]; organizationId: string; branchId?: string;
}) {
    const router = useRouter(), search = useSearchParams(), t = useTranslation();
    const { organization, branch } = accountBillingContext(organizations, { organizationId, branchId, returnTo: search.get("returnTo") })!;
    const returnPath = accountBillingHref(organization.id, branch?.id, accountWorkspaceReturn(organization, branch?.id, search.get("returnTo")));
    function select(org: string, selectedBranch?: string) {
        const selected = organizations.find(item => item.id === org);
        if (!selected) return;
        router.push(accountBillingHref(org, selectedBranch, accountWorkspaceReturn(selected, selectedBranch)));
    }
    return <div className="mx-auto max-w-6xl space-y-5">
        <section className="ui-account-provider p-4 sm:p-5" aria-label={t.owned("Subscription workspace")}>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[color:var(--text-muted)]">{t.owned("Subscription belongs to")}</p>
            <h2 className="text-xl font-semibold">{organization.name}</h2>
            <p className="mt-2 text-sm text-[color:var(--text-secondary)]">{t.owned("One organization subscription covers its branches.")}{branch && <> {t.owned("Selected branch")}: <strong>{branch.name}</strong>.</>}</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <SettingsField label={t("Organization")}>
                    <SettingsSelect value={organizationId} onValueChange={value => select(value)} options={organizations.map(org => ({ value: org.id, label: org.name }))} />
                </SettingsField>
                <SettingsField label={t.owned("Branch context")}>
                    <SettingsSelect value={branchId ?? "all"} onValueChange={value => select(organizationId, value === "all" ? undefined : value)} options={[{ value: "all", label: t.owned("All branches") }, ...organization.branches.map(item => ({ value: item.id, label: item.name }))]} />
                </SettingsField>
            </div>
        </section>
        <BillingExperienceProvider key={organizationId} organizationId={organizationId}>
            <OrganizationBillingContent key={organizationId} orgId={organizationId} returnPath={returnPath} />
        </BillingExperienceProvider>
    </div>;
}
