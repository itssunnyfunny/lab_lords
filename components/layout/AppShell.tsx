"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { isAuthBypassEnabled } from "@/lib/authMode";
import { ReactNode } from "react";
import { AmbientBackground } from "@/components/ui/AmbientBackground";
import { usePathname, useRouter } from "next/navigation";
import { BranchTopSearch } from "@/components/layout/BranchTopSearch";
import { BranchNotifications } from "@/components/layout/BranchNotifications";

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

function ClerkAccountSummary({ user }: { user?: User }) {
    const { user: clerkUser } = useUser();
    const displayName = user?.name ?? clerkUser?.fullName ?? clerkUser?.primaryEmailAddress?.emailAddress ?? "Account";
    const displayRole = user?.role ?? "Workspace User";

    return (
        <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-white tracking-wide">{displayName}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">{displayRole}</p>
        </div>
    );
}

function DevAccountSummary() {
    return (
        <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-white tracking-wide">Local Dev</p>
            <p className="text-[10px] text-amber-300 uppercase tracking-wider">Auth Bypass</p>
        </div>
    );
}

function AccountSummary({ user }: { user?: User }) {
    if (isAuthBypassEnabled()) {
        return <DevAccountSummary />;
    }

    return <ClerkAccountSummary user={user} />;
}

function AccountControl() {
    if (isAuthBypassEnabled()) {
        return (
            <div className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-200">
                Local
            </div>
        );
    }

    return <UserButton />;
}

export function AppShell({ children, sidebar, user }: AppShellProps) {
    const router = useRouter();
    const pathname = usePathname();
    const showBranchChrome = /^\/branch\/[^/]+/.test(pathname ?? "");

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
                        {showBranchChrome && <BranchTopSearch />}
                    </div>

                    <div className="flex items-center gap-4">
                        {showBranchChrome && (
                            <>
                                <BranchNotifications />
                                <div className="h-6 w-[1px] bg-white/10 mx-2" />
                            </>
                        )}
                        <button
                            onClick={() => router.push('/account')}
                            className="flex items-center gap-3 pl-2 pr-1 py-1 rounded-full hover:bg-white/5 border border-transparent hover:border-white/5 transition-all cursor-pointer"
                        >
                            <AccountSummary user={user} />
                        </button>
                        <AccountControl />
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
