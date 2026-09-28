"use client";
import { useTranslation } from "@/components/settings/LocalizedText";

import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export type StatCardTone = "neutral" | "success" | "warning" | "danger" | "info";
export type StatCardAccent = "neutral" | "emerald" | "rose" | "cyan" | "violet";

interface StatCardProps {
    title: string;
    value: string;
    sub: string;
    icon: LucideIcon;
    tone?: StatCardTone;
    accent?: StatCardAccent;
    alert?: boolean;
    progress?: number;
    footer?: string;
}

const toneMap = {
    neutral: {
        progress: "bg-[color:var(--ui-tone-neutral-progress)]",
    },
    success: {
        progress: "bg-[color:var(--ui-tone-success-progress)]",
    },
    warning: {
        progress: "bg-[color:var(--ui-tone-warning-progress)]",
    },
    danger: {
        progress: "bg-[color:var(--ui-tone-danger-progress)]",
    },
    info: {
        progress: "bg-[color:var(--ui-tone-info-progress)]",
    },
};

const accentMap = {
    neutral: {
        border: "border-[color:var(--ui-tone-neutral-border)]",
        wash: "hidden",
        icon: "bg-[color:var(--ui-tone-neutral-bg)] text-[color:var(--ui-tone-neutral-text)]",
        value: "text-[color:var(--ui-stat-value)]",
    },
    emerald: {
        border: "border-[color:var(--ui-tone-success-border)]",
        wash: "bg-[color:var(--ui-tone-success-bg)] opacity-60",
        icon: "bg-[color:var(--ui-tone-success-bg)] text-[color:var(--ui-tone-success-text)]",
        value: "text-[color:var(--ui-tone-success-text)]",
    },
    rose: {
        border: "border-[color:var(--ui-tone-danger-border)]",
        wash: "bg-[color:var(--ui-tone-danger-bg)] opacity-60",
        icon: "bg-[color:var(--ui-tone-danger-bg)] text-[color:var(--ui-tone-danger-text)]",
        value: "text-[color:var(--ui-tone-danger-text)]",
    },
    cyan: {
        border: "border-[color:var(--ui-tone-info-border)]",
        wash: "bg-[color:var(--ui-tone-info-bg)] opacity-60",
        icon: "bg-[color:var(--ui-tone-info-bg)] text-[color:var(--ui-tone-info-text)]",
        value: "text-[color:var(--ui-tone-info-text)]",
    },
    violet: {
        border: "border-[color:var(--ui-tone-insight-border)]",
        wash: "bg-[color:var(--ui-tone-insight-bg)] opacity-60",
        icon: "bg-[color:var(--ui-tone-insight-bg)] text-[color:var(--ui-tone-insight-text)]",
        value: "text-[color:var(--ui-tone-insight-text)]",
    },
} satisfies Record<StatCardAccent, {
    border: string;
    wash: string;
    icon: string;
    value: string;
}>;

export function StatCard({
    title,
    value,
    sub,
    icon: Icon,
    tone = "neutral",
    accent = "neutral",
    alert,
    progress,
    footer,
}: StatCardProps) {
    const t = useTranslation();
    const statusStyle = toneMap[tone];
    const identityStyle = accentMap[accent];
    const progressValue = typeof progress === "number" ? Math.max(0, Math.min(progress, 100)) : null;

    return (
        <div
            data-accent={accent}
            data-tone={tone}
            className={cn(
                "relative overflow-hidden rounded-[var(--ui-radius-panel)] border bg-[color:var(--ui-panel-bg)] p-4 shadow-[var(--ui-panel-shadow)]",
                identityStyle.border
            )}
        >
            <span aria-hidden="true" className={cn("pointer-events-none absolute inset-0", identityStyle.wash)} />
            <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs font-medium text-[color:var(--ui-stat-title)]">{t.owned(title)}</p>
                    <p className={cn("mt-2 break-words text-2xl font-semibold tracking-tight", identityStyle.value)}>{value}</p>
                    <p className="mt-1 text-xs leading-5 text-[color:var(--ui-stat-subtitle)]">{t.owned(sub)}</p>
                </div>
                <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--ui-radius-control)]", identityStyle.icon)}>
                    <Icon size={17} />
                </div>
            </div>

            {progressValue !== null && (
                <div className="relative mt-4">
                    <div className="h-1.5 overflow-hidden rounded-full bg-[color:var(--ui-stat-track)]">
                        <div className={cn("h-full rounded-full", statusStyle.progress)} style={{ width: `${progressValue}%` }} />
                    </div>
                    {footer && <p className="mt-2 text-[11px] text-[color:var(--ui-stat-subtitle)]">{t.owned(footer)}</p>}
                </div>
            )}

            {alert && progressValue === null && (
                <div className="relative mt-4 flex items-center gap-2 text-[11px] font-medium text-[color:var(--ui-stat-alert)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--ui-stat-alert-dot)]" />
                    {t("Needs attention")}</div>
            )}
        </div>
    );
}
