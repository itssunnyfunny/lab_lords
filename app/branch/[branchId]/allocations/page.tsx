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

    const [allocations, setAllocations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

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

    const handleEndAllocation = async (id: string) => {
        const res = await fetch(`/api/seat-allocations/${id}/end`, {
            method: "POST",
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Failed to end allocation");
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

    return (
        <div className="p-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-white">Seat Allocations</h1>
                    <p className="text-zinc-400">Manage student seat assignments</p>
                </div>
                <Button onClick={() => setIsDialogOpen(true)}>+ Allocate Seat</Button>
            </div>

            {allocations.length === 0 ? (
                <EmptyState
                    title="No Allocations"
                    description="No seats are currently allocated. Use Allocate Seat to assign students to seats."
                    actionScript={<Button onClick={() => setIsDialogOpen(true)}>Allocate Seat</Button>}
                />
            ) : (
                <AllocationsTable
                    allocations={allocations}
                    onEndAllocation={handleEndAllocation}
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
