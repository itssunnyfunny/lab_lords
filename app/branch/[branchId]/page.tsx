"use client";
import { use } from "react";
import { useUser } from "@clerk/nextjs";
import { ReferenceDashboard } from "@/components/dashboard/ReferenceDashboard";
export default function BranchDashboardPage({ params }: { params: Promise<{ branchId: string }> }) {
    const { branchId } = use(params);
    const { user } = useUser();
    return <ReferenceDashboard key={`${user?.id ?? "anonymous"}:${branchId}`} branchId={branchId} />;
}
