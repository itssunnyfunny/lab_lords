"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable } from "@/components/tables/DataTable";
import { ViewToggle } from "@/components/tables/ViewToggle";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { BranchAccessGuard } from "@/components/auth/BranchAccessGuard";
import {
    Loader2, AlertCircle, ArrowLeft, X,
    MoreVertical, Eye, Pencil, PowerOff, Power,
    AlertTriangle, CheckCircle2, MinusCircle, Clock, ArrowRightLeft,
} from "lucide-react";
import { useCallback, useEffect, useState, use, useMemo, useRef } from "react";
import { students } from "@/lib/api/students";
import { payments } from "@/lib/api/payments";
import { branches } from "@/lib/api/branches";
import { StudentStatus, type Student, type Payment, type Shift } from "@/app/generated/prisma/browser";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { AddStudentDialog } from "./AddStudentDialog";
import { EditStudentDialog } from "./EditStudentDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/utils";
import { BRANCH_PAGE_ACCESS } from "@/lib/branchPageAccess";
import { getPermissionHelpText } from "@/lib/permissionMessages";
import { useDataViewMode } from "@/hooks/useDataViewMode";

type DueResolution = "PAID" | "WAIVED" | "KEEP";

const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

// ─── Row action dropdown ──────────────────────────────────────────────────────

interface ActionItem {
    label: string;
    icon: React.ElementType;
    onClick: () => void;
    variant?: "danger" | "default";
}

function RowActions({ actions }: { actions: ActionItem[] }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    return (
        <div ref={ref} className="relative flex justify-end">
            <button
                onClick={() => setOpen(v => !v)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-all"
                title="Actions"
            >
                <MoreVertical size={16} />
            </button>

            {open && (
                <div className="absolute right-0 top-9 z-50 w-44 bg-[#0f111a] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                    {actions.map((action, idx) => {
                        const Icon = action.icon;
                        return (
                            <button
                                key={idx}
                                onClick={() => { action.onClick(); setOpen(false); }}
                                className={cn(
                                    "w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                                    action.variant === "danger"
                                        ? "text-red-400 hover:bg-red-500/10"
                                        : "text-gray-300 hover:bg-white/5 hover:text-white"
                                )}
                            >
                                <Icon size={14} className="flex-shrink-0" />
                                {action.label}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
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
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
            <div className="relative w-full max-w-md bg-[#0f111a] border border-white/10 rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-start gap-3 mb-5">
                    <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <AlertTriangle size={18} className="text-red-400" />
                    </div>
                    <div>
                        <h3 className="text-white font-semibold text-lg leading-tight">Deactivate {student.name}?</h3>
                        <p className="text-sm text-gray-400 mt-0.5">
                            Their seat allocation will be ended immediately.
                        </p>
                    </div>
                </div>

                {/* Due payments summary */}
                {hasDues ? (
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 mb-5">
                        <p className="text-amber-300 text-sm font-medium mb-1">
                            {duePayments.length} unpaid billing cycle{duePayments.length > 1 ? "s" : ""} — {formatCurrency(totalDue)} total
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
                                                ? "border-white/20 bg-white/5"
                                                : "border-white/5 hover:border-white/10 hover:bg-white/3"
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
                                            <div className="text-xs text-gray-500 mt-0.5">{opt.sublabel}</div>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="bg-green-500/5 border border-green-500/15 rounded-xl p-4 mb-5">
                        <p className="text-green-400 text-sm font-medium">✓ No outstanding payments</p>
                        <p className="text-gray-500 text-xs mt-0.5">This student has a clean financial record.</p>
                    </div>
                )}

                {/* Billing note */}
                <p className="text-xs text-gray-500 mb-5 border-l-2 border-white/10 pl-3">
                    No future billing cycles will be generated after deactivation.
                </p>

                {/* Actions */}
                <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>
                        Cancel
                    </Button>
                    <button
                        onClick={() => onConfirm(hasDues ? resolution : "KEEP")}
                        disabled={loading}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                            "bg-red-500/80 hover:bg-red-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        )}
                    >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <PowerOff size={14} />}
                        {loading ? "Deactivating…" : "Confirm Deactivate"}
                    </button>
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

    const [allStudents, setAllStudents] = useState<Student[]>([]);
    const [allPayments, setAllPayments] = useState<Payment[]>([]);
    const [shifts, setShifts] = useState<Shift[]>([]);

    const [activeTab, setActiveTab] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
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
            const [studentsList, paymentsList, shiftsList] = await Promise.all([
                students.list(branchId, selectedShift || undefined),
                canViewPayments ? payments.list(branchId) : Promise.resolve([]),
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

    if (loading) return <div className="p-8 flex items-center justify-center text-white"><Loader2 className="animate-spin mr-2" /> Loading data...</div>;

    if (error) {
        return (
            <div className="p-8 flex flex-col items-center justify-center text-white h-[50vh] space-y-4">
                <AlertCircle className="w-12 h-12 text-red-400 opacity-80" />
                <h2 className="text-xl font-semibold">Something went wrong</h2>
                <p className="text-gray-400">{error}</p>
                <Button variant="outline" onClick={() => router.push("/org")}>
                    <ArrowLeft size={16} className="mr-2" /> Back to Workspace
                </Button>
            </div>
        );
    }

    return (
        <div className="p-8 space-y-6">
            <PageHeader
                title="Students"
                subtitle="Manage detailed student profiles and fee history."
                onSearch={q => setSearchQuery(q)}
                onFilter={() => { }}
                onExport={() => { }}
                onAdd={() => setIsAddModalOpen(true)}
                actionLabel="Add Student"
            />

            {(!canViewPayments || !canAllocateSeats) && (
                <div className="grid gap-2 md:grid-cols-2">
                    {!canViewPayments && (
                        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/80">
                            Fee details are hidden. {paymentHelpText}
                        </div>
                    )}
                    {!canAllocateSeats && (
                        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/80">
                            Seat assignment actions are disabled. {allocationHelpText}
                        </div>
                    )}
                </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                    <span className="text-sm text-textMuted">Filter:</span>
                    <select
                        className="bg-surface border border-white/10 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-500"
                        value={selectedShift}
                        onChange={e => setSelectedShift(e.target.value)}
                    >
                        <option value="" className="bg-zinc-900">All Shifts</option>
                        {shifts.map(s => (
                            <option key={s.id} value={s.id} className="bg-zinc-900">{s.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                    <div className="flex items-center gap-2">
                        {(["ACTIVE", "INACTIVE"] as const).map(tab => {
                            const active = activeTab === tab;
                            const selectedClassName = tab === "ACTIVE"
                                ? "border-emerald-500 bg-emerald-500/5 text-emerald-400"
                                : "border-zinc-500 bg-zinc-500/5 text-zinc-300";
                            const dotClassName = tab === "ACTIVE"
                                ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.65)]"
                                : "bg-zinc-300 shadow-[0_0_8px_rgba(212,212,216,0.35)]";

                            return (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    aria-current={active ? "page" : undefined}
                                    className={cn(
                                        "inline-flex items-center gap-2 rounded-t-md px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                                        active ? selectedClassName : "border-transparent text-textSecondary hover:bg-white/[0.03] hover:text-white"
                                    )}
                                >
                                    {active && <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", dotClassName)} />}
                                    {tab === "ACTIVE" ? "Active" : "Inactive"} Students
                                    <span className="bg-white/10 text-white px-2 py-0.5 rounded-full text-xs">
                                        {allStudents.filter(s => s.status === tab).length}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <ViewToggle value={viewMode} onChange={setViewMode} />
                </div>
            </div>

            <DataTable
                data={filteredStudents}
                viewMode={viewMode}
                emptyMessage="No students found for this view."
                renderGridCard={(item, actions) => (
                    <div className="relative flex min-h-[230px] flex-col rounded-lg border border-white/10 bg-card p-4 shadow-card transition-colors hover:border-white/20 hover:bg-white/[0.04]">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                                <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg border border-white/10 bg-surface">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=random`}
                                        alt={item.name}
                                        className="h-full w-full object-cover"
                                    />
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate font-medium text-white">{item.name}</p>
                                    <p className="truncate text-xs text-textMuted">{item.phone || "No phone"}</p>
                                </div>
                            </div>
                            <div className="flex flex-shrink-0 items-start gap-2">
                                <Badge variant={item.status === "ACTIVE" ? "success" : "default"}>{item.status}</Badge>
                                {actions?.(item)}
                            </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                            <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
                                <div className="text-xs text-textMuted">Joined</div>
                                <div className="mt-1 truncate text-textSecondary">{format(new Date(item.joinedAt), "PP")}</div>
                            </div>
                            <div className="rounded-lg border border-white/5 bg-white/[0.03] p-3">
                                <div className="text-xs text-textMuted">Monthly Fee</div>
                                <div className="mt-1 truncate font-semibold text-white">
                                    {typeof item.monthlyFee === "number" ? formatCurrency(item.monthlyFee) : "Not set"}
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 rounded-lg border border-white/5 bg-white/[0.03] p-3">
                            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-textMuted">Fee Summary</div>
                            {renderFeeSummary(item)}
                        </div>
                    </div>
                )}
                columns={[
                    {
                        header: "Student",
                        accessor: (item) => (
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-surface border border-white/5 overflow-hidden flex-shrink-0">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=random`} alt={item.name} />
                                </div>
                                <div>
                                    <p className="font-medium text-white">{item.name}</p>
                                    <p className="text-xs text-textMuted">{item.phone || "No phone"}</p>
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
        </div>
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
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={onClose} />
            <div className="relative w-full max-w-md bg-surface border-l border-white/10 h-full p-6 shadow-2xl animate-in slide-in-from-right duration-300">
                <button onClick={onClose} className="absolute top-4 right-4 text-textMuted hover:text-white">
                    <X size={20} />
                </button>

                <div className="mt-2 space-y-6">
                    <div>
                        <h3 className="text-xl font-bold text-white">{student.name}</h3>
                        <p className="text-sm text-textSecondary">{student.phone}</p>
                        <div className="mt-2 text-sm text-textMuted">Joined {format(new Date(student.joinedAt), "PP")}</div>
                        <Badge className="mt-2" variant={student.status === "ACTIVE" ? "success" : "default"}>{student.status}</Badge>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold uppercase tracking-wider text-textMuted border-b border-white/10 pb-2">Payment History</h4>

                        <div className="grid grid-cols-2 gap-3 mb-1">
                            <div className="bg-white/5 p-3 rounded-lg text-center">
                                <div className="text-xs text-textSecondary">Total Paid</div>
                                <div className="text-lg font-bold text-green-400">{formatCurrency(financials?.totalPaid || 0)}</div>
                            </div>
                            <div className="bg-white/5 p-3 rounded-lg text-center">
                                <div className="text-xs text-textSecondary">Total Due</div>
                                <div className="text-lg font-bold text-red-400">{formatCurrency(financials?.totalDue || 0)}</div>
                            </div>
                        </div>

                        {/* Waived summary — only show if > 0 */}
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
                                            ? "bg-amber-500/5 border-amber-500/15 opacity-70"
                                            : "bg-white/5 border-white/5"
                                    )}>
                                        <div>
                                            <div className="text-sm font-medium text-white">
                                                {p.type === "ADMISSION" ? "Admission Fee" : "Monthly Fee"}
                                            </div>
                                            <div className="text-xs text-textSecondary">Due: {format(new Date(p.dueDate), "MMM d, yyyy")}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-bold text-white">{formatCurrency(p.amount)}</div>
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
