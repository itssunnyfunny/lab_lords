"use client";

import { AppButton, AppPanel } from "@/components/ui";
import { formatDistanceToNow } from "date-fns";
import { Activity, ArrowRight, IndianRupee, LayoutGrid, TriangleAlert, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";

export type ActivityItem =
    | { type: "allocation"; seat: string; studentName: string; ts: string }
    | { type: "payment"; amount: number; studentName: string; ts: string }
    | { type: "overdue"; count: number; ts: string }
    | { type: "enrollment"; studentName: string; ts: string };

interface RecentActivityProps {
    items: ActivityItem[];
    branchId: string;
}

function formatMoney(amount: number) {
    return `Rs ${amount.toLocaleString("en-IN")}`;
}

function getActivityContent(item: ActivityItem) {
    switch (item.type) {
        case "allocation":
            return {
                icon: LayoutGrid,
                iconClass: "bg-cyan-400/10 text-cyan-300",
                title: `Seat ${item.seat} allocated`,
                description: `${item.studentName} was assigned to a seat.`,
            };
        case "payment":
            return {
                icon: IndianRupee,
                iconClass: "bg-emerald-400/10 text-emerald-300",
                title: "Payment received",
                description: `${formatMoney(item.amount)} collected from ${item.studentName}.`,
            };
        case "overdue":
            return {
                icon: TriangleAlert,
                iconClass: "bg-rose-400/10 text-rose-300",
                title: "Overdue payments detected",
                description: `${item.count} student${item.count === 1 ? "" : "s"} need follow-up.`,
            };
        case "enrollment":
            return {
                icon: UserPlus,
                iconClass: "bg-violet-400/10 text-violet-300",
                title: "New student enrolled",
                description: `${item.studentName} joined the branch.`,
            };
    }
}

function EmptyActivity() {
    return (
        <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-white/10 bg-white/[0.03]">
                <Activity size={18} className="text-gray-500" />
            </div>
            <div>
                <p className="text-sm font-medium text-white">No recent activity</p>
                <p className="mt-1 text-xs text-gray-500">Student, seat, and payment changes will appear here.</p>
            </div>
        </div>
    );
}

export function RecentActivity({ items, branchId }: RecentActivityProps) {
    const router = useRouter();
    const visibleItems = items.slice(0, 7);

    return (
        <AppPanel
            title="Activity stream"
            description="Latest movement across branch operations."
            action={
                <AppButton
                    onClick={() => router.push(`/branch/${branchId}/payments`)}
                    variant="quiet"
                    size="sm"
                    rightIcon={ArrowRight}
                >
                    Audit
                </AppButton>
            }
            contentClassName="p-0"
            className="h-full"
        >
            {visibleItems.length === 0 ? (
                <EmptyActivity />
            ) : (
                <div className="divide-y divide-white/10">
                    {visibleItems.map((item, index) => {
                        const content = getActivityContent(item);
                        const Icon = content.icon;
                        const timeAgo = formatDistanceToNow(new Date(item.ts), { addSuffix: true });

                        return (
                            <div key={`${item.type}-${item.ts}-${index}`} className="flex gap-3 px-4 py-3">
                                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] ${content.iconClass}`}>
                                    <Icon size={15} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                                        <p className="text-sm font-medium text-white">{content.title}</p>
                                        <span className="shrink-0 text-xs text-gray-500">{timeAgo}</span>
                                    </div>
                                    <p className="mt-1 text-xs leading-5 text-gray-500">{content.description}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </AppPanel>
    );
}
