"use client";

import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { DashboardButton } from "@/components/dashboard/DashboardButton";
import { OverdueTable } from "@/components/dashboard/OverdueTable";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { RecentActivity, ActivityItem } from "@/components/dashboard/RecentActivity";
import { RecentStudents } from "@/components/dashboard/RecentStudents";
import { ShiftOccupancyCard } from "@/components/dashboard/ShiftOccupancyCard";
import { StatCard } from "@/components/dashboard/StatCard";
import { useBranchAccess } from "@/hooks/useBranchAccess";
import { analytics, BranchSnapshot } from "@/lib/api/analytics";
import { branches } from "@/lib/api/branches";
import { format } from "date-fns";
import {
    AlertCircle,
    AlertTriangle,
    ArrowRight,
    CheckCircle2,
    IndianRupee,
    LayoutGrid,
    Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, useState } from "react";

interface OverduePayment {
    paymentId: string;
    studentId: string;
    studentName: string;
    phone: string | null;
    dueDate: string;
    amount: number;
}

interface Student {
    id: string;
    name: string;
    status: string;
    joinedAt?: Date | string | null;
    createdAt?: Date | string;
}

interface PaymentWithStudent {
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

interface AllocationSummary {
    seat?: { label?: string | null } | null;
    student?: { name?: string | null } | null;
    startDate?: string | Date | null;
}

interface DashboardData {
    snapshot: BranchSnapshot | null;
    overduePayments: OverduePayment[];
    recentStudents: Student[];
    activityItems: ActivityItem[];
    branchName: string;
}

function Skeleton({ className }: { className?: string }) {
    return <div className={`animate-pulse rounded-[8px] bg-white/[0.05] ${className ?? ""}`} />;
}

function DashboardSkeleton() {
    return (
        <div className="mx-auto w-full max-w-[1600px] space-y-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-4 w-56" />
                    <Skeleton className="h-9 w-72" />
                </div>
                <Skeleton className="h-10 w-48" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[0, 1, 2, 3].map((item) => (
                    <Skeleton key={item} className="h-32" />
                ))}
            </div>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.75fr)]">
                <Skeleton className="h-72" />
                <Skeleton className="h-72" />
            </div>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <Skeleton className="h-80" />
                <Skeleton className="h-80" />
            </div>
        </div>
    );
}

function formatDateLabel() {
    return new Date().toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

function formatMoney(value: number) {
    return `Rs ${value.toLocaleString("en-IN")}`;
}

function toneForUtilization(rate: number): "success" | "warning" | "danger" {
    if (rate >= 70) return "success";
    if (rate >= 40) return "warning";
    return "danger";
}

function toneForCollection(rate: number, dueAmount: number): "success" | "warning" | "danger" {
    if (dueAmount === 0 || rate >= 85) return "success";
    if (rate >= 60) return "warning";
    return "danger";
}

async function fetchJson<T>(url: string, fallback: T): Promise<T> {
    try {
        const response = await fetch(url);
        if (!response.ok) return fallback;
        return response.json() as Promise<T>;
    } catch {
        return fallback;
    }
}

export default function BranchDashboardPage({
    params,
}: {
    params: Promise<{ branchId: string }>;
}) {
    const { branchId } = use(params);
    const router = useRouter();
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { access, loading: accessLoading } = useBranchAccess(branchId);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            if (accessLoading) return;
            if (!access) {
                setData(null);
                setLoading(false);
                setError("You do not have access to this branch.");
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const month = format(new Date(), "yyyy-MM");
                const [snapshot, studentsResult, allocationsResult, monthPayments, overdueResult] =
                    await Promise.all([
                        access.permissions.analytics ? analytics.getSnapshot(branchId) : Promise.resolve(null),
                        access.permissions.students ? branches.getStudents(branchId) : Promise.resolve([]),
                        access.permissions.seat_allocation
                            ? fetchJson<AllocationSummary[]>(`/api/branches/${branchId}/seat-allocations?activeOnly=true`, [])
                            : Promise.resolve([]),
                        access.permissions.view_payments
                            ? fetchJson<PaymentWithStudent[]>(`/api/branches/${branchId}/payments?month=${month}`, [])
                            : Promise.resolve([]),
                        access.permissions.view_payments
                            ? fetchJson<{ payments?: OverduePayment[] }>(`/api/branches/${branchId}/payments/overdue`, { payments: [] })
                            : Promise.resolve({ payments: [] }),
                    ]);

                if (cancelled) return;

                const students = studentsResult as Student[];
                const allocations = [...allocationsResult].sort((a, b) => {
                    const left = new Date(a.startDate ?? 0).getTime();
                    const right = new Date(b.startDate ?? 0).getTime();
                    return right - left;
                });
                const paidPayments = [...monthPayments]
                    .filter((payment) => payment.status === "PAID")
                    .sort((a, b) => {
                        const left = new Date(a.paidAt ?? a.updatedAt ?? 0).getTime();
                        const right = new Date(b.paidAt ?? b.updatedAt ?? 0).getTime();
                        return right - left;
                    });
                const overduePayments = overdueResult.payments ?? [];
                const sortedStudents = [...students].sort((a, b) => {
                    const left = new Date(a.joinedAt ?? a.createdAt ?? 0).getTime();
                    const right = new Date(b.joinedAt ?? b.createdAt ?? 0).getTime();
                    return right - left;
                });

                const activityItems: ActivityItem[] = [
                    ...allocations.slice(0, 5).map((allocation) => ({
                        type: "allocation" as const,
                        seat: allocation.seat?.label ?? "Seat",
                        studentName: allocation.student?.name ?? "Unknown student",
                        ts: new Date(allocation.startDate ?? new Date()).toISOString(),
                    })),
                    ...paidPayments.slice(0, 5).map((payment) => ({
                        type: "payment" as const,
                        amount: payment.amount,
                        studentName: payment.student?.name ?? "Unknown student",
                        ts: new Date(payment.paidAt ?? payment.updatedAt ?? new Date()).toISOString(),
                    })),
                    ...(overduePayments.length > 0
                        ? [
                            {
                                type: "overdue" as const,
                                count: overduePayments.length,
                                ts: new Date().toISOString(),
                            },
                        ]
                        : []),
                    ...sortedStudents.slice(0, 5).map((student) => ({
                        type: "enrollment" as const,
                        studentName: student.name,
                        ts: new Date(student.joinedAt ?? student.createdAt ?? new Date()).toISOString(),
                    })),
                ]
                    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
                    .slice(0, 10);

                setData({
                    snapshot,
                    overduePayments,
                    recentStudents: sortedStudents.slice(0, 6),
                    activityItems,
                    branchName: access.branchName,
                });
            } catch (loadError) {
                console.error("[Dashboard] load failed", loadError);
                if (!cancelled) {
                    setError("Some dashboard data failed to load.");
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        load();

        return () => {
            cancelled = true;
        };
    }, [access, accessLoading, branchId]);

    const snap = data?.snapshot ?? null;
    const canAddStudents = access?.permissions.students ?? false;
    const canViewPayments = access?.permissions.view_payments ?? false;

    const collectionSummary = useMemo(() => {
        if (!snap) {
            return {
                billed: 0,
                collected: 0,
                pending: 0,
                progress: 0,
                note: "Analytics access is required for revenue metrics.",
            };
        }

        const billed = Math.max(snap.monthlyRevenue, snap.paidAmount + snap.dueAmount);
        const progress = billed > 0 ? (snap.paidAmount / billed) * 100 : 0;
        const pending = Math.max(billed - snap.paidAmount, 0);
        const note = snap.dueAmount === 0
            ? "All billed payments are clear."
            : `${formatMoney(snap.dueAmount)} still needs collection follow-up.`;

        return {
            billed,
            collected: snap.paidAmount,
            pending,
            progress,
            note,
        };
    }, [snap]);

    if (loading) return <DashboardSkeleton />;

    return (
        <div className="mx-auto w-full max-w-[1600px] space-y-5 text-white">
            {error && (
                <div className="flex items-center gap-3 rounded-[8px] border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
                    <AlertCircle size={16} className="shrink-0" />
                    {error}
                </div>
            )}

            <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                        <span>Branch overview</span>
                        <span className="h-1 w-1 rounded-full bg-gray-600" />
                        <span>{formatDateLabel()}</span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                            Live
                        </span>
                    </div>
                    <h1 className="mt-2 truncate text-2xl font-semibold tracking-tight text-white md:text-3xl">
                        {data?.branchName ?? "Dashboard"}
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-400">
                        Monitor collections, occupancy, follow-ups, and student movement from one operating view.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {canViewPayments && (
                        <DashboardButton
                            onClick={() => router.push(`/branch/${branchId}/payments`)}
                            variant="secondary"
                            rightIcon={ArrowRight}
                        >
                            Review payments
                        </DashboardButton>
                    )}
                    {canAddStudents && (
                        <DashboardButton
                            onClick={() => router.push(`/branch/${branchId}/students`)}
                            variant="primary"
                        >
                            Add student
                        </DashboardButton>
                    )}
                </div>
            </header>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                    title="Collected this month"
                    value={snap ? formatMoney(snap.paidAmount) : "Restricted"}
                    sub={snap ? `${snap.collectionRate.toFixed(0)}% collection rate` : "No analytics access"}
                    icon={IndianRupee}
                    tone={snap ? toneForCollection(snap.collectionRate, snap.dueAmount) : "neutral"}
                    progress={snap ? collectionSummary.progress : undefined}
                    footer={snap ? `${formatMoney(collectionSummary.pending)} pending` : undefined}
                />
                <StatCard
                    title="Pending dues"
                    value={snap ? formatMoney(snap.dueAmount) : "Restricted"}
                    sub={`${data?.overduePayments.length ?? 0} overdue follow-ups`}
                    icon={AlertTriangle}
                    tone={snap && snap.dueAmount > 0 ? "danger" : "success"}
                    alert={!!snap && snap.dueAmount > 0}
                />
                <StatCard
                    title="Active students"
                    value={snap ? snap.activeStudents.toLocaleString("en-IN") : `${data?.recentStudents.length ?? 0}+`}
                    sub={snap ? `${snap.totalStudents.toLocaleString("en-IN")} total profiles` : "Recent enrollments loaded"}
                    icon={Users}
                    tone="info"
                />
                <StatCard
                    title="Seat utilization"
                    value={snap ? `${snap.occupancyRate.toFixed(0)}%` : "Restricted"}
                    sub={
                        snap?.seatDetails
                            ? `${snap.seatDetails.totalUsedSlots} of ${snap.seatDetails.totalShiftCapacity} shift slots`
                            : snap
                                ? `${snap.assignedSeats} of ${snap.totalSeats} seats`
                                : "No analytics access"
                    }
                    icon={LayoutGrid}
                    tone={snap ? toneForUtilization(snap.occupancyRate) : "neutral"}
                    progress={snap ? snap.occupancyRate : undefined}
                />
            </section>

            <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.75fr)]">
                <DashboardPanel
                    title="Monthly collections"
                    description="Billed, collected, and pending revenue for the active billing month."
                    className="h-full"
                >
                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
                        <div>
                            <div className="flex items-end justify-between gap-3">
                                <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Collection progress</p>
                                    <p className="mt-2 text-3xl font-semibold tracking-tight text-white">
                                        {snap ? `${collectionSummary.progress.toFixed(0)}%` : "Restricted"}
                                    </p>
                                </div>
                                {snap && snap.dueAmount === 0 ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-200">
                                        <CheckCircle2 size={13} />
                                        Clear
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-xs font-medium text-amber-200">
                                        <AlertTriangle size={13} />
                                        Follow-up
                                    </span>
                                )}
                            </div>
                            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
                                <div
                                    className="h-full rounded-full bg-emerald-400"
                                    style={{ width: `${Math.max(0, Math.min(collectionSummary.progress, 100))}%` }}
                                />
                            </div>
                            <p className="mt-3 text-sm leading-6 text-gray-400">{collectionSummary.note}</p>
                        </div>

                        <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
                            <div className="rounded-[8px] border border-white/10 bg-white/[0.02] p-3">
                                <p className="text-xs text-gray-500">Billed</p>
                                <p className="mt-1 text-sm font-semibold text-white">{formatMoney(collectionSummary.billed)}</p>
                            </div>
                            <div className="rounded-[8px] border border-white/10 bg-white/[0.02] p-3">
                                <p className="text-xs text-gray-500">Collected</p>
                                <p className="mt-1 text-sm font-semibold text-emerald-200">{formatMoney(collectionSummary.collected)}</p>
                            </div>
                            <div className="rounded-[8px] border border-white/10 bg-white/[0.02] p-3">
                                <p className="text-xs text-gray-500">Pending</p>
                                <p className="mt-1 text-sm font-semibold text-amber-200">{formatMoney(collectionSummary.pending)}</p>
                            </div>
                        </div>
                    </div>
                </DashboardPanel>

                <QuickActions branchId={branchId} />
            </section>

            <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
                <OverdueTable payments={data?.overduePayments ?? []} branchId={branchId} />
                <ShiftOccupancyCard shifts={snap?.seatDetails?.shifts ?? []} branchId={branchId} />
            </section>

            <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <RecentActivity items={data?.activityItems ?? []} branchId={branchId} />
                <RecentStudents students={data?.recentStudents ?? []} branchId={branchId} />
            </section>
        </div>
    );
}
