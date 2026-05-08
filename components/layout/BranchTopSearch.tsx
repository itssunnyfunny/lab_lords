"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
    AlertCircle,
    ArrowRight,
    CalendarCheck,
    Command,
    CreditCard,
    Grid,
    Loader2,
    Search,
    UserCircle,
    Users,
} from "lucide-react";
import { branches } from "@/lib/api/branches";
import { payments as paymentApi } from "@/lib/api/payments";
import { staff as staffApi } from "@/lib/api/staff";
import { useBranchAccess } from "@/hooks/useBranchAccess";
import { buildTopSearchResults } from "@/lib/topSearch";
import type {
    PaymentSearchRecord,
    SeatSearchRecord,
    ShiftSearchRecord,
    StaffSearchRecord,
    StudentSearchRecord,
    TopSearchResult,
    TopSearchResultType,
} from "@/lib/topSearch";
import { cn } from "@/lib/utils";

type BranchSearchData = {
    students: StudentSearchRecord[];
    payments: PaymentSearchRecord[];
    seats: SeatSearchRecord[];
    shifts: ShiftSearchRecord[];
    staff: StaffSearchRecord[];
};

const EMPTY_DATA: BranchSearchData = {
    students: [],
    payments: [],
    seats: [],
    shifts: [],
    staff: [],
};

const TYPE_ICONS: Record<TopSearchResultType, typeof Command> = {
    action: Command,
    student: Users,
    payment: CreditCard,
    seat: Grid,
    shift: CalendarCheck,
    staff: UserCircle,
};

function getBranchId(pathname: string | null) {
    const segments = pathname?.split("/").filter(Boolean) ?? [];
    if (segments[0] !== "branch" || !segments[1]) return undefined;
    return segments[1];
}

function DisabledSearch() {
    return (
        <div className="relative w-full min-w-0 max-w-sm opacity-70">
            <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600"
                size={16}
            />
            <input
                type="text"
                disabled
                placeholder="Open a branch to search"
                className="w-full cursor-not-allowed rounded-xl border border-white/5 bg-[#13131a]/30 py-2 pl-10 pr-4 text-sm text-gray-500 placeholder-gray-600"
            />
        </div>
    );
}

export function BranchTopSearch() {
    const pathname = usePathname();
    const router = useRouter();
    const branchId = getBranchId(pathname);
    const { access, loading: accessLoading, error: accessError } = useBranchAccess(branchId);

    const rootRef = useRef<HTMLDivElement>(null);
    const loadSeq = useRef(0);
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [data, setData] = useState<BranchSearchData>(EMPTY_DATA);
    const [loading, setLoading] = useState(false);
    const [fetched, setFetched] = useState(false);
    const [loadErrors, setLoadErrors] = useState<string[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(-1);

    const groups = useMemo(() => {
        if (!branchId) return [];

        return buildTopSearchResults({
            branchId,
            query,
            access,
            students: data.students,
            payments: data.payments,
            seats: data.seats,
            shifts: data.shifts,
            staff: data.staff,
        });
    }, [access, branchId, data, query]);

    const indexedGroups = useMemo(() => {
        let index = 0;
        return groups.map(group => ({
            ...group,
            results: group.results.map(result => ({
                result,
                index: index++,
            })),
        }));
    }, [groups]);

    const flatResults = useMemo(
        () => indexedGroups.flatMap(group => group.results.map(item => item.result)),
        [indexedGroups]
    );

    const loadSearchData = useCallback(async () => {
        if (!branchId || !access || loading || fetched) return;

        const seq = ++loadSeq.current;
        const failures: string[] = [];

        async function read<T>(
            label: string,
            enabled: boolean,
            loader: () => Promise<T[]>
        ): Promise<T[]> {
            if (!enabled) return [];
            try {
                return await loader();
            } catch {
                failures.push(label);
                return [];
            }
        }

        setLoading(true);

        const [
            students,
            payments,
            seats,
            shifts,
            staff,
        ] = await Promise.all([
            read("students", access.permissions.students, () => branches.getStudents(branchId)),
            read("payments", access.permissions.view_payments, () => paymentApi.list(branchId) as Promise<PaymentSearchRecord[]>),
            read("seats", access.permissions.seat_allocation, () => branches.getSeats(branchId) as Promise<SeatSearchRecord[]>),
            read("shifts", access.permissions.seat_allocation, () => branches.getShifts(branchId) as Promise<ShiftSearchRecord[]>),
            read("staff", access.permissions.manage_branch, () => staffApi.list(branchId) as Promise<StaffSearchRecord[]>),
        ]);

        if (seq !== loadSeq.current) return;

        setData({ students, payments, seats, shifts, staff });
        setLoadErrors(failures);
        setFetched(true);
        setLoading(false);
    }, [access, branchId, fetched, loading]);

    useEffect(() => {
        loadSeq.current += 1;
        setQuery("");
        setOpen(false);
        setData(EMPTY_DATA);
        setFetched(false);
        setLoadErrors([]);
        setLoading(false);
        setSelectedIndex(-1);
    }, [branchId]);

    useEffect(() => {
        if (!open) return;

        const handleMouseDown = (event: MouseEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        document.addEventListener("mousedown", handleMouseDown);
        return () => document.removeEventListener("mousedown", handleMouseDown);
    }, [open]);

    useEffect(() => {
        if (!open || flatResults.length === 0) {
            setSelectedIndex(-1);
            return;
        }

        setSelectedIndex(0);
    }, [flatResults.length, open, query]);

    const openSearch = () => {
        setOpen(true);
        void loadSearchData();
    };

    const executeResult = useCallback((result: TopSearchResult) => {
        setOpen(false);
        setQuery("");
        router.push(result.href);
    }, [router]);

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Escape") {
            setOpen(false);
            return;
        }

        if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            void loadSearchData();
            setSelectedIndex(current => {
                if (flatResults.length === 0) return -1;
                return current < 0 ? 0 : (current + 1) % flatResults.length;
            });
            return;
        }

        if (event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            void loadSearchData();
            setSelectedIndex(current => {
                if (flatResults.length === 0) return -1;
                return current <= 0 ? flatResults.length - 1 : current - 1;
            });
            return;
        }

        if (event.key === "Enter" && selectedIndex >= 0) {
            const selected = flatResults[selectedIndex];
            if (selected) {
                event.preventDefault();
                executeResult(selected);
            }
        }
    };

    if (!branchId) return <DisabledSearch />;

    const disabled = accessLoading || Boolean(accessError) || !access;
    const placeholder = accessLoading
        ? "Checking branch access..."
        : accessError
            ? "Search unavailable"
            : "Search branch...";
    const hasResults = flatResults.length > 0;
    const showNoMatches = query.trim().length > 0 && !loading && !hasResults;
    const showNoActions = query.trim().length === 0 && !loading && !hasResults;

    return (
        <div ref={rootRef} className="relative w-full min-w-0 max-w-sm">
            <div className="relative group">
                <Search
                    className={cn(
                        "absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 transition-colors duration-300",
                        !disabled && "group-focus-within:text-cyan-400"
                    )}
                    size={16}
                />
                <input
                    type="text"
                    value={query}
                    disabled={disabled}
                    placeholder={placeholder}
                    onFocus={openSearch}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setOpen(true);
                        void loadSearchData();
                    }}
                    onKeyDown={handleKeyDown}
                    aria-label="Search current branch"
                    className={cn(
                        "w-full rounded-xl border border-white/5 bg-[#13131a]/50 py-2 pl-10 pr-4 text-sm text-gray-200 placeholder-gray-600 transition-all duration-300 focus:border-cyan-500/30 focus:outline-none focus:ring-1 focus:ring-cyan-500/20",
                        disabled && "cursor-not-allowed opacity-70"
                    )}
                />
            </div>

            {open && !disabled && (
                <div className="fixed left-3 right-3 top-[4.25rem] z-50 overflow-hidden rounded-xl border border-white/10 bg-[#0f111a]/95 shadow-2xl shadow-black/40 backdrop-blur-xl sm:absolute sm:left-0 sm:right-0 sm:top-12">
                    <div className="max-h-[min(28rem,calc(100dvh-6rem))] overflow-y-auto py-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                        {loading && (
                            <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-400">
                                <Loader2 size={15} className="animate-spin text-cyan-300" />
                                Loading branch search...
                            </div>
                        )}

                        {loadErrors.length > 0 && (
                            <div className="mx-2 mb-2 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-100/80">
                                <AlertCircle size={14} className="mt-0.5 flex-shrink-0 text-amber-300" />
                                <span>Some results could not load: {loadErrors.join(", ")}.</span>
                            </div>
                        )}

                        {indexedGroups.map(group => (
                            <div key={group.id} className="py-1">
                                <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-gray-600">
                                    {group.label}
                                </div>
                                <div className="space-y-0.5 px-1.5">
                                    {group.results.map(({ result, index }) => {
                                        const Icon = TYPE_ICONS[result.type];
                                        const selected = index === selectedIndex;

                                        return (
                                            <button
                                                key={result.id}
                                                type="button"
                                                onClick={() => executeResult(result)}
                                                onMouseEnter={() => setSelectedIndex(index)}
                                                onMouseDown={(event) => {
                                                    event.preventDefault();
                                                    executeResult(result);
                                                }}
                                                className={cn(
                                                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                                                    selected
                                                        ? "bg-cyan-500/10 text-white"
                                                        : "text-gray-300 hover:bg-white/5 hover:text-white"
                                                )}
                                            >
                                                <span className={cn(
                                                    "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border",
                                                    result.type === "action"
                                                        ? "border-cyan-500/20 bg-cyan-500/10 text-cyan-300"
                                                        : "border-white/10 bg-white/[0.04] text-gray-400"
                                                )}>
                                                    <Icon size={15} />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-sm font-semibold">
                                                        {result.title}
                                                    </span>
                                                    <span className="block truncate text-xs text-gray-500">
                                                        {result.subtitle}
                                                    </span>
                                                </span>
                                                <ArrowRight size={14} className={cn(
                                                    "flex-shrink-0 transition-opacity",
                                                    selected ? "text-cyan-300 opacity-100" : "text-gray-600 opacity-0"
                                                )} />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}

                        {showNoMatches && (
                            <div className="px-4 py-6 text-center text-sm text-gray-500">
                                No matches for &quot;{query.trim()}&quot;.
                            </div>
                        )}

                        {showNoActions && (
                            <div className="px-4 py-6 text-center text-sm text-gray-500">
                                No searchable actions are available for this branch.
                            </div>
                        )}

                        {!query.trim() && hasResults && (
                            <div className="border-t border-white/5 px-4 py-2 text-xs text-gray-600">
                                Type to search branch records.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
