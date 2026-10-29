"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { BranchAccess } from "@/types";
import { toClientBillingExperience } from "@/lib/billingExperienceView";
import { workspacePresentation } from "@/lib/workspacePresentation";

type AccessContext = { branchId: string; access: BranchAccess | null; loading: boolean; error: string | null; refresh: () => Promise<void>; presentation: "simple" | "full" | null };
const Context = createContext<AccessContext | null>(null);
export const useWorkspaceAccess = () => useContext(Context);

/** One server-derived snapshot for the shell, billing banners and page capabilities. */
export function BranchAccessProvider({ branchId, children }: { branchId: string; children: ReactNode }) {
    const [access, setAccess] = useState<BranchAccess | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const sequence = useRef(0);
    const refresh = useCallback(async () => {
        const version = ++sequence.current;
        try {
            const response = await fetch(`/api/branches/${encodeURIComponent(branchId)}/access`, { cache: "no-store" });
            if (version !== sequence.current) return;
            if (!response.ok) {
                // Lost membership must discard private records/drafts. A transport
                // failure may retain the draft behind the blocking retry dialog.
                if ([401, 403, 404].includes(response.status)) setAccess(null);
                throw new Error("Branch access is unavailable.");
            }
            const next: BranchAccess = await response.json();
            if (version !== sequence.current) return;
            if (next.branchId !== branchId) {
                setAccess(null);
                throw new Error("Branch access is unavailable.");
            }
            setAccess(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
            setError(null);
        } catch {
            if (version === sequence.current) setError("Access could not be refreshed. Your draft is still here. Retry before continuing.");
        } finally { if (version === sequence.current) setLoading(false); }
    }, [branchId]);
    useEffect(() => {
        void refresh();
        const visible = () => { if (document.visibilityState === "visible") void refresh(); };
        const interval = window.setInterval(visible, 30_000);
        window.addEventListener("focus", visible); window.addEventListener("pageshow", visible);
        window.addEventListener("billing-access-changed", visible);
        document.addEventListener("visibilitychange", visible);
        const requests = sequence;
        return () => {
            requests.current++; clearInterval(interval);
            window.removeEventListener("focus", visible); window.removeEventListener("pageshow", visible);
            window.removeEventListener("billing-access-changed", visible);
            document.removeEventListener("visibilitychange", visible);
        };
    }, [refresh]);
    useEffect(() => {
        const experience = access?.billingExperience ? toClientBillingExperience(access.billingExperience) : null;
        const dates = [experience?.trialEndsAt, experience?.paidThrough, ...(experience?.scheduledChanges ?? []).map(change => change.effectiveAt)];
        const next = dates.filter(Boolean).map(value => Date.parse(value!)).filter(time => time > Date.now()).sort((a,b) => a-b)[0];
        if (!next) return;
        const timer = window.setTimeout(() => { void refresh(); }, Math.min(next - Date.now() + 100, 2_147_000_000));
        return () => clearTimeout(timer);
    }, [access, refresh]);
    const value = useMemo(() => ({ branchId, access, loading, error, refresh, presentation: workspacePresentation(access) }), [branchId, access, loading, error, refresh]);
    return <Context.Provider value={value}>{children}</Context.Provider>;
}
