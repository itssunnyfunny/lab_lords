"use client";

import { CreateBranchDialog } from "@/components/branch/CreateBranchDialog";
import { StatCard } from "@/components/dashboard/StatCard";
import { AppButton, AppPanel, PageShell } from "@/components/ui";
import { analytics, OrganizationAnalyticsSnapshot } from "@/lib/api/analytics";
import { BranchWithCounts, organizations } from "@/lib/api/organizations";
import {
    AlertCircle,
    ArrowRight,
    Building2,
    Clock,
    CreditCard,
    LayoutGrid,
    MapPin,
    Plus,
    TriangleAlert,
    Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useMemo, useState } from "react";

function Skeleton({ className }: { className?: string }) {
    return <div className={`animate-pulse rounded-[8px] bg-white/[0.05] ${className ?? ""}`} />;
}

function DashboardSkeleton() {
    return (
        <PageShell>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-9 w-80" />
                </div>
                <Skeleton className="h-10 w-40" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Skeleton className="h-48 sm:col-span-2 xl:col-span-4" />
            </div>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
                <Skeleton className="h-32" />
                <Skeleton className="h-96" />
            </div>
        </PageShell>
    );
}

function formatMoney(value: number) {
    return `Rs ${value.toLocaleString("en-IN")}`;
}

function formatDate(value?: string) {
    if (!value) return "Updated just now";

    return new Date(value).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

function utilizationTone(value: number): "success" | "warning" | "danger" {
    if (value >= 70) return "success";
    if (value >= 40) return "warning";
    return "danger";
}

function getBranchStatus(overdueCount: number, utilization: number) {
    if (overdueCount > 0) {
        return {
            label: "Needs follow-up",
            className: "border-rose-400/20 bg-rose-400/10 text-rose-200",
        };
    }

    if (utilization >= 90) {
        return {
            label: "Capacity tight",
            className: "border-amber-400/20 bg-amber-400/10 text-amber-200",
        };
    }

    return {
        label: "Operational",
        className: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
    };
}

export default function OrgDashboardPage({ params }: { params: Promise<{ orgId: string }> }) {
    const router = useRouter();
    const { orgId } = use(params);
    const [branchList, setBranchList] = useState<BranchWithCounts[]>([]);
    const [snapshot, setSnapshot] = useState<OrganizationAnalyticsSnapshot | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);

    const loadDashboard = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const [branchesResult, snapshotResult] = await Promise.all([
                organizations.getBranches(orgId),
                analytics.getOrganizationSnapshot(orgId).catch(() => null),
            ]);

            setBranchList(branchesResult);
            setSnapshot(snapshotResult);
        } catch (loadError) {
            console.error("Failed to fetch organization dashboard", loadError);
            setError("Failed to load organization dashboard.");
        } finally {
            setLoading(false);
        }
    }, [orgId]);

    useEffect(() => {
        loadDashboard();
    }, [loadDashboard]);

    const handleBranchCreated = () => {
        setCreateDialogOpen(false);
        loadDashboard();
    };

    const branchSnapshotById = useMemo(() => {
        return new Map((snapshot?.branches ?? []).map((branch) => [branch.branchId, branch]));
    }, [snapshot]);

    const totals = useMemo(() => {
        const branches = branchList.length;
        const fallbackStudents = branchList.reduce((sum, branch) => sum + branch._count.students, 0);
        const fallbackSeats = branchList.reduce((sum, branch) => sum + branch._count.seats, 0);
        const fallbackShifts = branchList.reduce((sum, branch) => sum + branch._count.shifts, 0);
        const defaultMonthlyBase = branchList.reduce(
            (sum, branch) => sum + (branch.defaultFee ?? 0) * branch._count.students,
            0
        );

        const utilization = snapshot ? snapshot.seats.utilizationRatio * 100 : 0;

        return {
            branches,
            students: snapshot?.students.active ?? fallbackStudents,
            seats: snapshot?.seats.totalSlots ?? fallbackSeats,
            usedSeats: snapshot?.seats.usedSlots ?? 0,
            shifts: fallbackShifts,
            utilization,
            paidAmount: snapshot?.payments.paidAmount ?? 0,
            dueAmount: snapshot?.payments.dueAmount ?? 0,
            overdueCount: snapshot?.payments.overdueCount ?? 0,
            defaultMonthlyBase,
        };
    }, [branchList, snapshot]);

    const attentionBranches = useMemo(() => {
        return [...(snapshot?.branches ?? [])]
            .filter((branch) => branch.snapshot.payments.overdueCount > 0)
            .sort((a, b) => b.snapshot.payments.overdueCount - a.snapshot.payments.overdueCount)
            .slice(0, 5);
    }, [snapshot]);

    if (loading) return <DashboardSkeleton />;

    return (
        <PageShell>
            {error && (
                <div className="flex items-center gap-3 rounded-[8px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
                    <AlertCircle size={16} className="shrink-0" />
                    {error}
                </div>
            )}

            <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                        <span>Workspace entry</span>
                        <span className="h-1 w-1 rounded-full bg-gray-600" />
                        <span>{formatDate(snapshot?.asOf)}</span>
                    </div>
                    <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">
                        Open a branch dashboard
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-400">
                        Choose the branch you want to work in. Organization numbers are here only as quick context.
                    </p>
                </div>

                <AppButton
                    onClick={() => setCreateDialogOpen(true)}
                    variant="primary"
                    icon={Plus}
                    className="w-fit"
                >
                    Create branch
                </AppButton>
            </header>

            <AppPanel
                title="Choose branch"
                description="Select a branch to continue to students, payments, seats, shifts, and follow-ups."
                action={
                    branchList.length > 0 && (
                        <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-gray-400">
                            {branchList.length} available
                        </span>
                    )
                }
                contentClassName="p-4"
            >
                {branchList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-4 px-4 py-14 text-center">
                        <div className="flex h-11 w-11 items-center justify-center rounded-[8px] border border-white/10 bg-white/[0.03]">
                            <Building2 size={21} className="text-gray-500" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-white">No branches yet</p>
                            <p className="mt-1 max-w-sm text-xs leading-5 text-gray-500">
                                Create your first branch to start using the operational dashboard.
                            </p>
                        </div>
                        <AppButton
                            onClick={() => setCreateDialogOpen(true)}
                            variant="primary"
                            size="sm"
                            icon={Plus}
                        >
                            Create branch
                        </AppButton>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        {branchList.map((branch) => {
                            const branchSnapshot = branchSnapshotById.get(branch.id);
                            const activeStudents = branchSnapshot?.snapshot.students.status.active ?? branch._count.students;
                            const utilization = branchSnapshot
                                ? branchSnapshot.snapshot.seats.overall.utilizationRatio * 100
                                : 0;
                            const overdueCount = branchSnapshot?.snapshot.payments.overdueCount ?? 0;
                            const status = getBranchStatus(overdueCount, utilization);

                            return (
                                <button
                                    key={branch.id}
                                    type="button"
                                    onClick={() => router.push(`/branch/${branch.id}`)}
                                    className="group relative isolate flex min-h-[214px] overflow-hidden rounded-[8px] border border-white/12 bg-[linear-gradient(145deg,rgba(18,26,36,0.96),rgba(7,11,16,0.98))] text-left shadow-[0_18px_50px_rgba(0,0,0,0.24)] transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-300/30 hover:shadow-[0_22px_60px_rgba(0,0,0,0.34)]"
                                >
                                    <span className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,rgba(103,232,249,0.9),rgba(110,231,183,0.65),rgba(255,255,255,0))]" />
                                    <span className="absolute bottom-0 right-0 h-24 w-24 rounded-full bg-cyan-300/5 blur-2xl transition-opacity group-hover:opacity-100" />

                                    <div className="flex min-w-0 flex-1 flex-col justify-between p-5">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex min-w-0 items-start gap-3">
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-white/10 bg-white/[0.04] text-sm font-semibold text-cyan-100">
                                                    {branch.name.slice(0, 1).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="truncate text-lg font-semibold text-white">{branch.name}</p>
                                                    <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                                                        <MapPin size={12} />
                                                        {branch.city || "City not set"}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-medium ${status.className}`}>
                                                {status.label}
                                            </span>
                                        </div>

                                        <div className="mt-5 grid grid-cols-3 divide-x divide-white/10 overflow-hidden border-y border-white/10 bg-black/10">
                                            <div className="px-3 py-3">
                                                <p className="text-xs text-gray-500">Students</p>
                                                <p className="mt-1 text-lg font-semibold text-white">{activeStudents.toLocaleString("en-IN")}</p>
                                            </div>
                                            <div className="px-3 py-3">
                                                <p className="text-xs text-gray-500">Utilization</p>
                                                <p className="mt-1 text-lg font-semibold text-white">
                                                    {branchSnapshot ? `${utilization.toFixed(0)}%` : "-"}
                                                </p>
                                            </div>
                                            <div className="px-3 py-3">
                                                <p className="text-xs text-gray-500">Overdue</p>
                                                <p className={overdueCount > 0 ? "mt-1 text-lg font-semibold text-rose-200" : "mt-1 text-lg font-semibold text-white"}>
                                                    {overdueCount.toLocaleString("en-IN")}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="mt-5 flex items-center justify-between gap-3">
                                            <span className="text-xs text-gray-500">
                                                {branch.defaultFee ? `${formatMoney(branch.defaultFee)} default fee` : "Fee not set"}
                                            </span>
                                            <span className="inline-flex items-center gap-1.5 rounded-[8px] border border-cyan-200/60 bg-cyan-300 px-3 py-2 text-xs font-semibold text-[#061014] shadow-[inset_0_-2px_0_rgba(0,0,0,0.16)] transition-colors group-hover:bg-cyan-200">
                                                Open dashboard
                                                <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                                            </span>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </AppPanel>

            <section className="space-y-3">
                <div>
                    <h2 className="text-sm font-semibold text-white">Organization snapshot</h2>
                    <p className="mt-1 text-xs text-gray-500">Secondary context after branch selection.</p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        title="Branches"
                        value={totals.branches.toLocaleString("en-IN")}
                        sub={`${totals.shifts.toLocaleString("en-IN")} configured shifts`}
                        icon={Building2}
                        tone="info"
                    />
                    <StatCard
                        title="Active students"
                        value={totals.students.toLocaleString("en-IN")}
                        sub="Currently active across branches"
                        icon={Users}
                        tone="success"
                    />
                    <StatCard
                        title="Slot utilization"
                        value={snapshot ? `${totals.utilization.toFixed(0)}%` : "Restricted"}
                        sub={
                            snapshot
                                ? `${totals.usedSeats.toLocaleString("en-IN")} of ${totals.seats.toLocaleString("en-IN")} slots used`
                                : `${totals.seats.toLocaleString("en-IN")} seats configured`
                        }
                        icon={LayoutGrid}
                        tone={snapshot ? utilizationTone(totals.utilization) : "neutral"}
                        progress={snapshot ? totals.utilization : undefined}
                    />
                    <StatCard
                        title="Payment risk"
                        value={formatMoney(totals.dueAmount)}
                        sub={`${totals.overdueCount.toLocaleString("en-IN")} overdue payments`}
                        icon={TriangleAlert}
                        tone={totals.overdueCount > 0 ? "danger" : "success"}
                        alert={totals.overdueCount > 0}
                    />
                </div>
            </section>

            <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
                <AppPanel
                    title="Revenue coverage"
                    description="Default branch fees and actual payment collection signal."
                >
                    <div className="space-y-4">
                        <div>
                            <p className="text-xs text-gray-500">Collected</p>
                            <p className="mt-1 text-2xl font-semibold text-white">{formatMoney(totals.paidAmount)}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-[8px] border border-white/10 bg-white/[0.02] p-3">
                                <p className="text-xs text-gray-500">Due</p>
                                <p className="mt-1 text-sm font-semibold text-amber-200">{formatMoney(totals.dueAmount)}</p>
                            </div>
                            <div className="rounded-[8px] border border-white/10 bg-white/[0.02] p-3">
                                <p className="text-xs text-gray-500">Fee base</p>
                                <p className="mt-1 text-sm font-semibold text-gray-200">{formatMoney(totals.defaultMonthlyBase)}</p>
                            </div>
                        </div>
                    </div>
                </AppPanel>

                <AppPanel
                    title="Attention queue"
                    description="Branches with overdue payment pressure."
                    contentClassName="p-0"
                >
                    {attentionBranches.length === 0 ? (
                        <div className="px-4 py-8 text-center">
                            <CreditCard size={22} className="mx-auto text-emerald-300" />
                            <p className="mt-3 text-sm font-medium text-white">No overdue branch risk</p>
                            <p className="mt-1 text-xs text-gray-500">Payment follow-up queue is clear.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/10">
                            {attentionBranches.map((branch) => (
                                <button
                                    key={branch.branchId}
                                    type="button"
                                    onClick={() => router.push(`/branch/${branch.branchId}/payments`)}
                                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
                                >
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-medium text-white">{branch.branchName}</span>
                                        <span className="mt-1 block text-xs text-gray-500">
                                            {formatMoney(branch.snapshot.payments.dueAmount)} pending
                                        </span>
                                    </span>
                                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-rose-400/20 bg-rose-400/10 px-2 py-1 text-[11px] font-medium text-rose-200">
                                        {branch.snapshot.payments.overdueCount} overdue
                                        <ArrowRight size={12} />
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </AppPanel>

                <AppPanel title="Setup footprint" contentClassName="p-0">
                    <div className="divide-y divide-white/10">
                        <div className="flex items-center justify-between px-4 py-3">
                            <span className="flex items-center gap-2 text-sm text-gray-400">
                                <LayoutGrid size={15} />
                                Seats
                            </span>
                            <span className="text-sm font-medium text-white">{branchList.reduce((sum, branch) => sum + branch._count.seats, 0)}</span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-3">
                            <span className="flex items-center gap-2 text-sm text-gray-400">
                                <Clock size={15} />
                                Shifts
                            </span>
                            <span className="text-sm font-medium text-white">{totals.shifts}</span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-3">
                            <span className="flex items-center gap-2 text-sm text-gray-400">
                                <Users size={15} />
                                Student profiles
                            </span>
                            <span className="text-sm font-medium text-white">
                                {branchList.reduce((sum, branch) => sum + branch._count.students, 0)}
                            </span>
                        </div>
                    </div>
                </AppPanel>
            </section>

            <CreateBranchDialog
                isOpen={createDialogOpen}
                onClose={() => setCreateDialogOpen(false)}
                organizationId={orgId}
                onSuccess={handleBranchCreated}
            />
        </PageShell>
    );
}
