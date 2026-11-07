import { workspaceReturnPath } from "@/lib/contextualNavigation";
import { authorizedWorkspaceReturn } from "@/lib/basicNavigation";
import type { WorkspaceDirectory, WorkspaceDirectoryOrganization } from "@/types";

/** Keep return hints within the selected, already-authorized subscription scope. */
export function accountWorkspaceReturn(organization: Pick<WorkspaceDirectoryOrganization, "id" | "branches">, branchId?: string | null, requested?: string | null) {
    const path = workspaceReturnPath(requested ?? null);
    const branch = organization.branches.find(item => item.id === branchId);
    if (branch) return path?.match(/^\/branch\/([^/]+)(?:\/|$)/)?.[1] === branch.id ? path! : `/branch/${branch.id}`;
    if (path?.match(/^\/org\/([^/]+)(?:\/|$)/)?.[1] === organization.id) return path;
    return `/org/${organization.id}`;
}

export function accountWorkspaceDestination(pathname: string, query: URLSearchParams, remembered: string | null, directory: WorkspaceDirectory) {
    const requested = query.get("returnTo") ?? remembered;
    const organizationId = pathname.match(/^\/account\/billing\/([^/]+)\/processing\//)?.[1] ?? query.get("organizationId")
        ?? (pathname === "/account/billing" && !query.get("branchId") ? directory.organizations[0]?.id : undefined);
    const branchId = query.get("branchId") ?? workspaceReturnPath(requested)?.match(/^\/branch\/([^/]+)(?:\/|$)/)?.[1];
    const organization = organizationId
        ? directory.organizations.find(item => item.id === organizationId)
        : branchId ? directory.organizations.find(item => item.branches.some(branch => branch.id === branchId))
        : pathname === "/account/billing" ? directory.organizations[0] : undefined;
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
