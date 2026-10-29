import type { BranchAccess } from "@/types";

/** Presentation only. Writability and permissions remain server-owned. */
export function workspacePresentation(access: BranchAccess | null | undefined): "simple" | "full" | null {
    if (!access) return null;
    const plan = access.billingExperience?.effectivePlan ?? access.effectivePlan;
    if (plan === "BASIC" || (plan === "NONE" && access.billingExperience?.accessMode === "READ_ONLY")) return "simple";
    if (["STANDARD", "STANDARD_TRIAL", "PRO"].includes(plan)) return "full";
    return null;
}

/** Copy only: compare authoritative effective capabilities before authorizing a change. */
export function workspaceDowngradeNotice(current: string | undefined, target: string): string | null {
    if (target === "BASIC" && ["STANDARD", "STANDARD_TRIAL", "PRO"].includes(current ?? "")) {
        return current === "PRO"
            ? "When Basic takes effect, the simple workspace replaces the full workspace. Attendance, imports, tasks, follow-ups, reports, staff invitations and permission controls, advanced analytics, AI and WhatsApp become unavailable. Your records, payment history and configuration are retained."
            : "When Basic takes effect, the simple workspace replaces the full workspace. Attendance, imports, tasks, follow-ups, reports, staff invitations and permission controls, advanced analytics and AI become unavailable. Your records, payment history and configuration are retained.";
    }
    if (current === "PRO" && target === "STANDARD") return "When Standard takes effect, WhatsApp becomes unavailable. The full workspace and your records, payment history and configuration are retained.";
    return null;
}
