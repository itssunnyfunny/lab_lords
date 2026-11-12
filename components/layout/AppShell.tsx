"use client";
import { useTranslation } from "@/components/settings/LocalizedText";

import { ReactNode, useEffect, useRef, useState } from "react";
import { AmbientBackground } from "@/components/ui/AmbientBackground";
import { usePathname } from "next/navigation";
import { BranchTopSearch } from "@/components/layout/BranchTopSearch";
import { BranchNotifications } from "@/components/layout/BranchNotifications";
import { ArrowLeft, Menu } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
    chromeAppRootClass,
    chromeHeaderClass,
    chromeIconButtonClass,
} from "@/components/ui/chromeSurface";
import { useBillingExperience } from "@/components/billing/BillingExperienceProvider";
import { BillingBanner } from "@/components/billing/BillingBanner";
import { ReadOnlyBanner } from "@/components/billing/ReadOnlyBanner";
import { BranchMobileNav } from "./BranchMobileNav";
import { WorkspaceSwitcher } from "@/components/layout/WorkspaceSwitcher";
import { ToastProvider } from "@/components/ui/Toast";
import { RouteTitleUpdater } from "@/components/layout/RouteTitleUpdater";
import { Drawer } from "@/components/ui/Drawer";
import { ContextualBackLink } from "@/components/layout/ContextualBackLink";
import { publicDisplayFont } from "@/lib/publicMarketingFonts";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useWorkspaceReturnHref } from "@/hooks/useWorkspaceReturnHref";


interface User {
    name: string;
    role: string;
    avatar: string;
}

interface AppShellProps {
    children: ReactNode;
    sidebar?: ReactNode;
    user?: User;
    designPilot?: boolean;
}

export function AppShell({ children, sidebar, designPilot = false }: AppShellProps) {
    const t = useTranslation();
    const pathname = usePathname();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const previousPathname = useRef(pathname);
    const showBranchChrome = /^\/branch\/[^/]+/.test(pathname ?? "");
    const showWorkspaceControls = showBranchChrome || /^\/org\/[^/]+/.test(pathname ?? "");
    const billing = useBillingExperience();
    const compactLayout = useMediaQuery("(max-width: 1023px)");
    const accountReturnHref = useWorkspaceReturnHref(pathname);
    const inAccount = pathname === "/account" || pathname.startsWith("/account/");

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
            {sidebar && !compactLayout && (
                <div className="relative z-30 hidden lg:block">
                    {sidebar}
                </div>
            )}

            {sidebar && compactLayout && (
                <Drawer
                    open={mobileNavOpen}
                    onClose={() => setMobileNavOpen(false)}
                    title={t(inAccount ? "Account navigation" : showBranchChrome ? "Branch navigation" : "Organization navigation")}
                    closeLabel={t("Close navigation")}
                    className="max-w-[19rem] lg:hidden"
                    variant="navigation"
                    overlayClassName={designPilot ? publicDisplayFont.variable : undefined}
                >
                    <div className="h-full overflow-hidden">{sidebar}</div>
                </Drawer>
            )}

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 max-w-full relative z-10">
                {/* Top Header */}
                <header className={cn(chromeHeaderClass, designPilot && "reference-topbar", inAccount && "ui-account-topbar")}>
                    <div className={cn(
                        "flex min-w-0 flex-1 items-center gap-2 sm:gap-3 lg:gap-5",
                        !designPilot && "lg:max-w-md",
                        designPilot && "max-sm:min-w-0",
                        inAccount && "flex-none"
                    )}>
                        {sidebar && <button
                            type="button"
                            onClick={() => setMobileNavOpen(true)}
                            className={cn("flex-shrink-0 lg:hidden", chromeIconButtonClass)}
                            aria-label={t("Open navigation")}
                            aria-expanded={mobileNavOpen}
                        >
                            <Menu size={18} />
                        </button>}
                        {showWorkspaceControls ? <WorkspaceSwitcher className={designPilot ? "min-w-0 flex-1 lg:flex-none" : "min-w-0 flex-1 lg:w-48 lg:flex-none"} /> : <span className="text-sm font-semibold text-[color:var(--text-primary)]">{t.owned(inAccount ? "Account" : "Workspaces")}</span>}
                        {showBranchChrome && <BranchTopSearch />}
                    </div>

                    <div className={cn("flex items-center gap-2", inAccount ? "min-w-0 shrink" : "shrink-0")}>
                        {showBranchChrome && <BranchNotifications />}
                        {inAccount && accountReturnHref && <Link href={accountReturnHref} className="inline-flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-2 text-sm font-medium text-[color:var(--text-secondary)] hover:bg-[color:var(--ui-form-surface-hover-bg)]"><ArrowLeft size={17} className="shrink-0" /><span className="min-w-0">{t("Back to workspace")}</span></Link>}
                    </div>
                </header>

                {/* Page Content */}
                <main id="main-content" tabIndex={-1} className="flex-1 min-w-0 overflow-y-auto p-4 [padding-bottom:max(1rem,env(safe-area-inset-bottom))] sm:p-6 sm:[padding-bottom:max(1.5rem,env(safe-area-inset-bottom))] lg:p-8 lg:[padding-bottom:max(2rem,env(safe-area-inset-bottom))]">
                    {billing?.experience && <ReadOnlyBanner experience={billing.experience} />}
                    {billing?.experience && <BillingBanner experience={billing.experience} />}
                    {!inAccount && <ContextualBackLink />}
                    {children}
                </main>
                {designPilot && showBranchChrome && <BranchMobileNav onMore={() => setMobileNavOpen(true)} open={mobileNavOpen} />}
            </div>
        </div>
        </ToastProvider>
    );
}
