"use client";

import { AppShell } from "@/components/layout/AppShell";
import { BranchSidebar } from "@/components/layout/BranchSidebar";
import {
    LAST_ACTIVE_BRANCH_COOKIE,
    LAST_ACTIVE_BRANCH_COOKIE_MAX_AGE,
} from "@/lib/workspaceRouting";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export default function BranchLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const branchId = pathname?.split("/")[2];

    useEffect(() => {
        if (!branchId) return;

        const secure = window.location.protocol === "https:" ? "; secure" : "";
        document.cookie = `${LAST_ACTIVE_BRANCH_COOKIE}=${encodeURIComponent(branchId)}; path=/; max-age=${LAST_ACTIVE_BRANCH_COOKIE_MAX_AGE}; samesite=lax${secure}`;
    }, [branchId]);

    return (
        <AppShell sidebar={<BranchSidebar />}>
            {children}
        </AppShell>
    );
}
