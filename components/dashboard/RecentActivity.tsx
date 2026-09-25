"use client";
import { useTranslation } from "@/components/settings/LocalizedText";

import { AppPanel } from "@/components/ui";
import {
    pageInsetSurfaceClass,
    pageMutedTextClass,
    pageSectionDividerClass,
    pageSubtleTextClass,
} from "@/components/ui/pageSurface";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { cn } from "@/lib/utils";
import { Activity, IndianRupee, LayoutGrid, UserPlus } from "lucide-react";

export type ActivityItem =
    | { type: "allocation"; seat: string; studentName: string; ts: string }
    | { type: "payment"; amount: number; studentName: string; ts: string }
    | { type: "enrollment"; studentName: string; ts: string };

interface RecentActivityProps {
    items: ActivityItem[];
    branchId: string;
}

function getActivityContent(
    item: ActivityItem,
    formatMoney: (amount: number) => string,
    t: ReturnType<typeof useTranslation>,
) {
    switch (item.type) {
        case "allocation":
            return {
                icon: LayoutGrid,
                iconClass: "bg-[color:var(--ui-tone-info-bg)] text-[color:var(--ui-tone-info-text)]",
                title: t("Seat {seat} allocated", { seat: item.seat }),
                description: t("{name} was assigned to a seat.", { name: item.studentName }),
            };
        case "payment":
            return {
                icon: IndianRupee,
                iconClass: "bg-[color:var(--ui-tone-success-bg)] text-[color:var(--ui-tone-success-text)]",
                title: "Payment received",
                description: t("{amount} collected from {name}.", { amount: formatMoney(item.amount), name: item.studentName }),
            };
        case "enrollment":
            return {
                icon: UserPlus,
                iconClass: "bg-[color:var(--ui-tone-insight-bg)] text-[color:var(--ui-tone-insight-text)]",
                title: "Student profile added",
                description: item.studentName,
            };
    }
}

function EmptyActivity() {
    const t = useTranslation();
    return (
        <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
            <div className={cn("flex h-10 w-10 items-center justify-center", pageInsetSurfaceClass)}>
                <Activity size={18} className="text-[color:var(--text-muted)]" />
            </div>
            <div>
                <p className="text-sm font-medium text-[color:var(--text-primary)]">{t("No recent activity")}</p>
                <p className={cn("mt-1 text-xs", pageSubtleTextClass)}>{t("Student, seat, and payment changes will appear here.")}</p>
            </div>
        </div>
    );
}

export function RecentActivity({ items }: RecentActivityProps) {
    const t = useTranslation();
    const visibleItems = items.slice(0, 7);
    const { formatDateTime, formatNumber } = useUserPreferences();
    const formatMoney = (amount: number) => formatNumber(amount, {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    });

    return (
        <AppPanel
            title={t("Recent activity")}
            contentClassName="p-0"
            className="dashboard-activity"
        >
            {visibleItems.length === 0 ? (
                <EmptyActivity />
            ) : (
                <div className={cn("dashboard-activity-list divide-y", pageSectionDividerClass)}>
                    {visibleItems.map((item, index) => {
                        const content = getActivityContent(item, formatMoney, t);
                        const Icon = content.icon;

                        return (
                            <div key={`${item.type}-${item.ts}-${index}`} className="dashboard-activity-row">
                                <div className={`dashboard-activity-icon flex shrink-0 items-center justify-center ${content.iconClass}`}>
                                    <Icon size={14} aria-hidden="true" />
                                </div>
                                <div className="dashboard-activity-content">
                                    <div className="dashboard-activity-meta">
                                        <p className="dashboard-activity-title font-medium text-[color:var(--text-primary)]">{t.owned(content.title)}</p>
                                        <time dateTime={item.ts} className={cn("dashboard-activity-time", pageSubtleTextClass)}>
                                            {formatDateTime(item.ts)}
                                        </time>
                                    </div>
                                    <p className={cn("dashboard-activity-description", pageMutedTextClass)}>{content.description}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </AppPanel>
    );
}
