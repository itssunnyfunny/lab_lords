"use client";

import { BranchAccessGuard } from "@/components/auth/BranchAccessGuard";
import { Badge } from "@/components/ui/Badge";
import { AppButton, AppPanel, PageShell } from "@/components/ui";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ViewToggle } from "@/components/tables/ViewToggle";
import type { DataViewMode } from "@/components/tables/DataTable";
import { cn } from "@/lib/utils";
import {
    AlertCircle,
    Armchair,
    ArrowLeft,
    CalendarClock,
    Clock,
    Loader2,
    LogOut,
    RefreshCw,
    Search,
    SearchX,
    User,
    UserPlus,
    X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, use } from "react";
import { branches } from "@/lib/api/branches";
import type { Shift } from "@/app/generated/prisma/browser";
import { useRouter } from "next/navigation";
import { AddSeatDialog } from "./AddSeatDialog";
import { AllocateSeatDialog } from "@/components/allocations/AllocateSeatDialog";
import { BRANCH_PAGE_ACCESS } from "@/lib/branchPageAccess";
import { getPermissionHelpText } from "@/lib/permissionMessages";

type SeatStatus = "Allocated" | "Available";
type StatusFilter = "ALL" | "ALLOCATED" | "AVAILABLE";
type SerializableDate = string | Date;

interface SeatAllocationSummary {
    id: string;
    studentId: string;
    shiftId: string;
    multiShiftId?: string | null;
    startDate: SerializableDate;
    student?: {
        id: string;
        name: string;
        phone?: string | null;
        status?: string;
        monthlyFee?: number | null;
    } | null;
    shift?: {
        id: string;
        name: string;
        startTime: string | null;
        endTime: string | null;
        isReserved?: boolean;
    } | null;
    multiShift?: {
        id: string;
        name: string;
    } | null;
}

interface SeatApi {
    id: string;
    branchId: string;
    label: string;
    createdAt: SerializableDate;
    seatAllocations?: SeatAllocationSummary[];
}

interface SeatWithStatus {
    id: string;
    branchId: string;
    label: string;
    createdAt: SerializableDate;
    status: SeatStatus;
    studentName?: string;
    allocations: SeatAllocationSummary[];
}

interface ReleaseTarget {
    id: string;
    seatLabel: string;
    studentName: string;
    shiftName: string;
}

interface AllocationSeed {
    seatId: string;
    seatLabel: string;
    shiftIds?: string[];
    shiftNames?: string[];
}

type ShiftSummary = {
    id: string;
    name: string;
    timeLabel: string;
    allocated: number;
    available: number;
    capacity: number;
    percent: number;
    tone: "success" | "warning" | "danger" | "info";
};

function getErrorMessage(err: unknown) {
    return err instanceof Error ? err.message : "Failed to load seats.";
}

function formatTime(value: string | null | undefined) {
    if (!value) return "";
    const [hourText, minuteText = "0"] = value.split(":");
    const hour = Number(hourText);
    const minute = Number(minuteText);

    if (Number.isNaN(hour) || Number.isNaN(minute)) return value;

    const suffix = hour < 12 ? "AM" : "PM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function formatTimeRange(startTime: string | null | undefined, endTime: string | null | undefined) {
    if (!startTime && !endTime) return "Full day";
    if (startTime && endTime) return `${formatTime(startTime)} - ${formatTime(endTime)}`;
    if (startTime) return `From ${formatTime(startTime)}`;
    return `Until ${formatTime(endTime)}`;
}

function getAllocationShiftLabel(allocation: SeatAllocationSummary) {
    const shiftName = allocation.shift?.name ?? "Shift";
    return allocation.multiShift?.name ? `${allocation.multiShift.name} - ${shiftName}` : shiftName;
}

function getUniqueStudentNames(allocations: SeatAllocationSummary[]) {
    return Array.from(
        new Set(
            allocations
                .map(allocation => allocation.student?.name)
                .filter((name): name is string => Boolean(name))
        )
    );
}

function buildSeatWithStatus(seat: SeatApi | SeatWithStatus, allocations: SeatAllocationSummary[]): SeatWithStatus {
    return {
        id: seat.id,
        branchId: seat.branchId,
        label: seat.label,
        createdAt: seat.createdAt,
        allocations,
        status: allocations.length > 0 ? "Allocated" : "Available",
        studentName: allocations[0]?.student?.name,
    };
}

function getShiftTone(percent: number): "success" | "warning" | "danger" | "info" {
    if (percent >= 100) return "danger";
    if (percent >= 80) return "warning";
    if (percent > 0) return "success";
    return "info";
}

export default function SeatsPage({ params }: { params: Promise<{ branchId: string }> }) {
    const { branchId } = use(params);

    return (
        <BranchAccessGuard branchId={branchId} permission={BRANCH_PAGE_ACCESS.seats}>
            {access => (
                <SeatsContent
                    branchId={branchId}
                    canManageBranch={access.permissions.manage_branch}
                    canAllocateSeats={access.permissions.seat_allocation}
                />
            )}
        </BranchAccessGuard>
    );
}

function SeatsContent({
    branchId,
    canManageBranch,
    canAllocateSeats,
}: {
    branchId: string;
    canManageBranch: boolean;
    canAllocateSeats: boolean;
}) {
    const router = useRouter();
    const hasLoadedSeats = useRef(false);
    const [allSeats, setAllSeats] = useState<SeatWithStatus[]>([]);
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [selectedShift, setSelectedShift] = useState<string>("");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
    const [searchQuery, setSearchQuery] = useState("");
    const [viewMode, setViewMode] = useState<DataViewMode>("grid");
    const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [releaseLoading, setReleaseLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [allocationSeed, setAllocationSeed] = useState<AllocationSeed | null>(null);
    const [releaseTarget, setReleaseTarget] = useState<ReleaseTarget | null>(null);

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

    const loadSeats = useCallback(async () => {
        if (hasLoadedSeats.current) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        try {
            setError(null);
            const data = await branches.getSeats(branchId) as SeatApi[];
            const mapped = data.map((seat) => buildSeatWithStatus(seat, seat.seatAllocations ?? []));

            setAllSeats(mapped);
        } catch (err: unknown) {
            const message = getErrorMessage(err);
            console.error("Failed to load seats", err);
            if (message.includes("Branch not found")) {
                setError("Branch not found. Matches no existing records.");
            } else {
                setError(message || "Failed to load seats.");
            }
        } finally {
            hasLoadedSeats.current = true;
            setLoading(false);
            setRefreshing(false);
        }
    }, [branchId]);

    useEffect(() => {
        loadSeats();
    }, [loadSeats]);

    const seats = useMemo(() => {
        if (!selectedShift) return allSeats;

        return allSeats.map((seat) => {
            const shiftAllocations = seat.allocations.filter(allocation => allocation.shiftId === selectedShift);
            return buildSeatWithStatus(seat, shiftAllocations);
        });
    }, [allSeats, selectedShift]);

    useEffect(() => {
        if (!selectedSeatId) return;
        if (!seats.some(seat => seat.id === selectedSeatId)) {
            setSelectedSeatId(null);
        }
    }, [seats, selectedSeatId]);

    const activeShift = useMemo(
        () => shifts.find(shift => shift.id === selectedShift) ?? null,
        [selectedShift, shifts]
    );

    const stats = useMemo(() => {
        const total = seats.length;
        const allocated = seats.filter(seat => seat.status === "Allocated").length;
        const available = total - allocated;
        const allocations = seats.reduce((sum, seat) => sum + seat.allocations.length, 0);
        const totalSlots = selectedShift ? total : total * shifts.length;
        const utilization = totalSlots === 0 ? 0 : Math.round((allocations / totalSlots) * 100);

        return { total, allocated, available, allocations, totalSlots, utilization };
    }, [seats, selectedShift, shifts.length]);

    const shiftSummaries = useMemo(() => {
        return shifts.map((shift) => {
            const allocated = allSeats.filter(seat =>
                seat.allocations.some(allocation => allocation.shiftId === shift.id)
            ).length;
            const capacity = allSeats.length;
            const available = Math.max(0, capacity - allocated);
            const percent = capacity === 0 ? 0 : Math.round((allocated / capacity) * 100);

            return {
                id: shift.id,
                name: shift.name,
                timeLabel: formatTimeRange(shift.startTime, shift.endTime),
                allocated,
                available,
                capacity,
                percent,
                tone: getShiftTone(percent),
            };
        });
    }, [allSeats, shifts]);

    const filteredSeats = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();

        return seats
            .filter((seat) => {
                if (statusFilter === "ALLOCATED" && seat.status !== "Allocated") return false;
                if (statusFilter === "AVAILABLE" && seat.status !== "Available") return false;
                if (!query) return true;

                const studentNames = getUniqueStudentNames(seat.allocations).join(" ").toLowerCase();
                const shiftNames = seat.allocations.map(getAllocationShiftLabel).join(" ").toLowerCase();
                return (
                    seat.label.toLowerCase().includes(query) ||
                    studentNames.includes(query) ||
                    shiftNames.includes(query)
                );
            })
            .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" }));
    }, [searchQuery, seats, statusFilter]);

    const selectedSeat = useMemo(
        () => seats.find(seat => seat.id === selectedSeatId) ?? null,
        [seats, selectedSeatId]
    );

    const statusFilters: { value: StatusFilter; label: string; count: number }[] = [
        { value: "ALL", label: "All", count: stats.total },
        { value: "ALLOCATED", label: "Allocated", count: stats.allocated },
        { value: "AVAILABLE", label: "Available", count: stats.available },
    ];

    const openAllocation = (seat: SeatWithStatus) => {
        setActionError(null);
        setSelectedSeatId(null);
        setAllocationSeed({
            seatId: seat.id,
            seatLabel: seat.label,
            shiftIds: selectedShift ? [selectedShift] : undefined,
            shiftNames: activeShift ? [activeShift.name] : undefined,
        });
    };

    const handleReleaseAllocation = async () => {
        if (!releaseTarget) return;

        setReleaseLoading(true);
        setActionError(null);

        try {
            const response = await fetch(`/api/seat-allocations/${releaseTarget.id}`, {
                method: "PUT",
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                throw new Error(typeof payload.error === "string" ? payload.error : "Failed to release seat.");
            }

            await loadSeats();
            setReleaseTarget(null);
        } catch (err: unknown) {
            setActionError(err instanceof Error ? err.message : "Failed to release seat.");
        } finally {
            setReleaseLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center p-4 text-white md:p-8">
                <Loader2 className="mr-2 animate-spin" />
                Loading seats...
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-[50vh] flex-col items-center justify-center space-y-4 p-4 text-white md:p-8">
                <AlertCircle className="h-12 w-12 text-red-400 opacity-80" />
                <h2 className="text-xl font-semibold">Something went wrong</h2>
                <p className="text-gray-400">{error}</p>
                <AppButton variant="quiet" icon={ArrowLeft} onClick={() => router.push("/org")}>
                    Back to Workspace
                </AppButton>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8">
            <PageShell>
                <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="min-w-0">
                        <h1 className="mt-2 truncate text-2xl font-semibold tracking-tight text-white md:text-3xl">
                            Seats
                        </h1>
                        <p className="mt-2 max-w-xl text-sm leading-6 text-gray-400">
                            Review seat availability by shift and manage active allocations.
                        </p>
                    </div>

                    <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                        <div className="relative min-w-0 sm:w-72">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder="Search seat, student, shift..."
                                className="h-10 w-full rounded-[8px] border border-white/10 bg-[#0b0f14]/80 pl-9 pr-3 text-sm text-white outline-none transition-colors placeholder:text-gray-600 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-300/10"
                            />
                        </div>
                        {canManageBranch && (
                            <AppButton variant="primary" icon={UserPlus} onClick={() => setIsAddModalOpen(true)} className="sm:w-auto">
                                Add Seat
                            </AppButton>
                        )}
                    </div>
                </header>

            {!canManageBranch && (
                <div className="rounded-[8px] border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100/80">
                    Adding seats is disabled. {getPermissionHelpText("manage_branch")}
                </div>
            )}

            {actionError && (
                <div className="flex items-start justify-between gap-3 rounded-[8px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100/85">
                    <span>{actionError}</span>
                    <button
                        type="button"
                        onClick={() => setActionError(null)}
                        className="text-rose-200/70 transition-colors hover:text-white"
                        aria-label="Dismiss error"
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            <AppPanel contentClassName="space-y-4">
                <ShiftFilterPanel
                    selectedShift={selectedShift}
                    summaries={shiftSummaries}
                    totalSeats={allSeats.length}
                    totalSlots={allSeats.length * shifts.length}
                    totalAllocatedSlots={allSeats.reduce((sum, seat) => sum + seat.allocations.length, 0)}
                    onSelect={setSelectedShift}
                />

                <div className="border-t border-white/10 pt-4">
                    <SeatSummaryBar
                        stats={stats}
                        activeShiftName={activeShift?.name}
                    />
                </div>

                <div className="flex flex-col gap-3 border-t border-white/10 pt-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                        {statusFilters.map(filter => (
                            <StatusFilterChip
                                key={filter.value}
                                filter={filter}
                                active={statusFilter === filter.value}
                                onClick={() => setStatusFilter(filter.value)}
                            />
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex h-8 max-w-full items-center gap-2 rounded-[8px] border border-white/10 bg-white/[0.02] px-2.5 text-xs text-gray-500">
                            <Clock size={13} className="shrink-0 text-gray-500" />
                            <span className="truncate">
                                {activeShift ? formatTimeRange(activeShift.startTime, activeShift.endTime) : "All active allocations"}
                            </span>
                        </div>
                        <ViewToggle value={viewMode} onChange={setViewMode} />
                        <AppButton
                            type="button"
                            variant="quiet"
                            size="sm"
                            icon={refreshing ? Loader2 : RefreshCw}
                            onClick={() => loadSeats()}
                            disabled={refreshing}
                            className={refreshing ? "[&_svg]:animate-spin" : undefined}
                        >
                            Refresh
                        </AppButton>
                    </div>
                </div>
            </AppPanel>

            <div className={cn("relative transition-opacity", refreshing && "opacity-60")}>
                {filteredSeats.length === 0 ? (
                    <SeatEmptyState
                        hasSeats={seats.length > 0}
                        canManageBranch={canManageBranch}
                        onAddSeat={() => setIsAddModalOpen(true)}
                    />
                ) : viewMode === "grid" ? (
                    <SeatGrid
                        seats={filteredSeats}
                        selectedSeatId={selectedSeatId}
                        selectedShiftId={selectedShift}
                        canAllocateSeats={canAllocateSeats}
                        onInspect={setSelectedSeatId}
                        onAllocate={openAllocation}
                    />
                ) : (
                    <SeatList
                        seats={filteredSeats}
                        selectedShiftId={selectedShift}
                        canAllocateSeats={canAllocateSeats}
                        onInspect={setSelectedSeatId}
                        onAllocate={openAllocation}
                    />
                )}
            </div>

            <SeatDetailsDrawer
                seat={selectedSeat}
                activeShiftName={activeShift?.name}
                selectedShiftId={selectedShift}
                canAllocateSeats={canAllocateSeats}
                onClose={() => setSelectedSeatId(null)}
                onAllocate={openAllocation}
                onRelease={setReleaseTarget}
            />

            {canManageBranch && (
                <AddSeatDialog
                    isOpen={isAddModalOpen}
                    onClose={() => setIsAddModalOpen(false)}
                    branchId={branchId}
                    onSuccess={loadSeats}
                />
            )}

            <AllocateSeatDialog
                isOpen={!!allocationSeed}
                branchId={branchId}
                preselectedSeatId={allocationSeed?.seatId}
                preselectedShiftIds={allocationSeed?.shiftIds}
                preselectedShiftNames={allocationSeed?.shiftNames}
                onClose={() => setAllocationSeed(null)}
                onSuccess={() => {
                    void loadSeats();
                }}
            />

            <ConfirmDialog
                isOpen={!!releaseTarget}
                onClose={() => setReleaseTarget(null)}
                onConfirm={handleReleaseAllocation}
                title="Release allocation?"
                description={
                    releaseTarget ? (
                        <span>
                            End {releaseTarget.studentName}&apos;s allocation for {releaseTarget.shiftName} on seat {releaseTarget.seatLabel}.
                        </span>
                    ) : null
                }
                confirmText="Release seat"
                loading={releaseLoading}
                variant="warning"
            />
            </PageShell>
        </div>
    );
}

function ShiftFilterPanel({
    selectedShift,
    summaries,
    totalSeats,
    totalSlots,
    totalAllocatedSlots,
    onSelect,
}: {
    selectedShift: string;
    summaries: ShiftSummary[];
    totalSeats: number;
    totalSlots: number;
    totalAllocatedSlots: number;
    onSelect: (shiftId: string) => void;
}) {
    const allPercent = totalSlots === 0 ? 0 : Math.round((totalAllocatedSlots / totalSlots) * 100);
    const selectedSummary = summaries.find((shift) => shift.id === selectedShift);
    const selectedLabel = selectedSummary
        ? `${selectedSummary.allocated}/${selectedSummary.capacity} seats allocated`
        : `${totalAllocatedSlots}/${totalSlots} shift slots used`;

    return (
        <div className="space-y-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h2 className="text-sm font-semibold text-white">Shift scope</h2>
                    <p className="mt-1 text-xs text-gray-500">Seat status is calculated inside the selected shift.</p>
                </div>
                <p className="text-xs font-medium text-gray-400">{selectedLabel}</p>
            </div>
            <div className="rounded-[8px] border border-white/10 bg-black/10 p-1.5">
                <div className="flex gap-1.5 overflow-x-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                <ShiftFilterChip
                    active={selectedShift === ""}
                    label="All shifts"
                    sublabel={`${totalSeats} seats`}
                    count={`${allPercent}% used`}
                    percent={allPercent}
                    tone="info"
                    onClick={() => onSelect("")}
                />
                {summaries.map((shift) => (
                    <ShiftFilterChip
                        key={shift.id}
                        active={selectedShift === shift.id}
                        label={shift.name}
                        sublabel={shift.timeLabel}
                        count={`${shift.available} free`}
                        percent={shift.percent}
                        tone={shift.tone}
                        onClick={() => onSelect(shift.id)}
                    />
                ))}
                </div>
            </div>
        </div>
    );
}

function ShiftFilterChip({
    active,
    label,
    sublabel,
    count,
    percent,
    tone,
    onClick,
}: {
    active: boolean;
    label: string;
    sublabel: string;
    count: string;
    percent: number;
    tone: "success" | "warning" | "danger" | "info";
    onClick: () => void;
}) {
    const toneClasses = {
        info: {
            active: "border-cyan-300/35 bg-cyan-300/10 text-cyan-100",
            dot: "bg-cyan-300",
            text: "text-cyan-200",
        },
        success: {
            active: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
            dot: "bg-emerald-300",
            text: "text-emerald-200",
        },
        warning: {
            active: "border-amber-300/30 bg-amber-300/10 text-amber-100",
            dot: "bg-amber-300",
            text: "text-amber-200",
        },
        danger: {
            active: "border-rose-300/30 bg-rose-300/10 text-rose-100",
            dot: "bg-rose-300",
            text: "text-rose-200",
        },
    }[tone];

    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={cn(
                "group min-w-[156px] rounded-[7px] border px-3 py-2 text-left transition-colors",
                active
                    ? cn(toneClasses.active, "shadow-sm shadow-black/20")
                    : "border-transparent bg-transparent text-gray-400 hover:bg-white/[0.04] hover:text-white"
            )}
        >
            <div className="flex items-center gap-2">
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", toneClasses.dot)} />
                <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-sm font-semibold", active ? "text-white" : "text-gray-300")}>{label}</p>
                    <p className="mt-0.5 truncate text-[11px] text-gray-500">{sublabel}</p>
                </div>
            </div>
            <p className={cn("mt-2 text-[11px] font-medium", active ? toneClasses.text : "text-gray-500")}>
                {count}
                <span className="ml-1 text-gray-600">· {percent}%</span>
            </p>
        </button>
    );
}

function SeatSummaryBar({
    stats,
    activeShiftName,
}: {
    stats: {
        total: number;
        allocated: number;
        available: number;
        allocations: number;
        totalSlots: number;
        utilization: number;
    };
    activeShiftName?: string;
}) {
    const utilizationLabel = activeShiftName ? "Shift use" : "Slot use";
    const utilizationDetail = activeShiftName
        ? `${stats.allocations}/${stats.total} seats`
        : `${stats.allocations}/${stats.totalSlots} slots`;

    return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryMetric label="Seats" value={stats.total} detail="Physical capacity" tone="neutral" />
            <SummaryMetric label="Allocated" value={stats.allocated} detail={`${stats.allocations} active slot${stats.allocations === 1 ? "" : "s"}`} tone="success" />
            <SummaryMetric label="Available" value={stats.available} detail={activeShiftName ? `In ${activeShiftName}` : "Unallocated seats"} tone="warning" />
            <SummaryMetric label={utilizationLabel} value={`${stats.utilization}%`} detail={utilizationDetail} tone={getShiftTone(stats.utilization)} />
        </div>
    );
}

function SummaryMetric({
    label,
    value,
    detail,
    tone,
}: {
    label: string;
    value: string | number;
    detail: string;
    tone: "neutral" | "success" | "warning" | "danger" | "info";
}) {
    const valueClass = {
        neutral: "text-white",
        success: "text-emerald-200",
        warning: "text-amber-200",
        danger: "text-rose-200",
        info: "text-cyan-200",
    }[tone];

    return (
        <div className="rounded-[8px] border border-white/10 bg-white/[0.02] px-3 py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</p>
            <div className="mt-1 flex items-baseline justify-between gap-3">
                <p className={cn("text-xl font-semibold tracking-tight", valueClass)}>{value}</p>
                <p className="truncate text-xs text-gray-500">{detail}</p>
            </div>
        </div>
    );
}

function StatusFilterChip({
    filter,
    active,
    onClick,
}: {
    filter: { value: StatusFilter; label: string; count: number };
    active: boolean;
    onClick: () => void;
}) {
    const tone = filter.value === "ALLOCATED"
        ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
        : filter.value === "AVAILABLE"
            ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
            : "border-cyan-400/30 bg-cyan-400/10 text-cyan-200";

    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={cn(
                "inline-flex h-8 items-center gap-2 rounded-[8px] border px-2.5 text-xs font-semibold transition-colors",
                active ? tone : "border-white/10 bg-white/[0.03] text-gray-400 hover:border-white/20 hover:text-white"
            )}
        >
            {filter.label}
            <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-white">
                {filter.count}
            </span>
        </button>
    );
}

function SeatGrid({
    seats,
    selectedSeatId,
    selectedShiftId,
    canAllocateSeats,
    onInspect,
    onAllocate,
}: {
    seats: SeatWithStatus[];
    selectedSeatId: string | null;
    selectedShiftId: string;
    canAllocateSeats: boolean;
    onInspect: (seatId: string) => void;
    onAllocate: (seat: SeatWithStatus) => void;
}) {
    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {seats.map(seat => {
                const allocated = seat.status === "Allocated";
                const canQuickAllocate = canAllocateSeats && (!selectedShiftId || !allocated);
                const studentNames = getUniqueStudentNames(seat.allocations);
                const shiftText = allocated
                    ? seat.allocations.map(getAllocationShiftLabel).join(", ")
                    : selectedShiftId ? "Open in selected shift" : "No active allocation";

                return (
                    <div
                        key={seat.id}
                        className={cn(
                            "flex min-h-[150px] flex-col rounded-[8px] border bg-[#0b0f14]/80 p-3.5 shadow-sm shadow-black/20 transition-colors",
                            selectedSeatId === seat.id ? "border-cyan-400/40 bg-cyan-400/[0.05]" : "border-white/10 hover:border-white/20",
                            allocated ? "shadow-[inset_2px_0_0_rgba(52,211,153,0.6)]" : "border-dashed shadow-[inset_2px_0_0_rgba(251,191,36,0.45)]"
                        )}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="truncate text-base font-semibold text-white">{seat.label}</p>
                                <p className="mt-1 truncate text-xs text-gray-500">{shiftText}</p>
                            </div>
                            <SeatStatusBadge status={seat.status} />
                        </div>

                        <div className="mt-3 min-h-[42px] flex-1">
                            <p className={cn("truncate text-sm font-medium", allocated ? "text-white" : "text-amber-100")}>
                                {allocated ? studentNames.join(", ") || "Student" : "Available"}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                                {allocated
                                    ? `${seat.allocations.length} allocation${seat.allocations.length === 1 ? "" : "s"}`
                                    : "Ready to assign"}
                            </p>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-2">
                            <AppButton type="button" variant="quiet" size="sm" onClick={() => onInspect(seat.id)}>
                                Details
                            </AppButton>
                            {canQuickAllocate && (
                                <AppButton type="button" variant="secondary" size="sm" icon={UserPlus} onClick={() => onAllocate(seat)}>
                                    {allocated ? "Add shift" : "Assign"}
                                </AppButton>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function SeatList({
    seats,
    selectedShiftId,
    canAllocateSeats,
    onInspect,
    onAllocate,
}: {
    seats: SeatWithStatus[];
    selectedShiftId: string;
    canAllocateSeats: boolean;
    onInspect: (seatId: string) => void;
    onAllocate: (seat: SeatWithStatus) => void;
}) {
    return (
        <div className="overflow-hidden rounded-[8px] border border-white/10 bg-[#0b0f14]/80 shadow-sm shadow-black/20">
            <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-white/[0.02]">
                        <tr>
                            <th className="px-5 py-4 text-xs font-medium uppercase tracking-wider text-textSecondary">Seat</th>
                            <th className="px-5 py-4 text-xs font-medium uppercase tracking-wider text-textSecondary">Status</th>
                            <th className="px-5 py-4 text-xs font-medium uppercase tracking-wider text-textSecondary">Students</th>
                            <th className="px-5 py-4 text-xs font-medium uppercase tracking-wider text-textSecondary">Shift coverage</th>
                            <th className="px-5 py-4 text-right text-xs font-medium uppercase tracking-wider text-textSecondary">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                        {seats.map(seat => {
                            const allocated = seat.status === "Allocated";
                            const canQuickAllocate = canAllocateSeats && (!selectedShiftId || !allocated);
                            const studentNames = getUniqueStudentNames(seat.allocations);

                            return (
                                <tr key={seat.id} className="transition-colors hover:bg-white/[0.02]">
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-cyan-400/20 bg-cyan-400/10 text-cyan-300">
                                                <Armchair size={16} />
                                            </div>
                                            <div>
                                                <p className="font-medium text-white">{seat.label}</p>
                                                <p className="text-xs text-textMuted">{seat.allocations.length} allocation{seat.allocations.length === 1 ? "" : "s"}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4">
                                        <SeatStatusBadge status={seat.status} />
                                    </td>
                                    <td className="px-5 py-4 text-textSecondary">
                                        {studentNames.length > 0 ? studentNames.join(", ") : "No student"}
                                    </td>
                                    <td className="px-5 py-4 text-textSecondary">
                                        {allocated ? seat.allocations.map(getAllocationShiftLabel).join(", ") : "Open"}
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex justify-end gap-2">
                                            <AppButton type="button" variant="quiet" size="sm" onClick={() => onInspect(seat.id)}>
                                                Details
                                            </AppButton>
                                            {canQuickAllocate && (
                                                <AppButton type="button" variant="secondary" size="sm" icon={UserPlus} onClick={() => onAllocate(seat)}>
                                                    Assign
                                                </AppButton>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function SeatStatusBadge({ status }: { status: SeatStatus }) {
    return (
        <Badge variant={status === "Allocated" ? "success" : "warning"}>
            {status}
        </Badge>
    );
}

function SeatEmptyState({
    hasSeats,
    canManageBranch,
    onAddSeat,
}: {
    hasSeats: boolean;
    canManageBranch: boolean;
    onAddSeat: () => void;
}) {
    return (
        <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[8px] border border-dashed border-white/10 bg-[#0b0f14]/80 px-6 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-[8px] border border-white/10 bg-white/[0.04] text-textSecondary">
                {hasSeats ? <SearchX size={24} /> : <Armchair size={24} />}
            </div>
            <h3 className="mt-4 text-lg font-semibold text-white">
                {hasSeats ? "No seats match this view" : "No seats yet"}
            </h3>
            <p className="mt-2 max-w-md text-sm text-textSecondary">
                {hasSeats
                    ? "Try a different search, status, or shift filter."
                    : "Create the physical seats first, then assign active students into the right shifts."}
            </p>
            {!hasSeats && canManageBranch && (
                <AppButton type="button" variant="primary" icon={UserPlus} className="mt-5" onClick={onAddSeat}>
                    Add first seat
                </AppButton>
            )}
        </div>
    );
}

function SeatDetailsDrawer({
    seat,
    activeShiftName,
    selectedShiftId,
    canAllocateSeats,
    onClose,
    onAllocate,
    onRelease,
}: {
    seat: SeatWithStatus | null;
    activeShiftName?: string;
    selectedShiftId: string;
    canAllocateSeats: boolean;
    onClose: () => void;
    onAllocate: (seat: SeatWithStatus) => void;
    onRelease: (target: ReleaseTarget) => void;
}) {
    if (!seat) return null;

    const allocated = seat.status === "Allocated";
    const studentNames = getUniqueStudentNames(seat.allocations);
    const canQuickAllocate = canAllocateSeats && (!selectedShiftId || !allocated);

    return (
        <div className="fixed inset-0 z-40 flex justify-end">
            <button
                type="button"
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
                aria-label="Close seat details"
            />
            <aside className="relative flex h-full w-full max-w-lg flex-col border-l border-white/10 bg-[#0a0c14] shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-5">
                    <div className="min-w-0">
                        <div className="mb-2 flex items-center gap-2">
                            <SeatStatusBadge status={seat.status} />
                            {activeShiftName && (
                                <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-textSecondary">
                                    {activeShiftName}
                                </span>
                            )}
                        </div>
                        <h2 className="truncate text-2xl font-semibold text-white">Seat {seat.label}</h2>
                        <p className="mt-1 text-sm text-textSecondary">
                            {allocated ? studentNames.join(", ") || "Allocated" : "Available for assignment"}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-2 text-textMuted transition-colors hover:bg-white/10 hover:text-white"
                        aria-label="Close details"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                            <p className="text-xs uppercase tracking-wide text-textMuted">Allocations</p>
                            <p className="mt-2 text-xl font-semibold text-white">{seat.allocations.length}</p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                            <p className="text-xs uppercase tracking-wide text-textMuted">Scope</p>
                            <p className="mt-2 truncate text-sm font-medium text-white">{activeShiftName ?? "All shifts"}</p>
                        </div>
                    </div>

                    <div>
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-white">Active allocations</h3>
                            {allocated && <Badge variant="purple">{seat.allocations.length}</Badge>}
                        </div>

                        {seat.allocations.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm text-textSecondary">
                                No active allocation in this view.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {seat.allocations.map(allocation => (
                                    <div key={allocation.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                                                        <User size={15} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="truncate font-medium text-white">{allocation.student?.name ?? "Student"}</p>
                                                        <p className="truncate text-xs text-textMuted">{allocation.student?.phone ?? "No phone"}</p>
                                                    </div>
                                                </div>
                                                <div className="mt-3 space-y-1.5 text-xs text-textSecondary">
                                                    <div className="flex items-center gap-2">
                                                        <CalendarClock size={13} className="text-cyan-300" />
                                                        <span>{getAllocationShiftLabel(allocation)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Clock size={13} className="text-amber-300" />
                                                        <span>{formatTimeRange(allocation.shift?.startTime, allocation.shift?.endTime)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <AppButton
                                                type="button"
                                                variant="danger"
                                                size="sm"
                                                icon={LogOut}
                                                onClick={() => onRelease({
                                                    id: allocation.id,
                                                    seatLabel: seat.label,
                                                    studentName: allocation.student?.name ?? "Student",
                                                    shiftName: getAllocationShiftLabel(allocation),
                                                })}
                                            >
                                                Release
                                            </AppButton>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="border-t border-white/10 px-5 py-4">
                    {canQuickAllocate ? (
                        <AppButton type="button" variant="primary" icon={UserPlus} className="w-full" onClick={() => onAllocate(seat)}>
                            {allocated ? "Add another shift allocation" : "Assign this seat"}
                        </AppButton>
                    ) : (
                        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/80">
                            This seat is already allocated in the selected shift.
                        </div>
                    )}
                </div>
            </aside>
        </div>
    );
}
