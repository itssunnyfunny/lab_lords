import { workspaceReturnPath } from "@/lib/contextualNavigation";

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
