"use client";
import { OwnedLabel } from "@/components/settings/LocalizedText";
import { useTranslation } from "@/components/settings/LocalizedText";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { AppButton, PageLoadingSkeleton } from "@/components/ui";
import { useBranchAccess } from "@/hooks/useBranchAccess";
import { getPermissionHelpText } from "@/lib/permissionMessages";
import type { BranchAccess } from "@/types";
import {
    firstBranchPermissionRequirement,
    hasBranchPermissionRequirement,
    type BranchPagePermissionRequirement,
} from "@/lib/branchPageAccess";
import { cn } from "@/lib/utils";
import {
    pageErrorStateClass,
    pageMutedTextClass,
} from "@/components/ui/pageSurface";
import { entryIconFrameClass, entrySubtitleClass, entryTitleClass } from "@/components/ui/entrySurface";
import { FeatureUpgradeGate } from "@/components/billing/FeatureUpgradeGate";
import type { BillingFeatureKey } from "@/lib/billingPolicy";

type BranchAccessGuardProps = {
    branchId: string | undefined;
    permission: BranchPagePermissionRequirement;
    children: ReactNode | ((access: BranchAccess) => ReactNode);
    title?: string;
    description?: string;
    feature?: BillingFeatureKey;
};

export function BranchAccessLoading({ label = "Checking access..." }: { label?: string }) {
    return <PageLoadingSkeleton label={label} variant="workspace" />;
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
    const t = useTranslation();
    const router = useRouter();

    return (
        <div className={pageErrorStateClass} role="alert">
            <div className="max-w-md space-y-5 text-center">
                <div className={cn(entryIconFrameClass, "mx-auto flex h-12 w-12 text-[color:var(--ui-form-warning-action-text)]")}>
                    <ShieldAlert size={24} />
                </div>
                <div className="space-y-2">
                    <h1 className={entryTitleClass}><OwnedLabel text={title} /></h1>
                    <p className={cn(entrySubtitleClass, pageMutedTextClass)}><OwnedLabel text={description} /></p>
                </div>
                <AppButton
                    variant="secondary"
                    icon={ArrowLeft}
                    onClick={() => router.push(branchId ? `/branch/${branchId}` : "/org")}
                >
                    {t("Back to dashboard")}</AppButton>
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
    feature,
}: BranchAccessGuardProps) {
    const { access, loading, error } = useBranchAccess(branchId);
    const hasRequiredPermission = hasBranchPermissionRequirement(access, permission);
    const fallbackPermission = firstBranchPermissionRequirement(permission);

    if (!branchId) {
        return <BranchNoAccess title={title} description={description} />;
    }

    if (loading || (!error && !access)) {
        return <BranchAccessLoading />;
    }

    if (error || !access || !hasRequiredPermission) {
        return (
            <BranchNoAccess
                branchId={branchId}
                title={title}
                description={description ?? getPermissionHelpText(fallbackPermission)}
            />
        );
    }

    const content = typeof children === "function" ? children(access) : children;
    return feature
        ? <FeatureUpgradeGate feature={feature} experience={access.billingExperience}>{content}</FeatureUpgradeGate>
        : <>{content}</>;
}
