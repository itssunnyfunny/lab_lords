import type { BranchSnapshot } from "@/lib/api/analytics";

/** Whitelist operational fields when the current branch access loses payment view. */
export function withoutFinancialAnalytics(snapshot: BranchSnapshot): BranchSnapshot {
    return {
        financialAccess: false,
        period: snapshot.period,
        totalStudents: snapshot.totalStudents,
        activeStudents: snapshot.activeStudents,
        assignedSeats: snapshot.assignedSeats,
        totalSeats: snapshot.totalSeats,
        occupancyRate: snapshot.occupancyRate,
        seatDetails: snapshot.seatDetails,
    };
}
