"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { User, Loader2 } from "lucide-react";
import { useEffect, useState, use } from "react";
import { branches } from "@/lib/api/branches";
import { Seat } from "@prisma/client";

// Extended Seat type to include temporary allocation info if available
// Or we might need to fetch allocations separately. 
// For now, assuming seat list might return some status or we default to Available.
// The raw Seat model has: id, label. It doesn't have status directly unless joined.
// The `listSeats` service method might include allocations.
// Let's assume for this step we display what we have, and if status is missing, we default to "Available" 
// or fetch allocations in parallel if needed.
// Checking `branches.getSeats`, it returns `Seat[]`.
// Use `any` for seat temporarily to check if it has extra props from backend join.
interface SeatWithStatus extends Seat {
    status?: "Occupied" | "Available" | "Maintenance";
    studentName?: string;
}

export default function SeatsPage({ params }: { params: Promise<{ branchId: string }> }) {
    const { branchId } = use(params);
    const [seats, setSeats] = useState<SeatWithStatus[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadSeats = async () => {
            try {
                const data = await branches.getSeats(branchId);
                // Data mapping: if the backend returns just Seat (id, label), we don't know status.
                // We'll mark as Available for now unless we fetch allocations.
                // TODO: Enhance backend to return status or fetch allocations here.
                // For valid display, we map them.
                const mapped = data.map((s: any) => ({
                    ...s,
                    status: s.seatAllocations && s.seatAllocations.length > 0 ? "Occupied" : "Available",
                    studentName: s.seatAllocations && s.seatAllocations.length > 0 ? s.seatAllocations[0].student.name : undefined
                }));
                setSeats(mapped);
            } catch (error) {
                console.error("Failed to load seats", error);
            } finally {
                setLoading(false);
            }
        };
        loadSeats();
    }, [branchId]);

    if (loading) {
        return <div className="p-8 flex items-center justify-center text-white"><Loader2 className="animate-spin mr-2" /> Loading seats...</div>;
    }

    return (
        <div className="p-8">
            <PageHeader
                title="Seat Management"
                subtitle="Visual map of study hall occupancy."
                onFilter={() => { }}
                onAdd={() => { }}
                actionLabel="Add Seat"
            />

            {/* Legend */}
            <div className="flex gap-6 mb-6 text-sm text-textSecondary">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/50" /> Occupied
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-slate-500/20 border border-slate-500/50" /> Available
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-rose-500/20 border border-rose-500/50" /> Maintenance
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {seats.length === 0 ? <div className="col-span-full text-gray-500">No seats found.</div> :
                    seats.map((seat) => (
                        <Card
                            key={seat.id}
                            className={cn(
                                "p-4 flex flex-col items-center justify-center min-h-[140px] cursor-pointer transition-all hover:scale-105 hover:shadow-glow",
                                seat.status === "Occupied" && "border-emerald-500/20 bg-emerald-500/[0.02]",
                                seat.status === "Available" && "border-dashed opacity-70 hover:opacity-100",
                                seat.status === "Maintenance" && "border-rose-500/20 bg-rose-500/[0.02] opacity-80"
                            )}
                        >
                            <div className="text-xl font-bold text-white mb-2">{seat.label}</div>

                            {seat.status === "Occupied" ? (
                                <div className="text-center">
                                    <div className="w-8 h-8 mx-auto bg-emerald-500/20 rounded-full flex items-center justify-center mb-2">
                                        <User size={14} className="text-emerald-400" />
                                    </div>
                                    <p className="text-xs text-emerald-400 font-medium truncate w-24">
                                        {seat.studentName || "Student"}
                                    </p>
                                </div>
                            ) : seat.status === "Available" ? (
                                <span className="text-xs text-textMuted">Open</span>
                            ) : (
                                <span className="text-xs text-rose-400">Maintenance</span>
                            )}
                        </Card>
                    ))}
            </div>
        </div>
    );
}

