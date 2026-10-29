"use client";

import { useEffect, useMemo, useState } from "react";
import { useWorkspaceAccess } from "@/components/layout/BranchAccessProvider";
import { branches } from "@/lib/api/branches";
import type { BranchAccess, StaffAction } from "@/types";
import {
    getBranchCapabilityDecision,
    type BranchCapabilityKey,
} from "@/lib/branchCapabilities";

export function useBranchAccess(branchId: string | undefined) {
    const shared = useWorkspaceAccess();
    const scoped = shared?.branchId === branchId ? shared : null;
    const [state, setState] = useState<{
        branchId?: string;
        access: BranchAccess | null;
        error: string | null;
    }>({
        access: null,
        error: null,
    });

    useEffect(() => {
        if (!branchId || scoped) return;

        let cancelled = false;

        branches.getAccess(branchId)
            .then(result => {
                if (!cancelled) {
                    setState({ branchId, access: result, error: null });
                }
            })
            .catch(err => {
                if (!cancelled) {
                    setState({
                        branchId,
                        access: null,
                        error: err instanceof Error ? err.message : "Failed to load access.",
                    });
                }
            });

        return () => {
            cancelled = true;
        };
    }, [branchId, scoped]);

    const access = scoped ? scoped.access : state.branchId === branchId ? state.access : null;
    const error = scoped ? (scoped.access ? null : scoped.error) : state.branchId === branchId ? state.error : null;
    const loading = scoped ? scoped.loading : Boolean(branchId && state.branchId !== branchId);

    const can = useMemo(() => {
        return (action: StaffAction) => access?.permissions[action] ?? false;
    }, [access]);

    const decide = useMemo(() => {
        return (capability: BranchCapabilityKey) =>
            getBranchCapabilityDecision(access, capability);
    }, [access]);

    return { access, loading, error, can, decide };
}
