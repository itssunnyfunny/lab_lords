"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { AllocationsTable } from "@/components/allocations/AllocationsTable";
import { AllocateSeatDialog } from "@/components/allocations/AllocateSeatDialog";
import { EmptyState } from "@/components/ui/EmptyState";

export default function AllocationsPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const branchId = params?.branchId as string;

    const [allocations, setAllocations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<"ACTIVE" | "ENDED">("ACTIVE");

    // Optional: pre-selected student passed via query param from students page
    const preselectedStudentId = searchParams.get("studentId") ?? undefined;
    const preselectedStudentName = searchParams.get("studentName") ?? undefined;

    // Auto-open dialog when navigated from students page with ?studentId=...
    useEffect(() => {
        if (preselectedStudentId) {
            setIsDialogOpen(true);
        }
    }, [preselectedStudentId]);

    const fetchAllocations = async () => {
        try {
            const res = await fetch(`/api/branches/${branchId}/seat-allocations`);
            if (!res.ok) throw new Error("Failed to load allocations");
            const data = await res.json();
            setAllocations(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!branchId) return;
        fetchAllocations();
    }, [branchId]);

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

    if (loading) return <div className="p-8 text-zinc-400">Loading allocations...</div>;
    if (error) return <div className="p-8 text-red-500">Error: {error}</div>;

    const filteredAllocations = allocations.filter(alloc => 
        activeTab === "ACTIVE" ? !alloc.endDate : !!alloc.endDate
    );

    return (
        <div className="p-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-white">Seat Allocations</h1>
                    <p className="text-zinc-400 mt-1">Manage student seat assignments</p>
                </div>
                <Button onClick={() => setIsDialogOpen(true)}>+ Allocate Seat</Button>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-end gap-4 border-b border-white/10 pb-4">
                <div className="flex items-center gap-2">
                    {(["ACTIVE", "ENDED"] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                                activeTab === tab
                                    ? "border-indigo-500 text-indigo-400"
                                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                            }`}
                        >
                            {tab === "ACTIVE" ? "Active" : "Ended"} Allocations
                            <span className="ml-2 bg-white/10 text-white px-2 py-0.5 rounded-full text-xs">
                                {allocations.filter(a => tab === "ACTIVE" ? !a.endDate : !!a.endDate).length}
                            </span>
                        </button>
                    ))}
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
                    onEndAllocation={handleEndAllocation}
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
        </div>
    );
}
