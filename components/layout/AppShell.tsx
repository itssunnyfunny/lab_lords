"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { isAuthBypassEnabled } from "@/lib/authMode";
import { ReactNode, useEffect, useRef, useState } from "react";
import { AmbientBackground } from "@/components/ui/AmbientBackground";
import { usePathname, useRouter } from "next/navigation";
import { BranchTopSearch } from "@/components/layout/BranchTopSearch";
import { BranchNotifications } from "@/components/layout/BranchNotifications";
import { Menu, X } from "lucide-react";

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
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const previousPathname = useRef(pathname);
    const showBranchChrome = /^\/branch\/[^/]+/.test(pathname ?? "");

    useEffect(() => {
        if (previousPathname.current === pathname) return;
        previousPathname.current = pathname;

        const closeTimer = window.setTimeout(() => setMobileNavOpen(false), 0);
        return () => window.clearTimeout(closeTimer);
    }, [pathname]);

    useEffect(() => {
        if (!mobileNavOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setMobileNavOpen(false);
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [mobileNavOpen]);

    return (
        <div className="flex h-[100dvh] max-w-full overflow-hidden text-white font-sans selection:bg-cyan-500/30 selection:text-cyan-50">
            <AmbientBackground />

            {/* Sidebar Area - Glassmorphic */}
            <div className="relative z-30 hidden md:block">
                {sidebar}
            </div>

            {mobileNavOpen && (
                <div className="fixed inset-0 z-[80] md:hidden">
                    <button
                        type="button"
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        aria-label="Close navigation"
                        onClick={() => setMobileNavOpen(false)}
                    />
                    <aside
                        className="relative h-full w-[min(18rem,calc(100vw-2rem))] overflow-hidden border-r border-white/10 bg-[#050508] shadow-2xl"
                        aria-label="Mobile navigation"
                    >
                        <button
                            type="button"
                            onClick={() => setMobileNavOpen(false)}
                            className="absolute right-3 top-3 z-50 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                            aria-label="Close navigation"
                        >
                            <X size={17} />
                        </button>
                        <div className="h-full overflow-hidden">
                            {sidebar}
                        </div>
                    </aside>
                </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 max-w-full relative z-10">
                {/* Top Header */}
                <header className="h-16 border-b border-white/5 bg-[#0a0a0e]/60 backdrop-blur-md flex items-center justify-between gap-2 px-3 sm:px-4 md:px-6 sticky top-0 z-40">
                    <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4 md:max-w-md">
                        <button
                            type="button"
                            onClick={() => setMobileNavOpen(true)}
                            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-gray-300 transition-colors hover:bg-white/10 hover:text-white md:hidden"
                            aria-label="Open navigation"
                            aria-expanded={mobileNavOpen}
                        >
                            <Menu size={18} />
                        </button>
                        {showBranchChrome && <BranchTopSearch />}
                    </div>

                    <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-3 md:gap-4">
                        {showBranchChrome && (
                            <>
                                <BranchNotifications />
                                <div className="hidden h-6 w-[1px] bg-white/10 sm:block md:mx-2" />
                            </>
                        )}
                        <button
                            onClick={() => router.push('/account')}
                            className="hidden items-center gap-3 pl-2 pr-1 py-1 rounded-full hover:bg-white/5 border border-transparent hover:border-white/5 transition-all cursor-pointer sm:flex"
                        >
                            <AccountSummary user={user} />
                        </button>
                        <AccountControl />
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto p-3 sm:p-4 md:p-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    {children}
                </main>
            </div>
        </div>
    );
}
