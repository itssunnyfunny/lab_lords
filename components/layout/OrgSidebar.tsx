"use client";
import { useTranslation } from "@/components/settings/LocalizedText";

import { LayoutDashboard, BarChart3, Settings } from "lucide-react";
import { SidebarItem } from "./SidebarItem";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { AppLogo } from "@/components/brand/AppLogo";
import {
    chromeOrgSidebarClass,
    chromeSidebarFooterClass,
    chromeSidebarHeaderClass,
    chromeSidebarSectionLabelClass,
} from "@/components/ui/chromeSurface";
import { useBillingExperience } from "@/components/billing/BillingExperienceProvider";
import { hasFeatureEntitlement } from "@/lib/billingPolicy";

export function OrgSidebar() {
    const t = useTranslation();
    const pathname = usePathname();
    const billing = useBillingExperience();

    const segments = pathname?.split('/') || [];
    const orgId = segments[2];
    const basePath = `/org/${orgId}`;

    return (
        <aside className={chromeOrgSidebarClass} aria-label={t("Organization navigation")}>
            <div className={chromeSidebarHeaderClass}>
                <Link href="/app" aria-label={t("Open workspace home")}>
                    <AppLogo
                        subtitle={t("Operations")}
                        markClassName="h-10 w-10"
                        titleClassName="text-lg font-bold sm:text-lg"
                        subtitleClassName="tracking-widest"
                    />
                </Link>
            </div>

            <div className="flex-1 p-6 space-y-2">
                <div className={`${chromeSidebarSectionLabelClass} mb-4`}>{t("Organization")}</div>
                <SidebarItem icon={LayoutDashboard} label={t("Dashboard")} isActive={pathname === basePath} href={basePath} />
                <SidebarItem
                    icon={BarChart3}
                    label={t("Global Analytics")}
                    isActive={pathname === `${basePath}/analytics`}
                    href={`${basePath}/analytics`}
                    locked={!hasFeatureEntitlement(billing?.experience?.entitlements ?? [], "ORG_ANALYTICS")}
                    badge={!hasFeatureEntitlement(billing?.experience?.entitlements ?? [], "ORG_ANALYTICS") ? "Standard" : undefined}
                />
            </div>

            <div className={chromeSidebarFooterClass}>
                <SidebarItem
                    icon={Settings}
                    label={t("System Settings")}
                    isActive={pathname === `${basePath}/settings`}
                    href={`${basePath}/settings`}
                />
            </div>
        </aside>
    );
}
