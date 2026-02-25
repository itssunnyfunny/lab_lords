"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable } from "@/components/tables/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
    Loader2, AlertCircle, ArrowLeft, X,
    MoreVertical, Eye, Pencil, PowerOff, Power,
} from "lucide-react";
import { useEffect, useState, use, useMemo, useRef } from "react";
import { students } from "@/lib/api/students";
import { payments } from "@/lib/api/payments";
import { branches } from "@/lib/api/branches";
import { Student, Payment, StudentStatus, Shift } from "@prisma/client";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { AddStudentDialog } from "./AddStudentDialog";
import { EditStudentDialog } from "./EditStudentDialog";
import { cn } from "@/lib/utils";

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

    // Close on outside click
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StudentsPage({ params }: { params: Promise<{ branchId: string }> }) {
    const { branchId } = use(params);
    const router = useRouter();

    const [allStudents, setAllStudents] = useState<Student[]>([]);
    const [allPayments, setAllPayments] = useState<Payment[]>([]);
    const [shifts, setShifts] = useState<Shift[]>([]);

    const [activeTab, setActiveTab] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
    const [selectedShift, setSelectedShift] = useState<string>("");
    const [searchQuery, setSearchQuery] = useState("");

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Add dialog
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // Edit dialog
    const [editTarget, setEditTarget] = useState<Student | null>(null);

    // Fee drawer
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const [studentsList, paymentsList, shiftsList] = await Promise.all([
                students.list(branchId, selectedShift || undefined),
                payments.list(branchId),
                branches.getShifts(branchId),
            ]);
            setAllStudents(studentsList);
            setAllPayments(paymentsList);
            setShifts(shiftsList);
            setError(null);
        } catch (err: any) {
            setError("Failed to load students data.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, [branchId, selectedShift]);

    const toggleStudentStatus = async (student: Student) => {
        const newStatus = student.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
        if (!confirm(`${newStatus === "INACTIVE" ? "Deactivate" : "Activate"} ${student.name}?`)) return;
        try {
            const res = await fetch(`/api/branches/${branchId}/students`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: student.id, status: newStatus }),
            });
            if (!res.ok) throw new Error();
            setAllStudents(prev => prev.map(s => s.id === student.id ? { ...s, status: newStatus as StudentStatus } : s));
        } catch {
            alert("Failed to update status.");
        }
    };

    const studentFinancials = useMemo(() => {
        const map = new Map<string, { totalDue: number; totalPaid: number; admissionPaid: boolean; payments: Payment[] }>();
        allStudents.forEach(s => {
            const sp = allPayments.filter(p => p.studentId === s.id);
            map.set(s.id, {
                totalDue: sp.filter(p => p.status === "DUE").reduce((sum, p) => sum + p.amount, 0),
                totalPaid: sp.filter(p => p.status === "PAID").reduce((sum, p) => sum + p.amount, 0),
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

                <div className="flex items-center gap-2">
                    {(["ACTIVE", "INACTIVE"] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={cn(
                                "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                                activeTab === tab
                                    ? "border-brand-500 text-brand-400"
                                    : "border-transparent text-textSecondary hover:text-white"
                            )}
                        >
                            {tab === "ACTIVE" ? "Active" : "Inactive"} Students
                            <span className="ml-2 bg-white/10 text-white px-2 py-0.5 rounded-full text-xs">
                                {allStudents.filter(s => s.status === tab).length}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            <DataTable
                data={filteredStudents}
                columns={[
                    {
                        header: "Student",
                        accessor: (item) => (
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-surface border border-white/5 overflow-hidden flex-shrink-0">
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
                        accessor: (item) => {
                            const fin = studentFinancials.get(item.id) || { totalDue: 0, totalPaid: 0 };
                            return (
                                <div className="text-xs">
                                    <div className={cn("font-medium", fin.totalDue > 0 ? "text-red-400" : "text-textMuted")}>
                                        Due: {formatCurrency(fin.totalDue)}
                                    </div>
                                    <div className="text-textSecondary">Paid: {formatCurrency(fin.totalPaid)}</div>
                                </div>
                            );
                        }
                    },
                    {
                        header: "Joined",
                        accessor: (item) => <span className="text-sm text-textSecondary">{format(new Date(item.joinedAt), "PP")}</span>
                    },
                ]}
                actions={(item) => (
                    <RowActions
                        actions={[
                            {
                                label: "View Fees",
                                icon: Eye,
                                onClick: () => { setSelectedStudent(item); setIsDrawerOpen(true); },
                            },
                            {
                                label: "Edit Details",
                                icon: Pencil,
                                onClick: () => setEditTarget(item),
                            },
                            {
                                label: item.status === "ACTIVE" ? "Deactivate" : "Activate",
                                icon: item.status === "ACTIVE" ? PowerOff : Power,
                                variant: item.status === "ACTIVE" ? "danger" : "default",
                                onClick: () => toggleStudentStatus(item),
                            },
                        ]}
                    />
                )}
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

// ─── Fee Drawer (unchanged) ───────────────────────────────────────────────────

interface FeeDetailsDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    student: Student | null;
    financials?: { totalDue: number; totalPaid: number; admissionPaid: boolean; payments: Payment[] };
}

function FeeDetailsDrawer({ isOpen, onClose, student, financials }: FeeDetailsDrawerProps) {
    if (!isOpen || !student) return null;

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

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="bg-white/5 p-3 rounded-lg text-center">
                                <div className="text-xs text-textSecondary">Total Paid</div>
                                <div className="text-lg font-bold text-green-400">{formatCurrency(financials?.totalPaid || 0)}</div>
                            </div>
                            <div className="bg-white/5 p-3 rounded-lg text-center">
                                <div className="text-xs text-textSecondary">Total Due</div>
                                <div className="text-lg font-bold text-red-400">{formatCurrency(financials?.totalDue || 0)}</div>
                            </div>
                        </div>

                        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                            {(financials?.payments || [])
                                .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime())
                                .map(p => (
                                    <div key={p.id} className="p-3 bg-white/5 rounded-lg border border-white/5 flex justify-between items-center">
                                        <div>
                                            <div className="text-sm font-medium text-white">
                                                {p.type === "ADMISSION" ? "Admission Fee" : "Monthly Fee"}
                                            </div>
                                            <div className="text-xs text-textSecondary">Due: {format(new Date(p.dueDate), "MMM d, yyyy")}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-bold text-white">{formatCurrency(p.amount)}</div>
                                            <Badge variant={p.status === "PAID" ? "success" : p.status === "DUE" ? "warning" : "danger"} className="text-[10px] h-5 px-1.5">
                                                {p.status}
                                            </Badge>
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
