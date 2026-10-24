"use client";

import { useEffect, useState } from "react";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { workspaces } from "@/lib/api/workspaces";
import { workspaceReturnPath } from "@/lib/contextualNavigation";

export function useWorkspaceReturnHref(pathname: string | null) {
    const { ownerKey } = useUserPreferences();
    const [destination, setDestination] = useState<{ owner: string | null; href: string } | null>(null);

    useEffect(() => {
        let cancelled = false;
        const key = `lab-lords:account-return:${ownerKey}`;
        const current = workspaceReturnPath(pathname);
        if (current) {
            try { sessionStorage.setItem(key, current); } catch { /* Storage is optional. */ }
            return;
        }
        if (pathname !== "/account") return;

        async function resolve() {
            let href = workspaceReturnPath(new URLSearchParams(window.location.search).get("returnTo"));
            try { href ??= workspaceReturnPath(sessionStorage.getItem(key)); } catch { /* Use the authorized directory. */ }
            if (!href) {
                try {
                    const directory = await workspaces.getDirectory();
                    href = workspaceReturnPath(directory.organizations[0]?.href ?? directory.staffBranches[0]?.href ?? null);
                } catch { return; }
            }
            if (!cancelled) setDestination({ owner: ownerKey, href: href ?? "/onboarding" });
        }
        void resolve();
        return () => { cancelled = true; };
    }, [ownerKey, pathname]);

    return destination?.owner === ownerKey ? destination.href : null;
}
