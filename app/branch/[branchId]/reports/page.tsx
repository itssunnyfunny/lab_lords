"use client";
import { use } from "react";
import { BranchAccessGuard } from "@/components/auth/BranchAccessGuard";
import { ReportsContent } from "@/components/dashboard-features/ReportsContent";
export default function ReportsPage({ params }: { params: Promise<{ branchId: string }> }) {
    const { branchId } = use(params);
    return <BranchAccessGuard branchId={branchId} permission={{ anyOf: ["view_payments", "students"] }}>{access => <ReportsContent key={branchId} branchId={branchId} access={access} />}</BranchAccessGuard>;
}
