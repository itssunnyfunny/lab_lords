"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import { CreditCard, LogOut, SlidersHorizontal, UserRound } from "lucide-react";
import { SidebarFrame } from "@/components/layout/SidebarFrame";
import { SidebarItem } from "@/components/layout/SidebarItem";
import type { WorkspaceDirectory } from "@/types";
import { accountBillingHref, accountWorkspaceReturn } from "@/lib/accountNavigation";
import { useWorkspaceReturnHref } from "@/hooks/useWorkspaceReturnHref";
import { workspaceReturnPath } from "@/lib/contextualNavigation";

export function AccountSidebar({ directory }: { directory: WorkspaceDirectory }) {
    const pathname = usePathname();
    const search = useSearchParams();
    const resolvedReturn = useWorkspaceReturnHref(pathname);
    const requestedReturn = workspaceReturnPath(search.get("returnTo")) ?? workspaceReturnPath(resolvedReturn);
    const requestedBranch = search.get("branchId") ?? requestedReturn?.match(/^\/branch\/([^/]+)/)?.[1];
    const requestedOrg = pathname.match(/^\/account\/billing\/([^/]+)/)?.[1] ?? search.get("organizationId")
        ?? (pathname === "/account/billing" && !search.get("branchId") ? directory.organizations[0]?.id : undefined)
        ?? requestedReturn?.match(/^\/org\/([^/]+)/)?.[1];
    const scopedOrganization = requestedOrg ? directory.organizations.find(org => org.id === requestedOrg) : directory.organizations.find(org => org.branches.some(branch => branch.id === requestedBranch));
    const organization = scopedOrganization ?? directory.organizations[0];
    const returnTo = scopedOrganization ? accountWorkspaceReturn(scopedOrganization, requestedBranch, requestedReturn) : requestedReturn;
    const context = new URLSearchParams();
    if (returnTo) context.set("returnTo", returnTo);
    if (scopedOrganization) context.set("organizationId", scopedOrganization.id);
    if (requestedBranch && organization?.branches.some(branch => branch.id === requestedBranch)) context.set("branchId", requestedBranch);
    const suffix = context.size ? `?${context}` : "";
    return <SidebarFrame homeHref={"/account/profile" + suffix} label="Account navigation" account footer={<SignOutButton redirectUrl="/"><SidebarItem icon={LogOut} label="Sign out" isActive={false} density="compact" /></SignOutButton>}>
        <SidebarItem icon={UserRound} label="Profile & security" href={"/account/profile" + suffix} isActive={pathname.startsWith("/account/profile")} density="compact" />
        <SidebarItem icon={SlidersHorizontal} label="Preferences" href={"/account/preferences" + suffix} isActive={pathname === "/account/preferences"} density="compact" />
        {organization && <SidebarItem icon={CreditCard} label="Billing" href={accountBillingHref(organization.id, organization.branches.some(branch => branch.id === requestedBranch) ? requestedBranch : undefined, accountWorkspaceReturn(organization, requestedBranch, returnTo))} isActive={pathname.startsWith("/account/billing")} density="compact" />}
    </SidebarFrame>;
}
