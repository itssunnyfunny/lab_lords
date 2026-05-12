"use client";

import { LayoutDashboard, BarChart3, Settings } from "lucide-react";
import { SidebarItem } from "./SidebarItem";
import { useRouter, usePathname } from "next/navigation";
import {
    chromeOrgSidebarClass,
    chromeSidebarFooterClass,
    chromeSidebarHeaderClass,
    chromeSidebarSectionLabelClass,
} from "@/components/ui/chromeSurface";

export function OrgSidebar() {
    const pathname = usePathname();
    const router = useRouter();

    const navigate = (path: string) => {
        router.push(path);
    };

    const segments = pathname?.split('/') || [];
    const orgId = segments[2];
    const basePath = `/org/${orgId}`;

    return (
        <div className={chromeOrgSidebarClass}>
            <div className={chromeSidebarHeaderClass}>
                <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-[var(--ui-radius-control)] border border-[color:var(--ui-form-surface-border)] bg-[color:var(--ui-button-primary-bg)] font-bold text-[color:var(--ui-button-primary-text)]">L</div>
                <div>
                    <span className="block text-lg font-bold tracking-tight text-[color:var(--text-primary)]">Lab Lords</span>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--text-muted)]">Operations</span>
                </div>
            </div>

            <div className="flex-1 p-6 space-y-2">
                <div className={`${chromeSidebarSectionLabelClass} mb-4`}>Organization</div>
                <SidebarItem icon={LayoutDashboard} label="Dashboard" isActive={pathname === basePath} onClick={() => navigate(basePath)} />
                <SidebarItem icon={BarChart3} label="Global Analytics" isActive={pathname === `${basePath}/analytics`} onClick={() => navigate(`${basePath}/analytics`)} />
            </div>

            <div className={chromeSidebarFooterClass}>
                <SidebarItem
                    icon={Settings}
                    label="System Settings"
                    isActive={pathname === `${basePath}/settings`}
                    onClick={() => navigate(`${basePath}/settings`)}
                />
            </div>
        </div>
    );
}
