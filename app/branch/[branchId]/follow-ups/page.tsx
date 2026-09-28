"use client";
import { use } from "react";
import { BranchAccessGuard } from "@/components/auth/BranchAccessGuard";
import { FollowUpsContent } from "@/components/dashboard-features/FollowUpsContent";
export default function FollowUpsPage({ params }: { params: Promise<{ branchId: string }> }) {
    const { branchId } = use(params);
    return <BranchAccessGuard branchId={branchId} permission="view_payments">{access => <FollowUpsContent key={branchId} branchId={branchId} access={access} />}</BranchAccessGuard>;
}
