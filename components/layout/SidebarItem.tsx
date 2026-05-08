"use client";

import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import React from "react";

interface SidebarItemProps {
    icon: LucideIcon;
    label: string;
    isActive: boolean;
    onClick?: () => void;
    isCollapsed?: boolean;
    density?: "default" | "compact";
}

export const SidebarItem = ({ icon: Icon, label, isActive, onClick, isCollapsed, density = "default" }: SidebarItemProps) => (
    <button
        onClick={onClick}
        aria-current={isActive ? "page" : undefined}
        className={cn(
            "group relative flex w-full items-center text-left transition-all duration-300",
            density === "compact"
                ? "h-9 gap-2.5 rounded-lg border px-2.5"
                : "gap-3 rounded-xl px-3 py-2.5",
            isActive
                ? density === "compact"
                    ? "border-cyan-400/20 bg-white/[0.075] text-white"
                    : "border-violet-500/30 bg-gradient-to-r from-violet-600/20 to-indigo-600/10 text-white shadow-[0_0_15px_rgba(139,92,246,0.15)]"
                : density === "compact"
                    ? "border-transparent text-gray-400 hover:border-white/10 hover:bg-white/[0.045] hover:text-white"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
        )}
    >
        <Icon
            size={density === "compact" ? 17 : 20}
            className={cn(
                "shrink-0 transition-colors duration-300",
                isActive
                    ? density === "compact" ? "text-cyan-300" : "text-violet-300 drop-shadow-[0_0_5px_rgba(167,139,250,0.5)]"
                    : "group-hover:text-cyan-200"
            )}
        />
        {!isCollapsed && (
            <span className={cn(
                "min-w-0 flex-1 truncate font-medium tracking-wide",
                density === "compact" ? "text-[13px]" : "text-sm"
            )}>
                {label}
            </span>
        )}
        {isActive && <div className={cn(
            "absolute left-0 top-1/2 w-0.5 -translate-y-1/2",
            density === "compact" ? "h-4 bg-cyan-300" : "h-6 bg-violet-400 shadow-[0_0_10px_#8b5cf6]"
        )} />}
    </button>
);
