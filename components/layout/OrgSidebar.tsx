"use client";
import { LayoutDashboard, BarChart3, Settings } from "lucide-react";
import { usePathname } from "next/navigation";
import { SidebarItem } from "./SidebarItem";
import { SidebarFrame } from "./SidebarFrame";
import { useBillingExperience } from "@/components/billing/BillingExperienceProvider";
import { hasFeatureEntitlement } from "@/lib/billingPolicy";

export function OrgSidebar() {
    const pathname = usePathname();
    const billing = useBillingExperience();
    const basePath = `/org/${pathname.split("/")[2]}`;
    const analytics = hasFeatureEntitlement(billing?.experience?.entitlements ?? [], "ORG_ANALYTICS");
    return <SidebarFrame homeHref={basePath} label="Organization navigation">
        <SidebarItem icon={LayoutDashboard} label="Dashboard" isActive={pathname === basePath} href={basePath} density="compact" />
        <SidebarItem icon={BarChart3} label="Global Analytics" isActive={pathname === `${basePath}/analytics`} href={`${basePath}/analytics`} locked={!analytics} badge={!analytics ? "Standard" : undefined} density="compact" />
        <SidebarItem icon={Settings} label="Organization settings" isActive={pathname === `${basePath}/settings`} href={`${basePath}/settings`} density="compact" />
    </SidebarFrame>;
}
