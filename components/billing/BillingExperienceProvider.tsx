"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useWorkspaceAccess } from "@/components/layout/BranchAccessProvider";
import { workspaces } from "@/lib/api/workspaces";
import type { WorkspaceDirectoryOrganization } from "@/types";
import { billing } from "@/lib/api/billing";
import { branches } from "@/lib/api/branches";
import type { BillingExperience } from "@/types/billingExperience";
import { toClientBillingExperience } from "@/lib/billingExperienceView";

type BillingExperienceContextValue = {
  experience: BillingExperience | null;
  organization?: WorkspaceDirectoryOrganization | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const BillingExperienceContext = createContext<BillingExperienceContextValue | null>(null);

export function BillingExperienceProvider({
  organizationId,
  resolveOrganization = false,
  branchId,
  children,
}: {
  organizationId?: string;
  resolveOrganization?: boolean;
  branchId?: string;
  children: ReactNode;
}) {
  const sharedAccess = useWorkspaceAccess();
  const shared = sharedAccess?.branchId === branchId ? sharedAccess : null;
  const [organization, setOrganization] = useState<WorkspaceDirectoryOrganization | null>(null);
  const [experience, setExperience] = useState<BillingExperience | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);

  const refresh = useCallback(async (background = false) => {
    if (shared) { await shared.refresh(); return; }
    const version = ++requestVersion.current;
    if (!organizationId && !branchId) {
      setExperience(null);
      setError(null);
      setLoading(false);
      return;
    }
    if (!background) setLoading(true);
    try {
      let owned: WorkspaceDirectoryOrganization | undefined;
      if (resolveOrganization && organizationId) {
        const directory = await workspaces.getDirectory();
        if (version !== requestVersion.current) return;
        owned = directory.organizations.find(item => item.id === organizationId);
        if (!owned) throw new Error("Organization access is unavailable.");
        setOrganization(owned);
      }
      const next = owned?.independentBilling ? null : branchId
        ? (await branches.getAccess(branchId)).billingExperience ?? null
        : (await billing.getOverview(organizationId!)).experience;
      if (version !== requestVersion.current) return;
      setExperience(next ? toClientBillingExperience(next) : null);
      setError(null);
    } catch (requestError) {
      if (version === requestVersion.current) {
        setError(requestError instanceof Error ? requestError.message : "Unable to load billing status");
        setExperience(null);
        setOrganization(null);
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [branchId, organizationId, shared, resolveOrganization]);

  useEffect(() => {
    if (shared) return;
    setExperience(null);
    setError(null);
    void refresh();
    const check = () => { if (document.visibilityState === "visible") void refresh(true); };
    if (resolveOrganization) {
      window.addEventListener("focus", check);
      window.addEventListener("billing-access-changed", check);
    }
    const timer = resolveOrganization ? window.setInterval(check, 30_000) : undefined;
    return () => {
      requestVersion.current += 1;
      window.clearInterval(timer);
      window.removeEventListener("focus", check);
      window.removeEventListener("billing-access-changed", check);
    };
  }, [refresh, shared, resolveOrganization]);

  const value = useMemo(() => ({ experience, organization, loading, error, refresh }), [experience, organization, loading, error, refresh]);
  const resolved = shared ? { experience: shared.access?.billingExperience ? toClientBillingExperience(shared.access.billingExperience) : null, loading: shared.loading, error: shared.error, refresh: shared.refresh } : value;
  return <BillingExperienceContext.Provider value={resolved}>{children}</BillingExperienceContext.Provider>;
}

export function useBillingExperience() {
  return useContext(BillingExperienceContext);
}
