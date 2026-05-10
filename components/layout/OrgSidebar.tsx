"use client";

import { LayoutDashboard, BarChart3, Settings } from "lucide-react";
import { SidebarItem } from "./SidebarItem";
import { useRouter, usePathname } from "next/navigation";

export function OrgSidebar() {
    const pathname = usePathname();
    const router = useRouter();

    const navigate = (path: string) => {
        router.push(path);
    };

    // Extract org ID from pathname
    const segments = pathname?.split('/') || [];
    const orgId = segments[2];
    const basePath = `/org/${orgId}`;

    return (
        <div className="w-full md:w-72 bg-[#050508]/80 backdrop-blur-xl border-r border-white/5 flex flex-col h-full relative z-30">
            <div className="h-20 flex items-center px-8 border-b border-white/5">
                <div className="w-10 h-10 bg-white text-gray-950 rounded-[8px] mr-3 flex items-center justify-center font-bold border border-white/10">L</div>
                <div>
                    <span className="font-bold text-lg tracking-tight text-white block">Lab Lords</span>
                    <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest">Operations</span>
                </div>
            </div>

            <div className="flex-1 p-6 space-y-2">
                <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-4 px-2">Organization</div>
                <SidebarItem icon={LayoutDashboard} label="Dashboard" isActive={pathname === basePath} onClick={() => navigate(basePath)} />
                <SidebarItem icon={BarChart3} label="Global Analytics" isActive={pathname === `${basePath}/analytics`} onClick={() => navigate(`${basePath}/analytics`)} />
            </div>

            {/* Bottom pinned: System Settings */}
            <div className="px-6 pb-6 border-t border-white/5 pt-4">
                <SidebarItem
                    icon={Settings}
                    label="System Settings"
                    isActive={pathname === `${basePath}/settings`}
                    onClick={() => navigate(`${basePath}/settings`)}
                />
            </div>
        </div>
    );
}
