"use client";

import { LockKeyhole, LucideIcon } from "lucide-react";
import Link from "next/link";
import React from "react";
import { useSidebarCollapsed } from "./SidebarContext";
import { useTranslation } from "@/components/settings/LocalizedText";

interface SidebarItemProps {
    icon: LucideIcon;
    label: string;
    isActive: boolean;
    onClick?: () => void;
    href?: string;
    isCollapsed?: boolean;
    density?: "default" | "compact";
    locked?: boolean;
    badge?: string;
}

export const SidebarItem = ({ icon: Icon, label, isActive, onClick, href, isCollapsed: collapsedProp, density = "default", locked = false, badge }: SidebarItemProps) => {
    const t = useTranslation();
    const inheritedCollapsed = useSidebarCollapsed();
    const isCollapsed = collapsedProp ?? inheritedCollapsed;
    const className = "ui-navigation-item";
    const content = <>
        <Icon size={density === "compact" ? 17 : 20} className="ui-navigation-icon" />
        {!isCollapsed && <span className="ui-navigation-item-label">{t.owned(label)}</span>}
        {!isCollapsed && locked && <LockKeyhole size={13} className="shrink-0 text-[color:var(--ui-tone-warning-text)]" aria-label={t.owned("Standard plan required")} />}
        {!isCollapsed && badge && <span className="rounded-full border border-[color:var(--ui-tone-warning-border)] bg-[color:var(--ui-tone-warning-bg)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[color:var(--ui-tone-warning-text)]">{badge}</span>}
    </>;

    if (href) {
        return (
            <Link href={href} aria-label={t.owned(label)} title={isCollapsed ? t.owned(label) : undefined} aria-current={isActive ? "page" : undefined} data-density={density} data-collapsed={isCollapsed || undefined} className={className}>
                {content}
            </Link>
        );
    }

    return (
        <button type="button" onClick={onClick} aria-label={t.owned(label)} title={isCollapsed ? t.owned(label) : undefined} aria-current={isActive ? "page" : undefined} data-density={density} data-collapsed={isCollapsed || undefined} className={className}>
            {content}
        </button>
    );
};
