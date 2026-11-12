"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "@/components/settings/LocalizedText";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { workspaces } from "@/lib/api/workspaces";
import type { WorkspaceDirectory } from "@/types";
import { branchSwitchDestination } from "@/lib/basicNavigation";
import { cn } from "@/lib/utils";
import { canNavigateWorkspace } from "@/lib/workspaceNavigationGuard";

export function WorkspaceSwitcher({ className, beforeNavigate, wrapBranchName = false }: { className?: string; beforeNavigate?: () => boolean; wrapBranchName?: boolean }) {
    const pathname = usePathname();
    const router = useRouter();
    const { ownerKey } = useUserPreferences();
    const [directory, setDirectory] = useState<WorkspaceDirectory | null>(null);
    const [directoryOwner, setDirectoryOwner] = useState<string | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        workspaces.getDirectory()
            .then(result => {
                if (!cancelled) {
                    setDirectory(result);
                    setDirectoryOwner(ownerKey);
                    setError(false);
                }
            })
            .catch(() => {
                if (!cancelled) setError(true);
            });
        return () => { cancelled = true; };
    }, [ownerKey]);

    return <BranchWorkspaceControls directory={directoryOwner === ownerKey ? directory : null} error={error} pathname={pathname} className={className} wrapBranchName={wrapBranchName} onNavigate={href => { const navigate = () => { if (!beforeNavigate || beforeNavigate()) router.push(href); }; if (canNavigateWorkspace(navigate)) navigate(); }} />;
}

export function BranchWorkspaceControls({ directory, error, pathname, className, wrapBranchName = false, onNavigate }: {
    directory: WorkspaceDirectory | null;
    error?: boolean;
    pathname: string | null;
    className?: string;
    wrapBranchName?: boolean;
    onNavigate: (href: string) => void;
}) {
    const t = useTranslation();
    const currentId = pathname?.match(/^\/branch\/([^/]+)/)?.[1];
    const currentOrganizationId = pathname?.match(/^\/org\/([^/]+)/)?.[1];
    const branches = [...new Map([
        ...(directory?.organizations.flatMap(organization => organization.branches) ?? []),
        ...(directory?.staffBranches ?? []),
    ].map(branch => [branch.id, branch])).values()];
    const current = branches.find(branch => branch.id === currentId);
    const selectedOrganization = current?.organizationId ?? currentOrganizationId
        ?? directory?.organizations[0]?.id ?? branches[0]?.organizationId;
    const organizationName = directory?.organizations.find(organization => organization.id === selectedOrganization)?.name
        ?? branches.find(branch => branch.organizationId === selectedOrganization)?.organizationName;
    const branchOptions = branches.filter(branch => branch.organizationId === selectedOrganization);
    const status = t.owned(error ? "Workspaces unavailable" : directory ? "No workspaces available" : "Loading workspaces");

    return <div className={cn("reference-workspace-switcher flex min-w-0 items-center gap-4", className)}>
        <span aria-label={t.owned("Current organization")} title={organizationName} className="ui-workspace-organization">{organizationName ?? status}</span>
        <label className={cn("ui-workspace-branch", wrapBranchName && "ui-workspace-branch--wrap")}>
            {wrapBranchName && <span className="ui-workspace-branch-name" aria-hidden="true"><span>{current?.name ?? (branchOptions.length ? t("Choose branch") : status)}</span><ChevronDown size={16} /></span>}
            <span className="sr-only">{t("Branch")}</span>
            <select aria-label={t("Switch branch")} value={current?.id ?? ""} disabled={!directory || Boolean(error) || !branchOptions.length}
                className="mt-0.5 block h-11 w-[180px] max-w-full rounded-md border border-[color:var(--ui-panel-border)] bg-[color:var(--ui-form-input-bg)] px-2 text-[11px] font-semibold text-[color:var(--text-primary)] lg:h-[29px]"
                onChange={event => { const branch = branchOptions.find(item => item.id === event.target.value); if (branch) onNavigate(branchSwitchDestination(pathname, branch.href, branch.role==="OWNER"?undefined:branch.permissions)); }}>
                {!current && <option value="">{branchOptions.length ? t("Choose branch") : status}</option>}
                {branchOptions.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
        </label>
    </div>;
}
