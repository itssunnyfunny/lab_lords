"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useBranchAccess } from "@/hooks/useBranchAccess";
import { getPermissionHelpText } from "@/lib/permissionMessages";
import type { BranchAccess, StaffAction } from "@/types";

type BranchAccessGuardProps = {
    branchId: string | undefined;
    permission: StaffAction;
    children: ReactNode | ((access: BranchAccess) => ReactNode);
    title?: string;
    description?: string;
};

export function BranchAccessLoading({ label = "Checking access..." }: { label?: string }) {
    return (
        <div className="flex min-h-[60vh] items-center justify-center p-8 text-white" role="status">
            <Loader2 className="mr-3 animate-spin text-cyan-400" />
            <span className="text-sm text-gray-400">{label}</span>
        </div>
    );
}

export function BranchNoAccess({
    branchId,
    title = "No access",
    description = "You do not have permission to open this branch page. Ask the branch owner to update your staff permissions.",
}: {
    branchId?: string;
    title?: string;
    description?: string;
}) {
    const router = useRouter();

    return (
        <div className="flex min-h-[60vh] items-center justify-center p-8 text-white" role="alert">
            <div className="max-w-md space-y-5 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10">
                    <ShieldAlert size={24} className="text-amber-300" />
                </div>
                <div className="space-y-2">
                    <h1 className="text-xl font-semibold text-white">{title}</h1>
                    <p className="text-sm leading-6 text-gray-400">{description}</p>
                </div>
                <Button
                    variant="outline"
                    icon={ArrowLeft}
                    onClick={() => router.push(branchId ? `/branch/${branchId}` : "/org")}
                >
                    Back to dashboard
                </Button>
            </div>
        </div>
    );
}

export function BranchAccessGuard({
    branchId,
    permission,
    children,
    title,
    description,
}: BranchAccessGuardProps) {
    const { access, loading, error, can } = useBranchAccess(branchId);

    if (!branchId) {
        return <BranchNoAccess title={title} description={description} />;
    }

    if (loading || (!error && !access)) {
        return <BranchAccessLoading />;
    }

    if (error || !access || !can(permission)) {
        return (
            <BranchNoAccess
                branchId={branchId}
                title={title}
                description={description ?? getPermissionHelpText(permission)}
            />
        );
    }

    return <>{typeof children === "function" ? children(access) : children}</>;
}
