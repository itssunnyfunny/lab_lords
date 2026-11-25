import { AccessPolicy } from "@/services/accessPolicy.service";
import { getBranchOperationalSnapshot } from "@/analytics/branch.analytics";
import { getOrganizationHealthSnapshot } from "@/analytics/org.analytics";
import { getOverduePaymentsPage, getPaymentPeriodStats, type AnalyticsPeriod } from "@/analytics/payment.analytics";
import { getBranchOperationalTrend } from "@/analytics/trends/branch.trends";
import { getPaymentTrend } from "@/analytics/trends/payment.trends";
import { getSeatUtilizationTrend } from "@/analytics/trends/seat.trends";
import { attendanceTimezone } from "@/lib/attendance";
import { parseTrendDate } from "@/analytics/trends/range";

/** Interactive analytics entry points. The analytics directory is an internal
 * read layer shared with tenant-scoped AI and machine-owned reports. */
export class AnalyticsAccessService {
    static async overduePayments(actorId: string, branchId: string, options: Parameters<typeof getOverduePaymentsPage>[1]) {
        await AccessPolicy.authorizeCapability(actorId, branchId, "overdueView");
        return getOverduePaymentsPage(branchId, options);
    }
    static async branchSnapshot(actorId: string, branchId: string, period: AnalyticsPeriod) {
        const access = await AccessPolicy.authorizeCapability(actorId, branchId, "analyticsView");
        const timezone = attendanceTimezone(access.timezone);
        const [health, finance] = await Promise.all([
            getBranchOperationalSnapshot(branchId),
            access.permissions.view_payments ? getPaymentPeriodStats(branchId, undefined, period, { timezone }) : null,
        ]);
        return { health, finance, timezone };
    }
    static async organizationSnapshot(actorId: string, organizationId: string) {
        await AccessPolicy.authorizeOrganization(actorId, organizationId);
        return getOrganizationHealthSnapshot(organizationId);
    }
    static async healthTrend(actorId: string, branchId: string, from: Date, to: Date) {
        await AccessPolicy.authorizeCapability(actorId, branchId, "analyticsView");
        return getBranchOperationalTrend(branchId, from, to);
    }
    static async paymentTrend(actorId: string, branchId: string, from: string | Date, to: string | Date, period: AnalyticsPeriod) {
        const access = await AccessPolicy.authorizeCapability(actorId, branchId, "analyticsFinanceView");
        const timezone = attendanceTimezone(access.timezone);
        const start = typeof from === "string" ? parseTrendDate(from, timezone) : from;
        const end = typeof to === "string" ? parseTrendDate(to, timezone) : to;
        return getPaymentTrend(branchId, start, end, "DAY", period, timezone);
    }
    static async seatTrend(actorId: string, branchId: string, from: Date, to: Date) {
        await AccessPolicy.authorizeCapability(actorId, branchId, "analyticsView");
        return getSeatUtilizationTrend(branchId, from, to);
    }
}
