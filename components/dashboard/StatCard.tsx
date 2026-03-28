"use client";

import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
    title: string;
    value: string;
    sub: string;
    icon: LucideIcon;
    accent: "emerald" | "rose" | "indigo" | "amber";
    alert?: boolean; // shows a glowing dot if true
}

const accentMap = {
    emerald: {
        icon: "bg-emerald-500/10 text-emerald-400",
        border: "hover:border-emerald-500/20",
        glow: "hover:shadow-[0_8px_32px_0_rgba(16,185,129,0.12)]",
        value: "text-emerald-300",
    },
    rose: {
        icon: "bg-rose-500/10 text-rose-400",
        border: "hover:border-rose-500/20",
        glow: "hover:shadow-[0_8px_32px_0_rgba(244,63,94,0.12)]",
        value: "text-rose-300",
    },
    indigo: {
        icon: "bg-indigo-500/10 text-indigo-400",
        border: "hover:border-indigo-500/20",
        glow: "hover:shadow-[0_8px_32px_0_rgba(99,102,241,0.12)]",
        value: "text-indigo-300",
    },
    amber: {
        icon: "bg-amber-500/10 text-amber-400",
        border: "hover:border-amber-500/20",
        glow: "hover:shadow-[0_8px_32px_0_rgba(245,158,11,0.12)]",
        value: "text-amber-300",
    },
};

export function StatCard({ title, value, sub, icon: Icon, accent, alert }: StatCardProps) {
    const a = accentMap[accent];

    return (
        <Card className={cn("relative group cursor-default transition-all duration-300", a.border, a.glow)}>
            {/* Alert dot */}
            {alert && (
                <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)] animate-pulse" />
            )}

            <div className="flex items-start gap-4">
                <div className={cn("p-2.5 rounded-xl flex-shrink-0 transition-all duration-300 group-hover:scale-110", a.icon)}>
                    <Icon size={20} />
                </div>
                <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-300 uppercase tracking-widest mb-1">{title}</p>
                    <p className={cn("text-2xl font-bold tracking-tight", a.value)}>{value}</p>
                    <p className="text-xs text-gray-400 mt-1 truncate">{sub}</p>
                </div>
            </div>
        </Card>
    );
}
