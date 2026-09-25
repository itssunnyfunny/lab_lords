"use client";
import { useEffect, useMemo, useState } from "react";
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

function activityTimeLabel(timestamp: string, now: number, relative: Intl.RelativeTimeFormat, formatDate: (value: string, options: Intl.DateTimeFormatOptions) => string) {
    const distance = new Date(timestamp).getTime() - now;
    if (!Number.isFinite(distance)) return timestamp;
    const absolute = Math.abs(distance);
    if (absolute < 60_000) return relative.format(0, "minute");
    if (absolute < 3_600_000) return relative.format(Math.round(distance / 60_000), "minute");
    if (absolute < 86_400_000) return relative.format(Math.round(distance / 3_600_000), "hour");
    if (absolute < 604_800_000) return relative.format(Math.round(distance / 86_400_000), "day");
    return formatDate(timestamp, { day: "numeric", month: "short" });
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
                description: item.studentName,
            };
        case "payment":
            return {
                icon: IndianRupee,
                iconClass: "bg-[color:var(--ui-tone-success-bg)] text-[color:var(--ui-tone-success-text)]",
                title: "Payment received",
                description: `${formatMoney(item.amount)} · ${item.studentName}`,
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
    const { formatDate, formatDateTime, formatNumber, locale } = useUserPreferences();
    const [now, setNow] = useState(() => Date.now());
    const relative = useMemo(() => new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "short" }), [locale]);
    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 60_000);
        return () => window.clearInterval(timer);
    }, []);
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
                        const exactTime = formatDateTime(item.ts);

                        return (
                            <div key={`${item.type}-${item.ts}-${index}`} className="dashboard-activity-row">
                                <div className={`dashboard-activity-icon ${content.iconClass}`}>
                                    <Icon size={16} aria-hidden="true" />
                                </div>
                                <div className="dashboard-activity-content">
                                    <p className="dashboard-activity-title">{t.owned(content.title)}</p>
                                    <p className={cn("dashboard-activity-description", pageMutedTextClass)}>{content.description}</p>
                                </div>
                                <time dateTime={item.ts} title={exactTime} aria-label={exactTime}
                                    className={cn("dashboard-activity-time", pageSubtleTextClass)}>
                                    {activityTimeLabel(item.ts, now, relative, formatDate)}
                                </time>
                            </div>
                        );
                    })}
                </div>
            )}
        </AppPanel>
    );
}
