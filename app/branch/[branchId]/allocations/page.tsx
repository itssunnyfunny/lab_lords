"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { AllocationsTable } from "@/components/allocations/AllocationsTable";
import { AllocateSeatModal } from "@/components/allocations/AllocateSeatModal";
import { EmptyState } from "@/components/ui/EmptyState";

export default function AllocationsPage() {
    const params = useParams();
    const branchId = params?.branchId as string;
    const [allocations, setAllocations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

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
        // Refresh list
        await fetchAllocations();
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
                <Button onClick={() => setIsModalOpen(true)}>+ Allocate Seat</Button>
            </div>

            {allocations.length === 0 ? (
                <EmptyState
                    title="No Allocations"
                    description="No seats are currently allocated."
                    actionScript={<Button onClick={() => setIsModalOpen(true)}>Allocate Seat</Button>}
                />
            ) : (
                <AllocationsTable
                    allocations={allocations}
                    onEndAllocation={handleEndAllocation}
                />
            )}

            <AllocateSeatModal
                branchId={branchId}
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={fetchAllocations}
            />
        </div>
    );
}
