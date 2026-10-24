"use client";

import type { ReactNode } from "react";
import { useUser } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@/components/settings/LocalizedText";
import { AppShell } from "@/components/layout/AppShell";
import { OrgSidebar } from "@/components/layout/OrgSidebar";
import { BillingExperienceProvider } from "@/components/billing/BillingExperienceProvider";

export function OrganizationWorkspaceShell({ organizationId, children }: { organizationId: string; children: ReactNode }) {
    const { isLoaded } = useUser();
    const t = useTranslation();
    // Identity changes reset preferences and their descendants. Wait before
    // mounting organization forms so initial hydration cannot discard a draft.
    if (!isLoaded) return (
        <div data-app-design-pilot="workspace" role="status" aria-busy="true" className="flex min-h-screen items-center justify-center gap-3 bg-[color:var(--bg-app)] text-[color:var(--text-primary)]">
            <Loader2 aria-hidden="true" className="h-6 w-6 animate-spin motion-reduce:animate-none" />
            <span>{t("Loading workspaces")}</span>
        </div>
    );
    return (
        <BillingExperienceProvider organizationId={organizationId}>
            <AppShell sidebar={<OrgSidebar />} designPilot>{children}</AppShell>
        </BillingExperienceProvider>
    );
}
