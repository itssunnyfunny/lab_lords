"use client";
import { RecordListPage, RecordListSurface, RecordListState } from "@/components/ui/RecordList";
import { useTranslation } from "@/components/settings/LocalizedText";
import { CollectFeeDialog } from "@/components/payments/CollectFeeDialog";
import { CollectionHistory } from "@/components/payments/CollectionHistory";
import { StudentAttendance } from "@/components/attendance/StudentAttendance";
import type { BranchAccess } from "@/types";
import { remainingFee } from "@/lib/feeBalance";

import { DataTable } from "@/components/tables/DataTable";
import { ViewToggle } from "@/components/tables/ViewToggle";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { AppButton, AppSelect, Dialog, Drawer, useToast } from "@/components/ui";
import { Button } from "@/components/ui/Button";
import { BranchAccessGuard } from "@/components/auth/BranchAccessGuard";
import {
    Eye, Pencil, PowerOff, Power,
    AlertTriangle, CheckCircle2, MinusCircle, Clock, ArrowRightLeft, Armchair, Download, Search, UserPlus, MessageCircle,
    Users,
} from "lucide-react";
import { useCallback, useEffect, useState, use, useMemo, useRef } from "react";
import { students, type StudentListItem } from "@/lib/api/students";
import { payments } from "@/lib/api/payments";
import { branches } from "@/lib/api/branches";
import { StudentStatus, type Student, type Payment, type Shift } from "@/app/generated/prisma/browser";
import { format } from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";
import { AddStudentDialog } from "./AddStudentDialog";
import { EditStudentDialog } from "./EditStudentDialog";
import { StudentRecordCard } from "./StudentRecordCard";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
    formControlClass,
    formHelpTextClass,
    formSuccessBannerClass,
    formSurfaceClass,
    formSurfaceHoverClass,
    formWarningBannerClass,
} from "@/components/ui/formSurface";
import {
    pageCountBadgeClass,
    pageInsetSurfaceClass,
    pageMutedTextClass,
    pageSubtleTextClass,
} from "@/components/ui/pageSurface";
import { cn } from "@/lib/utils";
import { BRANCH_PAGE_ACCESS } from "@/lib/branchPageAccess";
import { getPermissionHelpText } from "@/lib/permissionMessages";
import { useDataViewMode } from "@/hooks/useDataViewMode";
import { RowActionsMenu, type RowActionsMenuItem } from "@/components/ui/RowActionsMenu";
import { getBranchCapabilityDecision } from "@/lib/branchCapabilities";
import type { CapabilityDecision, MultiShiftSummary, ShiftScope } from "@/types";
import Link from "next/link";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { StudentWhatsAppConsentControls } from "@/components/whatsapp/StudentWhatsAppConsentControls";
import { BulkWhatsAppConsentControls } from "@/components/whatsapp/BulkWhatsAppConsentControls";
import {
    getStudentAllocationHref,
    getStudentsHrefWithoutAction,
    mergeStudentRosterUpdate,
} from "@/lib/studentRoster";

type DueResolution = "PAID" | "WAIVED" | "KEEP";
type StudentRosterTab = "ACTIVE" | "INACTIVE";

function shiftScopeValue(scope: ShiftScope) {
    return scope.kind === "all" ? "all" : `${scope.kind}:${scope.id}`;
}

function shiftScopeFromValue(value: string): ShiftScope {
    if (value === "all") return { kind: "all" };
    const [kind, id] = value.split(":", 2);
    return kind === "multi" ? { kind: "multi", id } : { kind: "primary", id };
}

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
    const t = useTranslation();
    const { seatText, shiftText, hasAllocation } = getSeatShiftLabels(student);

    if (!hasAllocation) {
        return (
            <span className={cn("inline-flex items-center gap-1.5 border-dashed px-2.5 py-1.5 text-xs text-textMuted", pageInsetSurfaceClass)}>
                <Armchair size={13} />
                {t("No seat assigned")}</span>
        );
    }

    return (
        <div className="min-w-0 space-y-1 text-xs" title={`${seatText} - ${shiftText}`}>
            <div className="flex min-w-0 items-center gap-1.5 text-[color:var(--text-primary)]">
                <Armchair size={13} className="flex-shrink-0 text-[color:var(--ui-tone-info-text)]" />
                <span className="truncate font-medium">{seatText}</span>
            </div>
            <div className="flex min-w-0 items-center gap-1.5 text-textSecondary">
                <Clock size={13} className="flex-shrink-0 text-[color:var(--ui-tone-warning-text)]" />
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
    count?: number;
    onClick: () => void;
}) {
    const t = useTranslation();
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
                "inline-flex h-11 cursor-pointer items-center gap-2 rounded-[var(--ui-radius-control)] border px-3 text-sm font-medium transition-colors lg:h-9",
                active
                    ? activeClassName
                    : "border-transparent text-[color:var(--text-secondary)] hover:bg-[color:var(--ui-form-surface-hover-bg)] hover:text-[color:var(--text-primary)]"
            )}
        >
            {active && <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", dotClassName)} />}
            {tab === "ACTIVE" ? t("Active") : t("Inactive")}
            {count !== undefined && <span className={pageCountBadgeClass}>{count}</span>}
        </button>
    );
}

// ─── Inactivate Dialog ────────────────────────────────────────────────────────

interface InactivateDialogProps {
    student: Student | null;
    duePayments: Payment[];
    canRecordFees: boolean;
    canWaiveFees: boolean;
    onConfirm: (resolution: DueResolution) => void;
    onCancel: () => void;
    loading: boolean;
}

function InactivateDialog({ student, duePayments, canRecordFees, canWaiveFees, onConfirm, onCancel, loading }: InactivateDialogProps) {
    const t = useTranslation();
    const { formatNumber } = useUserPreferences();
    const formatCurrency = (amount: number) => formatNumber(amount, {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    });
    const [resolution, setResolution] = useState<DueResolution>("KEEP");

    const totalDue = duePayments.reduce((sum, p) => sum + remainingFee(p), 0);
    const hasDues = duePayments.length > 0;

    const resolutionOptions: { value: DueResolution; label: string; sublabel: string; icon: React.ElementType; color: string }[] = [
        {
            value: "PAID",
            label: "Collect remaining fees in Cash",
            sublabel: "Records a cash collection per due. Use Collect fee first for UPI, bank transfer or partial amounts.",
            icon: CheckCircle2,
            color: "text-[color:var(--ui-tone-success-text)]",
        },
        {
            value: "WAIVED",
            label: "Mark as Waived",
            sublabel: "Owner chose not to pursue. Cleans analytics.",
            icon: MinusCircle,
            color: "text-[color:var(--ui-tone-warning-text)]",
        },
        {
            value: "KEEP",
            label: "Keep as Due",
            sublabel: "Still expecting payment. Stays in overdue.",
            icon: Clock,
            color: "text-[color:var(--ui-tone-danger-text)]",
        },
    ];
    const allowedOptions = resolutionOptions.filter(option => option.value === "KEEP"
        || (option.value === "PAID" && canRecordFees)
        || (option.value === "WAIVED" && canWaiveFees));
    const effectiveResolution = allowedOptions.some(option => option.value === resolution) ? resolution : "KEEP";

    return (
        <Dialog
            open={Boolean(student)}
            onClose={onCancel}
            title={`Deactivate ${student?.name ?? "student"}?`}
            description={t("Their active seat allocation will be ended immediately.")}
            icon={<span className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--ui-dialog-icon-danger-bg)] text-[color:var(--ui-dialog-icon-danger-text)]"><AlertTriangle size={18} /></span>}
            role="alertdialog"
            closeDisabled={loading}
            className="max-w-md"
            footer={(
                <>
                    <Button variant="outline" onClick={onCancel} disabled={loading} data-dialog-initial-focus>
                        {t("Cancel")}</Button>
                    <Button
                        variant="danger"
                        onClick={() => onConfirm(hasDues ? effectiveResolution : "KEEP")}
                        disabled={loading}
                        isLoading={loading}
                        icon={PowerOff}
                    >
                        {t("Confirm deactivate")}</Button>
                </>
            )}
        >
            <div>
                {/* Due payments summary */}
                {hasDues ? (
                    <div className={cn("mb-5 p-4", formWarningBannerClass)}>
                        <p className="text-[color:var(--ui-tone-warning-text)] text-sm font-medium mb-1">{t("{count} unpaid billing cycle(s) - {formatCurrency} total", { count: duePayments.length, formatCurrency: formatCurrency(totalDue) })}</p>
                        <p className="text-[color:var(--ui-tone-warning-text)] text-xs">{t("How should these be resolved?")}</p>

                        <div className="mt-3 space-y-2">
                            {allowedOptions.map(opt => {
                                const Icon = opt.icon;
                                const selected = effectiveResolution === opt.value;
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
                                                {t.owned(opt.label)}
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
                        <p className="text-[color:var(--ui-tone-success-text)] text-sm font-medium">{t("No outstanding payments")}</p>
                        <p className={cn("mt-0.5 text-xs", pageSubtleTextClass)}>{t("This student has a clean financial record.")}</p>
                    </div>
                )}

                {/* Billing note */}
                <p className={cn("mb-5 border-l-2 border-[color:var(--ui-form-section-divider)] pl-3 text-xs", formHelpTextClass)}>
                    {t("No future billing cycles will be generated after deactivation.")}</p>

            </div>
        </Dialog>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StudentsPage({ params }: { params: Promise<{ branchId: string }> }) {
    const { branchId } = use(params);
    const { ownerKey } = useUserPreferences();

    return (
        <BranchAccessGuard key={`${ownerKey}:${branchId}`} branchId={branchId} permission={BRANCH_PAGE_ACCESS.students}>
            {access => (
                <StudentsContent
                    access={access}
                    branchId={branchId}
                    canViewPayments={access.permissions.view_payments}
                    canRecordFees={getBranchCapabilityDecision(access, "paymentsRecord").allowed}
                    owner={access.isOwner}
                    canViewAllocations={access.permissions.seat_allocation}
                    manageDecision={getBranchCapabilityDecision(access, "studentsManage")}
                    allocationDecision={getBranchCapabilityDecision(access, "allocationsManage")}
                    canViewWhatsApp={getBranchCapabilityDecision(access, "whatsappView").allowed}
                    canManageWhatsApp={getBranchCapabilityDecision(access, "whatsappManage").allowed}
                />
            )}
        </BranchAccessGuard>
    );
}

function StudentsContent({
    access,
    branchId,
    canViewPayments,
    canRecordFees,
    owner,
    canViewAllocations,
    manageDecision,
    allocationDecision,
    canViewWhatsApp,
    canManageWhatsApp,
}: {
    access: BranchAccess;
    branchId: string;
    canViewPayments: boolean;
    canRecordFees: boolean;
    owner: boolean;
    canViewAllocations: boolean;
    manageDecision: CapabilityDecision;
    allocationDecision: CapabilityDecision;
    canViewWhatsApp: boolean;
    canManageWhatsApp: boolean;
}) {
    const t = useTranslation();
    const router = useRouter();
    const toast = useToast();
    const { formatDate, formatNumber } = useUserPreferences();
    const formatCurrency = (amount: number) => formatNumber(amount, {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    });
    const searchParams = useSearchParams();
    const targetStudentId = searchParams.get("studentId");
    const targetStudentStatus = searchParams.get("status");
    const requestedAction = searchParams.get("action");
    const paymentHelpText = getPermissionHelpText("view_payments");
    const allocationHelpText = getPermissionHelpText("seat_allocation");

    const [allStudents, setAllStudents] = useState<StudentListItem[]>([]);
    const [allPayments, setAllPayments] = useState<Payment[]>([]);
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [multiShifts, setMultiShifts] = useState<MultiShiftSummary[]>([]);
    const [shiftOptionsLoaded, setShiftOptionsLoaded] = useState(false);
    const [studentTotals, setStudentTotals] = useState<Record<StudentRosterTab, number>>({
        ACTIVE: 0,
        INACTIVE: 0,
    });
    const [nextStudentCursor, setNextStudentCursor] = useState<string | null>(null);

    const [activeTab, setActiveTab] = useState<StudentRosterTab>(() => (
        targetStudentStatus === "INACTIVE" ? "INACTIVE" : "ACTIVE"
    ));
    const [shiftScope, setShiftScope] = useState<ShiftScope>({ kind: "all" });
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
    const [viewMode, setViewMode] = useDataViewMode();

    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [auxiliaryError, setAuxiliaryError] = useState<string | null>(null);
    const rosterRequest = useRef(0);
    const auxiliaryRequest = useRef(0);

    // Add dialog
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // Edit dialog
    const [editTarget, setEditTarget] = useState<Student | null>(null);

    // Fee drawer
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [attendanceStudent, setAttendanceStudent] = useState<Student | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // Inactivate dialog
    const [inactivateTarget, setInactivateTarget] = useState<Student | null>(null);
    const [inactivateLoading, setInactivateLoading] = useState(false);

    // Activate confirm dialog
    const [activateTarget, setActivateTarget] = useState<Student | null>(null);
    const [activateLoading, setActivateLoading] = useState(false);
    const [whatsAppTarget, setWhatsAppTarget] = useState<Student | null>(null);
    const [whatsAppBulkOpen, setWhatsAppBulkOpen] = useState(false);

    useEffect(() => {
        if (requestedAction !== "add" || !manageDecision.allowed) return;

        setIsAddModalOpen(true);
        router.replace(
            getStudentsHrefWithoutAction(branchId, searchParams.toString()),
            { scroll: false }
        );
    }, [branchId, manageDecision.allowed, requestedAction, router, searchParams]);

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            setDebouncedSearchQuery(searchQuery.trim());
        }, 300);
        return () => window.clearTimeout(timeout);
    }, [searchQuery]);

    const loadAuxiliaryData = useCallback(async () => {
        const request = ++auxiliaryRequest.current;
        try {
            const paymentListPromise = canViewPayments
                ? Promise.all([
                    payments.listAll(branchId),
                    payments.listAll(branchId, { status: "WAIVED" }),
                ]).then(([activePayments, waivedPayments]) => [...activePayments, ...waivedPayments])
                : Promise.resolve([]);

            const [paymentsList, shiftsList, multiShiftList] = await Promise.all([
                paymentListPromise,
                canViewAllocations ? branches.getShifts(branchId) : Promise.resolve([]),
                canViewAllocations ? branches.getMultiShifts(branchId) : Promise.resolve([]),
            ]);
            if (request !== auxiliaryRequest.current) return;
            setAuxiliaryError(null);
            setAllPayments(paymentsList);
            setShifts(shiftsList);
            setMultiShifts(multiShiftList);
            setShiftOptionsLoaded(true);
        } catch {
            if (request === auxiliaryRequest.current) setAuxiliaryError("Failed to load students data.");
        }
    }, [branchId, canViewAllocations, canViewPayments]);

    const loadStudentPage = useCallback(async (cursor?: string, append = false) => {
        const request = ++rosterRequest.current;
        if (append) setLoadingMore(true);
        else setLoading(true);

        try {
            const listParams = {
                status: activeTab as StudentStatus,
                shiftId: shiftScope.kind === "primary" ? shiftScope.id : undefined,
                multiShiftId: shiftScope.kind === "multi" ? shiftScope.id : undefined,
                query: debouncedSearchQuery || undefined,
            };
            const otherStatus: StudentRosterTab = activeTab === "ACTIVE" ? "INACTIVE" : "ACTIVE";

            if (append) {
                const page = await students.list(branchId, {
                    ...listParams,
                    cursor,
                    limit: 50,
                });
                if (request !== rosterRequest.current) return;
                setAllStudents(previous => [...previous, ...page.items]);
                setNextStudentCursor(page.nextCursor);
                setStudentTotals(previous => ({ ...previous, [activeTab]: page.total }));
            } else {
                const shouldResolveDeepLink = Boolean(
                    targetStudentId && (!targetStudentStatus || targetStudentStatus === activeTab)
                );
                const currentPagePromise = shouldResolveDeepLink
                    ? students.listAll(branchId, listParams).then(items => ({
                        items,
                        nextCursor: null,
                        total: items.length,
                    }))
                    : students.list(branchId, { ...listParams, limit: 50 });
                const otherCountPromise = students.list(branchId, {
                    ...listParams,
                    status: otherStatus as StudentStatus,
                    limit: 1,
                });
                const [page, otherPage] = await Promise.all([currentPagePromise, otherCountPromise]);

                if (request !== rosterRequest.current) return;
                setAllStudents(page.items);
                setNextStudentCursor(page.nextCursor);
                setStudentTotals({
                    [activeTab]: page.total,
                    [otherStatus]: otherPage.total,
                } as Record<StudentRosterTab, number>);
            }
            setError(null);
        } catch (loadError) {
            if (request !== rosterRequest.current) return;
            if (
                shiftScope.kind === "multi"
                && loadError instanceof Error
                && loadError.message.toLowerCase().includes("not found")
            ) {
                setShiftScope({ kind: "all" });
                toast.show({
                    title: "Shift filter reset",
                    description: "That multi-shift is no longer available. Showing all shifts.",
                    tone: "info",
                });
                return;
            }
            if (append) {
                toast.show({
                    title: "More students could not be loaded",
                    description: loadError instanceof Error ? loadError.message : "Try again.",
                    tone: "error",
                });
            } else {
                setError("Failed to load students data.");
            }
        } finally {
            if (request === rosterRequest.current) {
                setLoadingMore(false);
                setLoading(false);
            }
        }
    }, [activeTab, branchId, debouncedSearchQuery, shiftScope, targetStudentId, targetStudentStatus, toast]);

    useEffect(() => { void loadStudentPage(); }, [loadStudentPage]);
    useEffect(() => { void loadAuxiliaryData(); }, [loadAuxiliaryData]);
    useEffect(() => {
        const refresh = () => void loadAuxiliaryData();
        window.addEventListener("fee-collection-changed", refresh);
        window.addEventListener("focus", refresh);
        return () => { window.removeEventListener("fee-collection-changed", refresh); window.removeEventListener("focus", refresh); };
    }, [loadAuxiliaryData]);

    useEffect(() => {
        if (!shiftOptionsLoaded || shiftScope.kind !== "multi") return;
        if (multiShifts.some(multiShift => multiShift.id === shiftScope.id)) return;
        setShiftScope({ kind: "all" });
        toast.show({
            title: "Shift filter reset",
            description: "That multi-shift is no longer available. Showing all shifts.",
            tone: "info",
        });
    }, [multiShifts, shiftOptionsLoaded, shiftScope, toast]);

    const shiftFilterOptions = useMemo(() => [
        { value: "all", label: t("All Shifts") },
        ...shifts.map(shift => ({ value: `primary:${shift.id}`, label: shift.name })),
        ...multiShifts.map(multiShift => ({ value: `multi:${multiShift.id}`, label: multiShift.name })),
    ], [multiShifts, shifts, t]);

    useEffect(() => {
        if (targetStudentStatus === "ACTIVE" || targetStudentStatus === "INACTIVE") {
            setActiveTab(targetStudentStatus);
        }
    }, [targetStudentStatus]);

    // ── Financial map ─────────────────────────────────────────────────────────
    const studentFinancials = useMemo(() => {
        const map = new Map<string, { totalDue: number; totalPaid: number; totalWaived: number; admissionPaid: boolean; payments: Payment[] }>();
        allPayments.forEach(payment => {
            const current = map.get(payment.studentId) ?? {
                totalDue: 0,
                totalPaid: 0,
                totalWaived: 0,
                admissionPaid: false,
                payments: [],
            };
                // WAIVED excluded from totalDue — it's resolved
            current.payments.push(payment);
            if (payment.status === "DUE") current.totalDue += remainingFee(payment);
            current.totalPaid += payment.ledgerBacked ? payment.collectedAmount : payment.status === "PAID" ? payment.amount : 0;
            current.totalWaived += payment.ledgerBacked ? payment.waivedAmount : payment.status === "WAIVED" ? payment.amount : 0;
            if (payment.type === "ADMISSION" && payment.status === "PAID") current.admissionPaid = true;
            map.set(payment.studentId, current);
        });
        return map;
    }, [allPayments]);

    const filteredStudents = allStudents;

    useEffect(() => {
        if (loading || !targetStudentId) return;
        const target = [document.getElementById(`student-table-${targetStudentId}`), document.getElementById(`student-grid-${targetStudentId}`)].find(element => element && element.getClientRects().length > 0);
        if (!target) return;
        const focusFrame = window.requestAnimationFrame(() => {
            const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
            target.focus({ preventScroll: true });
        });
        return () => window.cancelAnimationFrame(focusFrame);
    }, [activeTab, allStudents, loading, targetStudentId, viewMode]);

    const handleExportStudents = async () => {
        setExporting(true);
        try {
            const exportStudents = await students.listAll(branchId, {
                status: activeTab as StudentStatus,
                shiftId: shiftScope.kind === "primary" ? shiftScope.id : undefined,
                multiShiftId: shiftScope.kind === "multi" ? shiftScope.id : undefined,
                query: debouncedSearchQuery || undefined,
            });
            const paymentHeaders = canViewPayments ? ["Total Due", "Total Paid", "Total Waived"] : [];
            const rows = [
                ["Name", "Phone", "Status", "Monthly Fee", "Joined", "Seat", "Shift", ...paymentHeaders],
                ...exportStudents.map(student => {
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
        } catch (exportError) {
            toast.show({
                title: "Student export failed",
                description: exportError instanceof Error ? exportError.message : "Try again.",
                tone: "error",
            });
        } finally {
            setExporting(false);
        }
    };

    const renderFeeSummary = (item: Student) => {
        if (!canViewPayments) {
            return <span className="text-xs text-textMuted" title={paymentHelpText}>{t("No payment access")}</span>;
        }

        const fin = studentFinancials.get(item.id) || { totalDue: 0, totalPaid: 0, totalWaived: 0 };

        return (
            <div className="text-xs space-y-0.5">
                <div className={cn("font-medium", fin.totalDue > 0 ? "text-[color:var(--ui-tone-danger-text)]" : "text-textMuted")}>{t("Due: {formatCurrency}", { formatCurrency: formatCurrency(fin.totalDue) })}</div>
                <div className="text-textSecondary">{t("Paid: {formatCurrency}", { formatCurrency: formatCurrency(fin.totalPaid) })}</div>
                {fin.totalWaived > 0 && (
                    <div className="text-[color:var(--ui-tone-warning-text)]">{t("Waived: {formatCurrency}", { formatCurrency: formatCurrency(fin.totalWaived) })}</div>
                )}
            </div>
        );
    };

    const renderStudentActions = (item: Student) => (
        <RowActions
            actions={[
                { label: "Attendance & QR", icon: Clock, onClick: () => setAttendanceStudent(item) },
                ...(canViewPayments ? [{
                    label: "View Fees",
                    icon: Eye,
                    onClick: () => { setSelectedStudent(item); setIsDrawerOpen(true); },
                }] : []),
                ...(manageDecision.allowed || manageDecision.blocker !== "permission" ? [{
                    label: "Edit Details",
                    icon: Pencil,
                    disabled: !manageDecision.allowed,
                    description: manageDecision.allowed ? undefined : manageDecision.reason,
                    onClick: () => setEditTarget(item),
                }] : []),
                ...(manageDecision.allowed || manageDecision.blocker !== "permission" ? [item.status === "ACTIVE"
                    ? {
                        label: "Deactivate",
                        icon: PowerOff,
                        variant: "danger" as const,
                        disabled: !manageDecision.allowed,
                        description: manageDecision.allowed ? undefined : manageDecision.reason,
                        onClick: () => setInactivateTarget(item),
                    }
                    : {
                        label: "Activate",
                        icon: Power,
                        disabled: !manageDecision.allowed,
                        description: manageDecision.allowed ? undefined : manageDecision.reason,
                        onClick: () => handleActivateClick(item),
                    }] : []),
                ...(canViewWhatsApp ? [{
                    label: "WhatsApp consent",
                    icon: MessageCircle,
                    onClick: () => setWhatsAppTarget(item),
                }] : []),
                ...(item.status === "ACTIVE" && canViewAllocations
                    ? [{
                        label: "Allocate Seat",
                        icon: CheckCircle2,
                        disabled: !allocationDecision.allowed,
                        description: allocationDecision.allowed ? undefined : allocationDecision.reason,
                        onClick: () => router.push(getStudentAllocationHref(branchId, item.id, "allocate")),
                    },
                    {
                        label: "Change Seat",
                        icon: ArrowRightLeft,
                        disabled: !allocationDecision.allowed,
                        description: allocationDecision.allowed ? undefined : allocationDecision.reason,
                        onClick: () => router.push(getStudentAllocationHref(branchId, item.id, "change")),
                    }]
                    : []
                ),
            ]}
        />
    );

    // ── Inactivate Student ────────────────────────────────────────────────────
    const handleInactivateConfirm = async (resolution: DueResolution) => {
        if (!inactivateTarget) return;
        if (!manageDecision.allowed) {
            toast.show({ title: "Student changes unavailable", description: manageDecision.reason, tone: "error" });
            return;
        }
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
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(typeof body?.error === "string" ? body.error : "Failed to update status.");
            }
            setInactivateTarget(null);
            await Promise.all([loadStudentPage(), loadAuxiliaryData()]);
            toast.show({ title: "Student deactivated", tone: "success" });
        } catch (error) {
            toast.show({
                title: "Student was not deactivated",
                description: error instanceof Error ? error.message : "Try again. No student status was changed.",
                tone: "error",
                persistent: true,
            });
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
        if (!manageDecision.allowed) {
            toast.show({ title: "Student changes unavailable", description: manageDecision.reason, tone: "error" });
            return;
        }
        setActivateLoading(true);
        try {
            const res = await fetch(`/api/branches/${branchId}/students`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: activateTarget.id, status: "ACTIVE" }),
            });
            if (!res.ok) throw new Error();
            setActivateTarget(null);
            await loadStudentPage();
            toast.show({ title: "Student reactivated", tone: "success" });
        } catch (error) {
            toast.show({
                title: "Student was not reactivated",
                description: error instanceof Error ? error.message : "Try again. No student status was changed.",
                tone: "error",
                persistent: true,
            });
        } finally {
            setActivateLoading(false);
        }
    };

    const rosterBusy = loading || (!shiftOptionsLoaded && !auxiliaryError);
    const readError = error ?? auxiliaryError;

    return (
        <RecordListPage
            title={t("Students")}
            eyebrow={t("Student roster")}
            description={t("View students, their seats and fee details.")}
            actions={<>
                    <AppButton density="compact" variant="secondary" icon={Download} onClick={() => void handleExportStudents()} isLoading={exporting} disabled={rosterBusy || Boolean(readError)}>
                        {t("Export")}</AppButton>
                    {canViewWhatsApp ? (
                        <AppButton density="compact"
                            variant="secondary"
                            icon={Users}
                            onClick={() => setWhatsAppBulkOpen(true)}
                            disabled={!canManageWhatsApp}
                            title={canManageWhatsApp ? undefined : t("You need WhatsApp management permission to record bulk consent.")}
                        >
                            {t("Bulk WhatsApp consent")}</AppButton>
                    ) : null}
                    <AppButton density="compact"
                        variant="primary"
                        icon={UserPlus}
                        onClick={() => setIsAddModalOpen(true)}
                        disabled={!manageDecision.allowed}
                        title={manageDecision.allowed ? undefined : manageDecision.reason}
                    >
                        {t("Add student")}</AppButton>
            </>}
        >

            {!manageDecision.allowed && manageDecision.blocker !== "permission" && (
                <div className={cn("px-4 py-3 text-sm", formWarningBannerClass)} role="status">
                    {t("Student changes are disabled.")} {manageDecision.reason}{" "}
                    {manageDecision.recoveryHref ? (
                        <Link className="font-semibold underline underline-offset-4" href={manageDecision.recoveryHref}>
                            {t("Resolve access")}</Link>
                    ) : null}
                </div>
            )}

            {(!canViewPayments || !canViewAllocations) && (
                <div className="grid gap-2 md:grid-cols-2">
                    {!canViewPayments && (
                        <div className={cn("px-4 py-3 text-sm", formWarningBannerClass)}>
                            {t("Fee details are hidden.")} {paymentHelpText}
                        </div>
                    )}
                    {!canViewAllocations && (
                        <div className={cn("px-4 py-3 text-sm", formWarningBannerClass)}>
                            {t("Seat assignment actions are disabled.")} {allocationHelpText}
                        </div>
                    )}
                </div>
            )}

            <RecordListSurface label={t("Students")} busy={rosterBusy} toolbar={<>
                <div className="flex min-w-0 flex-wrap items-center gap-3">
                    <div className="relative min-w-0 w-full sm:w-64">
                        <Search className={cn("absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2", pageSubtleTextClass)} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder={t("Search name or phone...")}
                            aria-label={t("Search students by name or phone")}
                            className={cn(formControlClass, "h-11 pl-9 pr-3 text-base sm:text-sm")}
                        />
                    </div>
                    <label htmlFor="student-shift-filter" className={cn("text-sm", pageSubtleTextClass)}>{t("Shift")}</label>
                    <AppSelect
                        id="student-shift-filter"
                        aria-label={t("Filter students by shift")}
                        containerClassName="min-w-48"
                        value={shiftScopeValue(shiftScope)}
                        options={shiftFilterOptions}
                        onValueChange={value => setShiftScope(shiftScopeFromValue(value))}
                    />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                    <div className="flex items-center gap-2">
                        {(["ACTIVE", "INACTIVE"] as const).map(tab => (
                            <StudentTabButton
                                key={tab}
                                tab={tab}
                                active={activeTab === tab}
                                count={loading || error ? undefined : studentTotals[tab]}
                                onClick={() => setActiveTab(tab)}
                            />
                        ))}
                    </div>

                    <ViewToggle value={viewMode} onChange={setViewMode} className="hidden lg:inline-flex" />
                </div>
            </>} footer={!rosterBusy && !readError ? <div className="flex flex-wrap items-center justify-between gap-2" aria-live="polite">
                <p className={cn("text-sm", pageMutedTextClass)}>{t("Showing {count} of {value} {toLowerCase} students", { count: allStudents.length, value: studentTotals[activeTab], toLowerCase: activeTab.toLowerCase() })}</p>
                {nextStudentCursor ? (
                    <AppButton
                        variant="secondary"
                        isLoading={loadingMore}
                        aria-label={t("Load more students")}
                        onClick={() => void loadStudentPage(nextStudentCursor, true)}
                    >
                        {t("Load more students")}</AppButton>
                ) : null}
            </div> : undefined}>
                {rosterBusy ? <RecordListState kind="loading" title="Loading students" />
                    : readError ? <RecordListState kind="error" title="Something went wrong" description={readError} onRetry={() => void Promise.all([loadStudentPage(), loadAuxiliaryData()])} />
                    : !filteredStudents.length ? <RecordListState kind="empty" title={debouncedSearchQuery || shiftScope.kind !== "all" ? "No students match this search or shift filter." : "No students in this view yet."} action={debouncedSearchQuery || shiftScope.kind !== "all" ? <AppButton onClick={() => { setSearchQuery(""); setShiftScope({ kind: "all" }); }}>{t("Clear filters")}</AppButton> : undefined} />
                    : <DataTable
                density="compact"
                caption="Students"
                data={filteredStudents}
                getRowAttributes={(item, view) => ({
                    id: `student-${view}-${item.id}`,
                    tabIndex: -1,
                    "aria-label": item.id === targetStudentId ? item.name : undefined,
                    className: item.id === targetStudentId
                        ? "rounded-[var(--ui-radius-control)] bg-[color:var(--ui-tone-info-bg)] ring-2 ring-[color:var(--ui-focus-ring)]"
                        : undefined,
                })}
                viewMode={viewMode}
                emptyMessage={t(
                    debouncedSearchQuery || shiftScope.kind !== "all"
                        ? "No students match this search or shift filter."
                        : "No students in this view yet."
                )}
                renderGridCard={(item, actions) => (
                    <StudentRecordCard student={item}
                        canViewPayments={canViewPayments}
                        financials={studentFinancials.get(item.id) ?? (canViewPayments ? { totalDue: 0, totalPaid: 0, totalWaived: 0 } : undefined)}
                        actions={actions?.(item)}
                        detailsLabel={manageDecision.allowed ? "Edit Details" : "View Fees"}
                        detailsDisabled={!manageDecision.allowed && !canViewPayments}
                        detailsReason={!manageDecision.allowed && !canViewPayments ? manageDecision.reason : undefined}
                        onDetails={() => {
                            if (manageDecision.allowed) setEditTarget(item);
                            else if (canViewPayments) { setSelectedStudent(item); setIsDrawerOpen(true); }
                        }}
                    />
                )}
                columns={[
                    {
                        header: "Student",
                        rowHeader: true,
                        accessor: (item) => (
                            <div className="flex items-center gap-3">
                                <Avatar name={item.name} size="sm" />
                                <div>
                                    <p className="font-medium text-[color:var(--text-primary)]">{item.name}</p>
                                    <p className={cn("text-xs", pageSubtleTextClass)}>{item.phone || t("No phone")}</p>
                                </div>
                            </div>
                        )
                    },
                    {
                        header: "Status",
                        accessor: (item) => (
                            <Badge variant={item.status === "ACTIVE" ? "success" : "default"}>
                                {t(item.status === "ACTIVE" ? "Active" : "Inactive")}
                            </Badge>
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
                        accessor: (item) => <span className="text-sm text-textSecondary">{formatDate(item.joinedAt)}</span>
                    },
                ]}
                actions={renderStudentActions}
            />}
            </RecordListSurface>

            {/* Add dialog */}
            <AddStudentDialog
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSuccess={() => { void Promise.all([loadStudentPage(), loadAuxiliaryData()]); }}
                branchId={branchId}
                allocationDecision={allocationDecision}
            />

            {/* Edit dialog */}
            <EditStudentDialog
                isOpen={!!editTarget}
                student={editTarget}
                branchId={branchId}
                onClose={() => setEditTarget(null)}
                onSuccess={(updated) => {
                    setAllStudents(prev => prev.map(student => (
                        student.id === updated.id
                            ? mergeStudentRosterUpdate(student, updated)
                            : student
                    )));
                    setEditTarget(null);
                }}
            />

            <Dialog
                open={Boolean(whatsAppTarget)}
                onClose={() => setWhatsAppTarget(null)}
                title={t("WhatsApp recipient and consent")}
                description={t("Review or record explicit operational consent for the assigned branch sender.")}
            >
                {whatsAppTarget ? (
                    <StudentWhatsAppConsentControls
                        branchId={branchId}
                        student={whatsAppTarget}
                        canManage={canManageWhatsApp}
                    />
                ) : null}
            </Dialog>

            <Dialog
                open={whatsAppBulkOpen}
                onClose={() => setWhatsAppBulkOpen(false)}
                title={t("Bulk WhatsApp operational consent")}
                description={t("Select only students currently loaded in this roster view. Each request is capped at 100 students.")}
                className="max-w-2xl"
            >
                <BulkWhatsAppConsentControls
                    branchId={branchId}
                    students={allStudents}
                    canManage={canManageWhatsApp}
                />
            </Dialog>

            {/* Inactivate dialog */}
            <InactivateDialog
                key={inactivateTarget?.id ?? "closed"}
                student={inactivateTarget}
                duePayments={inactivateTarget
                    ? (allPayments.filter(p => p.studentId === inactivateTarget.id && p.status === "DUE"))
                    : []
                }
                canRecordFees={canRecordFees}
                canWaiveFees={getBranchCapabilityDecision(access, "paymentsWaive").allowed}
                onConfirm={handleInactivateConfirm}
                onCancel={() => setInactivateTarget(null)}
                loading={inactivateLoading}
            />

            {/* Activate dialog */}
            <ConfirmDialog
                isOpen={!!activateTarget}
                onClose={() => setActivateTarget(null)}
                onConfirm={confirmActivate}
                title={t("Reactivate Student")}
                description={`Are you sure you want to reactivate ${activateTarget?.name}? They will be able to be allocated a seat again.`}
                confirmText="Reactivate"
                loading={activateLoading}
            />

            {/* Fee drawer */}
            <Drawer density="compact" open={!!attendanceStudent} title={attendanceStudent?.name ?? "Attendance"} onClose={() => setAttendanceStudent(null)}>
                {attendanceStudent && <StudentAttendance key={attendanceStudent.id} branchId={branchId} studentId={attendanceStudent.id} access={access} />}
            </Drawer>
            <FeeDetailsDrawer
                branchId={branchId} canRecordFees={canRecordFees} owner={owner}
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                student={selectedStudent}
                financials={selectedStudent ? studentFinancials.get(selectedStudent.id) : undefined}
            />
        </RecordListPage>
    );
}

// ─── Fee Drawer ───────────────────────────────────────────────────────────────

interface FeeDetailsDrawerProps {
    branchId: string; canRecordFees: boolean; owner: boolean;
    isOpen: boolean;
    onClose: () => void;
    student: Student | null;
    financials?: { totalDue: number; totalPaid: number; totalWaived: number; admissionPaid: boolean; payments: Payment[] };
}

function FeeDetailsDrawer({ isOpen, onClose, student, financials, branchId, canRecordFees, owner }: FeeDetailsDrawerProps) {
    const t = useTranslation();
    const [collecting, setCollecting] = useState(false);
    const { formatDate, formatNumber } = useUserPreferences();
    const formatCurrency = (amount: number) => formatNumber(amount, {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    });
    const paymentBadge = (status: string) => {
        if (status === "PAID") return <Badge variant="success" className="text-[10px] h-5 px-1.5">{t("PAID")}</Badge>;
        if (status === "DUE") return <Badge variant="warning" className="text-[10px] h-5 px-1.5">{t("DUE")}</Badge>;
        if (status === "WAIVED") return (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[color:var(--ui-form-warning-bg)] text-[color:var(--ui-tone-warning-text)] border border-[color:var(--ui-form-warning-border)]">
                {t("WAIVED")}</span>
        );
        return <Badge className="text-[10px] h-5 px-1.5">{status}</Badge>;
    };

    return (
        <Drawer
            density="compact"
            open={isOpen && Boolean(student)}
            onClose={onClose}
            title={student?.name ?? "Student fees"}
            description={student?.phone ?? "Payment history"}
            className="max-w-md"
        >
                <div className="space-y-6">
                    <div>
                        {student ? <div className="text-sm text-textMuted">{t("Joined")} {formatDate(student.joinedAt)}</div> : null}
                        {student ? (
                            <Badge className="mt-2" variant={student.status === "ACTIVE" ? "success" : "default"}>
                                {t(student.status === "ACTIVE" ? "Active" : "Inactive")}
                            </Badge>
                        ) : null}
                    </div>

                    {student && <><AppButton variant="primary" disabled={!canRecordFees} onClick={() => setCollecting(true)}>{t("Collect fee")}</AppButton>
                        <CollectionHistory branchId={branchId} studentId={student.id} owner={owner} />
                        {collecting && <CollectFeeDialog key={student.id} branchId={branchId} studentId={student.id} onClose={() => setCollecting(false)} onSaved={() => {}} />}
                    </>}
                    <div className="space-y-4">
                        <h3 className="border-b border-[color:var(--ui-form-section-divider)] pb-2 text-sm font-semibold uppercase tracking-wider text-textMuted">{t("Payment history")}</h3>

                        <div className="grid grid-cols-2 gap-3 mb-1">
                            <div className={cn("p-3 text-center", formSurfaceClass)}>
                                <div className="text-xs text-textSecondary">{t("Total Paid")}</div>
                                <div className="text-lg font-bold text-[color:var(--ui-tone-success-text)]">{formatCurrency(financials?.totalPaid || 0)}</div>
                            </div>
                            <div className={cn("p-3 text-center", formSurfaceClass)}>
                                <div className="text-xs text-textSecondary">{t("Total Due")}</div>
                                <div className="text-lg font-bold text-[color:var(--ui-tone-danger-text)]">{formatCurrency(financials?.totalDue || 0)}</div>
                            </div>
                        </div>

                        {/* Waived summary only shows if there is a resolved amount. */}
                        {(financials?.totalWaived || 0) > 0 && (
                            <div className="bg-[color:var(--ui-form-warning-bg)] border border-[color:var(--ui-form-warning-border)] rounded-lg p-3 text-center">
                                <div className="text-xs text-[color:var(--ui-tone-warning-text)]">{t("Waived (resolved, not pursued)")}</div>
                                <div className="text-base font-bold text-[color:var(--ui-tone-warning-text)]">{formatCurrency(financials?.totalWaived || 0)}</div>
                            </div>
                        )}

                        <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-2">
                            {[...(financials?.payments || [])]
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
                                                {p.type === "ADMISSION" ? t("Admission Fee") : t("Monthly Fee")}
                                            </div>
                                            <div className="text-xs text-textSecondary">{t("Due: {formatDate}", { formatDate: formatDate(p.dueDate) })}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-bold text-[color:var(--text-primary)]">{formatCurrency(p.amount)}</div>
                                            {paymentBadge(p.status)}
                                            {p.ledgerBacked ? <p className="text-xs">{t("Collected ₹{collected} · Waived ₹{waived} · Remaining ₹{remaining}", { collected: p.collectedAmount, waived: p.waivedAmount, remaining: remainingFee(p) })}{p.status === "DUE" && p.collectedAmount > 0 ? t(" · Partially paid") : ""}</p> : p.status !== "DUE" ? <p className="text-xs">{t("Historical record · no generated receipt")}</p> : null}
                                        </div>
                                    </div>
                                ))}
                            {(!financials?.payments || financials.payments.length === 0) && (
                                <p className="text-sm text-textMuted italic text-center py-4">{t("No payment history found.")}</p>
                            )}
                        </div>
                    </div>
                </div>
        </Drawer>
    );
}
