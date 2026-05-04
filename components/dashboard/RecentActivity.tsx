"use client";

import { Card } from "@/components/ui/Card";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
    LayoutGrid,
    IndianRupee,
    AlertTriangle,
    UserPlus,
    Activity,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ActivityItem =
    | { type: "allocation"; seat: string; studentName: string; ts: string }
    | { type: "payment"; amount: number; studentName: string; ts: string }
    | { type: "overdue"; count: number; ts: string }
    | { type: "enrollment"; studentName: string; ts: string };

interface RecentActivityProps {
    items: ActivityItem[];
    branchId: string;
}

// ─── Config per type ─────────────────────────────────────────────────────────

const CONFIG = {
    allocation: {
        Icon: LayoutGrid,
        iconColor: "text-sky-300",
        bg: "bg-sky-500/20",
        border: "border-sky-400/40",
        shadow: "shadow-[0_0_16px_rgba(56,189,248,0.35)]",
        title: (i: ActivityItem) =>
            i.type === "allocation" ? `Seat ${i.seat} Allocated` : "",
        desc: (i: ActivityItem) =>
            i.type === "allocation" ? `${i.studentName} newly enrolled` : "",
    },
    payment: {
        Icon: IndianRupee,
        iconColor: "text-green-300",
        bg: "bg-green-500/20",
        border: "border-green-400/40",
        shadow: "shadow-[0_0_16px_rgba(74,222,128,0.35)]",
        title: () => "Payment Received",
        desc: (i: ActivityItem) =>
            i.type === "payment"
                ? `₹${i.amount.toLocaleString("en-IN")} from ${i.studentName}`
                : "",
    },
    overdue: {
        Icon: AlertTriangle,
        iconColor: "text-orange-300",
        bg: "bg-orange-500/20",
        border: "border-orange-400/40",
        shadow: "shadow-[0_0_16px_rgba(251,146,60,0.35)]",
        title: () => "Overdue Alert",
        desc: (i: ActivityItem) =>
            i.type === "overdue"
                ? `${i.count} student${i.count !== 1 ? "s" : ""} are overdue`
                : "",
    },
    enrollment: {
        Icon: UserPlus,
        iconColor: "text-purple-300",
        bg: "bg-purple-500/20",
        border: "border-purple-400/40",
        shadow: "shadow-[0_0_16px_rgba(192,132,252,0.35)]",
        title: () => "New Student",
        desc: (i: ActivityItem) =>
            i.type === "enrollment" ? `${i.studentName} joined the branch` : "",
    },
} as const;

// ─── Card ────────────────────────────────────────────────────────────────────

function ActivityCard({ item }: { item: ActivityItem }) {
    const cfg = CONFIG[item.type];
    const { Icon, iconColor, bg, border, shadow } = cfg;
    const title = (() => {
        switch (item.type) {
            case "allocation":
                return CONFIG.allocation.title(item);
            case "payment":
                return CONFIG.payment.title();
            case "overdue":
                return CONFIG.overdue.title();
            case "enrollment":
                return CONFIG.enrollment.title();
        }
    })();
    const desc = (() => {
        switch (item.type) {
            case "allocation":
                return CONFIG.allocation.desc(item);
            case "payment":
                return CONFIG.payment.desc(item);
            case "overdue":
                return CONFIG.overdue.desc(item);
            case "enrollment":
                return CONFIG.enrollment.desc(item);
        }
    })();
    const timeAgo = formatDistanceToNow(new Date(item.ts), { addSuffix: true });

    return (
        <div className="flex-shrink-0 w-44 flex flex-col items-center text-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-white/10 transition-all duration-200">
            {/* Icon circle */}
            <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center border ${bg} ${border} ${shadow}`}
            >
                <Icon size={18} className={iconColor} />
            </div>

            {/* Title */}
            <p className="text-sm font-semibold text-white leading-tight line-clamp-2">
                {title}
            </p>

            {/* Subtitle — dimmed */}
            <p className="text-xs text-gray-400 leading-tight line-clamp-2 w-full">
                {desc}
            </p>

            {/* Time badge */}
            <span className="text-[11px] font-medium text-gray-500 mt-auto">
                {timeAgo}
            </span>
        </div>
    );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyActivity() {
    return (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center">
                <Activity size={20} className="text-gray-500" />
            </div>
            <p className="text-sm font-semibold text-white">No recent activity</p>
            <p className="text-xs text-gray-500">
                Activity will appear here once students, seats, and payments are added.
            </p>
        </div>
    );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RecentActivity({ items, branchId }: RecentActivityProps) {
    const router = useRouter();

    return (
        <Card
            title="Recent Activity"
            action={
                <button
                    onClick={() => router.push(`/branch/${branchId}/payments`)}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 transition-colors"
                >
                    View all →
                </button>
            }
        >
            {items.length === 0 ? (
                <EmptyActivity />
            ) : (
                <div className="overflow-x-auto pb-1 -mx-1 px-1">
                    <div className="flex gap-3 w-max">
                        {items.map((item, i) => (
                            <ActivityCard key={i} item={item} />
                        ))}
                    </div>
                </div>
            )}
        </Card>
    );
}
