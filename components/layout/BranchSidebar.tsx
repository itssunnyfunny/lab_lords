"use client";

import { LayoutDashboard, Users, CreditCard, Settings, UserCircle, Grid, FileText, Sparkles, MessageSquare, ChevronRight, CalendarCheck, UserCircle2 } from "lucide-react";
import { SidebarItem } from "./SidebarItem";
import { useRouter, usePathname } from "next/navigation";

interface SidebarProps {
    className?: string; // Kept for compatibility although mostly unused in new styling
}

export function BranchSidebar({ className }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();

    const handleOrgDash = () => {
        router.push('/org'); // Simplistic
    };

    const navigate = (path: string) => {
        router.push(path);
    };

    // Extract branch ID from pathname for links
    const segments = pathname?.split('/') || [];
    const branchId = segments[2];
    const basePath = `/branch/${branchId}`;

    if (!branchId) return null; // Safe guard

    return (
        <div className="w-72 bg-[#050508]/80 backdrop-blur-xl border-r border-white/5 flex flex-col h-full relative z-30">
            <div className="h-20 flex items-center px-6 border-b border-white/5 bg-[#0a0a0e]/50">
                <div onClick={handleOrgDash} className="cursor-pointer hover:bg-white/10 -ml-2 p-2 rounded-xl transition-all duration-300 mr-3 border border-transparent hover:border-white/5 group">
                    <ChevronRight size={20} className="text-gray-500 group-hover:text-white rotate-180 transition-transform" />
                </div>
                <div className="flex flex-col overflow-hidden">
                    <span className="font-bold text-sm text-white truncate">Downtown Hub</span>
                    <span className="text-[10px] text-cyan-400 uppercase tracking-wider font-bold glow-text">Branch Connected</span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto py-6 space-y-8 scrollbar-none px-6">
                <div className="space-y-2">
                    <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-3 px-2">Overview</div>
                    <SidebarItem icon={LayoutDashboard} label="Dashboard" isActive={pathname === basePath} onClick={() => navigate(basePath)} />
                    <SidebarItem icon={LayoutDashboard} label="Analytics" isActive={pathname === `${basePath}/analytics`} onClick={() => navigate(`${basePath}/analytics`)} />
                </div>

                <div className="space-y-2">
                    <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-3 px-2">Operations</div>
                    <SidebarItem icon={Users} label="Students" isActive={pathname === `${basePath}/students`} onClick={() => navigate(`${basePath}/students`)} />
                    <SidebarItem icon={Grid} label="Seats & Maps" isActive={pathname === `${basePath}/seats`} onClick={() => navigate(`${basePath}/seats`)} />
                    <SidebarItem icon={CalendarCheck} label="Allocations" isActive={pathname?.startsWith(`${basePath}/allocations`)} onClick={() => navigate(`${basePath}/allocations`)} />
                    <SidebarItem icon={CreditCard} label="Payments" isActive={pathname === `${basePath}/payments`} onClick={() => navigate(`${basePath}/payments`)} />
                    <SidebarItem icon={UserCircle} label="Staff" isActive={pathname === `${basePath}/staff`} onClick={() => navigate(`${basePath}/staff`)} />
                </div>

                <div className="space-y-2">
                    <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-3 px-2">Intelligence</div>
                    <SidebarItem icon={FileText} label="AI Reports" isActive={pathname === `${basePath}/ai/reports`} onClick={() => navigate(`${basePath}/ai/reports`)} />
                    <SidebarItem icon={Sparkles} label="Insights" isActive={pathname === `${basePath}/ai/insights`} onClick={() => navigate(`${basePath}/ai/insights`)} />
                    <SidebarItem icon={MessageSquare} label="Assistant" isActive={pathname === `${basePath}/ai/messages`} onClick={() => navigate(`${basePath}/ai/messages`)} />
                </div>
            </div>

            {/* Account link — pinned at bottom */}
            <div className="px-6 pb-6 border-t border-white/5 pt-4">
                <SidebarItem
                    icon={UserCircle2}
                    label="My Account"
                    isActive={pathname === "/account"}
                    onClick={() => navigate("/account")}
                />
            </div>
        </div>
    );
}
