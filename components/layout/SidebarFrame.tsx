"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";
import { AppLogo } from "@/components/brand/AppLogo";
import { SidebarItem } from "./SidebarItem";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { useTranslation } from "@/components/settings/LocalizedText";
import { accountHref } from "@/lib/accountNavigation";

import { SidebarCollapsed } from "./SidebarContext";

export function SidebarFrame({ children, homeHref, label, account = false, footer }: {
    children: ReactNode; homeHref: string; label: string; account?: boolean; footer?: ReactNode;
}) {
    const t = useTranslation();
    const pathname = usePathname();
    const { ownerKey } = useUserPreferences();
    const mobile = useMediaQuery("(max-width: 1023px)");
    const key = `lab-lords:sidebar:${ownerKey}:${account ? "account" : "workspace"}`;
    const [saved, setSaved] = useState<{ key: string; collapsed: boolean } | null>(null);
    useEffect(() => {
        let collapsed = false;
        try { collapsed = localStorage.getItem(key) === "collapsed"; } catch {}
        queueMicrotask(() => setSaved({ key, collapsed }));
    }, [key]);
    const collapsed = !mobile && saved?.key === key && saved.collapsed;
    function toggle() {
        const next = !collapsed;
        setSaved({ key, collapsed: next });
        try { localStorage.setItem(key, next ? "collapsed" : "expanded"); } catch {}
    }
    return <SidebarCollapsed.Provider value={collapsed}>
        <aside className="ui-navigation-sidebar" data-collapsed={collapsed || undefined} aria-label={t.owned(label)} data-app-design-pilot="workspace">
            <div className="ui-navigation-brand">
                <Link href={homeHref} aria-label={t("Open workspace home")}>
                    <AppLogo showSubtitle={false} markVariant="botanical" titleClassName="text-lg" markClassName="h-8 w-11" />
                </Link>
            </div>
            <div className="ui-navigation-heading">
                {!collapsed && <span>{t.owned(account ? "Account" : "Workspace")}</span>}
                <button type="button" onClick={toggle} aria-label={t.owned(collapsed ? "Expand sidebar" : "Collapse sidebar")} title={t.owned(collapsed ? "Expand sidebar" : "Collapse sidebar")} aria-expanded={!collapsed} className="ui-navigation-toggle">
                    {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
                </button>
            </div>
            <nav className="ui-navigation-scroll" aria-label={t.owned(label)}>{children}</nav>
            <div className="ui-navigation-footer">
                {account ? footer : <SidebarItem icon={UserRound} label="Account" isActive={false} href={accountHref(pathname)} density="compact" />}
            </div>
        </aside>
    </SidebarCollapsed.Provider>;
}
