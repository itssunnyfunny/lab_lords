"use client";

import { LucideIcon } from "lucide-react";
import React from "react";

interface SidebarItemProps {
    icon: LucideIcon;
    label: string;
    isActive: boolean;
    onClick?: () => void;
    isCollapsed?: boolean;
}

export const SidebarItem = ({ icon: Icon, label, isActive, onClick, isCollapsed }: SidebarItemProps) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 group relative
      ${isActive
                ? 'bg-gradient-to-r from-violet-600/20 to-indigo-600/10 text-white border border-violet-500/30 shadow-[0_0_15px_rgba(139,92,246,0.15)]'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
    >
        <Icon size={20} className={`transition-colors duration-300 ${isActive ? 'text-violet-300 drop-shadow-[0_0_5px_rgba(167,139,250,0.5)]' : 'group-hover:text-cyan-200'}`} />
        {!isCollapsed && <span className="text-sm font-medium tracking-wide">{label}</span>}
        {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-violet-400 shadow-[0_0_10px_#8b5cf6]" />}
    </button>
);
