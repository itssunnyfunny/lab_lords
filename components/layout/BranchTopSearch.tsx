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
import { formWarningBannerClass } from "@/components/ui/formSurface";
import {
    chromeEmptyStateClass,
    chromeInputClass,
    chromeInputIconClass,
    chromeInputShellClass,
    chromeListIconClass,
    chromeListItemActiveClass,
    chromeListItemClass,
    chromeMutedTextClass,
    chromePopoverClass,
    chromePopoverScrollClass,
    chromeSubtleTextClass,
} from "@/components/ui/chromeSurface";

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
        <div className={cn(chromeInputShellClass, "opacity-70")}>
            <Search
                className={chromeInputIconClass}
                size={16}
            />
            <input
                type="text"
                disabled
                placeholder="Open a branch to search"
                className={chromeInputClass}
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
        <div ref={rootRef} className={chromeInputShellClass}>
            <div className="relative group">
                <Search
                    className={cn(
                        chromeInputIconClass,
                        disabled && "group-focus-within:text-[color:var(--ui-form-icon)]"
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
                        chromeInputClass,
                        disabled && "cursor-not-allowed opacity-70"
                    )}
                />
            </div>

            {open && !disabled && (
                <div className={cn(chromePopoverClass, "sm:absolute sm:left-0 sm:right-0 sm:top-12")}>
                    <div className={chromePopoverScrollClass}>
                        {loading && (
                            <div className={cn("flex items-center gap-2 px-4 py-3 text-sm", chromeMutedTextClass)}>
                                <Loader2 size={15} className="animate-spin text-[color:var(--ui-form-accent)]" />
                                Loading branch search...
                            </div>
                        )}

                        {loadErrors.length > 0 && (
                            <div className={cn("mx-2 mb-2 flex items-start gap-2 px-3 py-2 text-xs leading-5", formWarningBannerClass)}>
                                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                                <span>Some results could not load: {loadErrors.join(", ")}.</span>
                            </div>
                        )}

                        {indexedGroups.map(group => (
                            <div key={group.id} className="py-1">
                                <div className={cn("px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider", chromeSubtleTextClass)}>
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
                                                    chromeListItemClass,
                                                    selected && chromeListItemActiveClass
                                                )}
                                            >
                                                <span className={cn(
                                                    chromeListIconClass,
                                                    result.type === "action"
                                                        ? "border-[color:var(--ui-badge-cyan-border)] bg-[color:var(--ui-badge-cyan-bg)] text-[color:var(--ui-badge-cyan-text)]"
                                                        : ""
                                                )}>
                                                    <Icon size={15} />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-sm font-semibold">
                                                        {result.title}
                                                    </span>
                                                    <span className={cn("block truncate text-xs", chromeSubtleTextClass)}>
                                                        {result.subtitle}
                                                    </span>
                                                </span>
                                                <ArrowRight size={14} className={cn(
                                                    "flex-shrink-0 transition-opacity",
                                                    selected ? "text-[color:var(--ui-form-accent)] opacity-100" : "text-[color:var(--text-muted)] opacity-0"
                                                )} />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}

                        {showNoMatches && (
                            <div className={chromeEmptyStateClass}>
                                No matches for &quot;{query.trim()}&quot;.
                            </div>
                        )}

                        {showNoActions && (
                            <div className={chromeEmptyStateClass}>
                                No searchable actions are available for this branch.
                            </div>
                        )}

                        {!query.trim() && hasResults && (
                            <div className={cn("border-t border-[color:var(--ui-panel-header-border)] px-4 py-2 text-xs", chromeSubtleTextClass)}>
                                Type to search branch records.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
