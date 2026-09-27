"use client";
import { useTranslation } from "@/components/settings/LocalizedText";

import { UserButton, useUser } from "@clerk/nextjs";
import { ReactNode, useEffect, useRef, useState } from "react";
import { AmbientBackground } from "@/components/ui/AmbientBackground";
import { usePathname, useRouter } from "next/navigation";
import { BranchTopSearch } from "@/components/layout/BranchTopSearch";
import { BranchNotifications } from "@/components/layout/BranchNotifications";
import { LanguageControls } from "@/components/settings/LanguageControls";
import { ChevronDown, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import {
    chromeAppRootClass,
    chromeDividerClass,
    chromeHeaderClass,
    chromeIconButtonClass,
    chromeInlineCardHoverClass,
    chromeMutedTextClass,
} from "@/components/ui/chromeSurface";
import {
    accountMenuClerkAppearance,
    accountProfileClerkAppearance,
} from "@/components/ui/entrySurface";
import { useBillingExperience } from "@/components/billing/BillingExperienceProvider";
import { BillingBanner } from "@/components/billing/BillingBanner";
import { ReadOnlyBanner } from "@/components/billing/ReadOnlyBanner";
import { WorkspaceSwitcher } from "@/components/layout/WorkspaceSwitcher";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { ToastProvider } from "@/components/ui/Toast";
import { RouteTitleUpdater } from "@/components/layout/RouteTitleUpdater";
import { Drawer } from "@/components/ui/Drawer";
import { ContextualBackLink } from "@/components/layout/ContextualBackLink";
import { publicDisplayFont } from "@/lib/publicMarketingFonts";
import { useMediaQuery } from "@/hooks/useMediaQuery";


interface User {
    name: string;
    role: string;
    avatar: string;
}

interface AppShellProps {
    children: ReactNode;
    sidebar: ReactNode;
    user?: User;
    designPilot?: boolean;
}

function AccountSummary({ user }: { user?: User }) {
    const t = useTranslation();
    const { user: clerkUser } = useUser();
    const { profileName } = useUserPreferences();
    const displayName = profileName
        || user?.name?.trim()
        || clerkUser?.fullName?.trim()
        || clerkUser?.firstName?.trim()
        || "Set up profile";
    const displayRole = user?.role ?? "Workspace User";

    return (
        <div className="text-right hidden sm:block">
            <p className="text-xs font-bold tracking-wide text-[color:var(--text-primary)]">{displayName}</p>
            <p className={cn("text-[10px]", chromeMutedTextClass)}>{t.owned(displayRole)}</p>
        </div>
    );
}

export function AppShell({ children, sidebar, user, designPilot = false }: AppShellProps) {
    const t = useTranslation();
    const router = useRouter();
    const pathname = usePathname();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const previousPathname = useRef(pathname);
    const showBranchChrome = /^\/branch\/[^/]+/.test(pathname ?? "");
    const billing = useBillingExperience();
    const compactLayout = useMediaQuery("(max-width: 1023px)");

    useEffect(() => {
        if (previousPathname.current === pathname) return;
        previousPathname.current = pathname;

        const closeTimer = window.setTimeout(() => setMobileNavOpen(false), 0);
        return () => window.clearTimeout(closeTimer);
    }, [pathname]);

    return (
        <ToastProvider>
        <div
            className={cn(chromeAppRootClass, designPilot && publicDisplayFont.variable)}
            data-app-design-pilot={designPilot ? "workspace" : undefined}
        >
            <RouteTitleUpdater />
            <a
                href="#main-content"
                className="fixed left-4 top-3 z-[120] -translate-y-20 rounded-[var(--ui-radius-control)] border border-[color:var(--ui-button-primary-border)] bg-[color:var(--ui-button-primary-bg)] px-4 py-2 text-sm font-bold text-[color:var(--ui-button-primary-text)] shadow-lg transition-transform focus:translate-y-0"
            >
                {t("Skip to main content")}</a>
            <AmbientBackground />

            {/* Desktop and mobile navigation are mutually exclusive to avoid duplicate hidden controls and reads. */}
            {!compactLayout && (
                <div className="relative z-30 hidden lg:block">
                    {sidebar}
                </div>
            )}

            {compactLayout && (
                <Drawer
                    open={mobileNavOpen}
                    onClose={() => setMobileNavOpen(false)}
                    title={t("Workspace navigation")}
                    closeLabel={t("Close navigation")}
                    className="max-w-[19rem] lg:hidden"
                >
                    <div className="h-[calc(100dvh-9rem)] overflow-hidden">{sidebar}</div>
                </Drawer>
            )}

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 max-w-full relative z-10">
                {/* Top Header */}
                <header className={cn(chromeHeaderClass, designPilot && "reference-topbar max-sm:flex-wrap max-sm:content-center max-sm:py-2")}>
                    <div className={cn(
                        "flex min-w-0 flex-1 items-center gap-2 sm:gap-3 lg:gap-5",
                        !designPilot && "lg:max-w-md",
                        designPilot && "max-sm:w-full max-sm:flex-none"
                    )}>
                        <button
                            type="button"
                            onClick={() => setMobileNavOpen(true)}
                            className={cn("flex-shrink-0 lg:hidden", chromeIconButtonClass)}
                            aria-label={t("Open navigation")}
                            aria-expanded={mobileNavOpen}
                        >
                            <Menu size={18} />
                        </button>
                        <WorkspaceSwitcher separated={designPilot && showBranchChrome} className={designPilot ? "min-w-0 flex-1 lg:flex-none" : "min-w-0 flex-1 lg:w-48 lg:flex-none"} />
                        {showBranchChrome && <BranchTopSearch />}
                    </div>

                    <div className={cn(
                        "flex flex-shrink-0 items-center gap-1.5 sm:gap-3 md:gap-4",
                        designPilot && "max-sm:w-full max-sm:justify-end"
                    )}>
                        {showBranchChrome && (
                            <>
                                <BranchNotifications />
                                <div className={cn("hidden h-6 w-[1px] sm:block md:mx-2", chromeDividerClass)} />
                            </>
                        )}
                        <LanguageControls compact />
                        <UserButton
                            appearance={accountMenuClerkAppearance}
                            userProfileMode="modal"
                            userProfileProps={{ appearance: accountProfileClerkAppearance }}
                        />
                        <button
                            type="button"
                            onClick={() => router.push('/account')}
                            className={cn("hidden items-center gap-3 rounded-full border border-transparent py-1 pl-2 pr-1 transition-colors lg:flex", chromeInlineCardHoverClass)}
                        >
                            <AccountSummary user={user} />
                            <ChevronDown size={14} aria-hidden="true" />
                        </button>
                    </div>
                </header>

                {/* Page Content */}
                <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 overflow-y-auto p-4 [padding-bottom:max(1rem,env(safe-area-inset-bottom))] sm:p-6 sm:[padding-bottom:max(1.5rem,env(safe-area-inset-bottom))] lg:p-8 lg:[padding-bottom:max(2rem,env(safe-area-inset-bottom))]">
                    {billing?.experience && <ReadOnlyBanner experience={billing.experience} />}
                    {billing?.experience && <BillingBanner experience={billing.experience} />}
                    <ContextualBackLink />
                    {children}
                </main>
            </div>
        </div>
        </ToastProvider>
    );
}
