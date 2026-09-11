"use client";
import { use } from "react";
import { BranchAccessGuard } from "@/components/auth/BranchAccessGuard";
import { BRANCH_PAGE_ACCESS } from "@/lib/branchPageAccess";
import { AttendanceContent } from "@/components/attendance/AttendanceContent";
export default function AttendancePage({ params }: { params: Promise<{ branchId: string }> }) {
    const { branchId } = use(params);
    return <BranchAccessGuard branchId={branchId} permission={BRANCH_PAGE_ACCESS.attendance}>
        {access => <AttendanceContent key={branchId} branchId={branchId} access={access} />}
    </BranchAccessGuard>;
}
