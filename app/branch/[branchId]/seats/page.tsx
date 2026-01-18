"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { User, Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import { useEffect, useState, use } from "react";
import { branches } from "@/lib/api/branches";
import { Seat, Shift } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";

// Extended Seat type to include temporary allocation info if available
interface SeatWithStatus extends Seat {
    status?: "Occupied" | "Available" | "Maintenance";
    studentName?: string;
}

export default function SeatsPage({ params }: { params: Promise<{ branchId: string }> }) {
    const { branchId } = use(params);
    const router = useRouter();
    const [seats, setSeats] = useState<SeatWithStatus[]>([]);
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [selectedShift, setSelectedShift] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Initial load of shifts
    useEffect(() => {
        const loadShifts = async () => {
            try {
                const shiftsData = await branches.getShifts(branchId);
                setShifts(shiftsData);
            } catch (err) {
                console.error("Failed to load shifts", err);
            }
        };
        loadShifts();
    }, [branchId]);

    // Load seats whenever branchId or selectedShift changes
    useEffect(() => {
        const loadSeats = async () => {
            setLoading(true);
            try {
                // Fetch seats with optional shift filter
                // If selectedShift is empty, it returns seats with ALL active allocations
                // If selectedShift is set, it returns seats with allocations ONLY for that shift
                const data = await branches.getSeats(branchId, selectedShift || undefined);

                const mapped = data.map((s: any) => ({
                    ...s,
                    // If any allocation exists (after backend filtering), it is Occupied
                    status: s.seatAllocations && s.seatAllocations.length > 0 ? "Occupied" : "Available",
                    studentName: s.seatAllocations && s.seatAllocations.length > 0 ? s.seatAllocations[0].student.name : undefined
                }));
                setSeats(mapped);
            } catch (err: any) {
                console.error("Failed to load seats", err);
                if (err.message?.includes("Branch not found") || err.response?.status === 404) {
                    setError("Branch not found. Matches no existing records.");
                } else {
                    setError("Failed to load seats.");
                }
            } finally {
                setLoading(false);
            }
        };
        loadSeats();
    }, [branchId, selectedShift]);

    if (loading) {
        return <div className="p-8 flex items-center justify-center text-white"><Loader2 className="animate-spin mr-2" /> Loading seats...</div>;
    }

    if (error) {
        return (
            <div className="p-8 flex flex-col items-center justify-center text-white h-[50vh] space-y-4">
                <AlertCircle className="w-12 h-12 text-red-400 opacity-80" />
                <h2 className="text-xl font-semibold">Something went wrong</h2>
                <p className="text-gray-400">{error}</p>
                <Button variant="outline" onClick={() => router.push("/org")}>
                    <ArrowLeft size={16} className="mr-2" />
                    Back to Workspace
                </Button>
            </div>
        );
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

            {/* Controls & Legend */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                {/* Shift Filter */}
                <div className="flex items-center gap-3">
                    <span className="text-sm text-textMuted">Filter by Shift:</span>
                    <select
                        className="bg-surface border border-white/10 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary/50"
                        value={selectedShift}
                        onChange={(e) => setSelectedShift(e.target.value)}
                    >
                        <option value="" className="bg-zinc-900">All Shifts</option>
                        {shifts.map((s) => (
                            <option key={s.id} value={s.id} className="bg-zinc-900">
                                {s.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Legend */}
                <div className="flex gap-6 text-sm text-textSecondary">
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
