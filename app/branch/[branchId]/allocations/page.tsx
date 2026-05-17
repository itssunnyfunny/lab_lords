"use client";

import { type ComponentType, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { BranchAccessGuard } from "@/components/auth/BranchAccessGuard";
import { AllocationsTable } from "@/components/allocations/AllocationsTable";
import { AllocateSeatDialog } from "@/components/allocations/AllocateSeatDialog";
import { UpdateAllocationDialog } from "@/components/allocations/UpdateAllocationDialog";
import { BRANCH_PAGE_ACCESS } from "@/lib/branchPageAccess";
import { ViewToggle } from "@/components/tables/ViewToggle";
import { useDataViewMode } from "@/hooks/useDataViewMode";
import { AppButton, PageLoadingSkeleton, PageShell } from "@/components/ui";
import {
    pageCountBadgeClass,
    pageDescriptionClass,
    pageEmptyStateClass,
    pageEyebrowClass,
    pageErrorIconClass,
    pageErrorStateClass,
    pageInsetMetricClass,
    pageMutedTextClass,
    pageSectionDividerClass,
    pageSubtleTextClass,
    pageTitleClass,
} from "@/components/ui/pageSurface";
import { cn } from "@/lib/utils";
import { AlertCircle, ArrowRightLeft, CalendarCheck, UserPlus, Users } from "lucide-react";

interface AllocationRow {
    id: string;
    studentId: string;
    student: { name: string; status: string; monthlyFee?: number | null };
    seat: { id: string; label: string };
    shiftId: string;
    shift: { name: string; isReserved: boolean };
    startDate: string;
    endDate: string | null;
    multiShiftId: string | null;
    multiShift?: { id: string; name: string } | null;
}

type AllocationTab = "ACTIVE" | "ENDED";

export default function AllocationsPage() {
    const params = useParams();
    const branchId = params?.branchId as string;

    return (
        <BranchAccessGuard branchId={branchId} permission={BRANCH_PAGE_ACCESS.allocations}>
            <AllocationsContent branchId={branchId} />
        </BranchAccessGuard>
    );
}

function AllocationsContent({ branchId }: { branchId: string }) {
    const searchParams = useSearchParams();
    const router = useRouter();

    const [allocations, setAllocations] = useState<AllocationRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<AllocationTab>("ACTIVE");
    const [viewMode, setViewMode] = useDataViewMode();

    // Optional: pre-selected student passed via query param from students page
    const preselectedStudentId = searchParams.get("studentId") ?? undefined;
    const preselectedStudentName = searchParams.get("studentName") ?? undefined;
    // Change seat: navigated from students page with existing allocation
    const changeStudentId = searchParams.get("changeStudentId") ?? undefined;
    const changeStudentName = searchParams.get("studentName") ?? undefined;

    const [updateTarget, setUpdateTarget] = useState<{
        ids: string[];
        studentId: string;
        studentName: string;
        currentSeatId: string;
        currentFee: number | null;
        currentShiftIds: string[];
        currentMultiShiftId: string | null;
    } | null>(null);

    // Auto-open dialog when navigated from students page with ?studentId=...
    useEffect(() => {
        if (preselectedStudentId) {
            setIsDialogOpen(true);
        }
    }, [preselectedStudentId]);

    // Auto-open update dialog when navigated with ?changeStudentId=...
    useEffect(() => {
        if (!changeStudentId || allocations.length === 0) return;
        // Find the active allocation(s) for this student
        const studentAllocs = allocations.filter(
            (a) => a.studentId === changeStudentId && !a.endDate
        );
        if (studentAllocs.length === 0) return;
        // Group by multiShiftId
        const ids = studentAllocs.map((a) => a.id);
        setUpdateTarget({
            ids,
            studentId: changeStudentId,
            studentName: changeStudentName || studentAllocs[0]?.student?.name || "",
            currentSeatId: studentAllocs[0]?.seat?.id || "",
            currentFee: studentAllocs[0]?.student?.monthlyFee ?? null,
            currentShiftIds: studentAllocs.map((a) => a.shiftId),
            currentMultiShiftId: studentAllocs[0]?.multiShiftId ?? null,
        });
        // Clear query param
        router.replace(`/branch/${branchId}/allocations`);
    }, [allocations, branchId, changeStudentId, changeStudentName, router]);

    const fetchAllocations = useCallback(async () => {
        try {
            const res = await fetch(`/api/branches/${branchId}/seat-allocations`);
            if (!res.ok) throw new Error("Failed to load allocations");
            const data = await res.json();
            setAllocations(data);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to load allocations");
        } finally {
            setLoading(false);
        }
    }, [branchId]);

    useEffect(() => {
        if (!branchId) return;
        fetchAllocations();
    }, [branchId, fetchAllocations]);

    const handleEndAllocation = async (ids: string | string[]) => {
        const idArray = Array.isArray(ids) ? ids : [ids];
        for (const id of idArray) {
            const res = await fetch(`/api/seat-allocations/${id}/end`, {
                method: "POST",
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to end allocation");
            }
        }
        await fetchAllocations();
    };

    const handleClose = () => {
        setIsDialogOpen(false);
        // Clear studentId query param if present
        if (preselectedStudentId) {
            router.replace(`/branch/${branchId}/allocations`);
        }
    };

    const allocationCounts = useMemo(() => {
        const active = allocations.filter(alloc => !alloc.endDate).length;
        const ended = allocations.length - active;
        const multiShift = allocations.filter(alloc => alloc.multiShiftId || alloc.multiShift).length;
        return { active, ended, multiShift };
    }, [allocations]);

    if (loading) return <PageLoadingSkeleton label="Loading allocations" variant="table" rows={6} />;

    if (error) return (
        <div className={pageErrorStateClass}>
            <AlertCircle className={pageErrorIconClass} />
            <h2 className="text-xl font-semibold">Allocations did not load</h2>
            <p className={pageMutedTextClass}>{error}</p>
            <AppButton variant="secondary" onClick={() => fetchAllocations()}>
                Try again
            </AppButton>
        </div>
    );

    const filteredAllocations = allocations.filter(alloc => 
        activeTab === "ACTIVE" ? !alloc.endDate : !!alloc.endDate
    );

    return (
        <PageShell>
            <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                    <p className={pageEyebrowClass}>Seat workflow</p>
                    <h1 className={cn(pageTitleClass, "mt-2 truncate")}>Allocations</h1>
                    <p className={pageDescriptionClass}>
                        Keep current seat assignments visible, then move quickly into changes, releases, or allocation history.
                    </p>
                </div>

                <AppButton variant="primary" icon={UserPlus} onClick={() => setIsDialogOpen(true)}>
                    Allocate seat
                </AppButton>
            </header>

            <section className="grid gap-3 sm:grid-cols-3">
                <AllocationMetric icon={Users} label="Active" value={allocationCounts.active} detail="Current seat assignments" tone="success" />
                <AllocationMetric icon={CalendarCheck} label="Ended" value={allocationCounts.ended} detail="Historical allocations" tone="neutral" />
                <AllocationMetric icon={ArrowRightLeft} label="Multi-shift" value={allocationCounts.multiShift} detail="Linked shift assignments" tone="info" />
            </section>

            <div className={cn("flex flex-col gap-3 border-b pb-4 md:flex-row md:items-center md:justify-between", pageSectionDividerClass)}>
                <div className="flex max-w-full items-center gap-2 overflow-x-auto">
                    {(["ACTIVE", "ENDED"] as const).map(tab => {
                        const active = activeTab === tab;
                        const count = tab === "ACTIVE" ? allocationCounts.active : allocationCounts.ended;
                        const selectedClassName = tab === "ACTIVE"
                            ? "border-[color:var(--ui-badge-success-border)] bg-[color:var(--ui-badge-success-bg)] text-[color:var(--ui-badge-success-text)]"
                            : "border-[color:var(--ui-badge-default-border)] bg-[color:var(--ui-badge-default-bg)] text-[color:var(--ui-badge-default-text)]";
                        const dotClassName = tab === "ACTIVE"
                            ? "bg-[color:var(--ui-badge-success-text)]"
                            : "bg-[color:var(--ui-badge-default-text)]";

                        return (
                            <button
                                type="button"
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                aria-pressed={active}
                                className={cn(
                                    "inline-flex h-9 cursor-pointer items-center gap-2 whitespace-nowrap rounded-[var(--ui-radius-control)] border px-3 text-sm font-medium transition-colors",
                                    active ? selectedClassName : "border-transparent text-[color:var(--text-secondary)] hover:bg-[color:var(--ui-form-surface-hover-bg)] hover:text-[color:var(--text-primary)]"
                                )}
                            >
                                {active && <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", dotClassName)} />}
                                {tab === "ACTIVE" ? "Active" : "Ended"}
                                <span className={pageCountBadgeClass}>{count}</span>
                            </button>
                        );
                    })}
                </div>

                <ViewToggle value={viewMode} onChange={setViewMode} className="hidden md:inline-flex" />
            </div>

            {filteredAllocations.length === 0 ? (
                <div className={pageEmptyStateClass}>
                    <Users size={34} className="mb-4 opacity-60" />
                    <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">
                        No {activeTab === "ACTIVE" ? "active" : "ended"} allocations
                    </h2>
                    <p className={cn("mt-2 max-w-md text-sm", pageMutedTextClass)}>
                        {activeTab === "ACTIVE"
                            ? "No seats are currently allocated. Assign a student to a seat when they are ready to start."
                            : "Ended allocations will appear here after seats are released."}
                    </p>
                    {activeTab === "ACTIVE" && (
                        <AppButton className="mt-5" variant="primary" icon={UserPlus} onClick={() => setIsDialogOpen(true)}>
                            Allocate seat
                        </AppButton>
                    )}
                </div>
            ) : (
                <AllocationsTable
                    allocations={filteredAllocations}
                    viewMode={viewMode}
                    onEndAllocation={handleEndAllocation}
                    onUpdateAllocation={(ids, studentId, studentName, currentSeatId, currentFee, currentShiftIds, currentMultiShiftId) =>
                        setUpdateTarget({ ids, studentId, studentName, currentSeatId, currentFee, currentShiftIds, currentMultiShiftId })
                    }
                    isEndedTab={activeTab === "ENDED"}
                />
            )}

            <AllocateSeatDialog
                branchId={branchId}
                isOpen={isDialogOpen}
                preselectedStudentId={preselectedStudentId}
                preselectedStudentName={preselectedStudentName}
                onClose={handleClose}
                onSuccess={() => {
                    fetchAllocations();
                    handleClose();
                }}
            />

            {/* Update (change seat/shift) dialog */}
            {updateTarget && (
                <UpdateAllocationDialog
                    isOpen={!!updateTarget}
                    branchId={branchId}
                    allocationId={updateTarget.ids[0]}
                    allocationIds={updateTarget.ids}
                    studentId={updateTarget.studentId}
                    studentName={updateTarget.studentName}
                    currentSeatId={updateTarget.currentSeatId}
                    currentFee={updateTarget.currentFee}
                    currentShiftIds={updateTarget.currentShiftIds}
                    currentMultiShiftId={updateTarget.currentMultiShiftId}
                    onClose={() => setUpdateTarget(null)}
                    onSuccess={() => {
                        fetchAllocations();
                        setUpdateTarget(null);
                    }}
                />
            )}
        </PageShell>
    );
}

function AllocationMetric({
    icon: Icon,
    label,
    value,
    detail,
    tone,
}: {
    icon: ComponentType<{ size?: number; className?: string }>;
    label: string;
    value: number;
    detail: string;
    tone: "success" | "neutral" | "info";
}) {
    const toneClass = tone === "success"
        ? "text-[color:var(--ui-tone-success-text)]"
        : tone === "info"
            ? "text-[color:var(--ui-tone-info-text)]"
            : "text-[color:var(--text-primary)]";

    return (
        <div className={cn("flex items-start gap-3", pageInsetMetricClass)}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--ui-radius-control)] bg-[color:var(--ui-form-muted-surface-bg)]">
                <Icon size={17} className={toneClass} />
            </div>
            <div className="min-w-0">
                <p className={cn("text-xs font-medium uppercase tracking-wide", pageSubtleTextClass)}>{label}</p>
                <p className={cn("mt-1 text-2xl font-semibold tracking-tight", toneClass)}>{value}</p>
                <p className={cn("mt-1 text-xs", pageMutedTextClass)}>{detail}</p>
            </div>
        </div>
    );
}
