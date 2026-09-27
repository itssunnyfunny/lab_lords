"use client";

import { useEffect, type ReactNode } from "react";
import { useUser } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/components/settings/LocalizedText";
import { AppShell } from "@/components/layout/AppShell";
import { BranchSidebar } from "@/components/layout/BranchSidebar";
import { BillingExperienceProvider } from "@/components/billing/BillingExperienceProvider";
import { BranchActivationGate } from "@/components/billing/BranchActivationGate";
import {
    LAST_ACTIVE_BRANCH_COOKIE,
    LAST_ACTIVE_BRANCH_COOKIE_MAX_AGE,
} from "@/lib/workspaceRouting";
import { isApplicationDesignPilotPath } from "@/lib/applicationDesignPilot";

export function BranchWorkspaceShell({ branchId, children }: { branchId: string; children: ReactNode }) {
    const { isLoaded } = useUser();
    const t = useTranslation();
    const pathname = usePathname();
    const designPilot = isApplicationDesignPilotPath(pathname);

    useEffect(() => {
        const secure = window.location.protocol === "https:" ? "; secure" : "";
        document.cookie = `${LAST_ACTIVE_BRANCH_COOKIE}=${encodeURIComponent(branchId)}; path=/; max-age=${LAST_ACTIVE_BRANCH_COOKIE_MAX_AGE}; samesite=lax${secure}`;
    }, [branchId]);

    // The preferences boundary resets on identity changes. Do not expose forms
    // before Clerk resolves the initial identity, or that reset can lose input.
    // This is a readiness gate only; server authorization remains authoritative.
    if (!isLoaded) return (
        <div role="status" aria-busy="true" className="flex min-h-screen items-center justify-center gap-3">
            <Loader2 aria-hidden="true" className="h-6 w-6 animate-spin motion-reduce:animate-none" />
            <span>{t("Loading workspaces")}</span>
        </div>
    );

    return (
        <BillingExperienceProvider branchId={branchId}>
            <AppShell sidebar={<BranchSidebar />} designPilot={designPilot}>
                <BranchActivationGate>{children}</BranchActivationGate>
            </AppShell>
        </BillingExperienceProvider>
    );
}
