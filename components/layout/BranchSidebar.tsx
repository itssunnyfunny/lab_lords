"use client";
import { useTranslation } from "@/components/settings/LocalizedText";

import {
    ArrowLeft,
    BarChart2,
    CalendarCheck,
    CalendarClock,
    ClipboardList,
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
    UploadCloud,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { SidebarItem } from "./SidebarItem";
import { SidebarFrame } from "./SidebarFrame";
import { useBranchAccess } from "@/hooks/useBranchAccess";
import type { StaffAction } from "@/types";
import type { BillingFeatureKey } from "@/lib/billingPolicy";
import { hasFeatureEntitlement } from "@/lib/billingPolicy";
import { getBranchCapabilityDecision } from "@/lib/branchCapabilities";
import {
    chromeSidebarSectionLabelClass,
} from "@/components/ui/chromeSurface";
import { isApplicationDesignPilotPath } from "@/lib/applicationDesignPilot";

type BranchNavItem = {
    icon: LucideIcon;
    label: string;
    href: string;
    permission?: StaffAction | readonly [StaffAction, ...StaffAction[]];
    feature?: BillingFeatureKey;
    active: (pathname: string | null) => boolean;
};

export function BranchSidebar() {
    const t = useTranslation();
    const pathname = usePathname();
    const segments = pathname?.split("/") || [];
    const branchId = segments[2];
    const basePath = `/branch/${branchId}`;
    const designPilot = isApplicationDesignPilotPath(pathname);
    const { access } = useBranchAccess(branchId);

    if (!branchId) return null;

    const canSee = (permission?: StaffAction | readonly [StaffAction, ...StaffAction[]]) => {
        if (!permission) return true;
        const requiredPermissions = typeof permission === "string" ? [permission] : permission;
        return requiredPermissions.every(requiredPermission => access?.permissions[requiredPermission] ?? false);
    };

    const featureAvailable = (feature?: BillingFeatureKey) => !feature || hasFeatureEntitlement(access?.entitlements ?? [], feature);
    const canManageBranchSettings = canSee("manage_branch");
    const canViewWhatsApp = getBranchCapabilityDecision(
        access,
        "whatsappView"
    ).allowed;
    const canOpenSettings = canManageBranchSettings || canViewWhatsApp;

    const overviewItems: BranchNavItem[] = [
        { icon: LayoutDashboard, label: "Dashboard", href: basePath, active: current => current === basePath },
        { icon: BarChart2, label: "Analytics", href: `${basePath}/analytics`, permission: "analytics", feature: "BRANCH_ANALYTICS", active: current => current === `${basePath}/analytics` },
    ];

    const operationItems: BranchNavItem[] = [
        { icon: Users, label: "Students", href: `${basePath}/students`, permission: "students", active: current => current === `${basePath}/students` },
        { icon: CalendarCheck, label: "Attendance", href: `${basePath}/attendance`, permission: "students", active: current => current === `${basePath}/attendance` },
        { icon: UploadCloud, label: "Import Assistant", href: `${basePath}/onboarding/import`, permission: "students", active: current => current?.startsWith(`${basePath}/onboarding/import`) ?? false },
        { icon: Grid, label: "Seats & Maps", href: `${basePath}/seats`, permission: "seat_allocation", active: current => current === `${basePath}/seats` },
        { icon: CalendarClock, label: "Shifts", href: `${basePath}/shifts`, permission: "seat_allocation", active: current => current === `${basePath}/shifts` },
        { icon: CalendarCheck, label: "Allocations", href: `${basePath}/allocations`, permission: "seat_allocation", active: current => current?.startsWith(`${basePath}/allocations`) ?? false },
        { icon: CreditCard, label: "Payments", href: `${basePath}/payments`, permission: "view_payments", active: current => current === `${basePath}/payments` },
        { icon: CalendarClock, label: "Renewals & dues", href: `${basePath}/renewals`, permission: "view_payments", active: current => current === `${basePath}/renewals` },
        { icon: TriangleAlert, label: "Overdue", href: `${basePath}/overdue`, permission: "view_payments", active: current => current === `${basePath}/overdue` },
        { icon: UserCircle, label: "Staff", href: `${basePath}/staff`, permission: "manage_branch", feature: "STAFF_CONTROLS", active: current => current === `${basePath}/staff` },
    ];

    const intelligenceItems: BranchNavItem[] = [
        { icon: FileText, label: "AI Reports", href: `${basePath}/ai/reports`, permission: ["analytics", "view_payments"], feature: "AI_REPORTS", active: current => current === `${basePath}/ai/reports` },
    ];

    const followUpsItem: BranchNavItem = { icon: CalendarClock, label: "Follow-ups", href: `${basePath}/follow-ups`, permission: "view_payments", active: current => current === `${basePath}/follow-ups` };
    const tasksItem: BranchNavItem = { icon: ClipboardList, label: "Tasks", href: `${basePath}/tasks`, active: current => current === `${basePath}/tasks` };
    const reportsItem: BranchNavItem = { icon: FileText, label: "Exports & Reports", href: `${basePath}/reports`, active: current => current === `${basePath}/reports` };
    const settingsItem: BranchNavItem = { icon: Settings, label: canManageBranchSettings ? "Branch Settings" : "WhatsApp", href: `${basePath}/settings`, active: current => current === `${basePath}/settings` };
    const setupItem: BranchNavItem = { icon: Settings, label: "Dashboard setup", href: `${basePath}/dashboard-settings`, active: current => current === `${basePath}/dashboard-settings` };
    const canOpenSetup = canSee("manage_branch") || canSee("students") || canSee("seat_allocation");

    const pilotSections = [
        {
            label: "Daily work",
            items: [overviewItems[0], operationItems[0], operationItems[1], followUpsItem, tasksItem],
        },
        {
            label: "Seats and shifts",
            items: [operationItems[3], operationItems[4], operationItems[5]],
        },
        {
            label: "Fees",
            items: [operationItems[6], operationItems[7], operationItems[8]],
        },
        {
            label: "Reports",
            items: [overviewItems[1], ...intelligenceItems, ...(canSee("view_payments") || canSee("students") ? [reportsItem] : [])],
        },
        {
            label: "Setup and access",
            items: [...(canOpenSettings ? [settingsItem] : []), ...(canOpenSetup ? [setupItem] : []), ...(canManageBranchSettings && canViewWhatsApp ? [{ ...settingsItem, icon: MessageSquare, label: "WhatsApp", href: `${basePath}/settings#whatsapp`, active: () => false }] : []), operationItems[2], { ...operationItems[9], label: "Staff & Permissions" }],
        },
    ];

    const renderItems = (items: BranchNavItem[]) => items.map(item => (
        <SidebarItem
            key={item.href}
            icon={item.icon}
            label={item.label}
            isActive={item.active(pathname)}
            href={item.href}
            density="compact"
            locked={!featureAvailable(item.feature)}
            badge={!featureAvailable(item.feature) ? "Standard" : undefined}
        />
    ));

    const renderSection = (label: string, items: BranchNavItem[]) => {
        const visibleItems = items.filter(item => canSee(item.permission));
        if (visibleItems.length === 0) return null;

        return (
            <div className="space-y-2">
                <div data-sidebar-label className={chromeSidebarSectionLabelClass}>{t.owned(label)}</div>
                {renderItems(visibleItems)}
            </div>
        );
    };

    return (
        <SidebarFrame homeHref={basePath} label="Branch navigation">
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
                <div className="space-y-4">
                    {designPilot
                        ? pilotSections.map(section => (
                            <div key={section.label}>{renderSection(section.label, section.items)}</div>
                        ))
                        : (
                            <>
                                {renderSection("Overview", overviewItems)}
                                {renderSection("Operations", [...operationItems, followUpsItem, tasksItem])}
                                {renderSection("Intelligence", [...intelligenceItems, ...(canSee("view_payments") || canSee("students") ? [reportsItem] : [])])}
                            </>
                        )}
                </div>
                {access?.isOwner && (
                    <div className="mt-5 space-y-2 border-t border-[color:var(--ui-panel-header-border)] pt-4" aria-label={t.owned("Workspace")}>
                        <div data-sidebar-label className={chromeSidebarSectionLabelClass}>{t.owned("Workspace")}</div>
                        <SidebarItem icon={ArrowLeft} label={t("Back to organization")} isActive={false} href={`/org/${access.organizationId}`} density="compact" />
                    </div>
                )}
                {!designPilot && canOpenSettings && (
                    <SidebarItem icon={Settings} label={canManageBranchSettings ? t("Branch Settings") : t.owned("WhatsApp")} isActive={pathname === `${basePath}/settings`} href={`${basePath}/settings`} density="compact" />
                )}
            </div>

        </SidebarFrame>
    );
}
