"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Grid2X2, CreditCard, Menu } from "lucide-react";
import { useWorkspaceAccess } from "./BranchAccessProvider";
import { useBranchAccess } from "@/hooks/useBranchAccess";
import { useTranslation } from "@/components/settings/LocalizedText";

export function BranchMobileNav({ onMore, open }: { onMore: () => void; open: boolean }) {
    const pathname = usePathname(), t = useTranslation();
    const branchId = pathname?.match(/^\/branch\/([^/]+)/)?.[1];
    const { access } = useBranchAccess(branchId);
    const workspace = useWorkspaceAccess();
    const simple = workspace?.presentation === "simple";
    if (!branchId || !access) return null;
    const base = `/branch/${branchId}`;
    const items = [
        { label: "Overview", href: base, icon: LayoutDashboard, allowed: true, active: pathname === base },
        { label: "Students", href: `${base}/students`, icon: Users, allowed: access.permissions.students, active: pathname.startsWith(`${base}/students`) },
        { label: "Seats", href: `${base}/seats`, icon: Grid2X2, allowed: access.permissions.seat_allocation, active: /\/(seats|shifts|allocations)(\/|$)/.test(pathname) },
        { label: "Fees", href: `${base}/${simple ? "fees" : "payments"}`, icon: CreditCard, allowed: access.permissions.view_payments, active: /\/(payments|fees|renewals|overdue)(\/|$)/.test(pathname) },
    ].filter(item => item.allowed);
    return <nav className="ui-daily-nav" aria-label={t.owned("Daily navigation")}>
        {items.map(({ label, href, icon: Icon, active }) => <Link key={href} href={href} aria-current={active ? "page" : undefined}><Icon size={20} aria-hidden="true" /><span>{t.owned(label)}</span></Link>)}
        <button type="button" onClick={onMore} aria-expanded={open} aria-label={t.owned("More navigation")}><Menu size={20} aria-hidden="true" /><span>{t.owned("More")}</span></button>
    </nav>;
}
