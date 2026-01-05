"use client";

import { AppShell } from "@/components/layout/AppShell";
import { OrgSidebar } from "@/components/layout/OrgSidebar";

export default function OrgLayout({ children }: { children: React.ReactNode }) {
    return (
        <AppShell sidebar={<OrgSidebar />}>
            {children}
        </AppShell>
    );
}
