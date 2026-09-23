import type { BranchSnapshot, TrendData } from "@/lib/api/analytics";
import { analytics } from "@/lib/api/analytics";
import { branches } from "@/lib/api/branches";
import type { BranchAccess } from "@/types";
import type { AttendancePage } from "@/lib/attendance";
import type { RenewalPage } from "@/lib/renewals";
import type { FeeCollectionView } from "@/lib/feeCollections";

export type DashboardResourceStatus = "success" | "restricted" | "error";

export type DashboardResourceStatuses = {
    analytics: DashboardResourceStatus;
    collectionsTrend: DashboardResourceStatus;
    students: DashboardResourceStatus;
    allocations: DashboardResourceStatus;
    payments: DashboardResourceStatus;
    overdue: DashboardResourceStatus;
    attendance: DashboardResourceStatus;
    followUps: DashboardResourceStatus;
    upcoming: DashboardResourceStatus;
};

export interface DashboardStudent {
    id: string;
    name: string;
    status: string;
    joinedAt?: Date | string | null;
    createdAt?: Date | string;
}

export interface DashboardPayment {
    id: string;
    status: "DUE" | "PAID" | string;
    dueDate: string | Date;
    amount: number;
    paidAt?: string | Date | null;
    updatedAt?: string | Date | null;
    student?: {
        id?: string;
        name?: string | null;
        phone?: string | null;
    } | null;
}

export interface DashboardAllocation {
    seat?: { label?: string | null } | null;
    student?: { name?: string | null } | null;
    startDate?: string | Date | null;
    createdAt?: string | Date | null;
}

export interface DashboardOverduePayment {
    paymentId: string;
    studentId: string;
    studentName: string;
    phone: string | null;
    dueDate: string;
    amount: number;
}

export interface BranchDashboardSources {
    snapshot: BranchSnapshot | null;
    collectionsTrend: TrendData | null;
    students: DashboardStudent[];
    allocations: DashboardAllocation[];
    collections: FeeCollectionView[];
    overduePayments: DashboardOverduePayment[];
    attendance: AttendancePage | null;
    followUps: RenewalPage | null;
    upcoming: RenewalPage | null;
    resources: DashboardResourceStatuses;
    updatedAt: string;
}

type DashboardPermissions = Pick<
    BranchAccess["permissions"],
    "analytics" | "students" | "seat_allocation" | "view_payments"
>;

async function fetchDashboardJson<T>(url: string): Promise<T> {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
        throw new Error(`Dashboard request failed with status ${response.status}`);
    }
    return response.json() as Promise<T>;
}

function dashboardItems<T>(value: unknown, legacyKey?: string): T[] {
    if (Array.isArray(value)) return value as T[];
    if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;
        if (Array.isArray(record.items)) return record.items as T[];
        if (legacyKey && Array.isArray(record[legacyKey])) {
            return record[legacyKey] as T[];
        }
    }
    throw new Error("Dashboard response did not contain a list");
}

async function fetchDashboardItems<T>(url: string, legacyKey?: string): Promise<T[]> {
    return dashboardItems<T>(await fetchDashboardJson<unknown>(url), legacyKey);
}

function resourceStatus(
    allowed: boolean,
    result: PromiseSettledResult<unknown>
): DashboardResourceStatus {
    if (!allowed) return "restricted";
    return result.status === "fulfilled" ? "success" : "error";
}

function fulfilledValue<T>(result: PromiseSettledResult<T>, fallback: T): T {
    return result.status === "fulfilled" ? result.value : fallback;
}

export async function loadBranchDashboardSources(
    branchId: string,
    permissions: DashboardPermissions,
    now = new Date()
): Promise<BranchDashboardSources> {
    const base = `/api/branches/${encodeURIComponent(branchId)}`;
    const trendFrom = new Date(now);
    trendFrom.setDate(trendFrom.getDate() - 14);
    // Fifteen cumulative observations yield fourteen real daily changes. The
    // existing month-mode endpoint repeats month totals, so do not chart it as days.
    const [snapshotResult, studentsResult, allocationsResult, paymentsResult, overdueResult, attendanceResult, followUpsResult, upcomingResult, trendResult] =
        await Promise.allSettled([
            permissions.analytics
                ? analytics.getSnapshot(branchId, { period: "month" })
                : Promise.resolve(null),
            permissions.students
                ? branches.getStudents(branchId) as Promise<DashboardStudent[]>
                : Promise.resolve([] as DashboardStudent[]),
            permissions.seat_allocation
                ? fetchDashboardItems<DashboardAllocation>(
                    `${base}/seat-allocations?activeOnly=true&all=true`
                )
                : Promise.resolve([] as DashboardAllocation[]),
            permissions.view_payments
                ? fetchDashboardItems<FeeCollectionView>(
                    `${base}/collections`
                )
                : Promise.resolve([] as FeeCollectionView[]),
            permissions.view_payments
                ? fetchDashboardItems<DashboardOverduePayment>(
                    `${base}/payments/overdue?all=true`,
                    "payments"
                )
                : Promise.resolve([] as DashboardOverduePayment[]),
            permissions.students
                ? fetchDashboardJson<AttendancePage>(`${base}/attendance?limit=1`)
                : Promise.resolve(null),
            permissions.view_payments
                ? fetchDashboardJson<RenewalPage>(`${base}/renewals?filter=OVERDUE&days=7&search=&limit=6`)
                : Promise.resolve(null),
            permissions.view_payments
                ? fetchDashboardJson<RenewalPage>(`${base}/renewals?filter=UPCOMING&days=7&search=&limit=4`)
                : Promise.resolve(null),
            permissions.analytics
                ? analytics.getTrends(branchId, { from: trendFrom.toISOString(), to: now.toISOString(), type: "payment", period: "all" })
                : Promise.resolve(null),
        ] as const);

    return {
        snapshot: fulfilledValue(snapshotResult, null),
        collectionsTrend: fulfilledValue(trendResult, null),
        students: fulfilledValue(studentsResult, []),
        allocations: fulfilledValue(allocationsResult, []),
        collections: fulfilledValue(paymentsResult, []),
        overduePayments: fulfilledValue(overdueResult, []),
        attendance: fulfilledValue(attendanceResult, null),
        followUps: fulfilledValue(followUpsResult, null),
        upcoming: fulfilledValue(upcomingResult, null),
        resources: {
            analytics: resourceStatus(permissions.analytics, snapshotResult),
            collectionsTrend: resourceStatus(permissions.analytics, trendResult),
            students: resourceStatus(permissions.students, studentsResult),
            allocations: resourceStatus(permissions.seat_allocation, allocationsResult),
            payments: resourceStatus(permissions.view_payments, paymentsResult),
            overdue: resourceStatus(permissions.view_payments, overdueResult),
            attendance: resourceStatus(permissions.students, attendanceResult),
            followUps: resourceStatus(permissions.view_payments, followUpsResult),
            upcoming: resourceStatus(permissions.view_payments, upcomingResult),
        },
        updatedAt: now.toISOString(),
    };
}
