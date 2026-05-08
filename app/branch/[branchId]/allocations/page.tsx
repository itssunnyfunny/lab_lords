"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { BranchAccessGuard } from "@/components/auth/BranchAccessGuard";
import { AllocationsTable } from "@/components/allocations/AllocationsTable";
import { AllocateSeatDialog } from "@/components/allocations/AllocateSeatDialog";
import { UpdateAllocationDialog } from "@/components/allocations/UpdateAllocationDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { BRANCH_PAGE_ACCESS } from "@/lib/branchPageAccess";
import { ViewToggle } from "@/components/tables/ViewToggle";
import { useDataViewMode } from "@/hooks/useDataViewMode";

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
    const [activeTab, setActiveTab] = useState<"ACTIVE" | "ENDED">("ACTIVE");
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

    if (loading) return <div className="p-4 md:p-8 text-zinc-400">Loading allocations...</div>;
    if (error) return <div className="p-4 md:p-8 text-red-500">Error: {error}</div>;

    const filteredAllocations = allocations.filter(alloc => 
        activeTab === "ACTIVE" ? !alloc.endDate : !!alloc.endDate
    );

    return (
        <div className="p-4 md:p-8 space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-white">Seat Allocations</h1>
                    <p className="text-zinc-400 mt-1">Manage student seat assignments</p>
                </div>
                <Button onClick={() => setIsDialogOpen(true)}>+ Allocate Seat</Button>
            </div>

            <div className="flex flex-col gap-3 border-b border-white/10 pb-4 md:flex-row md:items-center md:justify-end">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                    <div className="flex items-center gap-2">
                        {(["ACTIVE", "ENDED"] as const).map(tab => {
                            const active = activeTab === tab;
                            const selectedClassName = tab === "ACTIVE"
                                ? "border-cyan-500 bg-cyan-500/5 text-cyan-400"
                                : "border-slate-500 bg-slate-500/5 text-slate-300";
                            const dotClassName = tab === "ACTIVE"
                                ? "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.65)]"
                                : "bg-slate-300 shadow-[0_0_8px_rgba(203,213,225,0.35)]";

                            return (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    aria-current={active ? "page" : undefined}
                                    className={`inline-flex items-center gap-2 rounded-t-md px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                                        active
                                            ? selectedClassName
                                            : "border-transparent text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200"
                                    }`}
                                >
                                    {active && <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dotClassName}`} />}
                                    {tab === "ACTIVE" ? "Active" : "Ended"} Allocations
                                    <span className="bg-white/10 text-white px-2 py-0.5 rounded-full text-xs">
                                        {allocations.filter(a => tab === "ACTIVE" ? !a.endDate : !!a.endDate).length}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <ViewToggle value={viewMode} onChange={setViewMode} className="hidden md:inline-flex" />
                </div>
            </div>

            {filteredAllocations.length === 0 ? (
                <EmptyState
                    title={`No ${activeTab === "ACTIVE" ? "Active" : "Ended"} Allocations`}
                    description={
                        activeTab === "ACTIVE" 
                            ? "No seats are currently allocated. Use Allocate Seat to assign students to seats."
                            : "No ended allocations found."
                    }
                    actionScript={activeTab === "ACTIVE" ? <Button onClick={() => setIsDialogOpen(true)}>Allocate Seat</Button> : undefined}
                />
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
        </div>
    );
}
