"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface Allocation {
    id: string;
    student: { name: string; status: string };
    seat: { label: string };
    shift: { name: string; isReserved: boolean };
    startDate: string;
    endDate: string | null;
}

interface AllocationsTableProps {
    allocations: Allocation[];
    onEndAllocation: (allocationId: string) => Promise<void>;
}

export function AllocationsTable({ allocations, onEndAllocation }: AllocationsTableProps) {
    const [endingId, setEndingId] = useState<string | null>(null);

    const handleEndClick = async (id: string) => {
        if (!confirm("End this seat allocation? This will free the seat for future use.")) return;
        setEndingId(id);
        try {
            await onEndAllocation(id);
        } finally {
            setEndingId(null);
        }
    };

    // Sort: Active first, then by date desc
    const sorted = [...allocations].sort((a, b) => {
        const aActive = !a.endDate;
        const bActive = !b.endDate;
        if (aActive && !bActive) return -1;
        if (!aActive && bActive) return 1;
        return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
    });

    return (
        <Card className="overflow-hidden">
            <table className="w-full text-left text-sm">
                <thead>
                    <tr className="border-b border-white/5 bg-white/5 text-zinc-400">
                        <th className="px-6 py-4 font-medium">Student</th>
                        <th className="px-6 py-4 font-medium">Seat</th>
                        <th className="px-6 py-4 font-medium">Shift</th>
                        <th className="px-6 py-4 font-medium">Start Date</th>
                        <th className="px-6 py-4 font-medium">Status</th>
                        <th className="px-6 py-4 font-medium">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {sorted.map((alloc) => {
                        const isActive = !alloc.endDate;
                        return (
                            <tr key={alloc.id} className="group hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4 font-medium text-zinc-200">
                                    {alloc.student.name}
                                </td>
                                <td className="px-6 py-4 text-zinc-400">
                                    {alloc.seat.label}
                                </td>
                                <td className="px-6 py-4">
                                    {alloc.shift.isReserved ? (
                                        <Badge variant="purple">{alloc.shift.name}</Badge>
                                    ) : (
                                        <span className="text-zinc-400">{alloc.shift.name}</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-zinc-400">
                                    {format(new Date(alloc.startDate), "PP")}
                                </td>
                                <td className="px-6 py-4">
                                    {isActive ? (
                                        <Badge variant="success">Active</Badge>
                                    ) : (
                                        <Badge variant="default">Ended</Badge>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    {isActive && (
                                        <Button
                                            variant="danger" // Assuming danger variant exists or use outline-red style
                                            // Since Button variant prop might be limited, let's check or use standard small button
                                            // The Badge error earlier showed "danger" as valid.
                                            onClick={() => handleEndClick(alloc.id)}
                                            isLoading={endingId === alloc.id}
                                            className="text-xs px-2 py-1 h-auto"
                                        >
                                            End
                                        </Button>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                    {sorted.length === 0 && (
                        <tr>
                            <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">
                                No allocations found.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </Card>
    );
}
