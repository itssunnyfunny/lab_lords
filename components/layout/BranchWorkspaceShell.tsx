"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useUser } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/components/settings/LocalizedText";
import { AppShell } from "@/components/layout/AppShell";
import { BranchSidebar } from "@/components/layout/BranchSidebar";
import { BasicWorkspace } from "@/components/basic/BasicWorkspace";
import { useWorkspaceAccess } from "@/components/layout/BranchAccessProvider";
import { Dialog } from "@/components/ui/Dialog";
import Link from "next/link";
import { BranchAccessProvider } from "@/components/layout/BranchAccessProvider";
import { BillingExperienceProvider } from "@/components/billing/BillingExperienceProvider";
import { BranchActivationGate } from "@/components/billing/BranchActivationGate";
import {
    LAST_ACTIVE_BRANCH_COOKIE,
    LAST_ACTIVE_BRANCH_COOKIE_MAX_AGE,
} from "@/lib/workspaceRouting";
import { isApplicationDesignPilotPath } from "@/lib/applicationDesignPilot";

export function BranchWorkspaceShell({ branchId, children }: { branchId: string; children: ReactNode }) {
    const { isLoaded, user } = useUser();
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
        <div data-app-design-pilot={designPilot ? "workspace" : undefined} role="status" aria-busy="true" className="flex min-h-screen items-center justify-center gap-3 bg-[color:var(--bg-app)] text-[color:var(--text-primary)]">
            <Loader2 aria-hidden="true" className="h-6 w-6 animate-spin motion-reduce:animate-none" />
            <span>{t("Loading workspaces")}</span>
        </div>
    );

    return (
        <BranchAccessProvider key={`${user?.id ?? "anonymous"}:${branchId}`} branchId={branchId}>
        <BillingExperienceProvider branchId={branchId}>
            <WorkspaceContent designPilot={designPilot}>{children}</WorkspaceContent>
        </BillingExperienceProvider>
        </BranchAccessProvider>
    );
}

function WorkspaceContent({children,designPilot}:{children:ReactNode;designPilot:boolean}) {
    const workspace=useWorkspaceAccess(), t=useTranslation(), pathname=usePathname();
    const [fullDraftPath,setFullDraftPath]=useState<string|null>(null);
    const returningToBasic=workspace?.presentation==="simple"&&fullDraftPath===pathname;
    const [interaction,setInteraction]=useState({dirty:false,pending:false});
    const leavingBasic=workspace?.presentation==="full"&&(interaction.dirty||interaction.pending);
    const transitioning=leavingBasic||returningToBasic;
    if(!workspace?.access || !workspace.presentation) return <div role={workspace?.error?"alert":"status"} className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p>{t.owned(workspace?.error??"Loading workspace")}</p><button onClick={()=>void workspace?.refresh()}>{t("Retry")}</button>
        {workspace?.access?.isOwner&&<Link href={"/org/"+workspace.access.organizationId+"/billing"}>{t("Billing")}</Link>}
    </div>;
    return <>
        {(!returningToBasic && (workspace.presentation==="simple" || leavingBasic)) ? <BranchActivationGate><BasicWorkspace access={workspace.access} blocked={!!workspace.error||transitioning} onInteractionState={setInteraction}/></BranchActivationGate>
            : <div inert={transitioning||!!workspace.error} onInputCapture={event=>{if((event.target as HTMLElement).closest("form,[role=dialog]"))setFullDraftPath(pathname);}}><AppShell sidebar={<BranchSidebar/>} designPilot={designPilot}><BranchActivationGate>{children}</BranchActivationGate></AppShell></div>}
        {transitioning&&<Dialog open title={t.owned("Workspace access changed")} onClose={()=>{}} showCloseButton={false} dismissOnEscape={false} dismissOnBackdrop={false}><p>{t.owned("Finish the current operation before switching. Saved recovery requests will not be retried automatically.")}</p><button disabled={interaction.pending} onClick={()=>{if(!window.confirm(t.owned("Continue with unsaved changes? Saved recovery requests remain available when you return.")))return;setInteraction({dirty:false,pending:false});setFullDraftPath(null);}}>{t.owned("Continue to the updated workspace")}</button></Dialog>}
        {workspace.error&&<Dialog open title={t.owned("Access could not be refreshed")} onClose={()=>{}} showCloseButton={false} dismissOnEscape={false} dismissOnBackdrop={false}>
            <p>{t.owned(workspace.error)}</p><button onClick={()=>void workspace.refresh()}>{t("Retry")}</button>
        </Dialog>}
    </>;
}
