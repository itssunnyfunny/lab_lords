"use client";

import {
    BarChart2,
    CalendarCheck,
    CalendarClock,
    ChevronRight,
    CreditCard,
    FileText,
    Grid,
    LayoutDashboard,
    LucideIcon,
    MessageSquare,
    Settings,
    TriangleAlert,
    UserCircle,
    Users,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { SidebarItem } from "./SidebarItem";
import { useBranchAccess } from "@/hooks/useBranchAccess";
import type { StaffAction } from "@/types";
import { cn } from "@/lib/utils";
import {
    chromeCompactIconButtonClass,
    chromeSidebarClass,
    chromeSidebarFooterClass,
    chromeSidebarHeaderClass,
    chromeSidebarSectionLabelClass,
} from "@/components/ui/chromeSurface";

type BranchNavItem = {
    icon: LucideIcon;
    label: string;
    href: string;
    permission?: StaffAction;
    active: (pathname: string | null) => boolean;
};

export function BranchSidebar() {
    const pathname = usePathname();
    const router = useRouter();

    const segments = pathname?.split("/") || [];
    const branchId = segments[2];
    const basePath = `/branch/${branchId}`;
    const { access, loading } = useBranchAccess(branchId);

    if (!branchId) return null;

    const canSee = (permission?: StaffAction) => {
        if (!permission) return true;
        return access?.permissions[permission] ?? false;
    };

    const overviewItems: BranchNavItem[] = [
        { icon: LayoutDashboard, label: "Dashboard", href: basePath, active: current => current === basePath },
        { icon: BarChart2, label: "Analytics", href: `${basePath}/analytics`, permission: "analytics", active: current => current === `${basePath}/analytics` },
    ];

    const operationItems: BranchNavItem[] = [
        { icon: Users, label: "Students", href: `${basePath}/students`, permission: "students", active: current => current === `${basePath}/students` },
        { icon: Grid, label: "Seats & Maps", href: `${basePath}/seats`, permission: "seat_allocation", active: current => current === `${basePath}/seats` },
        { icon: CalendarClock, label: "Shifts", href: `${basePath}/shifts`, permission: "seat_allocation", active: current => current === `${basePath}/shifts` },
        { icon: CalendarCheck, label: "Allocations", href: `${basePath}/allocations`, permission: "seat_allocation", active: current => current?.startsWith(`${basePath}/allocations`) ?? false },
        { icon: CreditCard, label: "Payments", href: `${basePath}/payments`, permission: "view_payments", active: current => current === `${basePath}/payments` },
        { icon: TriangleAlert, label: "Overdue", href: `${basePath}/overdue`, permission: "view_payments", active: current => current === `${basePath}/overdue` },
        { icon: UserCircle, label: "Staff", href: `${basePath}/staff`, permission: "manage_branch", active: current => current === `${basePath}/staff` },
    ];

    const intelligenceItems: BranchNavItem[] = [
        { icon: FileText, label: "AI Reports", href: `${basePath}/ai/reports`, permission: "analytics", active: current => current === `${basePath}/ai/reports` },
        { icon: MessageSquare, label: "AI Messages", href: `${basePath}/ai/messages`, permission: "analytics", active: current => current === `${basePath}/ai/messages` },
    ];

    const renderItems = (items: BranchNavItem[]) => items.map(item => (
        <SidebarItem
            key={item.href}
            icon={item.icon}
            label={item.label}
            isActive={item.active(pathname)}
            onClick={() => router.push(item.href)}
            density="compact"
        />
    ));

    const renderSection = (label: string, items: BranchNavItem[]) => {
        const visibleItems = items.filter(item => canSee(item.permission));
        if (visibleItems.length === 0) return null;

        return (
            <div className="space-y-2">
                <div className={chromeSidebarSectionLabelClass}>{label}</div>
                {renderItems(visibleItems)}
            </div>
        );
    };

    return (
        <div className={chromeSidebarClass}>
            <div className={chromeSidebarHeaderClass}>
                <button
                    type="button"
                    onClick={() => router.push("/")}
                    className={cn("shrink-0", chromeCompactIconButtonClass)}
                    aria-label="Back to home"
                >
                    <ChevronRight size={17} className="rotate-180 transition-transform" />
                </button>
                <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold leading-tight text-[color:var(--text-primary)]">{access?.branchName ?? "Loading..."}</span>
                    <span className="block truncate text-[10px] font-semibold uppercase tracking-wider text-[color:var(--ui-form-accent)]">
                        {access?.role ?? (loading ? "Checking access" : "Branch Connected")}
                    </span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3 scrollbar-none">
                <div className="space-y-4">
                    {renderSection("Overview", overviewItems)}
                    {renderSection("Operations", operationItems)}
                    {renderSection("Intelligence", intelligenceItems)}
                </div>
            </div>

            {canSee("manage_branch") && (
                <div className={chromeSidebarFooterClass}>
                    <SidebarItem
                        icon={Settings}
                        label="Branch Settings"
                        isActive={pathname === `${basePath}/settings`}
                        onClick={() => router.push(`${basePath}/settings`)}
                        density="compact"
                    />
                </div>
            )}
        </div>
    );
}
