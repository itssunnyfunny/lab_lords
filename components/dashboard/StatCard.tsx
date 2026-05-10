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
        icon: "bg-white/5 text-gray-300",
        value: "text-white",
        progress: "bg-gray-300",
    },
    success: {
        icon: "bg-emerald-500/10 text-emerald-300",
        value: "text-white",
        progress: "bg-emerald-400",
    },
    warning: {
        icon: "bg-amber-500/10 text-amber-300",
        value: "text-white",
        progress: "bg-amber-400",
    },
    danger: {
        icon: "bg-rose-500/10 text-rose-300",
        value: "text-white",
        progress: "bg-rose-400",
    },
    info: {
        icon: "bg-cyan-500/10 text-cyan-300",
        value: "text-white",
        progress: "bg-cyan-400",
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
        <div className="rounded-[8px] border border-white/10 bg-[#0b0f14]/80 p-4 shadow-sm shadow-black/20">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-400">{title}</p>
                    <p className={cn("mt-2 text-2xl font-semibold tracking-tight", accent.value)}>{value}</p>
                    <p className="mt-1 text-xs leading-5 text-gray-500">{sub}</p>
                </div>
                <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px]", accent.icon)}>
                    <Icon size={17} />
                </div>
            </div>

            {progressValue !== null && (
                <div className="mt-4">
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div className={cn("h-full rounded-full", accent.progress)} style={{ width: `${progressValue}%` }} />
                    </div>
                    {footer && <p className="mt-2 text-[11px] text-gray-500">{footer}</p>}
                </div>
            )}

            {alert && progressValue === null && (
                <div className="mt-4 flex items-center gap-2 text-[11px] font-medium text-rose-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                    Needs attention
                </div>
            )}
        </div>
    );
}
