import React, { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface BadgeProps {
    children: ReactNode;
    variant?: "default" | "success" | "warning" | "purple" | "cyan";
    className?: string;
}

export const Badge = ({ children, variant = "default", className }: BadgeProps) => {
    const variants = {
        default: "bg-white/5 text-gray-300 border-white/10",
        success: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]",
        warning: "bg-amber-500/10 text-amber-300 border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]",
        purple: "bg-violet-500/10 text-violet-300 border-violet-500/20 shadow-[0_0_10px_rgba(139,92,246,0.1)]",
        cyan: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.1)]",
    };

    return (
        <span className={cn(
            "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border",
            variants[variant] || variants.default,
            className
        )}>
            {children}
        </span>
    );
};
