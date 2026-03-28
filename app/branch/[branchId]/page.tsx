"use client";

import { use, useEffect, useState } from "react";
import { analytics, BranchSnapshot } from "@/lib/api/analytics";
import { branches } from "@/lib/api/branches";
import { StatCard } from "@/components/dashboard/StatCard";
import { OverdueTable } from "@/components/dashboard/OverdueTable";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { ShiftOccupancyCard } from "@/components/dashboard/ShiftOccupancyCard";
import { RecentStudents } from "@/components/dashboard/RecentStudents";
import {
    IndianRupee,
    AlertTriangle,
    Users,
    LayoutGrid,
    Loader2,
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
    joinedAt?: string;
    createdAt?: string;
}

interface DashboardData {
    snapshot: BranchSnapshot;
    overduePayments: OverduePayment[];
    recentStudents: Student[];
    branchName: string;
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
    return <div className={`animate-pulse bg-white/5 rounded-xl ${className ?? ""}`} />;
}

function DashboardSkeleton() {
    return (
        <div className="p-8 space-y-8">
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

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const [snapshot, branchDetails, allStudents, overdueRes] = await Promise.all([
                    analytics.getSnapshot(branchId),
                    branches.getDetails(branchId),
                    branches.getStudents(branchId),
                    fetch(`/api/branches/${branchId}/payments/overdue`)
                        .then((r) => (r.ok ? r.json() : { count: 0, payments: [] }))
                        .catch(() => ({ count: 0, payments: [] })),
                ]);

                // Sort students by joinedAt/createdAt desc, take first 5
                const sorted = [...allStudents].sort((a: any, b: any) => {
                    const da = new Date(a.joinedAt ?? a.createdAt ?? 0).getTime();
                    const db = new Date(b.joinedAt ?? b.createdAt ?? 0).getTime();
                    return db - da;
                });

                setData({
                    snapshot,
                    overduePayments: overdueRes.payments ?? [],
                    recentStudents: sorted.slice(0, 5),
                    branchName: branchDetails.name,
                });
            } catch (err) {
                console.error("[Dashboard] load failed", err);
                setError("Some dashboard data failed to load.");
                // Still try to show partial data
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [branchId]);

    if (loading) return <DashboardSkeleton />;

    const snap = data?.snapshot;

    return (
        <div className="p-8 space-y-8 text-white">

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

            {/* ── Recent Students (full width) ─────────────────────────── */}
            <RecentStudents
                students={data?.recentStudents ?? []}
                branchId={branchId}
            />
        </div>
    );
}
