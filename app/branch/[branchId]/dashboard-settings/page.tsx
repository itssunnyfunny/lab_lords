"use client";
import { use } from "react";
import { BranchAccessGuard } from "@/components/auth/BranchAccessGuard";
import { DashboardSettingsContent } from "@/components/dashboard-features/DashboardSettingsContent";
export default function DashboardSettingsPage({ params }: { params: Promise<{ branchId: string }> }) {
    const { branchId } = use(params);
    return <BranchAccessGuard branchId={branchId} permission={{ anyOf: ["manage_branch", "students", "seat_allocation"] }}>{access => <DashboardSettingsContent key={branchId} branchId={branchId} access={access} />}</BranchAccessGuard>;
}
