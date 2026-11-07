import { workspaceReturnPath } from "@/lib/contextualNavigation";
import { authorizedWorkspaceReturn } from "@/lib/basicNavigation";
import type { WorkspaceDirectory, WorkspaceDirectoryOrganization } from "@/types";

export type AccountBillingQuery = { organizationId?: string | null; branchId?: string | null; returnTo?: string | null };

/** Explicit scope wins; legacy return hints only select branches in the owned directory. */
export function accountBillingContext(organizations: WorkspaceDirectoryOrganization[], requested: AccountBillingQuery) {
    const hintedBranch = workspaceReturnPath(requested.returnTo ?? null)?.match(/^\/branch\/([^/]+)(?:\/|$)/)?.[1];
    const organization = requested.organizationId
        ? organizations.find(item => item.id === requested.organizationId)
        : requested.branchId ? organizations.find(item => item.branches.some(branch => branch.id === requested.branchId))
        : organizations.find(item => item.branches.some(branch => branch.id === hintedBranch)) ?? organizations[0];
    if (!organization || (requested.branchId && !organization.branches.some(branch => branch.id === requested.branchId))) return null;
    const branch = organization.branches.find(item => item.id === (requested.branchId ?? hintedBranch));
    return { organization, branch };
}

/** Preserve a valid origin within the selected organization, including its settings page. */
export function accountWorkspaceReturn(organization: Pick<WorkspaceDirectoryOrganization, "id" | "branches">, branchId?: string | null, requested?: string | null) {
    const path = workspaceReturnPath(requested ?? null);
    if (path?.match(/^\/org\/([^/]+)(?:\/|$)/)?.[1] === organization.id) return path;
    const hintedBranch = path?.match(/^\/branch\/([^/]+)(?:\/|$)/)?.[1];
    const branch = organization.branches.find(item => item.id === (branchId ?? hintedBranch));
    if (branch) return hintedBranch === branch.id ? path! : `/branch/${branch.id}`;
    return `/org/${organization.id}`;
}

export function accountWorkspaceDestination(pathname: string, query: URLSearchParams, remembered: string | null, directory: WorkspaceDirectory) {
    const requested = query.get("returnTo") ?? remembered;
    if (pathname === "/account/billing") {
        const selected = accountBillingContext(directory.organizations, {
            organizationId: query.get("organizationId"), branchId: query.get("branchId"), returnTo: query.get("returnTo"),
        });
        if (selected) return accountWorkspaceReturn(selected.organization, selected.branch?.id, requested);
    }
    const organizationId = pathname.match(/^\/account\/billing\/([^/]+)\/processing\//)?.[1] ?? query.get("organizationId");
    const branchId = query.get("branchId") ?? workspaceReturnPath(requested)?.match(/^\/branch\/([^/]+)(?:\/|$)/)?.[1];
    const organization = organizationId
        ? directory.organizations.find(item => item.id === organizationId)
        : directory.organizations.find(item => item.branches.some(branch => branch.id === branchId));
    return organization ? accountWorkspaceReturn(organization, branchId, requested) : authorizedWorkspaceReturn(requested, directory);
}

/** Navigation hints never confer access. Account pages and APIs authorize their own scope. */
export function accountHref(returnTo?: string | null) {
    const path = workspaceReturnPath(returnTo ?? null);
    return "/account" + (path ? `?returnTo=${encodeURIComponent(path)}` : "");
}

export function accountBillingHref(organizationId: string, branchId?: string | null, returnTo?: string | null) {
    const query = new URLSearchParams({ organizationId });
    if (branchId) query.set("branchId", branchId);
    const path = workspaceReturnPath(returnTo ?? null);
    if (path) query.set("returnTo", path);
    return `/account/billing?${query}`;
}

export function accountBillingProcessingHref(organizationId: string, changeId: string) {
    return `/account/billing/${encodeURIComponent(organizationId)}/processing/${encodeURIComponent(changeId)}`;
}

/** Older operations may have saved the bare Account route before scope was retained. */
export function accountBillingOperationReturn(organizationId: string, path?: string | null) {
    if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return accountBillingHref(organizationId);
    const destination = accountBillingDestination(path);
    if (/^\/account\/billing(?:[?#]|$)/.test(destination)) {
        const url = new URL(destination, "https://account.invalid");
        url.searchParams.set("organizationId", organizationId);
        url.searchParams.delete("billingPlan");
        return url.pathname + url.search + url.hash;
    }
    if (/^\/org\/[^/]+\/settings#billing$/.test(destination)) return accountBillingHref(organizationId) + "#billing";
    return destination;
}

export function accountBillingProcessingDestination(path: string, returnPath: string) {
    const destination = accountBillingDestination(path);
    const organizationId = destination.match(/^\/account\/billing\/([^/]+)\/processing\//)?.[1];
    if (!organizationId) return destination;
    const context = new URL(returnPath, "https://account.invalid");
    if (context.pathname !== "/account/billing" || context.searchParams.get("organizationId") !== decodeURIComponent(organizationId)) return destination;
    const url = new URL(destination, "https://account.invalid");
    for (const key of ["branchId", "returnTo"]) {
        const value = context.searchParams.get(key);
        if (value) url.searchParams.set(key, value);
    }
    return url.pathname + url.search + url.hash;
}

/** Retained provider return URLs and saved operations still resolve to Account. */
export function accountBillingDestination(path: string) {
    const match = path.match(/^\/org\/([^/?#]+)\/billing(?:\/processing\/([^/?#]+))?([?#].*)?$/);
    if (!match) return path;
    if (match[2]) return accountBillingProcessingHref(decodeURIComponent(match[1]), decodeURIComponent(match[2])) + (match[3] ?? "");
    const [query, hash] = (match[3] ?? "").split("#");
    const params = new URLSearchParams(query.replace(/^\?/, ""));
    params.set("organizationId", decodeURIComponent(match[1]));
    return `/account/billing?${params}${hash ? `#${hash}` : ""}`;
}
