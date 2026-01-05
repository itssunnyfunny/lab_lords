"use client";

import { AppShell } from "@/components/layout/AppShell";
import { BranchSidebar } from "@/components/layout/BranchSidebar";

export default function BranchLayout({ children }: { children: React.ReactNode }) {
    return (
        <AppShell sidebar={<BranchSidebar />}>
            {children}
        </AppShell>
    );
}
