"use client";
import { LocalizedError } from "@/components/settings/LocalizedText";
import { useTranslation } from "@/components/settings/LocalizedText";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";

import { BranchAccessGuard } from "@/components/auth/BranchAccessGuard";
import { Badge } from "@/components/ui/Badge";
import { AppButton, AppPanel, Drawer, PageLoadingSkeleton, PageShell } from "@/components/ui";
import type { DrawerProps } from "@/components/ui/Drawer";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
    formControlClass,
    formErrorBannerClass,
    formHelpTextClass,
    formSurfaceClass,
    formWarningBannerClass,
} from "@/components/ui/formSurface";
import {
    pageEmptyStateClass,
    pageErrorIconClass,
    pageErrorStateClass,
    pageInsetHoverClass,
    pageInsetSurfaceClass,
    pageMutedTextClass,
    pageSectionDividerClass,
    pageSubtleTextClass,
    pageTableBodyDividerClass,
    pageTableHeadClass,
    pageTableRowClass,
    pageTitleClass,
} from "@/components/ui/pageSurface";
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
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, use } from "react";
import { branches } from "@/lib/api/branches";
import type { Shift } from "@/app/generated/prisma/browser";
import { useRouter, useSearchParams } from "next/navigation";
import { AddSeatDialog } from "./AddSeatDialog";
import { AllocateSeatDialog } from "@/components/allocations/AllocateSeatDialog";
import { BRANCH_PAGE_ACCESS } from "@/lib/branchPageAccess";
import { getPermissionHelpText } from "@/lib/permissionMessages";
import { getBranchCapabilityDecision } from "@/lib/branchCapabilities";
import type { CapabilityDecision, MultiShiftSeatMap, MultiShiftSummary, ShiftScope } from "@/types";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
    getMultiShiftBranchStatusCount,
    getUnloadedMultiShiftMatchCount,
    type SeatStatusFilter,
} from "@/lib/seatViewState";

type SeatStatus = "Allocated" | "Assigned" | "Blocked" | "Available";
type StatusFilter = SeatStatusFilter;
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
    blockedBy?: string;
    allocations: SeatAllocationSummary[];
}

interface ReleaseTarget {
    id: string;
    seatLabel: string;
    studentName: string;
    shiftName: string;
    multiShiftId?: string;
    multiShiftName?: string;
}

interface AllocationSeed {
    seatId: string;
    seatLabel: string;
    shiftIds?: string[];
    shiftNames?: string[];
    multiShiftId?: string;
    multiShiftName?: string;
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

function scopeIsSelected(scope: ShiftScope) {
    return scope.kind !== "all";
}

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

function buildSeatWithStatus(
    seat: SeatApi | SeatWithStatus,
    allocations: SeatAllocationSummary[],
    status?: SeatStatus,
    blockedBy?: string
): SeatWithStatus {
    return {
        id: seat.id,
        branchId: seat.branchId,
        label: seat.label,
        createdAt: seat.createdAt,
        allocations,
        status: status ?? (allocations.length > 0 ? "Allocated" : "Available"),
        studentName: allocations[0]?.student?.name,
        blockedBy,
    };
}

function getShiftTone(percent: number): "success" | "warning" | "danger" | "info" {
    if (percent >= 100) return "danger";
    if (percent >= 80) return "warning";
    if (percent > 0) return "success";
    return "info";
}

export default function SeatsPage({ params }: { params: Promise<{ branchId: string }> }) {
    const t = useTranslation();
    const { branchId } = use(params);

    return (
        <BranchAccessGuard branchId={branchId} permission={BRANCH_PAGE_ACCESS.seats}>
            {access => (
                <Suspense fallback={<PageLoadingSkeleton label={t("Loading seats")} variant="cards" rows={6} />}>
                    <SeatsContent
                        branchId={branchId}
                        seatManageDecision={getBranchCapabilityDecision(access, "seatsManage")}
                        allocationDecision={getBranchCapabilityDecision(access, "allocationsManage")}
                    />
                </Suspense>
            )}
        </BranchAccessGuard>
    );
}

function SeatsContent({
    branchId,
    seatManageDecision,
    allocationDecision,
}: {
    branchId: string;
    seatManageDecision: CapabilityDecision;
    allocationDecision: CapabilityDecision;
}) {
    const t = useTranslation();
    const canManageBranch = seatManageDecision.allowed;
    const showSeatManageActions = seatManageDecision.blocker !== "permission";
    const canAllocateSeats = allocationDecision.allowed;
    const showAllocationActions = allocationDecision.blocker !== "permission";
    const router = useRouter();
    const searchParams = useSearchParams();
    const linkedSeatId = searchParams.get("seatId");
    const hasLoadedSeats = useRef(false);
    const loadSequence = useRef(0);
    const multiShiftMapSequence = useRef(0);
    const [allSeats, setAllSeats] = useState<SeatWithStatus[]>([]);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [totalSeatCount, setTotalSeatCount] = useState(0);
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [multiShifts, setMultiShifts] = useState<MultiShiftSummary[]>([]);
    const [shiftOptionsLoaded, setShiftOptionsLoaded] = useState(false);
    const [shiftScope, setShiftScope] = useState<ShiftScope>({ kind: "all" });
    const [multiShiftSeatMap, setMultiShiftSeatMap] = useState<MultiShiftSeatMap | null>(null);
    const [multiShiftMapLoading, setMultiShiftMapLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
    const [searchQuery, setSearchQuery] = useState("");
    const [viewMode, setViewMode] = useState<DataViewMode>("grid");
    const compactLayout = useMediaQuery("(max-width: 1023px)", true);
    const effectiveViewMode: DataViewMode = compactLayout ? "grid" : viewMode;
    const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
    const [releaseLoading, setReleaseLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [allocationSeed, setAllocationSeed] = useState<AllocationSeed | null>(null);
    const [releaseTarget, setReleaseTarget] = useState<ReleaseTarget | null>(null);
    const activeMultiShiftSeatMap = shiftScope.kind === "multi"
        && multiShiftSeatMap?.multiShiftId === shiftScope.id
        ? multiShiftSeatMap
        : null;
    const multiShiftAvailabilityPending = shiftScope.kind === "multi"
        && (multiShiftMapLoading || activeMultiShiftSeatMap === null);
    const seatViewRefreshing = refreshing || multiShiftMapLoading;

    useEffect(() => {
        const loadShifts = async () => {
            try {
                const [shiftsData, multiShiftData] = await Promise.all([
                    branches.getShifts(branchId),
                    branches.getMultiShifts(branchId),
                ]);
                setShifts(shiftsData);
                setMultiShifts(multiShiftData);
                setShiftOptionsLoaded(true);
            } catch (err) {
                console.error("Failed to load shifts", err);
                setActionError("Shift filters could not be loaded.");
            }
        };

        loadShifts();
    }, [branchId]);

    const loadSeats = useCallback(async ({
        cursor,
        append = false,
        revealSeatId,
    }: {
        cursor?: string;
        append?: boolean;
        revealSeatId?: string | null;
    } = {}) => {
        const sequence = ++loadSequence.current;
        if (append) {
            setLoadingMore(true);
            setLoadMoreError(null);
        } else if (hasLoadedSeats.current) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        try {
            if (!append) setError(null);

            let requestCursor = cursor;
            let resultCursor: string | null = null;
            let resultTotal = 0;
            const loaded: SeatWithStatus[] = [];

            do {
                const page = await branches.getSeats(branchId, { cursor: requestCursor });
                const mapped = (page.items as SeatApi[])
                    .map(seat => buildSeatWithStatus(seat, seat.seatAllocations ?? []));
                loaded.push(...mapped);
                resultCursor = page.nextCursor;
                resultTotal = page.total;
                requestCursor = page.nextCursor ?? undefined;
            } while (
                revealSeatId
                && !loaded.some(seat => seat.id === revealSeatId)
                && requestCursor
            );

            if (sequence !== loadSequence.current) return;

            setAllSeats(current => {
                if (!append) return loaded;
                const byId = new Map(current.map(seat => [seat.id, seat]));
                loaded.forEach(seat => byId.set(seat.id, seat));
                return Array.from(byId.values());
            });
            setNextCursor(resultCursor);
            setTotalSeatCount(resultTotal);

            if (revealSeatId && !loaded.some(seat => seat.id === revealSeatId) && !resultCursor) {
                setActionError("The linked seat could not be found in this branch.");
            }
        } catch (err: unknown) {
            if (sequence !== loadSequence.current) return;
            const message = getErrorMessage(err);
            console.error("Failed to load seats", err);
            if (append) {
                setLoadMoreError(message || "Failed to load more seats.");
            } else if (message.includes("Branch not found")) {
                setError("Branch not found. Matches no existing records.");
            } else {
                setError(message || "Failed to load seats.");
            }
        } finally {
            if (sequence === loadSequence.current) {
                hasLoadedSeats.current = true;
                setLoading(false);
                setRefreshing(false);
                setLoadingMore(false);
            }
        }
    }, [branchId]);

    const refreshSelectedMultiShiftMap = useCallback(async () => {
        if (shiftScope.kind !== "multi") return;

        const sequence = ++multiShiftMapSequence.current;
        setMultiShiftMapLoading(true);
        try {
            const seatMap = await branches.getMultiShiftSeatMap(branchId, shiftScope.id);
            if (sequence === multiShiftMapSequence.current) {
                setMultiShiftSeatMap(seatMap);
            }
        } catch (seatMapError: unknown) {
            if (sequence !== multiShiftMapSequence.current) return;
            setMultiShiftSeatMap(null);
            setShiftScope({ kind: "all" });
            setActionError(
                seatMapError instanceof Error && !seatMapError.message.toLowerCase().includes("not found")
                    ? seatMapError.message
                    : "That multi-shift is no longer available. Showing all shifts."
            );
        } finally {
            if (sequence === multiShiftMapSequence.current) {
                setMultiShiftMapLoading(false);
            }
        }
    }, [branchId, shiftScope]);

    const refreshSeatView = useCallback(async () => {
        await Promise.all([
            loadSeats({ revealSeatId: linkedSeatId }),
            refreshSelectedMultiShiftMap(),
        ]);
    }, [linkedSeatId, loadSeats, refreshSelectedMultiShiftMap]);

    useEffect(() => {
        if (!shiftOptionsLoaded || shiftScope.kind !== "multi") return;
        if (multiShifts.some(multiShift => multiShift.id === shiftScope.id)) return;
        setShiftScope({ kind: "all" });
        setMultiShiftSeatMap(null);
        setActionError("That multi-shift is no longer available. Showing all shifts.");
    }, [multiShifts, shiftOptionsLoaded, shiftScope]);

    useEffect(() => {
        if (shiftScope.kind !== "multi") {
            multiShiftMapSequence.current++;
            setMultiShiftMapLoading(false);
            return;
        }
        void refreshSelectedMultiShiftMap();
    }, [refreshSelectedMultiShiftMap, shiftScope.kind]);

    useEffect(() => {
        hasLoadedSeats.current = false;
        setAllSeats([]);
        setNextCursor(null);
        setTotalSeatCount(0);
        setActionError(null);
        void loadSeats({ revealSeatId: linkedSeatId });
    }, [linkedSeatId, loadSeats]);

    useEffect(() => {
        if (!linkedSeatId || !allSeats.some(seat => seat.id === linkedSeatId)) return;

        const frame = window.requestAnimationFrame(() => {
            const target = document.getElementById(`seat-record-${linkedSeatId}`);
            target?.focus({ preventScroll: true });
            target?.scrollIntoView({
                block: "center",
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
            });
        });
        return () => window.cancelAnimationFrame(frame);
    }, [allSeats, effectiveViewMode, linkedSeatId]);

    const seats = useMemo(() => {
        if (shiftScope.kind === "all") return allSeats;

        if (shiftScope.kind === "primary") {
            return allSeats.map((seat) => {
                const shiftAllocations = seat.allocations.filter(allocation => allocation.shiftId === shiftScope.id);
                return buildSeatWithStatus(seat, shiftAllocations);
            });
        }

        if (!activeMultiShiftSeatMap) return [];

        const statusBySeat = new Map(activeMultiShiftSeatMap.seats.map(seat => [seat.seatId, seat]));
        return allSeats.map(seat => {
            const availability = statusBySeat.get(seat.id);
            const exactAllocations = seat.allocations.filter(
                allocation => allocation.multiShiftId === shiftScope.id
            );
            if (availability?.status === "ASSIGNED") {
                return buildSeatWithStatus(seat, exactAllocations, "Assigned");
            }
            if (availability?.status === "BLOCKED") {
                return buildSeatWithStatus(seat, [], "Blocked", availability.occupiedBy ?? undefined);
            }
            return buildSeatWithStatus(seat, [], "Available");
        });
    }, [activeMultiShiftSeatMap, allSeats, shiftScope]);

    useEffect(() => {
        if (!selectedSeatId) return;
        if (!seats.some(seat => seat.id === selectedSeatId)) {
            setSelectedSeatId(null);
        }
    }, [seats, selectedSeatId]);

    const activeShift = useMemo(
        () => shiftScope.kind === "primary" ? shifts.find(shift => shift.id === shiftScope.id) ?? null : null,
        [shiftScope, shifts]
    );
    const activeMultiShift = useMemo(
        () => shiftScope.kind === "multi" ? multiShifts.find(shift => shift.id === shiftScope.id) ?? null : null,
        [multiShifts, shiftScope]
    );
    const activeScopeName = activeShift?.name ?? activeMultiShift?.name;

    const stats = useMemo(() => {
        const total = seats.length;
        const allocated = seats.filter(seat => seat.status === "Allocated" || seat.status === "Assigned").length;
        const blocked = seats.filter(seat => seat.status === "Blocked").length;
        const available = total - allocated - blocked;
        const allocations = seats.reduce((sum, seat) => sum + seat.allocations.length, 0);
        const totalSlots = scopeIsSelected(shiftScope) ? total : total * shifts.length;
        const usedUnits = shiftScope.kind === "multi" ? allocated + blocked : allocations;
        const utilization = totalSlots === 0 ? 0 : Math.round((usedUnits / totalSlots) * 100);

        return { total, allocated, blocked, available, allocations, totalSlots, utilization };
    }, [seats, shiftScope, shifts.length]);

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
                if (
                    statusFilter === "ALLOCATED"
                    && seat.status !== (shiftScope.kind === "multi" ? "Assigned" : "Allocated")
                ) return false;
                if (statusFilter === "BLOCKED" && seat.status !== "Blocked") return false;
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
    }, [searchQuery, seats, shiftScope.kind, statusFilter]);
    const unloadedMultiShiftMatchCount = useMemo(() => {
        if (!activeMultiShiftSeatMap || searchQuery.trim()) return 0;
        return getUnloadedMultiShiftMatchCount(
            activeMultiShiftSeatMap,
            allSeats.map(seat => seat.id),
            statusFilter
        );
    }, [activeMultiShiftSeatMap, allSeats, searchQuery, statusFilter]);

    const selectedSeat = useMemo(
        () => seats.find(seat => seat.id === selectedSeatId) ?? null,
        [seats, selectedSeatId]
    );
    const selectedScopeId = shiftScope.kind === "all" ? "" : shiftScope.id;
    const allocationReady = shiftScope.kind !== "multi" || activeMultiShiftSeatMap !== null;

    const statusCount = (filter: StatusFilter, loadedCount: number) =>
        activeMultiShiftSeatMap
            ? getMultiShiftBranchStatusCount(activeMultiShiftSeatMap, filter)
            : loadedCount;
    const statusFilters: { value: StatusFilter; label: string; count: number }[] = [
        { value: "ALL", label: "All", count: statusCount("ALL", stats.total) },
        { value: "ALLOCATED", label: shiftScope.kind === "multi" ? "Assigned" : "Allocated", count: statusCount("ALLOCATED", stats.allocated) },
        { value: "AVAILABLE", label: "Available", count: statusCount("AVAILABLE", stats.available) },
        ...(shiftScope.kind === "multi"
            ? [{ value: "BLOCKED" as const, label: "Blocked", count: statusCount("BLOCKED", stats.blocked) }]
            : []),
    ];

    useEffect(() => {
        if (statusFilter === "BLOCKED" && shiftScope.kind !== "multi") {
            setStatusFilter("ALL");
        }
    }, [shiftScope.kind, statusFilter]);

    const openAllocation = (seat: SeatWithStatus) => {
        if (!allocationDecision.allowed) {
            setActionError(allocationDecision.reason ?? "Seat allocation changes are unavailable.");
            return;
        }
        if (!allocationReady || seat.status === "Blocked") {
            setActionError("This seat is not available across every component shift in the selected multi-shift.");
            return;
        }
        setActionError(null);
        setSelectedSeatId(null);
        setAllocationSeed({
            seatId: seat.id,
            seatLabel: seat.label,
            shiftIds: shiftScope.kind === "primary"
                ? [shiftScope.id]
                : shiftScope.kind === "multi"
                    ? activeMultiShift?.components.map(component => component.shiftId)
                    : undefined,
            shiftNames: shiftScope.kind === "primary"
                ? activeShift ? [activeShift.name] : undefined
                : shiftScope.kind === "multi"
                    ? activeMultiShift ? [activeMultiShift.name] : undefined
                    : undefined,
            multiShiftId: shiftScope.kind === "multi" ? shiftScope.id : undefined,
            multiShiftName: shiftScope.kind === "multi" ? activeMultiShift?.name : undefined,
        });
    };

    const handleReleaseAllocation = async () => {
        if (!releaseTarget) return;
        if (!allocationDecision.allowed) {
            setActionError(allocationDecision.reason ?? "Seat allocation changes are unavailable.");
            return;
        }

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

            await refreshSeatView();
            setReleaseTarget(null);
        } catch (err: unknown) {
            setActionError(err instanceof Error ? err.message : "Failed to release seat.");
        } finally {
            setReleaseLoading(false);
        }
    };

    if (loading) {
        return <PageLoadingSkeleton label={t("Loading seats")} variant="cards" rows={6} />;
    }

    if (error) {
        return (
            <div className={pageErrorStateClass}>
                <AlertCircle className={pageErrorIconClass} />
                <h2 className="text-xl font-semibold">{t("Something went wrong")}</h2>
                <p className={pageMutedTextClass}><LocalizedError error={error} /></p>
                <AppButton variant="quiet" icon={ArrowLeft} onClick={() => router.push("/app")}>
                    {t("Back to Workspace")}</AppButton>
            </div>
        );
    }

    return (
        <PageShell className="ui-seat-page">
            <header className="ui-record-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                    <h1 className={cn(pageTitleClass, "mt-2 truncate")}>{t("Seats")}</h1>

                </div>

                <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                    <div className="relative min-w-0 sm:w-72">
                        <Search className={cn("absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2", pageSubtleTextClass)} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder={t("Search seat, student, shift...")}
                            aria-label={t("Search loaded seats")}
                            className={cn(formControlClass, "h-11 pl-9 pr-3 text-sm lg:h-10")}
                        />
                    </div>
                    {showSeatManageActions && (
                        <AppButton
                            density="compact"
                            variant="secondary"
                            icon={UserPlus}
                            onClick={() => setIsAddModalOpen(true)}
                            disabled={!canManageBranch}
                            title={canManageBranch ? undefined : seatManageDecision.reason ?? undefined}
                            className="sm:w-auto"
                        >
                            {t("Add seat")}</AppButton>
                    )}
                </div>
            </header>

            {!canManageBranch && (
                <div className={cn("px-4 py-3 text-sm", formWarningBannerClass)}>
                    {t("Adding seats is disabled.")} {seatManageDecision.reason ?? getPermissionHelpText("manage_branch")}
                    {seatManageDecision.recoveryHref ? (
                        <a href={seatManageDecision.recoveryHref} className="ml-2 inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
                            {t("Review billing")}</a>
                    ) : null}
                </div>
            )}

            {!canAllocateSeats && allocationDecision.blocker !== "permission" ? (
                <div className={cn("px-4 py-3 text-sm", formWarningBannerClass)}>
                    {t("Allocation changes are disabled.")} {allocationDecision.reason}
                    {allocationDecision.recoveryHref ? (
                        <a href={allocationDecision.recoveryHref} className="ml-2 inline-flex min-h-11 items-center font-semibold underline underline-offset-4">
                            {t("Review billing")}</a>
                    ) : null}
                </div>
            ) : null}

            {actionError && (
                <div className={cn("flex items-start justify-between gap-3 px-4 py-3 text-sm", formErrorBannerClass)}>
                    <span><LocalizedError error={actionError} /></span>
                    <button
                        type="button"
                        onClick={() => setActionError(null)}
                        className="transition-colors hover:text-[color:var(--text-primary)]"
                        aria-label={t("Dismiss error")}
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            <AppPanel density="compact" contentClassName="space-y-4">
                <ShiftFilterPanel
                    selectedScope={shiftScope}
                    summaries={shiftSummaries}
                    multiShifts={multiShifts}
                    multiShiftSeatMap={activeMultiShiftSeatMap}
                    totalSeats={allSeats.length}
                    branchTotalSeats={totalSeatCount}
                    totalSlots={allSeats.length * shifts.length}
                    totalAllocatedSlots={allSeats.reduce((sum, seat) => sum + seat.allocations.length, 0)}
                    onSelect={scope => {
                        setActionError(null);
                        setMultiShiftMapLoading(
                            scope.kind === "multi" && multiShiftSeatMap?.multiShiftId !== scope.id
                        );
                        setShiftScope(scope);
                    }}
                />


                {!multiShiftAvailabilityPending && (
                <div className={cn("flex flex-wrap items-center justify-between gap-2", pageSectionDividerClass)}>
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
                        <ViewToggle value={viewMode} onChange={setViewMode} className="hidden lg:inline-flex" />
                        <AppButton
                            type="button"
                            variant="quiet"
                            size="sm"
                            icon={seatViewRefreshing ? Loader2 : RefreshCw}
                            onClick={() => void refreshSeatView()}
                            disabled={seatViewRefreshing}
                            className={seatViewRefreshing ? "[&_svg]:animate-spin" : undefined}
                        >
                            {t("Refresh")}</AppButton>
                    </div>
                </div>
                )}
            </AppPanel>

            <div className="ui-seat-workspace">
            <div className={cn("relative transition-opacity", seatViewRefreshing && "opacity-60")}>
                {multiShiftAvailabilityPending ? (
                    <div role="status" className={cn("flex min-h-56 flex-col items-center justify-center gap-3", pageEmptyStateClass)}>
                        <Loader2 size={28} className="animate-spin" aria-hidden="true" />
                        <p className="text-sm font-medium text-[color:var(--text-primary)]">{t("Calculating multi-shift availability")}</p>
                        <p className={cn("text-xs", pageMutedTextClass)}>{t("Seats remain unavailable until every component and overlap check completes.")}</p>
                    </div>
                ) : filteredSeats.length === 0 && unloadedMultiShiftMatchCount > 0 && nextCursor ? (
                    <div role="status" className={cn("flex min-h-56 flex-col items-center justify-center gap-3 text-center", pageEmptyStateClass)}>
                        <SearchX size={28} aria-hidden="true" />
                        <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                            {t("Matching seats are on later pages")}</p>
                        <p className={cn("max-w-md text-sm", pageMutedTextClass)}>{t("{unloadedMultiShiftMatchCount} matching {value} in this branch but not loaded yet.", { unloadedMultiShiftMatchCount: unloadedMultiShiftMatchCount, value: unloadedMultiShiftMatchCount === 1 ? "seat is" : "seats are" })}</p>
                        <AppButton
                            type="button"
                            variant="secondary"
                            onClick={() => loadSeats({ cursor: nextCursor, append: true })}
                            isLoading={loadingMore}
                            disabled={loadingMore}
                        >
                            {t("Load next seats")}</AppButton>
                    </div>
                ) : filteredSeats.length === 0 ? (
                    <SeatEmptyState
                        hasSeats={seats.length > 0}
                        canManageBranch={canManageBranch}
                        showManageAction={showSeatManageActions}
                        disabledReason={seatManageDecision.reason ?? undefined}
                        onAddSeat={() => setIsAddModalOpen(true)}
                    />
                ) : effectiveViewMode === "grid" ? (
                    <SeatGrid
                        seats={filteredSeats}
                        selectedSeatId={selectedSeatId}
                        focusedSeatId={linkedSeatId}
                        selectedShiftId={selectedScopeId}
                        canAllocateSeats={canAllocateSeats && allocationReady}
                        showAllocationActions={showAllocationActions}
                        allocationDisabledReason={allocationDecision.reason ?? undefined}
                        onInspect={setSelectedSeatId}
                        onAllocate={openAllocation}
                    />
                ) : (
                    <SeatList
                        seats={filteredSeats}
                        focusedSeatId={linkedSeatId}
                        selectedShiftId={selectedScopeId}
                        canAllocateSeats={canAllocateSeats && allocationReady}
                        showAllocationActions={showAllocationActions}
                        allocationDisabledReason={allocationDecision.reason ?? undefined}
                        onInspect={setSelectedSeatId}
                        onAllocate={openAllocation}
                    />
                )}
            </div>

            <SeatDetailsDrawer
                seat={selectedSeat}
                activeShiftName={activeScopeName}
                selectedShiftId={selectedScopeId}
                canAllocateSeats={canAllocateSeats && allocationReady}
                showAllocationActions={showAllocationActions}
                allocationDisabledReason={allocationDecision.reason ?? undefined}
                onClose={() => setSelectedSeatId(null)}
                onAllocate={openAllocation}
                onRelease={setReleaseTarget}
            />
            </div>

            {!multiShiftAvailabilityPending && <details className="ui-context-help"><summary>{t.owned("Capacity details")}</summary>
                        <SeatSummaryBar
                            stats={stats}
                            activeShiftName={activeScopeName}
                            multiShiftSelected={shiftScope.kind === "multi"}
                            branchTotalSeats={totalSeatCount}
                            multiShiftSeatMap={activeMultiShiftSeatMap}
                        />
            </details>}
            <div className="flex flex-col items-center gap-2" aria-busy={loadingMore}>
                <p id="seat-page-progress" className={cn("text-sm", pageMutedTextClass)} aria-live="polite">{t("Showing {count} of {totalSeatCount} seats", { count: allSeats.length, totalSeatCount: totalSeatCount })}</p>
                {nextCursor && (
                    <AppButton
                        type="button"
                        variant="secondary"
                        onClick={() => loadSeats({ cursor: nextCursor, append: true })}
                        isLoading={loadingMore}
                        disabled={loadingMore}
                        aria-describedby="seat-page-progress"
                    >
                        {t("Load more seats")}</AppButton>
                )}
                {loadMoreError && (
                    <p role="alert" className="text-sm text-[color:var(--ui-tone-danger-text)]">
                        <LocalizedError error={loadMoreError} />
                    </p>
                )}
            </div>



            {canManageBranch && (
                <AddSeatDialog
                    isOpen={isAddModalOpen}
                    onClose={() => setIsAddModalOpen(false)}
                    branchId={branchId}
                    onSuccess={() => void refreshSeatView()}
                />
            )}

            <AllocateSeatDialog
                isOpen={!!allocationSeed}
                branchId={branchId}
                preselectedSeatId={allocationSeed?.seatId}
                preselectedShiftIds={allocationSeed?.shiftIds}
                preselectedShiftNames={allocationSeed?.shiftNames}
                preselectedMultiShiftId={allocationSeed?.multiShiftId}
                preselectedMultiShiftName={allocationSeed?.multiShiftName}
                onClose={() => setAllocationSeed(null)}
                onSuccess={() => {
                    void refreshSeatView();
                }}
            />

            <ConfirmDialog
                isOpen={!!releaseTarget}
                onClose={() => setReleaseTarget(null)}
                onConfirm={handleReleaseAllocation}
                title={releaseTarget?.multiShiftId ? t("Release multi-shift allocation?") : t("Release allocation?")}
                description={
                    releaseTarget ? (
                        <span>
                            {releaseTarget.multiShiftId
                                ? `End ${releaseTarget.studentName}'s complete ${releaseTarget.multiShiftName ?? "multi-shift"} allocation on seat ${releaseTarget.seatLabel}, including every component shift.`
                                : `End ${releaseTarget.studentName}'s allocation for ${releaseTarget.shiftName} on seat ${releaseTarget.seatLabel}.`}
                        </span>
                    ) : null
                }
                confirmText={releaseTarget?.multiShiftId ? "Release complete bundle" : "Release seat"}
                loading={releaseLoading}
                variant="warning"
            />
        </PageShell>
    );
}

function ShiftFilterPanel({
    selectedScope,
    summaries,
    multiShifts,
    multiShiftSeatMap,
    totalSeats,
    branchTotalSeats,
    totalSlots,
    totalAllocatedSlots,
    onSelect,
}: {
    selectedScope: ShiftScope;
    summaries: ShiftSummary[];
    multiShifts: MultiShiftSummary[];
    multiShiftSeatMap: MultiShiftSeatMap | null;
    totalSeats: number;
    branchTotalSeats: number;
    totalSlots: number;
    totalAllocatedSlots: number;
    onSelect: (scope: ShiftScope) => void;
}) {
    const t = useTranslation();
    const { formatNumber } = useUserPreferences();
    const selectedSummary = selectedScope.kind === "primary"
        ? summaries.find((shift) => shift.id === selectedScope.id)
        : undefined;
    const selectedLabel = selectedScope.kind === "multi"
        ? multiShiftSeatMap
            ? t("{assigned} assigned / {blocked} blocked / {available} available across the branch", { assigned: formatNumber(multiShiftSeatMap.assignedCount), blocked: formatNumber(multiShiftSeatMap.blockedCount), available: formatNumber(multiShiftSeatMap.availableCount) })
            : t("Checking component and overlap conflicts…")
        : selectedSummary
            ? t("{used}/{total} seats in use in this view", { used: formatNumber(selectedSummary.allocated), total: formatNumber(selectedSummary.capacity) })
            : t("In this view: {used} assignments · {total} seat-shift places", { used: formatNumber(totalAllocatedSlots), total: formatNumber(totalSlots) });

    return <div className="ui-seat-shift-picker">
        <label className="text-sm font-medium">{t("Shift scope")}
            <select className={`${formControlClass} mt-1 min-h-11 px-3`} value={selectedScope.kind === "all" ? "all" : `${selectedScope.kind}:${selectedScope.id}`} onChange={event => {
                const [kind, id] = event.target.value.split(":");
                onSelect(kind === "all" ? { kind: "all" } : kind === "multi" ? { kind: "multi", id } : { kind: "primary", id });
            }}>
                <option value="all">{t("All shifts")}</option>
                {summaries.map(shift => <option key={shift.id} value={`primary:${shift.id}`}>{shift.name} · {shift.timeLabel} · {t("{count} free", { count: formatNumber(shift.available) })}</option>)}
                {multiShifts.map(shift => <option key={shift.id} value={`multi:${shift.id}`}>{shift.name} · {shift.components.map(component => component.shiftName).join(" + ")}</option>)}
            </select>
        </label>
        <div className="text-xs text-[color:var(--text-secondary)]"><p>{selectedLabel}</p>
            {totalSeats < branchTotalSeats && <p role="status" className="mt-1 text-[color:var(--ui-tone-warning-text)]">{t("Showing {count} of {totalSeatCount} seats", { count: totalSeats, totalSeatCount: branchTotalSeats })}. {t("Counts cover only the seats currently shown.")}</p>}
            {selectedScope.kind === "multi" && <details className="ui-context-help"><summary>{t.owned("Combined-shift availability")}</summary><p>{t("Assigned seats belong to this exact shift combination. Blocked seats are occupied in a component or overlapping shift; available seats are free across every component.")}</p></details>}
        </div>
    </div>;
}

function SeatSummaryBar({
    stats,
    activeShiftName,
    multiShiftSelected,
    branchTotalSeats,
    multiShiftSeatMap,
}: {
    stats: {
        total: number;
        allocated: number;
        blocked: number;
        available: number;
        allocations: number;
        totalSlots: number;
        utilization: number;
    };
    activeShiftName?: string;
    multiShiftSelected: boolean;
    branchTotalSeats: number;
    multiShiftSeatMap: MultiShiftSeatMap | null;
}) {
    const t = useTranslation();
    const { formatNumber } = useUserPreferences();
    const displayedTotal = multiShiftSeatMap?.totalSeats ?? stats.total;
    const displayedAssigned = multiShiftSeatMap?.assignedCount ?? stats.allocated;
    const displayedBlocked = multiShiftSeatMap?.blockedCount ?? stats.blocked;
    const displayedAvailable = multiShiftSeatMap?.availableCount ?? stats.available;
    const unavailable = displayedAssigned + displayedBlocked;
    const displayedUtilization = displayedTotal === 0 ? 0 : Math.round((unavailable / displayedTotal) * 100);
    const utilizationLabel = t(multiShiftSelected ? "Seat use" : activeShiftName ? "Shift use" : "Slot use");
    const utilizationDetail = multiShiftSelected
        ? t("{used}/{total} unavailable branch seats", { used: formatNumber(unavailable), total: formatNumber(displayedTotal) })
        : activeShiftName
        ? t("{used}/{total} seats shown", { used: formatNumber(stats.allocations), total: formatNumber(stats.total) })
        : t("{used}/{total} seat-shift places shown", { used: formatNumber(stats.allocations), total: formatNumber(stats.totalSlots) });

    return (
        <div className="ui-seat-summary">
            <SummaryMetric
                label={multiShiftSelected ? t("Branch seats") : t("Seats shown")}
                value={formatNumber(displayedTotal)}
                detail={multiShiftSelected ? t("{count} shown below", { count: formatNumber(stats.total) }) : t("{count} total", { count: formatNumber(branchTotalSeats) })}
                tone="neutral"
            />
            <SummaryMetric
                label={multiShiftSelected ? t("Assigned") : t("Allocated")}
                value={formatNumber(multiShiftSelected ? displayedAssigned : stats.allocated)}
                detail={multiShiftSelected
                    ? t("Assigned to this exact combination")
                    : t("{count} current assignments shown", { count: formatNumber(stats.allocations) })}
                tone="success"
            />
            {multiShiftSelected && (
                <SummaryMetric label={t("Blocked")} value={formatNumber(displayedBlocked)} detail={t("In use during these timings")} tone="danger" />
            )}
            <SummaryMetric
                label={t("Available")}
                value={formatNumber(multiShiftSelected ? displayedAvailable : stats.available)}
                detail={multiShiftSelected ? t("Available across the branch") : activeShiftName ? t("Shown for {shift}", { shift: activeShiftName }) : t("Seats shown without an assignment")}
                tone="warning"
            />
            <SummaryMetric
                label={utilizationLabel}
                value={`${formatNumber(multiShiftSelected ? displayedUtilization : stats.utilization)}%`}
                detail={utilizationDetail}
                tone={getShiftTone(multiShiftSelected ? displayedUtilization : stats.utilization)}
            />
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
        neutral: "text-[color:var(--text-primary)]",
        success: "text-[color:var(--ui-tone-success-text)]",
        warning: "text-[color:var(--ui-tone-warning-text)]",
        danger: "text-[color:var(--ui-tone-danger-text)]",
        info: "text-[color:var(--ui-tone-info-text)]",
    }[tone];

    return (
        <div title={detail}>
            <p className={cn("text-[11px] font-medium uppercase tracking-wide", pageSubtleTextClass)}>{label}</p>
            <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className={cn("text-lg font-semibold tabular-nums", valueClass)}>{value}</p>
                <span className="sr-only">{detail}</span>
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
    const t = useTranslation();
    const tone = filter.value === "ALLOCATED"
        ? "border-[color:var(--ui-tone-success-border)] bg-[color:var(--ui-tone-success-bg)] text-[color:var(--ui-tone-success-text)]"
        : filter.value === "BLOCKED"
            ? "border-[color:var(--ui-tone-danger-border)] bg-[color:var(--ui-tone-danger-bg)] text-[color:var(--ui-tone-danger-text)]"
        : filter.value === "AVAILABLE"
            ? "border-[color:var(--ui-tone-warning-border)] bg-[color:var(--ui-tone-warning-bg)] text-[color:var(--ui-tone-warning-text)]"
            : "border-[color:var(--ui-tone-info-border)] bg-[color:var(--ui-tone-info-bg)] text-[color:var(--ui-tone-info-text)]";

    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={cn(
                "inline-flex h-11 cursor-pointer items-center gap-2 rounded-[var(--ui-radius-control)] border px-2.5 text-xs font-semibold transition-colors lg:h-8",
                active ? tone : cn(pageInsetSurfaceClass, pageInsetHoverClass, "text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]")
            )}
        >
            {t.owned(filter.label)}
            <span className="rounded-full bg-[color:var(--ui-table-action-bg)] px-1.5 py-0.5 text-[10px] text-[color:var(--text-primary)]">
                {filter.count}
            </span>
        </button>
    );
}

function SeatGrid({
    seats,
    selectedSeatId,
    focusedSeatId,
    selectedShiftId,
    canAllocateSeats,
    showAllocationActions,
    allocationDisabledReason,
    onInspect,
    onAllocate,
}: {
    seats: SeatWithStatus[];
    selectedSeatId: string | null;
    focusedSeatId: string | null;
    selectedShiftId: string;
    canAllocateSeats: boolean;
    showAllocationActions: boolean;
    allocationDisabledReason?: string;
    onInspect: (seatId: string) => void;
    onAllocate: (seat: SeatWithStatus) => void;
}) {
    const t = useTranslation();
    return (
        <div className="ui-seat-grid">
            {seats.map(seat => {
                const allocated = seat.status === "Allocated" || seat.status === "Assigned";
                const blocked = seat.status === "Blocked";
                const allocationEligible = !selectedShiftId || seat.status === "Available";
                const studentNames = getUniqueStudentNames(seat.allocations);
                const shiftText = allocated && !selectedShiftId ? seat.allocations.map(getAllocationShiftLabel).join(", ") : "";

                return (
                    <article
                        key={seat.id}
                        id={`seat-record-${seat.id}`}
                        tabIndex={-1}
                        aria-label={t("Seat {label}", { label: seat.label })}
                        aria-current={focusedSeatId === seat.id ? "true" : undefined}
                        className={cn(
                            "ui-panel--compact ui-seat-tile flex flex-col border-l-[3px] transition-colors hover:border-[color:var(--ui-card-hover-border)]",
                            selectedSeatId === seat.id || focusedSeatId === seat.id ? "bg-[color:var(--ui-tone-info-bg)] outline outline-2 outline-[color:var(--ui-focus-ring)]" : undefined,
                            allocated
                                ? "border-l-[color:var(--ui-tone-success-border)]"
                                : blocked
                                    ? "border-l-[color:var(--ui-tone-danger-border)]"
                                    : "border-dashed border-l-[color:var(--ui-tone-warning-border)]"
                        )}
                    >
                        <button type="button" className="ui-seat-select" aria-label={t("View seat {label}", { label: seat.label })}
                            aria-pressed={selectedSeatId === seat.id} onClick={() => onInspect(seat.id)}>
                            <span className="ui-seat-tile-heading"><strong>{seat.label}</strong><SeatStatusBadge status={seat.status} /></span>
                            {allocated && <span className="ui-seat-occupant">{studentNames.join(", ") || t("Student")}</span>}
                            {blocked && seat.blockedBy && <span className="ui-seat-conflict">{t("Blocked by {name}", { name: seat.blockedBy })}</span>}
                            {shiftText && <span className="ui-seat-timing">{shiftText}</span>}
                        </button>
                        {showAllocationActions && allocationEligible && <div className="ui-seat-tile-actions">
                            <AppButton type="button" variant="secondary" density="compact" icon={UserPlus} onClick={() => onAllocate(seat)}
                                disabled={!canAllocateSeats} title={canAllocateSeats ? undefined : allocationDisabledReason}>
                                {allocated ? t("Add shift") : t("Assign")}
                            </AppButton>
                        </div>}

                    </article>
                );
            })}
        </div>
    );
}

function SeatList({
    seats,
    focusedSeatId,
    selectedShiftId,
    canAllocateSeats,
    showAllocationActions,
    allocationDisabledReason,
    onInspect,
    onAllocate,
}: {
    seats: SeatWithStatus[];
    focusedSeatId: string | null;
    selectedShiftId: string;
    canAllocateSeats: boolean;
    showAllocationActions: boolean;
    allocationDisabledReason?: string;
    onInspect: (seatId: string) => void;
    onAllocate: (seat: SeatWithStatus) => void;
}) {
    const t = useTranslation();
    return (
        <AppPanel density="compact" padding="none">
            <div className="overflow-x-auto" role="region" aria-label={t("Seats currently shown")} tabIndex={0}>
                <table className="ui-table--compact w-full min-w-[760px] text-left text-sm">
                    <caption className="sr-only">{t("Seats shown and current assignments")}</caption>
                    <thead className={pageTableHeadClass}>
                        <tr>
                            <th scope="col" className="px-5 py-4 text-xs font-medium uppercase tracking-wider text-textSecondary">{t("Seat")}</th>
                            <th scope="col" className="px-5 py-4 text-xs font-medium uppercase tracking-wider text-textSecondary">{t("Status")}</th>
                            <th scope="col" className="px-5 py-4 text-xs font-medium uppercase tracking-wider text-textSecondary">{t("Students")}</th>
                            <th scope="col" className="px-5 py-4 text-xs font-medium uppercase tracking-wider text-textSecondary">{t("Shift coverage")}</th>
                            <th scope="col" className="px-5 py-4 text-right text-xs font-medium uppercase tracking-wider text-textSecondary">{t("Actions")}</th>
                        </tr>
                    </thead>
                    <tbody className={pageTableBodyDividerClass}>
                        {seats.map(seat => {
                            const allocated = seat.status === "Allocated" || seat.status === "Assigned";
                            const allocationEligible = !selectedShiftId || seat.status === "Available";
                            const studentNames = getUniqueStudentNames(seat.allocations);

                            return (
                                <tr
                                    key={seat.id}
                                    id={`seat-record-${seat.id}`}
                                    tabIndex={-1}
                                    aria-current={focusedSeatId === seat.id ? "true" : undefined}
                                    className={cn(pageTableRowClass, focusedSeatId === seat.id && "bg-[color:var(--ui-tone-info-bg)] outline outline-2 outline-[color:var(--ui-focus-ring)]")}
                                >
                                    <th scope="row" className="px-5 py-4 text-left font-normal">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-9 w-9 items-center justify-center rounded-[var(--ui-radius-control)] border border-[color:var(--ui-badge-cyan-border)] bg-[color:var(--ui-badge-cyan-bg)] text-[color:var(--ui-badge-cyan-text)]">
                                                <Armchair size={16} />
                                            </div>
                                            <div>
                                                <p className="font-medium text-[color:var(--text-primary)]">{seat.label}</p>
                                                <p className="text-xs text-textMuted">{t("{count} allocation(s)", { count: seat.allocations.length })}</p>
                                            </div>
                                        </div>
                                    </th>
                                    <td className="px-5 py-4">
                                        <SeatStatusBadge status={seat.status} />
                                    </td>
                                    <td className="px-5 py-4 text-textSecondary">
                                        {studentNames.length > 0 ? studentNames.join(", ") : seat.blockedBy ?? t("No student")}
                                    </td>
                                    <td className="px-5 py-4 text-textSecondary">
                                        {allocated ? seat.allocations.map(getAllocationShiftLabel).join(", ") : seat.status === "Blocked" ? t("Component or overlap conflict") : t("Open")}
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex justify-end gap-2">
                                            <AppButton type="button" variant="quiet" size="sm" onClick={() => onInspect(seat.id)}>
                                                {t("Details")}</AppButton>
                                            {showAllocationActions && allocationEligible && (
                                                <AppButton
                                                    type="button"
                                                    variant="secondary"
                                                    size="sm"
                                                    icon={UserPlus}
                                                    onClick={() => onAllocate(seat)}
                                                    disabled={!canAllocateSeats}
                                                    title={canAllocateSeats ? undefined : allocationDisabledReason}
                                                >
                                                    {t("Assign")}</AppButton>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </AppPanel>
    );
}

function SeatStatusBadge({ status }: { status: SeatStatus }) {
    const t = useTranslation();
    return (
        <Badge variant={status === "Allocated" || status === "Assigned" ? "success" : status === "Blocked" ? "danger" : "warning"}>
            {t(status)}
        </Badge>
    );
}

function SeatEmptyState({
    hasSeats,
    canManageBranch,
    showManageAction,
    disabledReason,
    onAddSeat,
}: {
    hasSeats: boolean;
    canManageBranch: boolean;
    showManageAction: boolean;
    disabledReason?: string;
    onAddSeat: () => void;
}) {
    const t = useTranslation();
    return (
        <div className={pageEmptyStateClass}>
            <div className={cn("flex h-14 w-14 items-center justify-center", pageInsetSurfaceClass, pageMutedTextClass)}>
                {hasSeats ? <SearchX size={24} /> : <Armchair size={24} />}
            </div>
            <h3 className="mt-4 text-lg font-semibold text-[color:var(--text-primary)]">
                {hasSeats ? t("No seats match this view") : t("No seats yet")}
            </h3>
            <p className="mt-2 max-w-md text-sm text-textSecondary">
                {hasSeats
                    ? t("Try a different search, status, or shift filter.")
                    : t("Create the physical seats first, then assign active students into the right shifts.")}
            </p>
            {!hasSeats && showManageAction && (
                <AppButton
                    type="button"
                    variant="primary"
                    icon={UserPlus}
                    className="mt-5"
                    onClick={onAddSeat}
                    disabled={!canManageBranch}
                    title={canManageBranch ? undefined : disabledReason}
                >
                    {t("Add first seat")}</AppButton>
            )}
        </div>
    );
}

function SeatDetailsDrawer({
    seat,
    activeShiftName,
    selectedShiftId,
    canAllocateSeats,
    showAllocationActions,
    allocationDisabledReason,
    onClose,
    onAllocate,
    onRelease,
}: {
    seat: SeatWithStatus | null;
    activeShiftName?: string;
    selectedShiftId: string;
    canAllocateSeats: boolean;
    showAllocationActions: boolean;
    allocationDisabledReason?: string;
    onClose: () => void;
    onAllocate: (seat: SeatWithStatus) => void;
    onRelease: (target: ReleaseTarget) => void;
}) {
    const t = useTranslation();
    const compact = useMediaQuery("(max-width: 1023px)");
    const DetailFrame = compact ? Drawer : SeatDetailsPanel;
    if (!seat) return null;

    const allocated = seat.status === "Allocated" || seat.status === "Assigned";
    const blocked = seat.status === "Blocked";
    const studentNames = getUniqueStudentNames(seat.allocations);
    const allocationEligible = !selectedShiftId || seat.status === "Available";

    return (
        <DetailFrame
            open
            onClose={onClose}
            title={t("Seat {label}", { label: seat.label })}
            description={allocated
                ? studentNames.join(", ") || t("Assigned")
                : blocked
                    ? t("Unavailable because {name} occupies a component or overlapping shift", { name: seat.blockedBy ?? t("Another allocation") })
                    : t("Available for assignment")}
            closeLabel={t("Close seat details")}
            className="max-w-lg"
            footer={
                showAllocationActions && allocationEligible ? (
                    <AppButton
                        type="button"
                        variant="primary"
                        icon={UserPlus}
                        className="w-full"
                        onClick={() => onAllocate(seat)}
                        disabled={!canAllocateSeats}
                        title={canAllocateSeats ? undefined : allocationDisabledReason}
                    >
                        {allocated ? t("Add another shift allocation") : t("Assign this seat")}
                    </AppButton>
                ) : allocationEligible ? null : (
                    <div className={cn("w-full px-4 py-3 text-sm", formWarningBannerClass)}>
                        {blocked
                            ? t("This seat is blocked by a component or overlapping shift.")
                            : t("This seat is already allocated in the selected shift.")}
                    </div>
                )
            }
        >
            <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                    <SeatStatusBadge status={seat.status} />
                    {activeShiftName ? (
                        <span className="rounded-full border border-[color:var(--ui-form-surface-border)] bg-[color:var(--ui-form-surface-bg)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-textSecondary">
                            {activeShiftName}
                        </span>
                    ) : null}
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className={cn("p-3", formSurfaceClass)}>
                        <p className="text-xs uppercase tracking-wide text-textMuted">{t("Allocations")}</p>
                        <p className="mt-2 text-xl font-semibold text-[color:var(--text-primary)]">{seat.allocations.length}</p>
                    </div>
                    <div className={cn("p-3", formSurfaceClass)}>
                        <p className="text-xs uppercase tracking-wide text-textMuted">{t("Scope")}</p>
                        <p className="mt-2 truncate text-sm font-medium text-[color:var(--text-primary)]">{activeShiftName ?? t("All shifts")}</p>
                    </div>
                </div>

                <div>
                    <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">{t("Active allocations")}</h3>
                        {allocated ? <Badge variant="purple">{seat.allocations.length}</Badge> : null}
                    </div>

                    {seat.allocations.length === 0 ? (
                        <div className={cn("rounded-[var(--ui-radius-control)] border border-dashed border-[color:var(--ui-form-surface-border)] bg-[color:var(--ui-form-muted-surface-bg)] p-4 text-sm", formHelpTextClass)}>
                            {t("No active allocation in this view.")}</div>
                    ) : (
                        <div className="space-y-3">
                            {seat.allocations.map((allocation, index) => {
                                const showReleaseAction = !allocation.multiShiftId || seat.allocations.findIndex(candidate =>
                                    candidate.multiShiftId === allocation.multiShiftId
                                    && candidate.studentId === allocation.studentId
                                ) === index;

                                return (
                                <div key={allocation.id} className={cn("p-4", formSurfaceClass)}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex min-w-0 items-center gap-2">
                                                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-[color:var(--ui-tone-success-border)] bg-[color:var(--ui-tone-success-bg)] text-[color:var(--ui-tone-success-text)]">
                                                    <User size={15} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="break-words font-medium text-[color:var(--text-primary)]">{allocation.student?.name ?? t("Student")}</p>
                                                    <p className="truncate text-xs text-textMuted">{allocation.student?.phone ?? t("No phone")}</p>
                                                </div>
                                            </div>
                                            <div className="mt-3 space-y-1.5 text-xs text-textSecondary">
                                                <div className="flex items-center gap-2">
                                                    <CalendarClock size={13} className="text-[color:var(--ui-tone-info-text)]" />
                                                    <span>{getAllocationShiftLabel(allocation)}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Clock size={13} className="text-[color:var(--ui-tone-warning-text)]" />
                                                    <span>{formatTimeRange(allocation.shift?.startTime, allocation.shift?.endTime)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        {showAllocationActions && showReleaseAction ? (
                                            <AppButton
                                                type="button"
                                                variant="danger"
                                                size="sm"
                                                icon={LogOut}
                                                disabled={!canAllocateSeats}
                                                title={canAllocateSeats ? undefined : allocationDisabledReason}
                                                onClick={() => onRelease({
                                                    id: allocation.id,
                                                    seatLabel: seat.label,
                                                    studentName: allocation.student?.name ?? t("Student"),
                                                    shiftName: getAllocationShiftLabel(allocation),
                                                    multiShiftId: allocation.multiShiftId ?? undefined,
                                                    multiShiftName: allocation.multiShift?.name ?? undefined,
                                                })}
                                            >
                                                {allocation.multiShiftId ? t("Release bundle") : t("Release")}
                                            </AppButton>
                                        ) : null}
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </DetailFrame>
    );
}

function SeatDetailsPanel({ title, description, onClose, closeLabel, children, footer }: DrawerProps) {
    return <aside className="ui-seat-detail ui-panel--compact" aria-label={typeof title === "string" ? title : undefined}>
        <header className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">{title}</h2>{description && <p className="mt-1 text-sm text-[color:var(--text-secondary)]">{description}</p>}</div><AppButton variant="quiet" size="icon" onClick={onClose} aria-label={closeLabel}><X size={18} /></AppButton></header>
        <div className="mt-4">{children}</div>
        {footer && <footer className="mt-4 border-t border-[color:var(--ui-panel-border)] pt-4">{footer}</footer>}
    </aside>;
}
