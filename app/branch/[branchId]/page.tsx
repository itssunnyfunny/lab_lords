"use client";

import { use, useEffect, useState } from "react";
import { analytics, BranchSnapshot } from "@/lib/api/analytics";
import { branches } from "@/lib/api/branches";
import { format } from "date-fns";
import { StatCard } from "@/components/dashboard/StatCard";
import { OverdueTable } from "@/components/dashboard/OverdueTable";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { ShiftOccupancyCard } from "@/components/dashboard/ShiftOccupancyCard";
import { RecentActivity, ActivityItem } from "@/components/dashboard/RecentActivity";
import { useBranchAccess } from "@/hooks/useBranchAccess";
import {
    IndianRupee,
    AlertTriangle,
    Users,
    LayoutGrid,
    AlertCircle,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

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

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
    return <div className={`animate-pulse bg-white/5 rounded-xl ${className ?? ""}`} />;
}

function DashboardSkeleton() {
    return (
        <div className="p-4 md:p-8 space-y-8">
            {/* Header */}
            <div className="space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-8 w-72" />
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
            </div>

            {/* Main grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <Skeleton className="h-80" />
                </div>
                <div className="space-y-6">
                    <Skeleton className="h-44" />
                    <Skeleton className="h-32" />
                </div>
            </div>

            {/* Recent students */}
            <Skeleton className="h-48" />
        </div>
    );
}

// ─── Greeting ────────────────────────────────────────────────────────────────

function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
}

function formatDate() {
    return new Date().toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

// ─── Seat utilisation accent ─────────────────────────────────────────────────

function utilAccent(rate: number): "emerald" | "amber" | "rose" {
    if (rate >= 70) return "emerald";
    if (rate >= 40) return "amber";
    return "rose";
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function BranchDashboardPage({
    params,
}: {
    params: Promise<{ branchId: string }>;
}) {
    const { branchId } = use(params);

    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { access, loading: accessLoading } = useBranchAccess(branchId);

    useEffect(() => {
        const load = async () => {
            if (accessLoading) return;
            if (!access) {
                setLoading(false);
                setError("You do not have access to this branch.");
                return;
            }

            setLoading(true);
            setError(null);
            try {
                const monthStr = format(new Date(), "yyyy-MM");
                const [snapshot, allStudents, allocationsRes, monthPayments, overduePaymentsRes] =
                    await Promise.all([
                        access.permissions.analytics ? analytics.getSnapshot(branchId) : Promise.resolve(null),
                        access.permissions.students ? branches.getStudents(branchId) : Promise.resolve([]),
                        access.permissions.seat_allocation
                            ? fetch(`/api/branches/${branchId}/seat-allocations?activeOnly=true`)
                                .then((r) => (r.ok ? r.json() : []))
                                .catch(() => [])
                            : Promise.resolve([]),
                        access.permissions.view_payments
                            ? fetch(`/api/branches/${branchId}/payments?month=${monthStr}`)
                                .then((r) => (r.ok ? r.json() : []))
                                .catch(() => [])
                            : Promise.resolve([]),
                        access.permissions.view_payments
                            ? fetch(`/api/branches/${branchId}/payments/overdue`)
                                .then((r) => (r.ok ? r.json() : { payments: [] }))
                                .catch(() => ({ payments: [] }))
                            : Promise.resolve({ payments: [] }),
                    ]);
                
                const paymentsData = monthPayments as PaymentWithStudent[];
                const allocationsData = allocationsRes as AllocationSummary[];
                const paidPaymentsRes = paymentsData.filter((p) => p.status === "PAID");
                const overdueRes = overduePaymentsRes as { payments?: OverduePayment[] };
                const overduePayments = overdueRes.payments ?? [];
                // Sort students by joinedAt/createdAt desc, take first 5
                const sorted = [...allStudents].sort((a, b) => {
                    const da = new Date(a.joinedAt ?? a.createdAt ?? 0).getTime();
                    const db = new Date(b.joinedAt ?? b.createdAt ?? 0).getTime();
                    return db - da;
                });

                // ── Build activity feed ──────────────────────────────────
                const rawItems: ActivityItem[] = [
                    // Recent seat allocations (up to 5)
                    ...allocationsData.slice(0, 5).map((a) => ({
                        type: "allocation" as const,
                        seat: a.seat?.label ?? "Seat",
                        studentName: a.student?.name ?? "—",
                        ts: new Date(a.startDate ?? new Date()).toISOString(),
                    })),
                    // Recent paid payments — sort by paidAt desc so newest appear first
                    ...[...paidPaymentsRes]
                        .sort((a, b) =>
                            new Date(b.paidAt ?? b.updatedAt ?? 0).getTime() -
                            new Date(a.paidAt ?? a.updatedAt ?? 0).getTime()
                        )
                        .slice(0, 5)
                        .map((p) => ({
                        type: "payment" as const,
                        amount: p.amount,
                        studentName: p.student?.name ?? "—",
                        ts: new Date(p.paidAt ?? p.updatedAt ?? new Date()).toISOString(),
                    })),
                    // Single overdue aggregate event (if any)
                    ...(overduePayments.length > 0
                        ? [{
                            type: "overdue" as const,
                            count: overduePayments.length,
                            ts: new Date().toISOString(),
                        }]
                        : []),
                    // New enrollments (up to 5)
                    ...sorted.slice(0, 5).map((s) => ({
                        type: "enrollment" as const,
                        studentName: s.name,
                        ts: new Date(s.joinedAt ?? s.createdAt ?? new Date()).toISOString(),
                    })),
                ];

                // Sort by most recent, keep top 10
                const activityItems = rawItems
                    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
                    .slice(0, 10);

                setData({
                    snapshot,
                    overduePayments,
                    recentStudents: sorted.slice(0, 5),
                    activityItems,
                    branchName: access.branchName,
                });
            } catch (err) {
                console.error("[Dashboard] load failed", err);
                setError("Some dashboard data failed to load.");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [access, accessLoading, branchId]);

    if (loading) return <DashboardSkeleton />;

    const snap = data?.snapshot;

    return (
        <div className="p-4 md:p-8 space-y-8 text-white">

            {/* ── Soft error banner ─────────────────────────────────────── */}
            {error && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
                    <AlertCircle size={16} className="flex-shrink-0" />
                    {error}
                </div>
            )}

            {/* ── Header ───────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">
                        {getGreeting()} · {formatDate()}
                    </p>
                    <h1 className="text-3xl font-bold text-white tracking-tight">
                        {data?.branchName ?? "Dashboard"}
                    </h1>
                </div>

                {/* Live dot */}
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] animate-pulse" />
                    Live data
                </div>
            </div>

            {/* ── 4 Stat Cards ─────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <StatCard
                    title="Revenue Collected"
                    value={snap ? `₹${snap.paidAmount.toLocaleString("en-IN")}` : "—"}
                    sub={snap ? `of ₹${snap.monthlyRevenue.toLocaleString("en-IN")} billed` : "Loading…"}
                    icon={IndianRupee}
                    accent="emerald"
                />
                <StatCard
                    title="Pending Dues"
                    value={snap ? `₹${snap.dueAmount.toLocaleString("en-IN")}` : "—"}
                    sub={snap ? `${snap.collectionRate.toFixed(0)}% collected this month` : "Loading…"}
                    icon={AlertTriangle}
                    accent="rose"
                    alert={!!snap && snap.dueAmount > 0}
                />
                <StatCard
                    title="Active Students"
                    value={snap ? `${snap.activeStudents}` : "—"}
                    sub={snap ? `of ${snap.totalStudents} total enrolled` : "Loading…"}
                    icon={Users}
                    accent="indigo"
                />
                <StatCard
                    title="Seat Utilization"
                    value={snap ? `${snap.occupancyRate.toFixed(0)}%` : "—"}
                    sub={snap ? `${snap.assignedSeats} of ${snap.totalSeats} seats filled` : "Loading…"}
                    icon={LayoutGrid}
                    accent={snap ? utilAccent(snap.occupancyRate) : "amber"}
                />
            </div>

            {/* ── Main Grid: Overdue table + Right column ─────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left — overdue table (spans 2 cols) */}
                <div className="lg:col-span-2">
                    <OverdueTable
                        payments={data?.overduePayments ?? []}
                        branchId={branchId}
                    />
                </div>

                {/* Right column — quick actions + shift occupancy */}
                <div className="flex flex-col gap-6">
                    <QuickActions branchId={branchId} />

                    <ShiftOccupancyCard
                        shifts={snap?.seatDetails?.shifts ?? []}
                        branchId={branchId}
                    />
                </div>
            </div>

            {/* ── Recent Activity (full width) ─────────────────────────── */}
            <RecentActivity
                items={data?.activityItems ?? []}
                branchId={branchId}
            />
        </div>
    );
}
