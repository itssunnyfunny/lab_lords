"use client";
import { accountBillingHref } from "@/lib/accountNavigation";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useUser } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/components/settings/LocalizedText";
import { AppShell } from "@/components/layout/AppShell";
import { BranchSidebar } from "@/components/layout/BranchSidebar";
import { BasicWorkspace, BasicSidebar } from "@/components/basic/BasicWorkspace";
import { useWorkspaceAccess } from "@/components/layout/BranchAccessProvider";
import { Dialog } from "@/components/ui/Dialog";
import { AppButton, appActionClassName } from "@/components/ui/AppButton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import Link from "next/link";
import { BranchAccessProvider } from "@/components/layout/BranchAccessProvider";
import { BillingExperienceProvider } from "@/components/billing/BillingExperienceProvider";
import { BranchActivationGate } from "@/components/billing/BranchActivationGate";
import {
    LAST_ACTIVE_BRANCH_COOKIE,
    LAST_ACTIVE_BRANCH_COOKIE_MAX_AGE,
} from "@/lib/workspaceRouting";
import { WORKSPACE_NAVIGATION_REQUEST, type WorkspaceNavigationRequest } from "@/lib/workspaceNavigationGuard";
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

function watchLocation(notify: () => void) {
    window.addEventListener("popstate", notify);
    window.addEventListener("hashchange", notify);
    return () => {
        window.removeEventListener("popstate", notify);
        window.removeEventListener("hashchange", notify);
    };
}

function WorkspaceContent({children,designPilot}:{children:ReactNode;designPilot:boolean}) {
    const workspace=useWorkspaceAccess(), t=useTranslation(), pathname=usePathname();
    const location = useSyncExternalStore(watchLocation, () => window.location.search + window.location.hash, () => "");
    const notice = new URLSearchParams(location.split("#")[0]).get("workspaceNotice") === "area-unavailable";
    const [fullDraftPath,setFullDraftPath]=useState<string|null>(null);
    const fullDraft = useRef<Element | null>(null);
    const [settingsDraft, setSettingsDraft] = useState({ dirty: false, pending: false });
    const [leave, setLeave] = useState<{ resume: () => void } | null>(null);
    const [confirmTransition,setConfirmTransition]=useState(false);
    const returningToBasic=workspace?.presentation==="simple"&&(fullDraftPath===pathname || (pathname.endsWith("/settings") && (settingsDraft.dirty || settingsDraft.pending)));
    const [interaction,setInteraction]=useState({dirty:false,pending:false});
    const leavingBasic=workspace?.presentation==="full"&&(interaction.dirty||interaction.pending);
    const transitioning=leavingBasic||returningToBasic;
    const transitionPending = interaction.pending || settingsDraft.pending;
    const sharedImport = /^\/branch\/[^/]+\/onboarding\/import(?:\/|$)/.test(pathname ?? "");
    useEffect(() => {
        function settingsChanged(event: Event) {
            const detail = (event as CustomEvent<{ branchId: string; dirty: boolean; pending: boolean }>).detail;
            if (workspace?.branchId === detail.branchId) setSettingsDraft({ dirty: detail.dirty, pending: detail.pending });
        }
        window.addEventListener("branch-settings-draft", settingsChanged);
        return () => window.removeEventListener("branch-settings-draft", settingsChanged);
    }, [workspace?.branchId]);
    useEffect(() => {
        if (workspace?.presentation !== "full" || sharedImport || fullDraftPath !== pathname || settingsDraft.dirty || settingsDraft.pending) return;
        function protect(event: Event) {
            if (!fullDraft.current?.isConnected) return;
            const resume = (event as CustomEvent<WorkspaceNavigationRequest>).detail?.resume;
            if (resume) {
                event.preventDefault();
                setLeave({ resume });
            }
        }
        window.addEventListener(WORKSPACE_NAVIGATION_REQUEST, protect);
        return () => window.removeEventListener(WORKSPACE_NAVIGATION_REQUEST, protect);
    }, [workspace?.presentation, sharedImport, fullDraftPath, pathname, settingsDraft]);
    if(!workspace?.access || !workspace.presentation) return <main data-app-design-pilot={designPilot ? "workspace" : undefined} role={workspace?.error ? "alert" : "status"} aria-busy={!workspace?.error} className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[color:var(--bg-app)] px-6 text-center text-[color:var(--text-primary)]">
        {!workspace?.error && <Loader2 aria-hidden="true" className="h-6 w-6 animate-spin motion-reduce:animate-none" />}
        {workspace?.accessDenied && <h1 className="text-2xl font-semibold">{t("No access")}</h1>}
        <p>{t.owned(workspace?.error ?? "Loading workspace")}</p>
        {workspace?.error && <AppButton variant="primary" onClick={()=>void workspace.refresh()}>{t("Retry")}</AppButton>}
        {workspace?.access?.isOwner && <Link className={appActionClassName()} href={accountBillingHref(workspace.access.organizationId, workspace.access.branchId, pathname)}>{t("Billing")}</Link>}
    </main>;
    const simple = workspace.presentation === "simple";
    let surface: ReactNode;
    if (sharedImport) {
        surface = <div inert={!!workspace.error} data-shared-import-shell>
            <AppShell simpleWorkspace={simple} sidebar={simple ? <BasicSidebar access={workspace.access} area="imports" /> : <BranchSidebar />} designPilot={designPilot}>
                <BranchActivationGate>{children}</BranchActivationGate>
            </AppShell>
        </div>;
    } else if (!returningToBasic && (simple || leavingBasic)) {
        surface = <BranchActivationGate>
            <BasicWorkspace access={workspace.access} blocked={!!workspace.error || transitioning} onInteractionState={setInteraction} />
        </BranchActivationGate>;
    } else {
        const area = pathname.split("/")[3] ?? "";
        const coreRoute = ["", "students", "payments", "fees", "seats", "shifts", "allocations", "settings"].includes(area);
        surface = <div inert={transitioning || !!workspace.error} onInputCapture={event => {
            const form = (event.target as HTMLElement).closest("form,[role=dialog]");
            if (form) {
                fullDraft.current = form;
                setFullDraftPath(pathname);
            }
        }}>
            <AppShell simpleWorkspace={simple} sidebar={simple ? <BasicSidebar access={workspace.access} area={area} /> : <BranchSidebar />} designPilot={designPilot}>
                <BranchActivationGate>{!simple || coreRoute ? children : null}</BranchActivationGate>
            </AppShell>
        </div>;
    }
    return <>
        {notice && <p role="status" className="px-4 py-2 text-sm">{t.owned("The previous page is unavailable here. You are on the branch overview.")}</p>}
        {surface}
        <ConfirmDialog isOpen={!!leave} title="Unsaved changes" description="Your edits belong to this branch. Leave without saving?" confirmText="Leave branch" onClose={() => setLeave(null)} onConfirm={() => {
            const destination = leave;
            fullDraft.current = null;
            setFullDraftPath(null);
            setLeave(null);
            destination?.resume();
        }} />
        {transitioning&&<Dialog open overlayClassName={designPilot ? "app-design-pilot-overlay" : undefined} title={t.owned("Workspace access changed")} onClose={()=>{}} showCloseButton={false} dismissOnEscape={false} dismissOnBackdrop={false}><p>{t.owned("Finish the current operation before switching. Saved recovery requests will not be retried automatically.")}</p><AppButton variant="primary" disabled={transitionPending} onClick={()=>setConfirmTransition(true)}>{t.owned("Continue to the updated workspace")}</AppButton></Dialog>}
        <ConfirmDialog overlayClassName={designPilot ? "app-design-pilot-overlay" : undefined} isOpen={transitioning && confirmTransition} title="Workspace access changed" description="Continue with unsaved changes? Saved recovery requests remain available when you return." confirmText="Continue to the updated workspace" loading={transitionPending} onClose={()=>setConfirmTransition(false)} onConfirm={()=>{if(transitionPending)return;setConfirmTransition(false);setSettingsDraft({dirty:false,pending:false});setInteraction({dirty:false,pending:false});setFullDraftPath(null);}} />
        {workspace.error&&<Dialog open overlayClassName={designPilot ? "app-design-pilot-overlay" : undefined} title={t.owned("Access could not be refreshed")} onClose={()=>{}} showCloseButton={false} dismissOnEscape={false} dismissOnBackdrop={false}>
            <p>{t.owned("Access could not be refreshed. Your draft is still here. Retry before continuing.")}</p><AppButton variant="primary" onClick={()=>void workspace.refresh()}>{t("Retry")}</AppButton>
        </Dialog>}
    </>;
}
