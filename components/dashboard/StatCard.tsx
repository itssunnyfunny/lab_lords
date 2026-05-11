"use client";

import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
    title: string;
    value: string;
    sub: string;
    icon: LucideIcon;
    tone?: "neutral" | "success" | "warning" | "danger" | "info";
    alert?: boolean;
    progress?: number;
    footer?: string;
}

const toneMap = {
    neutral: {
        icon: "bg-[color:var(--ui-tone-neutral-bg)] text-[color:var(--ui-tone-neutral-text)]",
        value: "text-[color:var(--ui-stat-value)]",
        progress: "bg-[color:var(--ui-tone-neutral-progress)]",
    },
    success: {
        icon: "bg-[color:var(--ui-tone-success-bg)] text-[color:var(--ui-tone-success-text)]",
        value: "text-[color:var(--ui-stat-value)]",
        progress: "bg-[color:var(--ui-tone-success-progress)]",
    },
    warning: {
        icon: "bg-[color:var(--ui-tone-warning-bg)] text-[color:var(--ui-tone-warning-text)]",
        value: "text-[color:var(--ui-stat-value)]",
        progress: "bg-[color:var(--ui-tone-warning-progress)]",
    },
    danger: {
        icon: "bg-[color:var(--ui-tone-danger-bg)] text-[color:var(--ui-tone-danger-text)]",
        value: "text-[color:var(--ui-stat-value)]",
        progress: "bg-[color:var(--ui-tone-danger-progress)]",
    },
    info: {
        icon: "bg-[color:var(--ui-tone-info-bg)] text-[color:var(--ui-tone-info-text)]",
        value: "text-[color:var(--ui-stat-value)]",
        progress: "bg-[color:var(--ui-tone-info-progress)]",
    },
};

export function StatCard({
    title,
    value,
    sub,
    icon: Icon,
    tone = "neutral",
    alert,
    progress,
    footer,
}: StatCardProps) {
    const accent = toneMap[tone];
    const progressValue = typeof progress === "number" ? Math.max(0, Math.min(progress, 100)) : null;

    return (
        <div className="rounded-[var(--ui-radius-panel)] border border-[color:var(--ui-panel-border)] bg-[color:var(--ui-panel-bg)] p-4 shadow-[var(--ui-panel-shadow)]">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs font-medium text-[color:var(--ui-stat-title)]">{title}</p>
                    <p className={cn("mt-2 text-2xl font-semibold tracking-tight", accent.value)}>{value}</p>
                    <p className="mt-1 text-xs leading-5 text-[color:var(--ui-stat-subtitle)]">{sub}</p>
                </div>
                <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--ui-radius-control)]", accent.icon)}>
                    <Icon size={17} />
                </div>
            </div>

            {progressValue !== null && (
                <div className="mt-4">
                    <div className="h-1.5 overflow-hidden rounded-full bg-[color:var(--ui-stat-track)]">
                        <div className={cn("h-full rounded-full", accent.progress)} style={{ width: `${progressValue}%` }} />
                    </div>
                    {footer && <p className="mt-2 text-[11px] text-[color:var(--ui-stat-subtitle)]">{footer}</p>}
                </div>
            )}

            {alert && progressValue === null && (
                <div className="mt-4 flex items-center gap-2 text-[11px] font-medium text-[color:var(--ui-stat-alert)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--ui-stat-alert-dot)]" />
                    Needs attention
                </div>
            )}
        </div>
    );
}
