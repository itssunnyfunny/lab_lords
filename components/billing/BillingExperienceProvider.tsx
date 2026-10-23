"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { billing } from "@/lib/api/billing";
import { branches } from "@/lib/api/branches";
import type { BillingExperience } from "@/types/billingExperience";
import { toClientBillingExperience } from "@/lib/billingExperienceView";

type BillingExperienceContextValue = {
  experience: BillingExperience | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const BillingExperienceContext = createContext<BillingExperienceContextValue | null>(null);

export function BillingExperienceProvider({
  organizationId,
  branchId,
  children,
}: {
  organizationId?: string;
  branchId?: string;
  children: ReactNode;
}) {
  const [experience, setExperience] = useState<BillingExperience | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);

  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    if (!organizationId && !branchId) {
      setExperience(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const next = branchId
        ? (await branches.getAccess(branchId)).billingExperience ?? null
        : (await billing.getOverview(organizationId!)).experience;
      if (version !== requestVersion.current) return;
      setExperience(next ? toClientBillingExperience(next) : null);
      setError(null);
    } catch (requestError) {
      if (version === requestVersion.current) setError(requestError instanceof Error ? requestError.message : "Unable to load billing status");
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [branchId, organizationId]);

  useEffect(() => {
    setExperience(null);
    setError(null);
    void refresh();
    return () => { requestVersion.current += 1; };
  }, [refresh]);

  const value = useMemo(() => ({ experience, loading, error, refresh }), [experience, loading, error, refresh]);
  return <BillingExperienceContext.Provider value={value}>{children}</BillingExperienceContext.Provider>;
}

export function useBillingExperience() {
  return useContext(BillingExperienceContext);
}
