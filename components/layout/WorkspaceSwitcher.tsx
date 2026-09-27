"use client";

import { useTranslation } from "@/components/settings/LocalizedText";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppSelect, type AppSelectItem } from "@/components/ui";
import { workspaces } from "@/lib/api/workspaces";
import type { WorkspaceDirectory } from "@/types";
import { cn } from "@/lib/utils";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";

function currentWorkspaceHref(pathname: string | null) {
    const branchMatch = pathname?.match(/^\/branch\/([^/]+)/);
    if (branchMatch) return `/branch/${branchMatch[1]}`;
    const organizationMatch = pathname?.match(/^\/org\/([^/]+)/);
    if (organizationMatch) return `/org/${organizationMatch[1]}`;
    return "/app";
}

type WorkspaceDestination = {
    href: string;
    label: string;
    group: string;
};

export function getWorkspaceSwitcherModel(directory: WorkspaceDirectory) {
    const destinations: WorkspaceDestination[] = [
        ...directory.organizations.flatMap(organization => [
            {
                href: organization.href,
                label: `${organization.name} overview`,
                group: organization.name,
            },
            ...organization.branches.map(branch => ({
                href: branch.href,
                label: branch.name,
                group: organization.name,
            })),
        ]),
        ...directory.staffBranches.map(branch => ({
            href: branch.href,
            label: `${branch.name} — ${branch.organizationName}`,
            group: "Branch workspaces",
        })),
    ];

    return {
        label: directory.organizations.length > 0 ? "Org / Branch" : "Branch",
        destinations,
    };
}

export function getWorkspaceSwitcherOptions(
    directory: WorkspaceDirectory | null,
    error = false
): AppSelectItem[] {
    const destinations = directory ? getWorkspaceSwitcherModel(directory).destinations : [];
    const groups = destinations.reduce<Map<string, WorkspaceDestination[]>>((result, destination) => {
        const group = result.get(destination.group) ?? [];
        group.push(destination);
        result.set(destination.group, group);
        return result;
    }, new Map());
    const workspaceOptions: AppSelectItem[] = [...groups.entries()].map(([group, groupDestinations]) => ({
        label: group,
        options: groupDestinations.map(destination => ({
            value: destination.href,
            label: destination.label,
        })),
    }));
    const statusLabel = error
        ? "Workspaces unavailable"
        : directory
            ? "No workspaces available"
            : "Loading workspaces";

    return [
        ...workspaceOptions,
        ...(workspaceOptions.length === 0
            ? [{ value: "__workspace_status__", label: statusLabel, disabled: true }]
            : []),
        {
            label: "Account",
            options: [{
                value: "/account",
                label: "Account settings",
                description: "Profile, locale, and preferences",
            }],
        },
    ];
}

export function WorkspaceSwitcherControl({
    directory,
    error = false,
    pathname,
    className,
    onNavigate,
}: {
    directory: WorkspaceDirectory | null;
    error?: boolean;
    pathname: string | null;
    className?: string;
    onNavigate: (href: string) => void;
}) {
    const t = useTranslation();
    const model = useMemo(
        () => directory ? getWorkspaceSwitcherModel(directory) : null,
        [directory]
    );
    const availableHrefs = useMemo(
        () => new Set(model?.destinations.map(destination => destination.href) ?? []),
        [model]
    );
    const currentHref = currentWorkspaceHref(pathname);
    const fallbackHref = directory && availableHrefs.has(directory.defaultHref)
        ? directory.defaultHref
        : model?.destinations[0]?.href;
    const value = availableHrefs.has(currentHref) ? currentHref : fallbackHref;
    const label = model?.label ?? "Workspace";
    const statusLabel = error
        ? "Workspaces unavailable"
        : directory
            ? "No workspaces available"
            : "Loading workspaces";
    const selectOptions = useMemo(
        () => getWorkspaceSwitcherOptions(directory, error),
        [directory, error]
    );
    const currentValue = pathname?.startsWith("/account") ? "/account" : (value ?? "");

    return (
        <AppSelect
            value={currentValue}
            options={selectOptions}
            onValueChange={onNavigate}
            label={t.owned(label)}
            aria-label={t("Switch workspace or open account settings")}
            placeholder={t.owned(statusLabel)}
            containerClassName={cn("min-w-0", className)}
            labelClassName="mb-0 text-[10px] font-semibold uppercase leading-4 tracking-[0.12em] text-[color:var(--text-muted)]"
            className="max-w-56 px-2 font-semibold sm:px-3"
        />
    );
}

export function WorkspaceSwitcher({ className, separated = false }: { className?: string; separated?: boolean }) {
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
        return () => {
            cancelled = true;
        };
    }, [ownerKey]);

    const visibleDirectory = directoryOwner === ownerKey ? directory : null;
    if (separated) return <BranchWorkspaceControls directory={visibleDirectory} error={error} pathname={pathname} className={className} onNavigate={href => router.push(href)} />;

    return (
        <WorkspaceSwitcherControl
            directory={visibleDirectory}
            error={error}
            pathname={pathname}
            className={className}
            onNavigate={href => router.push(href)}
        />
    );
}

export function BranchWorkspaceControls({ directory, error, pathname, className, onNavigate }: {
    directory: WorkspaceDirectory | null; error?: boolean; pathname: string | null; className?: string; onNavigate: (href: string) => void;
}) {
    const t = useTranslation();
    const currentId = pathname?.match(/^\/branch\/([^/]+)/)?.[1];
    const branches = [...(directory?.organizations.flatMap(organization => organization.branches) ?? []), ...(directory?.staffBranches ?? [])];
    const current = branches.find(branch => branch.id === currentId);
    const organizations = [...(directory?.organizations.map(organization => ({ id: organization.id, name: organization.name, href: organization.href })) ?? [])];
    for (const branch of directory?.staffBranches ?? []) if (!organizations.some(organization => organization.id === branch.organizationId)) organizations.push({ id: branch.organizationId, name: branch.organizationName, href: branch.href });
    const selectedOrganization = current?.organizationId ?? organizations[0]?.id ?? "";
    const branchOptions = branches.filter(branch => branch.organizationId === selectedOrganization);
    const status = t.owned(error ? "Workspaces unavailable" : "Loading workspaces");
    return <div className={cn("reference-workspace-switcher flex min-w-0 items-center gap-4", className)}>
        <label className="min-w-0 text-[10px] text-[color:var(--text-muted)]">{t("Organization")}<select aria-label={t("Switch organization")} value={selectedOrganization} disabled={!directory || Boolean(error)}
            className="mt-0.5 block h-[29px] w-[138px] max-w-full rounded-md border border-[color:var(--ui-panel-border)] bg-white px-2 text-[11px] font-semibold text-[color:var(--text-primary)]"
            onChange={event => { const value = event.target.value.replace(/^overview:/, ""); const org = organizations.find(item => item.id === value); if (org) onNavigate(org.href); }}>
            {!organizations.length && <option value="">{status}</option>}{organizations.map(organization => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
            {directory?.organizations.some(organization => organization.id === selectedOrganization) && <option value={`overview:${selectedOrganization}`}>{t("Organization overview")}</option>}
        </select></label>
        <label className="min-w-0 text-[10px] text-[color:var(--text-muted)]">{t("Branch")}<select aria-label={t("Switch branch")} value={current?.id ?? ""} disabled={!directory || Boolean(error)}
            className="mt-0.5 block h-[29px] w-[180px] max-w-full rounded-md border border-[color:var(--ui-panel-border)] bg-white px-2 text-[11px] font-semibold text-[color:var(--text-primary)]"
            onChange={event => { const branch = branchOptions.find(item => item.id === event.target.value); if (branch) onNavigate(branch.href); }}>
            {!current && <option value="">{directory ? t("Choose branch") : status}</option>}{branchOptions.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
        </select></label>
    </div>;
}
