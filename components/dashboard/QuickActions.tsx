"use client";

import { Card } from "@/components/ui/Card";
import { ChevronRight, UserPlus, CreditCard, Grid, CalendarCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBranchAccess } from "@/hooks/useBranchAccess";
import type { StaffAction } from "@/types";

interface Action {
    label: string;
    description: string;
    icon: LucideIcon;
    route: string;
    accent: string;
    permission: StaffAction;
}

const actions: Action[] = [
    {
        label: "Add New Student",
        description: "Enroll a student",
        icon: UserPlus,
        route: "/students",
        accent: "group-hover:text-indigo-400 group-hover:bg-indigo-500/10",
        permission: "students",
    },
    {
        label: "Record Payment",
        description: "Mark fee as paid",
        icon: CreditCard,
        route: "/payments",
        accent: "group-hover:text-emerald-400 group-hover:bg-emerald-500/10",
        permission: "mark_payment_paid",
    },
    {
        label: "Assign a Seat",
        description: "Link student to seat",
        icon: Grid,
        route: "/allocations",
        accent: "group-hover:text-violet-400 group-hover:bg-violet-500/10",
        permission: "seat_allocation",
    },
    {
        label: "View Shifts",
        description: "Manage time slots",
        icon: CalendarCheck,
        route: "/shifts",
        accent: "group-hover:text-cyan-400 group-hover:bg-cyan-500/10",
        permission: "manage_branch",
    },
];

export function QuickActions({ branchId }: { branchId: string }) {
    const router = useRouter();
    const { access, loading } = useBranchAccess(branchId);
    const visibleActions = actions.filter(action => access?.permissions[action.permission]);

    return (
        <Card title="Quick Actions" className="h-full">
            <div className="space-y-2">
                {!loading && visibleActions.length === 0 && (
                    <p className="px-1 py-2 text-sm text-gray-500">No quick actions available for your access.</p>
                )}
                {visibleActions.map((action) => (
                    <button
                        key={action.label}
                        onClick={() => router.push(`/branch/${branchId}${action.route}`)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all duration-200 text-left group"
                    >
                        <div className={cn(
                            "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-white/5 text-gray-400 transition-all duration-200",
                            action.accent
                        )}>
                            <action.icon size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white group-hover:text-white transition-colors">{action.label}</p>
                            <p className="text-xs text-gray-500">{action.description}</p>
                        </div>
                        <ChevronRight size={14} className="text-gray-600 group-hover:text-gray-400 flex-shrink-0 transition-colors" />
                    </button>
                ))}
            </div>
        </Card>
    );
}
