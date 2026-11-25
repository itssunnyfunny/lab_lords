import type { BillingExperience } from "@/types/billingExperience";
import type { DirectoryBranchBilling } from "@/types/ui";

/** Account amounts use paise. Staff directory entries have no commercial fields. */
export function projectDirectoryBilling(experience: BillingExperience): DirectoryBranchBilling {
    const result = {
        independent: true,
        effectivePlan: experience.effectivePlan,
        accessMode: experience.accessMode,
        customerState: experience.customerState,
        billingStatus: experience.branch!.billingStatus,
    };
    if (!experience.viewer.canManageBilling) return result;
    const pending = experience.activeOperation ?? experience.scheduledChanges.at(-1);
    return {
        ...result,
        paidThrough: experience.paidThrough ?? experience.legacyCoverageEndsAt ?? null,
        trialEndsAt: experience.trialEndsAt,
        nextChargeAt: experience.nextChargeAt,
        nextChargeAmount: experience.nextChargeAmountSubunits ?? null,
        monthlyCommitment: experience.monthlyCommitmentSubunits ?? null,
        pendingPlan: pending?.toPlan ?? null,
        effectiveAt: pending?.effectiveAt ?? null,
    };
}
