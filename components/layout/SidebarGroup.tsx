"use client";
import { useId, useState, type ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/components/settings/LocalizedText";
import { useSidebarCollapsed } from "./SidebarContext";

/** Route changes reopen the active group; disclosure never changes a destination. */
export function SidebarGroup({ label, icon: Icon, active, children }: { label: string; icon: LucideIcon; active: boolean; children: ReactNode }) {
    const t = useTranslation(), pathname = usePathname(), id = useId();
    const collapsed = useSidebarCollapsed();
    const [choice, setChoice] = useState<{ pathname: string | null; open: boolean } | null>(null);
    const open = collapsed || (choice?.pathname === pathname ? choice.open : active);
    return <section className="ui-navigation-group" data-active={active || undefined}>
        {!collapsed && <button type="button" className="ui-navigation-group-toggle" aria-expanded={open} aria-controls={id} onClick={() => setChoice({ pathname, open: !open })}>
            <Icon size={17} aria-hidden="true" /><span>{t.owned(label)}</span><ChevronDown size={14} aria-hidden="true" />
        </button>}
        <div id={id} hidden={!open} className="ui-navigation-group-items">{children}</div>
    </section>;
}
