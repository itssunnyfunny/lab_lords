"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Building2, CreditCard, LayoutGrid, Loader2, Users } from "lucide-react";
import { analytics, type OrganizationAnalyticsSnapshot } from "@/lib/api/analytics";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/tables/DataTable";

type BranchAnalyticsRow = {
    id: string;
    branchId: string;
    branchName: string;
    students: string;
    seated: string;
    utilization: number;
    paidAmount: number;
    dueAmount: number;
    overdueCount: number;
};

function money(value: number) {
    return `Rs.${value.toLocaleString("en-IN")}`;
}

function percent(value: number) {
    return `${(value * 100).toFixed(1)}%`;
}

function formatAsOf(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}

export default function OrgAnalyticsPage({ params }: { params: Promise<{ orgId: string }> }) {
    const router = useRouter();
    const { orgId } = use(params);
    const [snapshot, setSnapshot] = useState<OrganizationAnalyticsSnapshot | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;

        async function loadAnalytics() {
            setLoading(true);
            setError(null);

            try {
                const data = await analytics.getOrganizationSnapshot(orgId);
                if (active) setSnapshot(data);
            } catch (loadError) {
                console.error("Failed to load organization analytics", loadError);
                if (active) setError("Failed to load organization analytics.");
            } finally {
                if (active) setLoading(false);
            }
        }

        loadAnalytics();

        return () => {
            active = false;
        };
    }, [orgId]);

    const rows = useMemo<BranchAnalyticsRow[]>(() => {
        return snapshot?.branches.map(branch => ({
            id: branch.branchId,
            branchId: branch.branchId,
            branchName: branch.branchName,
            students: `${branch.snapshot.students.status.active} / ${branch.snapshot.students.status.total}`,
            seated: `${branch.snapshot.students.seating.seated} / ${branch.snapshot.students.seating.activeStudents}`,
            utilization: branch.snapshot.seats.overall.utilizationRatio,
            paidAmount: branch.snapshot.payments.paidAmount,
            dueAmount: branch.snapshot.payments.dueAmount,
            overdueCount: branch.snapshot.payments.overdueCount,
        })) ?? [];
    }, [snapshot]);

    if (loading && !snapshot) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center p-4 md:p-8 text-white">
                <Loader2 className="mr-3 animate-spin text-cyan-400" size={28} />
                <span className="text-gray-400">Loading organization analytics...</span>
            </div>
        );
    }

    const collectionBase = (snapshot?.payments.paidAmount ?? 0) + (snapshot?.payments.dueAmount ?? 0);
    const collectionRate = collectionBase > 0 ? (snapshot?.payments.paidAmount ?? 0) / collectionBase : 0;
    const usedSeatSlots = snapshot?.seats.usedSlots ?? snapshot?.seats.occupiedSeats ?? 0;
    const totalSeatSlots = snapshot?.seats.totalSlots ?? snapshot?.seats.totalSeats ?? 0;

    return (
        <div className="space-y-8 p-4 md:p-8 text-white fade-in">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">Organization Analytics</h1>
                    <p className="mt-1 text-sm text-gray-400">
                        Cross-branch health, seating, and payment snapshot.
                    </p>
                </div>
                {snapshot?.asOf && (
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-gray-500">
                        Updated {formatAsOf(snapshot.asOf)}
                    </div>
                )}
            </div>

            {error && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                    <AlertCircle size={16} />
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                    icon={Building2}
                    label="Branches"
                    value={(snapshot?.organization.totalBranches ?? 0).toLocaleString("en-IN")}
                    detail="Active operating locations"
                />
                <MetricCard
                    icon={Users}
                    label="Students"
                    value={(snapshot?.students.total ?? 0).toLocaleString("en-IN")}
                    detail={`${snapshot?.students.active ?? 0} active`}
                />
                <MetricCard
                    icon={LayoutGrid}
                    label="Seat Utilization"
                    value={percent(snapshot?.seats.utilizationRatio ?? 0)}
                    detail={`${usedSeatSlots} of ${totalSeatSlots} slots used`}
                />
                <MetricCard
                    icon={CreditCard}
                    label="Collection Rate"
                    value={percent(collectionRate)}
                    detail={`${money(snapshot?.payments.paidAmount ?? 0)} collected`}
                />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <Card title="Seat Health" noHover>
                    <div className="space-y-4">
                        <div className="flex items-end justify-between gap-4">
                            <div>
                                <p className="text-3xl font-bold text-white">{percent(snapshot?.seats.utilizationRatio ?? 0)}</p>
                                <p className="mt-1 text-sm text-gray-500">Overall utilization</p>
                            </div>
                            <Badge variant="cyan">{usedSeatSlots} slots used</Badge>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-white/5">
                            <div
                                className="h-full rounded-full bg-cyan-500"
                                style={{ width: `${Math.min((snapshot?.seats.utilizationRatio ?? 0) * 100, 100)}%` }}
                            />
                        </div>
                    </div>
                </Card>

                <Card title="Student Mix" noHover>
                    <div className="grid grid-cols-2 gap-3">
                        <CompactStat label="Active" value={snapshot?.students.active ?? 0} tone="text-emerald-300" />
                        <CompactStat label="Inactive" value={snapshot?.students.inactive ?? 0} tone="text-gray-400" />
                    </div>
                </Card>

                <Card title="Payments" noHover>
                    <div className="grid grid-cols-2 gap-3">
                        <CompactStat label="Paid" value={snapshot?.payments.paidCount ?? 0} tone="text-emerald-300" />
                        <CompactStat label="Due" value={snapshot?.payments.dueCount ?? 0} tone="text-rose-300" />
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-xl bg-white/[0.03] p-3">
                            <p className="text-xs text-gray-500">Collected</p>
                            <p className="mt-1 font-semibold text-emerald-300">{money(snapshot?.payments.paidAmount ?? 0)}</p>
                        </div>
                        <div className="rounded-xl bg-white/[0.03] p-3">
                            <p className="text-xs text-gray-500">Due</p>
                            <p className="mt-1 font-semibold text-rose-300">{money(snapshot?.payments.dueAmount ?? 0)}</p>
                        </div>
                    </div>
                </Card>
            </div>

            <div>
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white">Branch Breakdown</h2>
                </div>
                <DataTable
                    data={rows}
                    emptyMessage="No branches available for analytics."
                    columns={[
                        { header: "Branch", accessor: "branchName", className: "font-medium text-white" },
                        { header: "Active / Total", accessor: "students" },
                        { header: "Seated / Active", accessor: "seated" },
                        {
                            header: "Utilization",
                            accessor: (item) => <Badge variant="cyan">{percent(item.utilization)}</Badge>,
                        },
                        {
                            header: "Collected",
                            accessor: (item) => <span className="font-semibold text-emerald-300">{money(item.paidAmount)}</span>,
                        },
                        {
                            header: "Due",
                            accessor: (item) => <span className="font-semibold text-rose-300">{money(item.dueAmount)}</span>,
                        },
                        {
                            header: "Overdue",
                            accessor: (item) => item.overdueCount > 0
                                ? <Badge variant="danger">{item.overdueCount}</Badge>
                                : <Badge variant="success">0</Badge>,
                        },
                    ]}
                    actions={(item) => (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/branch/${item.branchId}/analytics`)}
                            className="gap-1.5 whitespace-nowrap"
                        >
                            Open <ArrowRight size={13} />
                        </Button>
                    )}
                />
            </div>
        </div>
    );
}

function MetricCard({
    icon: Icon,
    label,
    value,
    detail,
}: {
    icon: typeof Building2;
    label: string;
    value: string;
    detail: string;
}) {
    return (
        <Card noHover className="p-5">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
                <Icon size={18} />
            </div>
            <p className="text-sm text-gray-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-white">{value}</p>
            <p className="mt-2 text-xs leading-5 text-gray-500">{detail}</p>
        </Card>
    );
}

function CompactStat({ label, value, tone }: { label: string; value: number; tone: string }) {
    return (
        <div className="rounded-xl bg-white/[0.03] p-4">
            <p className="text-xs text-gray-500">{label}</p>
            <p className={`mt-1 text-2xl font-bold ${tone}`}>{value.toLocaleString("en-IN")}</p>
        </div>
    );
}
