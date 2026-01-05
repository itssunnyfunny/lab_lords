"use client";

import { ReactNode } from "react";
import { AmbientBackground } from "@/components/ui/AmbientBackground";
import { Search, Bell } from "lucide-react";

interface User {
    name: string;
    role: string;
    avatar: string;
}

interface AppShellProps {
    children: ReactNode;
    sidebar: ReactNode;
    user?: User;
}

const DEFAULT_USER = {
    name: "Admin User",
    role: "Super Admin",
    avatar: "AU"
};

export function AppShell({ children, sidebar, user = DEFAULT_USER }: AppShellProps) {
    return (
        <div className="flex h-screen text-white font-sans overflow-hidden selection:bg-cyan-500/30 selection:text-cyan-50">
            <AmbientBackground />

            {/* Sidebar Area - Glassmorphic */}
            <div className="relative z-30 hidden md:block">
                {sidebar}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 relative z-10">
                {/* Top Header */}
                <header className="h-16 border-b border-white/5 bg-[#0a0a0e]/60 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-40">
                    <div className="flex items-center gap-4 w-1/3">
                        <div className="relative w-full max-w-sm group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-cyan-400 transition-colors duration-300" size={16} />
                            <input
                                type="text"
                                placeholder="Search system..."
                                className="w-full bg-[#13131a]/50 border border-white/5 focus:border-cyan-500/30 rounded-xl pl-10 pr-4 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-cyan-500/20 transition-all duration-300"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button className="relative p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/5">
                            <Bell size={20} />
                            <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.8)] animate-pulse" />
                        </button>
                        <div className="h-6 w-[1px] bg-white/10 mx-2" />
                        <div className="flex items-center gap-3 pl-2 pr-1 py-1 rounded-full hover:bg-white/5 border border-transparent hover:border-white/5 transition-all cursor-pointer">
                            <div className="text-right hidden sm:block">
                                <p className="text-xs font-bold text-white tracking-wide">{user.name}</p>
                                <p className="text-[10px] text-gray-400 uppercase tracking-wider">{user.role}</p>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-violet-600 p-[1px] shadow-[0_0_10px_rgba(139,92,246,0.3)]">
                                <div className="w-full h-full rounded-full bg-[#0a0a0e] flex items-center justify-center text-xs font-bold text-white">
                                    {user.avatar}
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    {children}
                </main>
            </div>
        </div>
    );
}
