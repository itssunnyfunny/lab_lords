import { workspaceReturnPath } from "./contextualNavigation";
import type { WorkspaceDirectoryBranch } from "@/types";
/** Preserve a compatible area, never an object ID or another branch's query. */
export function branchSwitchDestination(pathname: string | null, href: string, permissions?: import("@/types").WorkspaceDirectoryBranch["permissions"]) {
    const area=pathname?.match(/^\/branch\/[^/]+(?:\/([^/]+))?/)?.[1]??"";
    const common: Record<string,string> = { students:"students", seats:"seats", allocations:"seats", fees:"payments", payments:"payments", setup:"settings", settings:"settings", shifts:"settings" };
    const permission = ({students:"students",seats:"seat_allocation",payments:"view_payments",settings:"manage_branch"} as const)[common[area] as "students"|"seats"|"payments"|"settings"];
    if(permissions && permission && !permissions[permission]) return href;
    return href.replace(/\/$/,"")+(common[area]?"/"+common[area]:"");
}

/** Directory data chooses a collection landing page. The destination shell
 * independently resolves the viewer's current access before mounting it. */
export function branchSwitchTarget(pathname: string | null, branch: WorkspaceDirectoryBranch) {
    const root = branch.href.replace(/\/$/, "");
    const area = pathname?.match(/^\/branch\/[^/]+\/([^/?#]+)/)?.[1];
    if (!area) return root;
    const permissions = branch.role === "OWNER" ? undefined : branch.permissions;
    const allowed = (key: keyof WorkspaceDirectoryBranch["permissions"]) => !permissions || !!permissions[key];
    const unavailable = root + "?workspaceNotice=area-unavailable";
    if (["ARCHIVED", "PENDING_ACTIVATION"].includes(branch.billing?.billingStatus ?? "")) return unavailable;
    const full = branch.billing ? ["STANDARD", "STANDARD_TRIAL", "PRO"].includes(branch.billing.effectivePlan)
        : branch.entitlements.includes("ADVANCED_ANALYTICS");
    if (area === "settings" && pathname?.endsWith("#whatsapp")) {
        return allowed("view_whatsapp") && branch.entitlements.includes("WHATSAPP_AUTOMATION") ? root + "/settings#whatsapp" : unavailable;
    }
    if (area === "onboarding" && pathname?.includes("/onboarding/import") && allowed("students")) return root + "/onboarding/import";
    if (area === "shifts" && allowed("seat_allocation")) return root + (full ? "/shifts" : "/seats");
    if (area === "analytics" && allowed("analytics") && branch.entitlements.includes("ADVANCED_ANALYTICS")) return root + "/analytics";
    if (area === "staff" && allowed("manage_branch") && branch.entitlements.includes("STAFF_MANAGEMENT")) return root + "/staff";
    if (full && area === "attendance" && allowed("students")) return root + "/attendance";
    if (full && ["renewals", "overdue", "follow-ups"].includes(area) && allowed("view_payments")) return root + "/" + area;
    if (full && area === "tasks" && (allowed("manage_branch") || allowed("students") || allowed("view_payments") || allowed("seat_allocation"))) return root + "/tasks";
    if (full && area === "reports" && (allowed("students") || allowed("view_payments"))) return root + "/reports";
    if (full && area === "ai" && allowed("analytics") && allowed("view_payments") && branch.entitlements.includes("AI_ACCESS")) return root + "/ai/reports";
    const destination = branchSwitchDestination(pathname, root, permissions);
    return destination === root ? unavailable : destination;
}

export function authorizedWorkspaceReturn(requested: string | null, directory: import("@/types").WorkspaceDirectory) {
    requested=workspaceReturnPath(requested);
    const branch=requested?.match(/^\/branch\/([^/]+)(?:\/|$)/)?.[1];
    const organization=requested?.match(/^\/org\/([^/]+)(?:\/|$)/)?.[1];
    const branches=[...directory.organizations.flatMap(org=>org.branches),...directory.staffBranches];
    if(branch && branches.some(item=>item.id===branch)) return requested!;
    if(organization && directory.organizations.some(item=>item.id===organization)) return requested!;
    return directory.organizations[0]?.href??directory.staffBranches[0]?.href??"/onboarding";
}
