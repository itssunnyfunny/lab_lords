"use client";
import { useTranslation } from "@/components/settings/LocalizedText";

import Link from "next/link";
import { LayoutDashboard, UserRound } from "lucide-react";
import { AppLogo } from "@/components/brand/AppLogo";
import { SidebarItem } from "@/components/layout/SidebarItem";
import {
    chromeOrgSidebarClass,
    chromeSidebarHeaderClass,
    chromeSidebarSectionLabelClass,
} from "@/components/ui/chromeSurface";

export function AccountSidebar() {
    const t = useTranslation();
    return (
        <aside className={chromeOrgSidebarClass} aria-label={t("Account navigation")}>
            <div className={chromeSidebarHeaderClass}>
                <Link href="/app" aria-label={t("Open workspace home")}>
                    <AppLogo subtitle={t("Account")} markClassName="h-10 w-10" />
                </Link>
            </div>
            <nav className="flex-1 space-y-2 p-6" aria-label={t("Account")}>
                <div className={`${chromeSidebarSectionLabelClass} mb-4`}>{t("Personal")}</div>
                <SidebarItem
                    icon={UserRound}
                    label={t("Account settings")}
                    isActive
                    href="/account"
                />
                <SidebarItem
                    icon={LayoutDashboard}
                    label={t("Back to workspace")}
                    isActive={false}
                    href="/app"
                />
            </nav>
        </aside>
    );
}
