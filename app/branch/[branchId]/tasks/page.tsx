"use client";
import { use } from "react";
import { BranchAccessGuard } from "@/components/auth/BranchAccessGuard";
import { TasksContent, SourceTasksContent } from "@/components/dashboard-features/TasksContent";
import { ActivityContent } from "@/components/dashboard-features/ActivityContent";
import { useSearchParams } from "next/navigation";
export default function TasksPage({ params }: { params: Promise<{ branchId: string }> }) {
    const { branchId } = use(params);
    const query = useSearchParams();
    if (query.get("view") === "activity") return <BranchAccessGuard branchId={branchId} permission={{ anyOf: ["students", "view_payments", "seat_allocation", "manage_branch"] }}><ActivityContent key={branchId} branchId={branchId} /></BranchAccessGuard>;
    return <BranchAccessGuard branchId={branchId} permission={{ anyOf: ["manage_branch", "students", "view_payments", "seat_allocation"] }}>{access => access.permissions.manage_branch ? <TasksContent key={branchId} branchId={branchId} access={access} /> : <SourceTasksContent key={branchId} branchId={branchId} />}</BranchAccessGuard>;
}
