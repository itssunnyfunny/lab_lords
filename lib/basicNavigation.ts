import { workspaceReturnPath } from "./contextualNavigation";
/** Preserve a compatible area, never an object ID or another branch's query. */
export function branchSwitchDestination(pathname: string | null, href: string, permissions?: import("@/types").WorkspaceDirectoryBranch["permissions"]) {
    const area=pathname?.match(/^\/branch\/[^/]+(?:\/([^/]+))?/)?.[1]??"";
    const common: Record<string,string> = { students:"students", seats:"seats", allocations:"seats", fees:"payments", payments:"payments", setup:"settings", settings:"settings", shifts:"settings" };
    const permission = ({students:"students",seats:"seat_allocation",payments:"view_payments",settings:"manage_branch"} as const)[common[area] as "students"|"seats"|"payments"|"settings"];
    if(permissions && permission && !permissions[permission]) return href;
    return href.replace(/\/$/,"")+(common[area]?"/"+common[area]:"");
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
