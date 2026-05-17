"use client";

import { CreateBranchDialog } from "@/components/branch/CreateBranchDialog";
import { StatCard } from "@/components/dashboard/StatCard";
import { AppButton, AppPanel, PageLoadingSkeleton, PageShell } from "@/components/ui";
import { Badge } from "@/components/ui/Badge";
import { formErrorBannerClass } from "@/components/ui/formSurface";
import {
    pageDescriptionClass,
    pageEmptyStateClass,
    pageEyebrowClass,
    pageGridCardClass,
    pageGridCardHoverClass,
    pageInsetMetricClass,
    pageMetaPillClass,
    pageSectionDescriptionClass,
    pageSectionTitleClass,
    pageSubtleTextClass,
    pageTitleClass,
} from "@/components/ui/pageSurface";
import { analytics, OrganizationAnalyticsSnapshot } from "@/lib/api/analytics";
import { BranchWithCounts, organizations } from "@/lib/api/organizations";
import { cn } from "@/lib/utils";
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

function DashboardSkeleton() {
    return <PageLoadingSkeleton label="Loading organization dashboard" variant="workspace" rows={4} />;
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
            variant: "danger" as const,
        };
    }

    if (utilization >= 90) {
        return {
            label: "Capacity tight",
            variant: "warning" as const,
        };
    }

    return {
        label: "Operational",
        variant: "success" as const,
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
                <div className={cn(formErrorBannerClass, "flex items-center gap-3 px-4 py-3 text-sm")}>
                    <AlertCircle size={16} className="shrink-0" />
                    {error}
                </div>
            )}

            <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                    <div className={cn(pageEyebrowClass, "flex flex-wrap items-center gap-2")}>
                        <span>Workspace entry</span>
                        <span className="h-1 w-1 rounded-full bg-[color:var(--text-muted)]" />
                        <span>{formatDate(snapshot?.asOf)}</span>
                    </div>
                    <h1 className={cn(pageTitleClass, "mt-2")}>
                        Open a branch dashboard
                    </h1>
                    <p className={pageDescriptionClass}>
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
                        <span className={pageMetaPillClass}>
                            {branchList.length} available
                        </span>
                    )
                }
                contentClassName="p-4"
            >
                {branchList.length === 0 ? (
                    <div className={cn(pageEmptyStateClass, "min-h-[260px] gap-4")}>
                        <div className="flex h-11 w-11 items-center justify-center rounded-[var(--ui-radius-control)] border border-[color:var(--ui-form-surface-border)] bg-[color:var(--ui-form-surface-bg)]">
                            <Building2 size={21} className="text-[color:var(--text-muted)]" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-[color:var(--text-primary)]">No branches yet</p>
                            <p className={cn(pageSubtleTextClass, "mt-1 max-w-sm text-xs leading-5")}>
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
                                    className={cn(
                                        "group relative isolate flex min-h-[214px] cursor-pointer overflow-hidden p-0 text-left transition-transform duration-200 hover:-translate-y-0.5",
                                        pageGridCardClass,
                                        pageGridCardHoverClass
                                    )}
                                >
                                    <span className="absolute inset-x-0 top-0 h-1 bg-[color:var(--ui-form-accent)]" />

                                    <div className="flex min-w-0 flex-1 flex-col justify-between p-5">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex min-w-0 items-start gap-3">
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--ui-radius-control)] border border-[color:var(--ui-form-surface-border)] bg-[color:var(--ui-form-surface-bg)] text-sm font-semibold text-[color:var(--ui-form-accent)]">
                                                    {branch.name.slice(0, 1).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="truncate text-lg font-semibold text-[color:var(--text-primary)]">{branch.name}</p>
                                                    <p className={cn(pageSubtleTextClass, "mt-1 flex items-center gap-1.5 text-xs")}>
                                                        <MapPin size={12} />
                                                        {branch.city || "City not set"}
                                                    </p>
                                                </div>
                                            </div>
                                            <Badge variant={status.variant} className="shrink-0">
                                                {status.label}
                                            </Badge>
                                        </div>

                                        <div className="mt-5 grid grid-cols-3 divide-x divide-[color:var(--ui-form-section-divider)] overflow-hidden rounded-[var(--ui-radius-control)] border border-[color:var(--ui-form-surface-border)] bg-[color:var(--ui-form-muted-surface-bg)]">
                                            <div className="px-3 py-3">
                                                <p className={cn(pageSubtleTextClass, "text-xs")}>Students</p>
                                                <p className="mt-1 text-lg font-semibold text-[color:var(--text-primary)]">{activeStudents.toLocaleString("en-IN")}</p>
                                            </div>
                                            <div className="px-3 py-3">
                                                <p className={cn(pageSubtleTextClass, "text-xs")}>Utilization</p>
                                                <p className="mt-1 text-lg font-semibold text-[color:var(--text-primary)]">
                                                    {branchSnapshot ? `${utilization.toFixed(0)}%` : "-"}
                                                </p>
                                            </div>
                                            <div className="px-3 py-3">
                                                <p className={cn(pageSubtleTextClass, "text-xs")}>Overdue</p>
                                                <p className={overdueCount > 0 ? "mt-1 text-lg font-semibold text-[color:var(--ui-tone-danger-text)]" : "mt-1 text-lg font-semibold text-[color:var(--text-primary)]"}>
                                                    {overdueCount.toLocaleString("en-IN")}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="mt-5 flex items-center justify-between gap-3">
                                            <span className={cn(pageSubtleTextClass, "text-xs")}>
                                                {branch.defaultFee ? `${formatMoney(branch.defaultFee)} default fee` : "Fee not set"}
                                            </span>
                                            <span className="inline-flex items-center gap-1.5 rounded-[var(--ui-radius-control)] border border-[color:var(--ui-button-primary-border)] bg-[color:var(--ui-button-primary-bg)] px-3 py-2 text-xs font-semibold text-[color:var(--ui-button-primary-text)] shadow-[var(--ui-button-primary-shadow)] transition-colors group-hover:bg-[color:var(--ui-button-primary-hover-bg)]">
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
                    <h2 className={pageSectionTitleClass}>Organization snapshot</h2>
                    <p className={pageSectionDescriptionClass}>Secondary context after branch selection.</p>
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
                            <p className={cn(pageSubtleTextClass, "text-xs")}>Collected</p>
                            <p className="mt-1 text-2xl font-semibold text-[color:var(--text-primary)]">{formatMoney(totals.paidAmount)}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className={pageInsetMetricClass}>
                                <p className={cn(pageSubtleTextClass, "text-xs")}>Due</p>
                                <p className="mt-1 text-sm font-semibold text-[color:var(--ui-tone-warning-text)]">{formatMoney(totals.dueAmount)}</p>
                            </div>
                            <div className={pageInsetMetricClass}>
                                <p className={cn(pageSubtleTextClass, "text-xs")}>Fee base</p>
                                <p className="mt-1 text-sm font-semibold text-[color:var(--text-secondary)]">{formatMoney(totals.defaultMonthlyBase)}</p>
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
                            <CreditCard size={22} className="mx-auto text-[color:var(--ui-tone-success-text)]" />
                            <p className="mt-3 text-sm font-medium text-[color:var(--text-primary)]">No overdue branch risk</p>
                            <p className={cn(pageSubtleTextClass, "mt-1 text-xs")}>Payment follow-up queue is clear.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-[color:var(--ui-form-section-divider)]">
                            {attentionBranches.map((branch) => (
                                <button
                                    key={branch.branchId}
                                    type="button"
                                    onClick={() => router.push(`/branch/${branch.branchId}/payments`)}
                                    className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[color:var(--ui-form-surface-hover-bg)]"
                                >
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-medium text-[color:var(--text-primary)]">{branch.branchName}</span>
                                        <span className={cn(pageSubtleTextClass, "mt-1 block text-xs")}>
                                            {formatMoney(branch.snapshot.payments.dueAmount)} pending
                                        </span>
                                    </span>
                                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[color:var(--ui-badge-danger-border)] bg-[color:var(--ui-badge-danger-bg)] px-2 py-1 text-[11px] font-medium text-[color:var(--ui-badge-danger-text)]">
                                        {branch.snapshot.payments.overdueCount} overdue
                                        <ArrowRight size={12} />
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </AppPanel>

                <AppPanel title="Setup footprint" contentClassName="p-0">
                    <div className="divide-y divide-[color:var(--ui-form-section-divider)]">
                        <div className="flex items-center justify-between px-4 py-3">
                            <span className="flex items-center gap-2 text-sm text-[color:var(--text-secondary)]">
                                <LayoutGrid size={15} />
                                Seats
                            </span>
                            <span className="text-sm font-medium text-[color:var(--text-primary)]">{branchList.reduce((sum, branch) => sum + branch._count.seats, 0)}</span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-3">
                            <span className="flex items-center gap-2 text-sm text-[color:var(--text-secondary)]">
                                <Clock size={15} />
                                Shifts
                            </span>
                            <span className="text-sm font-medium text-[color:var(--text-primary)]">{totals.shifts}</span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-3">
                            <span className="flex items-center gap-2 text-sm text-[color:var(--text-secondary)]">
                                <Users size={15} />
                                Student profiles
                            </span>
                            <span className="text-sm font-medium text-[color:var(--text-primary)]">
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
