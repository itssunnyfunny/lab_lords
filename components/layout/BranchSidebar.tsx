"use client";

import {
    BarChart2,
    CalendarCheck,
    ChevronRight,
    CreditCard,
    FileText,
    Grid,
    LayoutDashboard,
    LucideIcon,
    MessageSquare,
    Settings,
    UserCircle,
    Users,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { SidebarItem } from "./SidebarItem";
import { useBranchAccess } from "@/hooks/useBranchAccess";
import type { StaffAction } from "@/types";

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
        { icon: CalendarCheck, label: "Allocations", href: `${basePath}/allocations`, permission: "seat_allocation", active: current => current?.startsWith(`${basePath}/allocations`) ?? false },
        { icon: CreditCard, label: "Payments", href: `${basePath}/payments`, permission: "view_payments", active: current => current === `${basePath}/payments` },
        { icon: UserCircle, label: "Staff", href: `${basePath}/staff`, permission: "manage_branch", active: current => current === `${basePath}/staff` },
    ];

    const intelligenceItems: BranchNavItem[] = [
        { icon: FileText, label: "AI Reports", href: `${basePath}/ai/reports`, permission: "analytics", active: current => current === `${basePath}/ai/reports` },
        { icon: MessageSquare, label: "AI Messages", href: `${basePath}/ai/messages`, permission: "analytics", active: current => current === `${basePath}/ai/messages` },
    ];

    const renderItems = (items: BranchNavItem[]) => items
        .filter(item => canSee(item.permission))
        .map(item => (
            <SidebarItem
                key={item.href}
                icon={item.icon}
                label={item.label}
                isActive={item.active(pathname)}
                onClick={() => router.push(item.href)}
            />
        ));

    return (
        <div className="w-72 bg-[#050508]/80 backdrop-blur-xl border-r border-white/5 flex flex-col h-full relative z-30">
            <div className="h-20 flex items-center px-6 border-b border-white/5 bg-[#0a0a0e]/50">
                <div onClick={() => router.push("/")} className="cursor-pointer hover:bg-white/10 -ml-2 p-2 rounded-xl transition-all duration-300 mr-3 border border-transparent hover:border-white/5 group">
                    <ChevronRight size={20} className="text-gray-500 group-hover:text-white rotate-180 transition-transform" />
                </div>
                <div className="flex flex-col overflow-hidden">
                    <span className="font-bold text-sm text-white truncate">{access?.branchName ?? "Loading..."}</span>
                    <span className="text-[10px] text-cyan-400 uppercase tracking-wider font-bold glow-text">
                        {access?.role ?? (loading ? "Checking access" : "Branch Connected")}
                    </span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto py-6 space-y-8 scrollbar-none px-6">
                <div className="space-y-2">
                    <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-3 px-2">Overview</div>
                    {renderItems(overviewItems)}
                </div>

                <div className="space-y-2">
                    <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-3 px-2">Operations</div>
                    {renderItems(operationItems)}
                </div>

                {intelligenceItems.some(item => canSee(item.permission)) && (
                    <div className="space-y-2">
                        <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-3 px-2">Intelligence</div>
                        {renderItems(intelligenceItems)}
                    </div>
                )}
            </div>

            {canSee("manage_branch") && (
                <div className="px-6 pb-6 border-t border-white/5 pt-4">
                    <SidebarItem
                        icon={Settings}
                        label="Branch Settings"
                        isActive={pathname === `${basePath}/settings`}
                        onClick={() => router.push(`${basePath}/settings`)}
                    />
                </div>
            )}
        </div>
    );
}
