"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Layers, Pencil } from "lucide-react";
import type { DataViewMode } from "@/components/tables/DataTable";

interface Allocation {
    id: string;
    studentId: string;
    student: { name: string; status: string; monthlyFee?: number | null };
    seat: { id: string; label: string };
    shiftId: string;
    shift: { name: string; isReserved: boolean };
    startDate: string;
    endDate: string | null;
    multiShiftId?: string | null;
    multiShift?: { id: string; name: string } | null;
}

interface AllocationsTableProps {
    allocations: Allocation[];
    viewMode?: DataViewMode;
    onEndAllocation: (allocationIds: string | string[]) => Promise<void>;
    onUpdateAllocation?: (ids: string[], studentId: string, studentName: string, currentSeatId: string, currentFee: number | null, currentShiftIds: string[], currentMultiShiftId: string | null) => void;
    isEndedTab?: boolean;
}

interface GroupedAllocation {
    isMulti: boolean;
    id: string; // main key
    ids: string[]; // all ids
    studentId: string;
    student: { name: string; status: string; monthlyFee?: number | null };
    seat: { id: string; label: string };
    startDate: string;
    endDate: string | null;
    shiftName: string; // for primary
    shiftIds: string[]; // for all shifts involved
    multiShiftId?: string | null;
    multiShiftName?: string; // for multi
    componentShiftNames?: string[]; // for multi
}

export function AllocationsTable({ allocations, viewMode = "table", onEndAllocation, onUpdateAllocation, isEndedTab = false }: AllocationsTableProps) {
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
                group.shiftIds.push(alloc.shiftId);
                group.componentShiftNames!.push(alloc.shift.name);
            } else {
                const group: GroupedAllocation = {
                    isMulti: true,
                    id: alloc.id,
                    ids: [alloc.id],
                    studentId: alloc.studentId,
                    student: alloc.student,
                    seat: alloc.seat,
                    startDate: alloc.startDate,
                    endDate: alloc.endDate,
                    shiftName: alloc.shift.name,
                    shiftIds: [alloc.shiftId],
                    multiShiftName: msName,
                    multiShiftId: msId,
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
                studentId: alloc.studentId,
                student: alloc.student,
                seat: alloc.seat,
                startDate: alloc.startDate,
                endDate: alloc.endDate,
                shiftName: alloc.shift.name,
                shiftIds: [alloc.shiftId],
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

    const renderShiftSummary = (alloc: GroupedAllocation) => {
        if (alloc.isMulti) {
            return (
                <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full border border-orange-500/20 bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-orange-300">
                            <Layers size={9} /> MULTI-SHIFT
                        </span>
                        <span className="text-sm font-semibold text-zinc-100">{alloc.multiShiftName}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                        {alloc.componentShiftNames?.map((name, i) => (
                            <span
                                key={i}
                                className="rounded-md border border-white/10 bg-zinc-800/80 px-2 py-0.5 text-[11px] font-medium text-zinc-300 shadow-sm"
                            >
                                {name}
                            </span>
                        ))}
                    </div>
                </div>
            );
        }

        return (
            <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-yellow-500/20 bg-yellow-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-yellow-300">
                    PRIMARY
                </span>
                <span className="text-sm font-medium text-zinc-200">{alloc.shiftName}</span>
            </div>
        );
    };

    const renderAllocationStatus = (alloc: GroupedAllocation) => (
        !alloc.endDate ? (
            <Badge variant="success">Active</Badge>
        ) : (
            <div className="flex flex-col items-start gap-1">
                <Badge variant="default">Ended</Badge>
                <span className="text-[10px] text-zinc-500">{format(new Date(alloc.endDate), "PP")}</span>
            </div>
        )
    );

    const renderAllocationActions = (alloc: GroupedAllocation) => {
        if (isEndedTab || alloc.endDate) return null;

        return (
            <div className="flex flex-wrap items-center gap-2">
                {onUpdateAllocation && (
                    <button
                        onClick={() => onUpdateAllocation(alloc.ids, alloc.studentId, alloc.student.name, alloc.seat.id, alloc.student.monthlyFee ?? null, alloc.shiftIds, alloc.multiShiftId ?? null)}
                        className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-300 transition-all hover:bg-white/10 hover:text-white"
                        title="Change seat / shift"
                    >
                        <Pencil size={11} />
                        Change
                    </button>
                )}
                <Button
                    variant="danger"
                    onClick={() => handleEndClick(alloc.ids)}
                    isLoading={endingIds?.some(id => alloc.ids.includes(id))}
                    className="h-auto px-2 py-1 text-xs"
                >
                    End
                </Button>
            </div>
        );
    };

    const allocationCards = (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {sorted.map((alloc) => {
                const actions = renderAllocationActions(alloc);

                return (
                    <div
                        key={alloc.id}
                        className="relative flex min-h-[250px] flex-col rounded-[var(--ui-table-radius)] border border-[color:var(--ui-table-border)] bg-[color:var(--ui-table-bg)] p-4 shadow-[var(--ui-table-shadow)] transition-colors hover:border-[color:var(--ui-button-secondary-hover-border)] hover:bg-[color:var(--ui-table-row-hover-bg)]"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="truncate font-medium text-[color:var(--ui-table-text)]">{alloc.student.name}</p>
                                <p className="mt-1 text-xs text-[color:var(--ui-table-subtle)]">Student assignment</p>
                            </div>
                            <div className="flex-shrink-0">{renderAllocationStatus(alloc)}</div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                            <div className="rounded-[var(--ui-radius-control)] border border-[color:var(--ui-card-border)] bg-[color:var(--ui-table-cell-bg)] p-3">
                                <div className="text-xs text-[color:var(--ui-table-subtle)]">Seat</div>
                                <div className="mt-1 truncate font-semibold text-[color:var(--ui-table-text)]">{alloc.seat.label}</div>
                            </div>
                            <div className="rounded-[var(--ui-radius-control)] border border-[color:var(--ui-card-border)] bg-[color:var(--ui-table-cell-bg)] p-3">
                                <div className="text-xs text-[color:var(--ui-table-subtle)]">Start Date</div>
                                <div className="mt-1 truncate text-[color:var(--ui-table-muted)]">{format(new Date(alloc.startDate), "PP")}</div>
                            </div>
                        </div>

                        <div className="mt-3 rounded-[var(--ui-radius-control)] border border-[color:var(--ui-card-border)] bg-[color:var(--ui-table-cell-bg)] p-3">
                            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-[color:var(--ui-table-subtle)]">Shift</div>
                            {renderShiftSummary(alloc)}
                        </div>

                        {actions && (
                            <div className="mt-auto border-t border-[color:var(--ui-table-divider)] pt-4">
                                {actions}
                            </div>
                        )}
                    </div>
                );
            })}

            {sorted.length === 0 && (
                <div className="col-span-full rounded-[var(--ui-table-radius)] border border-dashed border-[color:var(--ui-table-empty-border)] py-12 text-center text-[color:var(--ui-table-subtle)]">
                    No allocations found.
                </div>
            )}
        </div>
    );

    const confirmDialog = (
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
    );

    if (viewMode === "grid") {
        return (
            <>
                {allocationCards}
                {confirmDialog}
            </>
        );
    }

    return (
        <>
            <div className="md:hidden">{allocationCards}</div>
            <Card noHover className="hidden overflow-hidden p-0 md:block md:p-0">
            <div className="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            <table className="w-full min-w-[58rem] text-left text-sm">
                <thead>
                    <tr className="border-b border-[color:var(--ui-table-divider)] bg-[color:var(--ui-table-head-bg)] text-[color:var(--ui-table-muted)]">
                        <th className="px-6 py-4 font-medium">Student</th>
                        <th className="px-6 py-4 font-medium">Seat</th>
                        <th className="px-6 py-4 font-medium">Shift</th>
                        <th className="px-6 py-4 font-medium">Start Date</th>
                        <th className="px-6 py-4 font-medium">Status</th>
                        {!isEndedTab && <th className="px-6 py-4 font-medium">Actions</th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--ui-table-divider)]">
                    {sorted.map((alloc) => {
                        const isActive = !alloc.endDate;
                        const isMulti = alloc.isMulti;

                        return (
                            <tr key={alloc.id} className="group transition-colors hover:bg-[color:var(--ui-table-row-hover-bg)]">
                                <td className="px-6 py-4 font-medium text-[color:var(--ui-table-text)]">
                                    {alloc.student.name}
                                </td>
                                <td className="px-6 py-4 text-[color:var(--ui-table-muted)]">
                                    {alloc.seat.label}
                                </td>
                                <td className="px-6 py-4">
                                    {isMulti ? (
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center gap-2">
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/20">
                                                    <Layers size={9} /> MULTI-SHIFT
                                                </span>
                                                <span className="text-sm font-semibold text-[color:var(--ui-table-text)]">{alloc.multiShiftName}</span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                {alloc.componentShiftNames?.map((name, i) => (
                                                    <span 
                                                        key={i} 
                                                        className="rounded-md border border-[color:var(--ui-table-border)] bg-[color:var(--ui-table-action-bg)] px-2 py-0.5 text-[11px] font-medium text-[color:var(--ui-table-muted)] shadow-sm"
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
                                            <span className="text-sm font-medium text-[color:var(--ui-table-text)]">{alloc.shiftName}</span>
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-[color:var(--ui-table-muted)]">
                                    {format(new Date(alloc.startDate), "PP")}
                                </td>
                                <td className="px-6 py-4">
                                    {isActive ? (
                                        <Badge variant="success">Active</Badge>
                                    ) : (
                                        <div className="flex flex-col gap-1">
                                            <Badge variant="default">Ended</Badge>
                                            <span className="text-[10px] text-[color:var(--ui-table-subtle)]">{alloc.endDate ? format(new Date(alloc.endDate), "PP") : ""}</span>
                                        </div>
                                    )}
                                </td>
                                {!isEndedTab && (
                                    <td className="px-6 py-4">
                                        {isActive && (
                                            <div className="flex items-center gap-2">
                                                {onUpdateAllocation && (
                                                    <button
                                                        onClick={() => onUpdateAllocation(alloc.ids, alloc.studentId, alloc.student.name, alloc.seat.id, alloc.student.monthlyFee ?? null, alloc.shiftIds, alloc.multiShiftId ?? null)}
                                                        className="inline-flex items-center gap-1 rounded-md border border-[color:var(--ui-table-border)] bg-[color:var(--ui-table-action-bg)] px-2 py-1 text-xs text-[color:var(--ui-table-action-text)] transition-all hover:bg-[color:var(--ui-table-action-hover-bg)] hover:text-[color:var(--ui-table-action-hover-text)]"
                                                        title="Change seat / shift"
                                                    >
                                                        <Pencil size={11} />
                                                        Change
                                                    </button>
                                                )}
                                                <Button
                                                    variant="danger"
                                                    onClick={() => handleEndClick(alloc.ids)}
                                                    isLoading={endingIds?.includes(alloc.id)}
                                                    className="text-xs px-2 py-1 h-auto"
                                                >
                                                    End
                                                </Button>
                                            </div>
                                        )}
                                    </td>
                                )}
                            </tr>
                        );
                    })}
                    {sorted.length === 0 && (
                        <tr>
                            <td colSpan={isEndedTab ? 5 : 6} className="px-6 py-8 text-center text-[color:var(--ui-table-subtle)]">
                                No allocations found.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
            </div>
            </Card>
            {confirmDialog}
        </>
    );
}
