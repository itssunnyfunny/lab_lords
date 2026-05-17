"use client";

import { DataTable } from "@/components/tables/DataTable";
import { ViewToggle } from "@/components/tables/ViewToggle";
import { Badge } from "@/components/ui/Badge";
import { AppButton, PageLoadingSkeleton, PageShell } from "@/components/ui";
import { Button } from "@/components/ui/Button";
import { BranchAccessGuard } from "@/components/auth/BranchAccessGuard";
import {
    Loader2, AlertCircle, ArrowLeft, X,
    Eye, Pencil, PowerOff, Power,
    AlertTriangle, CheckCircle2, MinusCircle, Clock, ArrowRightLeft, Armchair, Download, Search, UserPlus,
} from "lucide-react";
import { useCallback, useEffect, useState, use, useMemo } from "react";
import { students, type StudentListItem } from "@/lib/api/students";
import { payments } from "@/lib/api/payments";
import { branches } from "@/lib/api/branches";
import { StudentStatus, type Student, type Payment, type Shift } from "@/app/generated/prisma/browser";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { AddStudentDialog } from "./AddStudentDialog";
import { EditStudentDialog } from "./EditStudentDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
    formControlClass,
    formDialogOverlayClass,
    formDialogPanelClass,
    formDrawerHeaderClass,
    formDrawerPanelClass,
    formHelpTextClass,
    formSuccessBannerClass,
    formSurfaceClass,
    formSurfaceHoverClass,
    formWarningBannerClass,
} from "@/components/ui/formSurface";
import {
    pageCountBadgeClass,
    pageDescriptionClass,
    pageEyebrowClass,
    pageErrorIconClass,
    pageErrorStateClass,
    pageFilterShellClass,
    pageGridCardClass,
    pageGridCardHoverClass,
    pageInsetMetricClass,
    pageInsetSurfaceClass,
    pageMutedTextClass,
    pageSectionDividerClass,
    pageSubtleTextClass,
    pageTitleClass,
} from "@/components/ui/pageSurface";
import { cn } from "@/lib/utils";
import { BRANCH_PAGE_ACCESS } from "@/lib/branchPageAccess";
import { getPermissionHelpText } from "@/lib/permissionMessages";
import { useDataViewMode } from "@/hooks/useDataViewMode";
import { RowActionsMenu, type RowActionsMenuItem } from "@/components/ui/RowActionsMenu";

type DueResolution = "PAID" | "WAIVED" | "KEEP";
type StudentRosterTab = "ACTIVE" | "INACTIVE";

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

function escapeCsvValue(value: string | number | null | undefined) {
    const text = value == null ? "" : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
    const csv = rows.map(row => row.map(escapeCsvValue).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function getSeatShiftLabels(student: StudentListItem) {
    const activeAllocations = student.seatAllocations ?? [];
    const seatText = Array.from(new Set(activeAllocations.map(alloc => alloc.seat.label))).join(", ");
    const shiftGroups = new Map<string, { label: string; components: Set<string> }>();

    activeAllocations.forEach(alloc => {
        const key = alloc.multiShiftId ?? alloc.shiftId;
        const label = alloc.multiShift?.name ?? alloc.shift.name;
        const existing = shiftGroups.get(key);

        if (existing) {
            existing.components.add(alloc.shift.name);
            return;
        }

        shiftGroups.set(key, {
            label,
            components: new Set([alloc.shift.name]),
        });
    });

    const shiftText = Array.from(shiftGroups.values())
        .map(group => group.components.size > 1 ? `${group.label} (${group.components.size} shifts)` : group.label)
        .join(", ");

    return {
        seatText: seatText || "No seat",
        shiftText: shiftText || "No shift",
        hasAllocation: activeAllocations.length > 0,
    };
}

function StudentSeatShiftSummary({ student }: { student: StudentListItem }) {
    const { seatText, shiftText, hasAllocation } = getSeatShiftLabels(student);

    if (!hasAllocation) {
        return (
            <span className={cn("inline-flex items-center gap-1.5 border-dashed px-2.5 py-1.5 text-xs text-textMuted", pageInsetSurfaceClass)}>
                <Armchair size={13} />
                No seat assigned
            </span>
        );
    }

    return (
        <div className="min-w-0 space-y-1 text-xs" title={`${seatText} - ${shiftText}`}>
            <div className="flex min-w-0 items-center gap-1.5 text-[color:var(--text-primary)]">
                <Armchair size={13} className="flex-shrink-0 text-cyan-300" />
                <span className="truncate font-medium">{seatText}</span>
            </div>
            <div className="flex min-w-0 items-center gap-1.5 text-textSecondary">
                <Clock size={13} className="flex-shrink-0 text-amber-300" />
                <span className="truncate">{shiftText}</span>
            </div>
        </div>
    );
}

// ─── Row action dropdown ──────────────────────────────────────────────────────

type ActionItem = RowActionsMenuItem;

function RowActions({ actions }: { actions: ActionItem[] }) {
    return <RowActionsMenu actions={actions} />;
}

function StudentTabButton({
    tab,
    active,
    count,
    onClick,
}: {
    tab: StudentRosterTab;
    active: boolean;
    count: number;
    onClick: () => void;
}) {
    const activeClassName = tab === "ACTIVE"
        ? "border-[color:var(--ui-badge-success-border)] bg-[color:var(--ui-badge-success-bg)] text-[color:var(--ui-badge-success-text)]"
        : "border-[color:var(--ui-badge-default-border)] bg-[color:var(--ui-badge-default-bg)] text-[color:var(--ui-badge-default-text)]";
    const dotClassName = tab === "ACTIVE"
        ? "bg-[color:var(--ui-badge-success-text)]"
        : "bg-[color:var(--ui-badge-default-text)]";

    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={cn(
                "inline-flex h-9 cursor-pointer items-center gap-2 rounded-[var(--ui-radius-control)] border px-3 text-sm font-medium transition-colors",
                active
                    ? activeClassName
                    : "border-transparent text-[color:var(--text-secondary)] hover:bg-[color:var(--ui-form-surface-hover-bg)] hover:text-[color:var(--text-primary)]"
            )}
        >
            {active && <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", dotClassName)} />}
            {tab === "ACTIVE" ? "Active" : "Inactive"}
            <span className={pageCountBadgeClass}>{count}</span>
        </button>
    );
}

// ─── Inactivate Dialog ────────────────────────────────────────────────────────

interface InactivateDialogProps {
    student: Student | null;
    duePayments: Payment[];
    onConfirm: (resolution: DueResolution) => void;
    onCancel: () => void;
    loading: boolean;
}

function InactivateDialog({ student, duePayments, onConfirm, onCancel, loading }: InactivateDialogProps) {
    const [resolution, setResolution] = useState<DueResolution>("WAIVED");

    if (!student) return null;

    const totalDue = duePayments.reduce((sum, p) => sum + p.amount, 0);
    const hasDues = duePayments.length > 0;

    const resolutionOptions: { value: DueResolution; label: string; sublabel: string; icon: React.ElementType; color: string }[] = [
        {
            value: "PAID",
            label: "Mark as Paid",
            sublabel: "Student paid before leaving. Record it.",
            icon: CheckCircle2,
            color: "text-green-400",
        },
        {
            value: "WAIVED",
            label: "Mark as Waived",
            sublabel: "Owner chose not to pursue. Cleans analytics.",
            icon: MinusCircle,
            color: "text-amber-400",
        },
        {
            value: "KEEP",
            label: "Keep as Due",
            sublabel: "Still expecting payment. Stays in overdue.",
            icon: Clock,
            color: "text-red-400",
        },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className={cn("cursor-pointer", formDialogOverlayClass)} onClick={onCancel} />
            <div className={cn("relative w-full max-w-md p-6 animate-in zoom-in-95 duration-200", formDialogPanelClass)}>
                {/* Header */}
                <div className="flex items-start gap-3 mb-5">
                    <div className="w-10 h-10 rounded-full bg-[color:var(--ui-dialog-icon-danger-bg)] text-[color:var(--ui-dialog-icon-danger-text)] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <AlertTriangle size={18} />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold leading-tight text-[color:var(--text-primary)]">Deactivate {student.name}?</h3>
                        <p className={cn("mt-0.5 text-sm", formHelpTextClass)}>
                            Their seat allocation will be ended immediately.
                        </p>
                    </div>
                </div>

                {/* Due payments summary */}
                {hasDues ? (
                    <div className={cn("mb-5 p-4", formWarningBannerClass)}>
                        <p className="text-amber-300 text-sm font-medium mb-1">
                            {duePayments.length} unpaid billing cycle{duePayments.length > 1 ? "s" : ""} - {formatCurrency(totalDue)} total
                        </p>
                        <p className="text-amber-200/60 text-xs">How should these be resolved?</p>

                        <div className="mt-3 space-y-2">
                            {resolutionOptions.map(opt => {
                                const Icon = opt.icon;
                                const selected = resolution === opt.value;
                                return (
                                    <label
                                        key={opt.value}
                                        className={cn(
                                            "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                                            selected
                                                ? "border-[color:var(--ui-form-input-border)] bg-[color:var(--ui-form-surface-hover-bg)]"
                                                : cn(formSurfaceClass, formSurfaceHoverClass)
                                        )}
                                    >
                                        <input
                                            type="radio"
                                            name="resolution"
                                            value={opt.value}
                                            checked={selected}
                                            onChange={() => setResolution(opt.value)}
                                            className="mt-0.5 accent-current"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className={cn("text-sm font-medium flex items-center gap-1.5", opt.color)}>
                                                <Icon size={13} />
                                                {opt.label}
                                            </div>
                                            <div className={cn("mt-0.5 text-xs", formHelpTextClass)}>{opt.sublabel}</div>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className={cn("mb-5 p-4", formSuccessBannerClass)}>
                        <p className="text-green-400 text-sm font-medium">No outstanding payments</p>
                        <p className={cn("mt-0.5 text-xs", pageSubtleTextClass)}>This student has a clean financial record.</p>
                    </div>
                )}

                {/* Billing note */}
                <p className={cn("mb-5 border-l-2 border-[color:var(--ui-form-section-divider)] pl-3 text-xs", formHelpTextClass)}>
                    No future billing cycles will be generated after deactivation.
                </p>

                {/* Actions */}
                <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>
                        Cancel
                    </Button>
                    <Button
                        variant="danger"
                        className="flex-1"
                        onClick={() => onConfirm(hasDues ? resolution : "KEEP")}
                        disabled={loading}
                    >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <PowerOff size={14} />}
                        {loading ? "Deactivating..." : "Confirm deactivate"}
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StudentsPage({ params }: { params: Promise<{ branchId: string }> }) {
    const { branchId } = use(params);

    return (
        <BranchAccessGuard branchId={branchId} permission={BRANCH_PAGE_ACCESS.students}>
            {access => (
                <StudentsContent
                    branchId={branchId}
                    canViewPayments={access.permissions.view_payments}
                    canAllocateSeats={access.permissions.seat_allocation}
                />
            )}
        </BranchAccessGuard>
    );
}

function StudentsContent({
    branchId,
    canViewPayments,
    canAllocateSeats,
}: {
    branchId: string;
    canViewPayments: boolean;
    canAllocateSeats: boolean;
}) {
    const router = useRouter();
    const paymentHelpText = getPermissionHelpText("view_payments");
    const allocationHelpText = getPermissionHelpText("seat_allocation");

    const [allStudents, setAllStudents] = useState<StudentListItem[]>([]);
    const [allPayments, setAllPayments] = useState<Payment[]>([]);
    const [shifts, setShifts] = useState<Shift[]>([]);

    const [activeTab, setActiveTab] = useState<StudentRosterTab>("ACTIVE");
    const [selectedShift, setSelectedShift] = useState<string>("");
    const [searchQuery, setSearchQuery] = useState("");
    const [viewMode, setViewMode] = useDataViewMode();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Add dialog
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // Edit dialog
    const [editTarget, setEditTarget] = useState<Student | null>(null);

    // Fee drawer
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // Inactivate dialog
    const [inactivateTarget, setInactivateTarget] = useState<Student | null>(null);
    const [inactivateLoading, setInactivateLoading] = useState(false);

    // Activate confirm dialog
    const [activateTarget, setActivateTarget] = useState<Student | null>(null);
    const [activateLoading, setActivateLoading] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const paymentListPromise = canViewPayments
                ? Promise.all([
                    payments.list(branchId),
                    payments.list(branchId, "WAIVED"),
                ]).then(([activePayments, waivedPayments]) => [...activePayments, ...waivedPayments])
                : Promise.resolve([]);

            const [studentsList, paymentsList, shiftsList] = await Promise.all([
                students.list(branchId, selectedShift || undefined),
                paymentListPromise,
                canAllocateSeats ? branches.getShifts(branchId) : Promise.resolve([]),
            ]);
            setAllStudents(studentsList);
            setAllPayments(paymentsList);
            setShifts(shiftsList);
            setError(null);
        } catch {
            setError("Failed to load students data.");
        } finally {
            setLoading(false);
        }
    }, [branchId, canAllocateSeats, canViewPayments, selectedShift]);

    useEffect(() => { loadData(); }, [loadData]);

    // ── Financial map ─────────────────────────────────────────────────────────
    const studentFinancials = useMemo(() => {
        const map = new Map<string, { totalDue: number; totalPaid: number; totalWaived: number; admissionPaid: boolean; payments: Payment[] }>();
        allStudents.forEach(s => {
            const sp = allPayments.filter(p => p.studentId === s.id);
            map.set(s.id, {
                // WAIVED excluded from totalDue — it's resolved
                totalDue: sp.filter(p => p.status === "DUE").reduce((sum, p) => sum + p.amount, 0),
                totalPaid: sp.filter(p => p.status === "PAID").reduce((sum, p) => sum + p.amount, 0),
                totalWaived: sp.filter(p => p.status === "WAIVED").reduce((sum, p) => sum + p.amount, 0),
                admissionPaid: sp.some(p => p.type === "ADMISSION" && p.status === "PAID"),
                payments: sp,
            });
        });
        return map;
    }, [allStudents, allPayments]);

    const filteredStudents = allStudents.filter(s => {
        const matchesTab = s.status === activeTab;
        const q = searchQuery.toLowerCase();
        return matchesTab && (s.name.toLowerCase().includes(q) || (s.phone && s.phone.includes(q)));
    });

    const handleExportStudents = () => {
        const paymentHeaders = canViewPayments ? ["Total Due", "Total Paid", "Total Waived"] : [];
        const rows = [
            ["Name", "Phone", "Status", "Monthly Fee", "Joined", "Seat", "Shift", ...paymentHeaders],
            ...filteredStudents.map(student => {
                const financials = studentFinancials.get(student.id);
                const seatShift = getSeatShiftLabels(student);
                const baseRow = [
                    student.name,
                    student.phone ?? "",
                    student.status,
                    student.monthlyFee ?? "",
                    format(new Date(student.joinedAt), "yyyy-MM-dd"),
                    seatShift.hasAllocation ? seatShift.seatText : "",
                    seatShift.hasAllocation ? seatShift.shiftText : "",
                ];

                if (!canViewPayments) return baseRow;

                return [
                    ...baseRow,
                    financials?.totalDue ?? 0,
                    financials?.totalPaid ?? 0,
                    financials?.totalWaived ?? 0,
                ];
            }),
        ];

        downloadCsv(`students-${branchId}-${activeTab.toLowerCase()}.csv`, rows);
    };

    const renderFeeSummary = (item: Student) => {
        if (!canViewPayments) {
            return <span className="text-xs text-textMuted" title={paymentHelpText}>No payment access</span>;
        }

        const fin = studentFinancials.get(item.id) || { totalDue: 0, totalPaid: 0, totalWaived: 0 };

        return (
            <div className="text-xs space-y-0.5">
                <div className={cn("font-medium", fin.totalDue > 0 ? "text-red-400" : "text-textMuted")}>
                    Due: {formatCurrency(fin.totalDue)}
                </div>
                <div className="text-textSecondary">Paid: {formatCurrency(fin.totalPaid)}</div>
                {fin.totalWaived > 0 && (
                    <div className="text-amber-500/70">Waived: {formatCurrency(fin.totalWaived)}</div>
                )}
            </div>
        );
    };

    const renderStudentActions = (item: Student) => (
        <RowActions
            actions={[
                ...(canViewPayments ? [{
                    label: "View Fees",
                    icon: Eye,
                    onClick: () => { setSelectedStudent(item); setIsDrawerOpen(true); },
                }] : []),
                {
                    label: "Edit Details",
                    icon: Pencil,
                    onClick: () => setEditTarget(item),
                },
                item.status === "ACTIVE"
                    ? {
                        label: "Deactivate",
                        icon: PowerOff,
                        variant: "danger" as const,
                        onClick: () => setInactivateTarget(item),
                    }
                    : {
                        label: "Activate",
                        icon: Power,
                        onClick: () => handleActivateClick(item),
                    },
                ...(item.status === "ACTIVE" && canAllocateSeats
                    ? [{
                        label: "Allocate Seat",
                        icon: CheckCircle2,
                        onClick: () => router.push(`/branch/${branchId}/allocations?studentId=${item.id}&studentName=${encodeURIComponent(item.name)}`),
                    },
                    {
                        label: "Change Seat",
                        icon: ArrowRightLeft,
                        onClick: () => router.push(`/branch/${branchId}/allocations?changeStudentId=${item.id}&studentName=${encodeURIComponent(item.name)}`),
                    }]
                    : []
                ),
            ]}
        />
    );

    // ── Inactivate Student ────────────────────────────────────────────────────
    const handleInactivateConfirm = async (resolution: DueResolution) => {
        if (!inactivateTarget) return;
        setInactivateLoading(true);
        try {
            const res = await fetch(`/api/branches/${branchId}/students`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: inactivateTarget.id,
                    status: "INACTIVE",
                    dueResolution: resolution,
                }),
            });
            if (!res.ok) throw new Error("Failed to update status.");
            setInactivateTarget(null);
            await loadData();
        } catch {
            alert("Failed to deactivate student.");
        } finally {
            setInactivateLoading(false);
        }
    };

    // ── Activate Student (simple) ─────────────────────────────────
    const handleActivateClick = (student: Student) => {
        setActivateTarget(student);
    };

    const confirmActivate = async () => {
        if (!activateTarget) return;
        setActivateLoading(true);
        try {
            const res = await fetch(`/api/branches/${branchId}/students`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: activateTarget.id, status: "ACTIVE" }),
            });
            if (!res.ok) throw new Error();
            setAllStudents(prev => prev.map(s => s.id === activateTarget.id ? { ...s, status: "ACTIVE" as StudentStatus } : s));
            setActivateTarget(null);
        } catch {
            alert("Failed to activate student.");
        } finally {
            setActivateLoading(false);
        }
    };

    if (loading) return <PageLoadingSkeleton label="Loading students" variant="table" rows={7} />;

    if (error) {
        return (
            <div className={pageErrorStateClass}>
                <AlertCircle className={pageErrorIconClass} />
                <h2 className="text-xl font-semibold">Something went wrong</h2>
                <p className={pageMutedTextClass}>{error}</p>
                <AppButton variant="secondary" icon={ArrowLeft} onClick={() => router.push("/org")}>
                    Back to workspace
                </AppButton>
            </div>
        );
    }

    return (
        <PageShell>
            <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                    <p className={pageEyebrowClass}>Student roster</p>
                    <h1 className={cn(pageTitleClass, "mt-2 truncate")}>Students</h1>
                    <p className={pageDescriptionClass}>
                        Keep profiles, allocation context, and fee signals easy to scan without crowding the roster.
                    </p>
                </div>

                <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                    <div className="relative min-w-0 sm:w-72">
                        <Search className={cn("absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2", pageSubtleTextClass)} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="Search name or phone..."
                            className={cn(formControlClass, "h-10 pl-9 pr-3 text-sm")}
                        />
                    </div>
                    <AppButton variant="secondary" icon={Download} onClick={handleExportStudents}>
                        Export
                    </AppButton>
                    <AppButton variant="primary" icon={UserPlus} onClick={() => setIsAddModalOpen(true)}>
                        Add student
                    </AppButton>
                </div>
            </header>

            {(!canViewPayments || !canAllocateSeats) && (
                <div className="grid gap-2 md:grid-cols-2">
                    {!canViewPayments && (
                        <div className={cn("px-4 py-3 text-sm", formWarningBannerClass)}>
                            Fee details are hidden. {paymentHelpText}
                        </div>
                    )}
                    {!canAllocateSeats && (
                        <div className={cn("px-4 py-3 text-sm", formWarningBannerClass)}>
                            Seat assignment actions are disabled. {allocationHelpText}
                        </div>
                    )}
                </div>
            )}

            <div className={cn("flex flex-col gap-4 border-b pb-4 md:flex-row md:items-center md:justify-between", pageSectionDividerClass)}>
                <div className={cn("flex items-center gap-3 px-3 py-2", pageFilterShellClass)}>
                    <span className={cn("text-sm", pageSubtleTextClass)}>Shift</span>
                    <select
                        className={cn(formControlClass, "w-auto bg-[color:var(--ui-form-input-select-bg)] px-3 py-1.5 text-sm")}
                        value={selectedShift}
                        onChange={e => setSelectedShift(e.target.value)}
                    >
                        <option value="" className="bg-[color:var(--ui-form-input-select-bg)]">All Shifts</option>
                        {shifts.map(s => (
                            <option key={s.id} value={s.id} className="bg-[color:var(--ui-form-input-select-bg)]">{s.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                    <div className="flex items-center gap-2">
                        {(["ACTIVE", "INACTIVE"] as const).map(tab => (
                            <StudentTabButton
                                key={tab}
                                tab={tab}
                                active={activeTab === tab}
                                count={allStudents.filter(s => s.status === tab).length}
                                onClick={() => setActiveTab(tab)}
                            />
                        ))}
                    </div>

                    <ViewToggle value={viewMode} onChange={setViewMode} className="hidden md:inline-flex" />
                </div>
            </div>

            <DataTable
                data={filteredStudents}
                viewMode={viewMode}
                emptyMessage="No students found for this view."
                renderGridCard={(item, actions) => (
                    <div className={cn("relative flex min-h-[230px] flex-col", pageGridCardClass, pageGridCardHoverClass)}>
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                                <div className={cn("h-11 w-11 flex-shrink-0 overflow-hidden", pageFilterShellClass)}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=random`}
                                        alt={item.name}
                                        className="h-full w-full object-cover"
                                    />
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate font-medium text-[color:var(--text-primary)]">{item.name}</p>
                                    <p className={cn("truncate text-xs", pageSubtleTextClass)}>{item.phone || "No phone"}</p>
                                </div>
                            </div>
                            <div className="flex flex-shrink-0 items-start gap-2">
                                <Badge variant={item.status === "ACTIVE" ? "success" : "default"}>{item.status}</Badge>
                                {actions?.(item)}
                            </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                            <div className={pageInsetMetricClass}>
                                <div className={cn("text-xs", pageSubtleTextClass)}>Joined</div>
                                <div className={cn("mt-1 truncate", pageMutedTextClass)}>{format(new Date(item.joinedAt), "PP")}</div>
                            </div>
                            <div className={pageInsetMetricClass}>
                                <div className={cn("text-xs", pageSubtleTextClass)}>Monthly fee</div>
                                <div className="mt-1 truncate font-semibold text-[color:var(--text-primary)]">
                                    {typeof item.monthlyFee === "number" ? formatCurrency(item.monthlyFee) : "Not set"}
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                            <div className={cn("min-w-0", pageInsetMetricClass)}>
                                <div className={cn("mb-2 text-xs font-medium uppercase tracking-wide", pageSubtleTextClass)}>Seat & shift</div>
                                <StudentSeatShiftSummary student={item} />
                            </div>
                            <div className={cn("min-w-0", pageInsetMetricClass)}>
                                <div className={cn("mb-2 text-xs font-medium uppercase tracking-wide", pageSubtleTextClass)}>Fee summary</div>
                                {renderFeeSummary(item)}
                            </div>
                        </div>
                    </div>
                )}
                columns={[
                    {
                        header: "Student",
                        accessor: (item) => (
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-[color:var(--ui-form-input-select-bg)] border border-[color:var(--ui-form-surface-border)] overflow-hidden flex-shrink-0">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=random`} alt={item.name} />
                                </div>
                                <div>
                                    <p className="font-medium text-[color:var(--text-primary)]">{item.name}</p>
                                    <p className={cn("text-xs", pageSubtleTextClass)}>{item.phone || "No phone"}</p>
                                </div>
                            </div>
                        )
                    },
                    {
                        header: "Status",
                        accessor: (item) => (
                            <Badge variant={item.status === "ACTIVE" ? "success" : "default"}>{item.status}</Badge>
                        )
                    },
                    {
                        header: "Seat & Shift",
                        accessor: (item) => <StudentSeatShiftSummary student={item} />
                    },
                    {
                        header: "Fee Summary",
                        accessor: renderFeeSummary
                    },
                    {
                        header: "Joined",
                        accessor: (item) => <span className="text-sm text-textSecondary">{format(new Date(item.joinedAt), "PP")}</span>
                    },
                ]}
                actions={renderStudentActions}
            />

            {/* Add dialog */}
            <AddStudentDialog
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSuccess={() => loadData()}
                branchId={branchId}
            />

            {/* Edit dialog */}
            <EditStudentDialog
                isOpen={!!editTarget}
                student={editTarget}
                branchId={branchId}
                onClose={() => setEditTarget(null)}
                onSuccess={(updated) => {
                    setAllStudents(prev => prev.map(s => s.id === updated.id ? updated : s));
                    setEditTarget(null);
                }}
            />

            {/* Inactivate dialog */}
            <InactivateDialog
                student={inactivateTarget}
                duePayments={inactivateTarget
                    ? (allPayments.filter(p => p.studentId === inactivateTarget.id && p.status === "DUE"))
                    : []
                }
                onConfirm={handleInactivateConfirm}
                onCancel={() => setInactivateTarget(null)}
                loading={inactivateLoading}
            />

            {/* Activate dialog */}
            <ConfirmDialog
                isOpen={!!activateTarget}
                onClose={() => setActivateTarget(null)}
                onConfirm={confirmActivate}
                title="Reactivate Student"
                description={`Are you sure you want to reactivate ${activateTarget?.name}? They will be able to be allocated a seat again.`}
                confirmText="Reactivate"
                loading={activateLoading}
            />

            {/* Fee drawer */}
            <FeeDetailsDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                student={selectedStudent}
                financials={selectedStudent ? studentFinancials.get(selectedStudent.id) : undefined}
            />
        </PageShell>
    );
}

// ─── Fee Drawer ───────────────────────────────────────────────────────────────

interface FeeDetailsDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    student: Student | null;
    financials?: { totalDue: number; totalPaid: number; totalWaived: number; admissionPaid: boolean; payments: Payment[] };
}

function FeeDetailsDrawer({ isOpen, onClose, student, financials }: FeeDetailsDrawerProps) {
    if (!isOpen || !student) return null;

    const paymentBadge = (status: string) => {
        if (status === "PAID") return <Badge variant="success" className="text-[10px] h-5 px-1.5">PAID</Badge>;
        if (status === "DUE") return <Badge variant="warning" className="text-[10px] h-5 px-1.5">DUE</Badge>;
        if (status === "WAIVED") return (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                WAIVED
            </span>
        );
        return <Badge className="text-[10px] h-5 px-1.5">{status}</Badge>;
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className={cn("cursor-pointer animate-in fade-in", formDialogOverlayClass)} onClick={onClose} />
            <div className={cn("relative h-full w-full max-w-md p-6 animate-in slide-in-from-right duration-300", formDrawerPanelClass)}>
                <button onClick={onClose} className="absolute top-4 right-4 cursor-pointer text-textMuted transition-colors hover:text-[color:var(--text-primary)]">
                    <X size={20} />
                </button>

                <div className="mt-2 space-y-6">
                    <div>
                        <h3 className="text-xl font-bold text-[color:var(--text-primary)]">{student.name}</h3>
                        <p className="text-sm text-textSecondary">{student.phone}</p>
                        <div className="mt-2 text-sm text-textMuted">Joined {format(new Date(student.joinedAt), "PP")}</div>
                        <Badge className="mt-2" variant={student.status === "ACTIVE" ? "success" : "default"}>{student.status}</Badge>
                    </div>

                    <div className="space-y-4">
                        <h4 className={cn("pb-2 text-sm font-semibold uppercase tracking-wider text-textMuted", formDrawerHeaderClass)}>Payment History</h4>

                        <div className="grid grid-cols-2 gap-3 mb-1">
                            <div className={cn("p-3 text-center", formSurfaceClass)}>
                                <div className="text-xs text-textSecondary">Total Paid</div>
                                <div className="text-lg font-bold text-green-400">{formatCurrency(financials?.totalPaid || 0)}</div>
                            </div>
                            <div className={cn("p-3 text-center", formSurfaceClass)}>
                                <div className="text-xs text-textSecondary">Total Due</div>
                                <div className="text-lg font-bold text-red-400">{formatCurrency(financials?.totalDue || 0)}</div>
                            </div>
                        </div>

                        {/* Waived summary only shows if there is a resolved amount. */}
                        {(financials?.totalWaived || 0) > 0 && (
                            <div className="bg-amber-500/5 border border-amber-500/15 rounded-lg p-3 text-center">
                                <div className="text-xs text-amber-400/70">Waived (resolved, not pursued)</div>
                                <div className="text-base font-bold text-amber-400">{formatCurrency(financials?.totalWaived || 0)}</div>
                            </div>
                        )}

                        <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-2">
                            {(financials?.payments || [])
                                .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime())
                                .map(p => (
                                    <div key={p.id} className={cn(
                                        "p-3 rounded-lg border flex justify-between items-center",
                                        p.status === "WAIVED"
                                            ? "bg-[color:var(--ui-form-warning-bg)] border-[color:var(--ui-form-warning-border)] opacity-70"
                                            : "border-[color:var(--ui-form-surface-border)] bg-[color:var(--ui-form-surface-bg)]"
                                    )}>
                                        <div>
                                            <div className="text-sm font-medium text-[color:var(--text-primary)]">
                                                {p.type === "ADMISSION" ? "Admission Fee" : "Monthly Fee"}
                                            </div>
                                            <div className="text-xs text-textSecondary">Due: {format(new Date(p.dueDate), "MMM d, yyyy")}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-bold text-[color:var(--text-primary)]">{formatCurrency(p.amount)}</div>
                                            {paymentBadge(p.status)}
                                        </div>
                                    </div>
                                ))}
                            {(!financials?.payments || financials.payments.length === 0) && (
                                <p className="text-sm text-textMuted italic text-center py-4">No payment history found.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
