"use client";
import { use } from "react";
import { BranchAccessGuard } from "@/components/auth/BranchAccessGuard";
import { BRANCH_PAGE_ACCESS } from "@/lib/branchPageAccess";
import { RenewalsContent } from "@/components/renewals/RenewalsContent";
export default function RenewalsPage({ params }: { params: Promise<{ branchId: string }> }) {
    const { branchId } = use(params);
    return <BranchAccessGuard branchId={branchId} permission={BRANCH_PAGE_ACCESS.renewals}>
        {access => <RenewalsContent key={branchId} branchId={branchId} access={access} />}
    </BranchAccessGuard>;
}
