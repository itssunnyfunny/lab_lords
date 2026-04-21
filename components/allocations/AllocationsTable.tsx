"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Layers } from "lucide-react";

interface Allocation {
    id: string;
    student: { name: string; status: string };
    seat: { label: string };
    shift: { name: string; isReserved: boolean };
    startDate: string;
    endDate: string | null;
    multiShiftId?: string | null;
    multiShift?: { id: string; name: string } | null;
}

interface AllocationsTableProps {
    allocations: Allocation[];
    onEndAllocation: (allocationIds: string | string[]) => Promise<void>;
    isEndedTab?: boolean;
}

interface GroupedAllocation {
    isMulti: boolean;
    id: string; // main key
    ids: string[]; // all ids
    student: { name: string; status: string };
    seat: { label: string };
    startDate: string;
    endDate: string | null;
    shiftName: string; // for primary
    multiShiftId?: string | null;
    multiShiftName?: string; // for multi
    componentShiftNames?: string[]; // for multi
}

export function AllocationsTable({ allocations, onEndAllocation, isEndedTab = false }: AllocationsTableProps) {
    const [endingIds, setEndingIds] = useState<string[] | null>(null);
    const [confirmIds, setConfirmIds] = useState<string[] | null>(null);

    const handleEndClick = (ids: string[]) => {
        setConfirmIds(ids);
    };

    const confirmEnd = async () => {
        if (!confirmIds || confirmIds.length === 0) return;
        setEndingIds(confirmIds);
        try {
            await onEndAllocation(confirmIds);
            setConfirmIds(null);
        } finally {
            setEndingIds(null);
        }
    };

    const grouped = new Map<string, GroupedAllocation>();
    const result: GroupedAllocation[] = [];

    allocations.forEach(alloc => {
        const isActive = !alloc.endDate;
        if (alloc.multiShiftId || alloc.multiShift) {
            const msId = alloc.multiShiftId || alloc.multiShift?.id;
            const msName = alloc.multiShift?.name || "MULTI-SHIFT";
            const key = `${msId}-${alloc.student.name}-${alloc.seat.label}-${isActive}`;
            if (grouped.has(key)) {
                const group = grouped.get(key)!;
                group.ids.push(alloc.id);
                group.componentShiftNames!.push(alloc.shift.name);
            } else {
                const group: GroupedAllocation = {
                    isMulti: true,
                    id: alloc.id,
                    ids: [alloc.id],
                    student: alloc.student,
                    seat: alloc.seat,
                    startDate: alloc.startDate,
                    endDate: alloc.endDate,
                    shiftName: alloc.shift.name,
                    multiShiftName: msName,
                    componentShiftNames: [alloc.shift.name],
                };
                grouped.set(key, group);
                result.push(group);
            }
        } else {
            result.push({
                isMulti: false,
                id: alloc.id,
                ids: [alloc.id],
                student: alloc.student,
                seat: alloc.seat,
                startDate: alloc.startDate,
                endDate: alloc.endDate,
                shiftName: alloc.shift.name,
            });
        }
    });

    // Sort: Active first, then by date desc
    const sorted = result.sort((a, b) => {
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
                        {!isEndedTab && <th className="px-6 py-4 font-medium">Actions</th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {sorted.map((alloc) => {
                        const isActive = !alloc.endDate;
                        const isMulti = alloc.isMulti;

                        return (
                            <tr key={alloc.id} className="group hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4 font-medium text-zinc-200">
                                    {alloc.student.name}
                                </td>
                                <td className="px-6 py-4 text-zinc-400">
                                    {alloc.seat.label}
                                </td>
                                <td className="px-6 py-4">
                                    {isMulti ? (
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center gap-2">
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/20">
                                                    <Layers size={9} /> MULTI-SHIFT
                                                </span>
                                                <span className="text-sm font-semibold text-zinc-100">{alloc.multiShiftName}</span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                {alloc.componentShiftNames?.map((name, i) => (
                                                    <span 
                                                        key={i} 
                                                        className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-zinc-800/80 border border-white/10 text-zinc-300 shadow-sm"
                                                    >
                                                        {name}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/20">
                                                PRIMARY
                                            </span>
                                            <span className="text-sm font-medium text-zinc-200">{alloc.shiftName}</span>
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-zinc-400">
                                    {format(new Date(alloc.startDate), "PP")}
                                </td>
                                <td className="px-6 py-4">
                                    {isActive ? (
                                        <Badge variant="success">Active</Badge>
                                    ) : (
                                        <div className="flex flex-col gap-1">
                                            <Badge variant="default">Ended</Badge>
                                            <span className="text-[10px] text-zinc-500">{alloc.endDate ? format(new Date(alloc.endDate), "PP") : ""}</span>
                                        </div>
                                    )}
                                </td>
                                {!isEndedTab && (
                                    <td className="px-6 py-4">
                                        {isActive && (
                                            <Button
                                                variant="danger"
                                                onClick={() => handleEndClick(alloc.ids)}
                                                isLoading={endingIds?.includes(alloc.id)}
                                                className="text-xs px-2 py-1 h-auto"
                                            >
                                                End
                                            </Button>
                                        )}
                                    </td>
                                )}
                            </tr>
                        );
                    })}
                    {sorted.length === 0 && (
                        <tr>
                            <td colSpan={isEndedTab ? 5 : 6} className="px-6 py-8 text-center text-zinc-500">
                                No allocations found.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>

            <ConfirmDialog
                isOpen={!!confirmIds}
                onClose={() => setConfirmIds(null)}
                onConfirm={confirmEnd}
                title="End Seat Allocation"
                description={confirmIds && confirmIds.length > 1 ? "Are you sure you want to end this multi-shift allocation? All attached shifts will be freed." : "Are you sure you want to end this seat allocation? This will free the seat for future use."}
                confirmText="End Allocation"
                variant="danger"
                loading={!!endingIds}
            />
        </Card>
    );
}
