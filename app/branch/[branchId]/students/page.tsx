"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable } from "@/components/tables/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Loader2, AlertCircle, ArrowLeft, Eye, Power, PowerOff, X } from "lucide-react";
import { useEffect, useState, use, useMemo } from "react";
import { students } from "@/lib/api/students";
import { payments } from "@/lib/api/payments";
import { branches } from "@/lib/api/branches";
import { Student, Payment, StudentStatus, Shift } from "@prisma/client";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { AddStudentDialog } from "./AddStudentDialog";
import { cn } from "@/lib/utils";

// Helper to format currency
const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amount);
};

export default function StudentsPage({ params }: { params: Promise<{ branchId: string }> }) {
    const { branchId } = use(params);
    const router = useRouter();

    const [allStudents, setAllStudents] = useState<Student[]>([]);
    const [allPayments, setAllPayments] = useState<Payment[]>([]);
    const [shifts, setShifts] = useState<Shift[]>([]);

    // Filters
    const [activeTab, setActiveTab] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
    const [selectedShift, setSelectedShift] = useState<string>("");
    const [searchQuery, setSearchQuery] = useState("");

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // Selected student for drawer
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            // Fetch students filtered by shift if selected
            const [studentsList, paymentsList, shiftsList] = await Promise.all([
                students.list(branchId, selectedShift || undefined),
                payments.list(branchId),
                branches.getShifts(branchId)
            ]);

            setAllStudents(studentsList);
            setAllPayments(paymentsList);
            setShifts(shiftsList);
            setError(null);
        } catch (error: any) {
            console.error("Failed to load data", error);
            setError("Failed to load students data.");
        } finally {
            setLoading(false);
        }
    };

    // Re-fetch when branchId OR selectedShift changes
    useEffect(() => {
        loadData();
    }, [branchId, selectedShift]);

    const handleAddStudent = () => {
        setIsAddModalOpen(true);
    };

    const handleStudentAdded = (newStudent: Student) => {
        loadData();
    };

    const toggleStudentStatus = async (student: Student) => {
        const newStatus = student.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
        const action = newStatus === "INACTIVE" ? "deactivate" : "activate";

        if (!confirm(`Are you sure you want to ${action} ${student.name}?`)) return;

        try {
            const res = await fetch(`/api/branches/${branchId}/students`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: student.id, status: newStatus })
            });

            if (!res.ok) throw new Error("Failed to update status");

            setAllStudents(prev => prev.map(s => s.id === student.id ? { ...s, status: newStatus as StudentStatus } : s));
        } catch (err) {
            alert(`Failed to ${action} student`);
        }
    };

    // Calculate financials per student
    const studentFinancials = useMemo(() => {
        const map = new Map<string, { totalDue: number; totalPaid: number; admissionPaid: boolean; payments: Payment[] }>();

        allStudents.forEach(s => {
            const studentPayments = allPayments.filter(p => p.studentId === s.id);
            const due = studentPayments.filter(p => p.status === "DUE").reduce((sum, p) => sum + p.amount, 0);
            const paid = studentPayments.filter(p => p.status === "PAID").reduce((sum, p) => sum + p.amount, 0);
            const admissionPaid = studentPayments.some(p => p.type === "ADMISSION" && p.status === "PAID");

            map.set(s.id, {
                totalDue: due,
                totalPaid: paid,
                admissionPaid,
                payments: studentPayments
            });
        });
        return map;
    }, [allStudents, allPayments]);

    // Filter students by Tab and Search (Shift is handled by API)
    const filteredStudents = allStudents.filter(s => {
        const matchesTab = s.status === activeTab;
        const query = searchQuery.toLowerCase();
        const matchesSearch = s.name.toLowerCase().includes(query) || (s.phone && s.phone.includes(query));

        return matchesTab && matchesSearch;
    });

    if (loading) {
        return <div className="p-8 flex items-center justify-center text-white"><Loader2 className="animate-spin mr-2" /> Loading data...</div>;
    }

    if (error) {
        return (
            <div className="p-8 flex flex-col items-center justify-center text-white h-[50vh] space-y-4">
                <AlertCircle className="w-12 h-12 text-red-400 opacity-80" />
                <h2 className="text-xl font-semibold">Something went wrong</h2>
                <p className="text-gray-400">{error}</p>
                <Button variant="outline" onClick={() => router.push("/org")}>
                    <ArrowLeft size={16} className="mr-2" />
                    Back to Workspace
                </Button>
            </div>
        );
    }

    return (
        <div className="p-8 space-y-6">
            <PageHeader
                title="Students"
                subtitle="Manage detailed student profiles and fee history."
                onSearch={(q) => setSearchQuery(q)}
                onFilter={() => { }}
                onExport={() => { }}
                onAdd={handleAddStudent}
                actionLabel="Add Student"
            />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
                {/* Shift Filter (Left) */}
                <div className="flex items-center gap-3">
                    <span className="text-sm text-textMuted">Filter:</span>
                    <select
                        className="bg-surface border border-white/10 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-500"
                        value={selectedShift}
                        onChange={(e) => setSelectedShift(e.target.value)}
                    >
                        <option value="" className="bg-zinc-900">All Shifts</option>
                        {shifts.map((s) => (
                            <option key={s.id} value={s.id} className="bg-zinc-900">
                                {s.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Tabs (Right) */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setActiveTab("ACTIVE")}
                        className={cn(
                            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                            activeTab === "ACTIVE"
                                ? "border-brand-500 text-brand-400"
                                : "border-transparent text-textSecondary hover:text-white"
                        )}
                    >
                        Active Students
                        <span className="ml-2 bg-white/10 text-white px-2 py-0.5 rounded-full text-xs">
                            {allStudents.filter(s => s.status === "ACTIVE").length}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab("INACTIVE")}
                        className={cn(
                            "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                            activeTab === "INACTIVE"
                                ? "border-brand-500 text-brand-400"
                                : "border-transparent text-textSecondary hover:text-white"
                        )}
                    >
                        Inactive Students
                        <span className="ml-2 bg-white/10 text-white px-2 py-0.5 rounded-full text-xs">
                            {allStudents.filter(s => s.status === "INACTIVE").length}
                        </span>
                    </button>
                </div>
            </div>

            <DataTable
                data={filteredStudents}
                columns={[
                    {
                        header: "Student Name",
                        accessor: (item) => (
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-surface border border-white/5 overflow-hidden flex-shrink-0">
                                    <img src={`https://ui-avatars.com/api/?name=${item.name}&background=random`} alt={item.name} />
                                </div>
                                <div>
                                    <p className="font-medium text-white">{item.name}</p>
                                    <p className="text-xs text-textmuted">{item.phone || "No phone"}</p>
                                </div>
                            </div>
                        )
                    },
                    {
                        header: "Status",
                        accessor: (item) => (
                            <Badge variant={item.status === "ACTIVE" ? "success" : "default"}>
                                {item.status}
                            </Badge>
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
                                    <div className="text-textSecondary">
                                        Paid: {formatCurrency(fin.totalPaid)}
                                    </div>
                                </div>
                            );
                        }
                    },
                    {
                        header: "Joined",
                        accessor: (item) => format(new Date(item.joinedAt), "PP")
                    },
                ]}
                actions={(item) => (
                    <div className="flex justify-end gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-white/10"
                            onClick={() => {
                                setSelectedStudent(item);
                                setIsDrawerOpen(true);
                            }}
                            title="View Fee Details"
                        >
                            <Eye size={16} className="text-brand-400" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-white/10"
                            onClick={() => toggleStudentStatus(item)}
                            title={item.status === "ACTIVE" ? "Deactivate" : "Activate"}
                        >
                            {item.status === "ACTIVE" ? (
                                <PowerOff size={16} className="text-red-400" />
                            ) : (
                                <Power size={16} className="text-green-400" />
                            )}
                        </Button>
                    </div>
                )}
            />

            <AddStudentDialog
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSuccess={handleStudentAdded}
                branchId={branchId}
            />

            <FeeDetailsDrawer
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                student={selectedStudent}
                financials={selectedStudent ? studentFinancials.get(selectedStudent.id) : undefined}
            />
        </div>
    );
}

// Sub-component for Drawer
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
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-textMuted hover:text-white"
                >
                    <X size={20} />
                </button>

                <div className="mt-2 space-y-6">
                    <div>
                        <h3 className="text-xl font-bold text-white">{student.name}</h3>
                        <p className="text-sm text-textSecondary">{student.phone}</p>
                        <div className="mt-2 text-sm text-textMuted">
                            Joined {format(new Date(student.joinedAt), "PP")}
                        </div>
                        <Badge className="mt-2" variant={student.status === "ACTIVE" ? "success" : "default"}>
                            {student.status}
                        </Badge>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold uppercase tracking-wider text-textMuted border-b border-white/10 pb-2">
                            Payment History
                        </h4>

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
                                    <div key={p.id} className="p-3 bg-white/5 rounded-lg border border-white/5 flex justify-between items-center group hover:bg-white/10 transition-colors">
                                        <div>
                                            <div className="text-sm font-medium text-white">
                                                {p.type === "ADMISSION" ? "Admission Fee" : `Monthly Fee`}
                                            </div>
                                            <div className="text-xs text-textSecondary">
                                                Due: {format(new Date(p.dueDate), "MMM d, yyyy")}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-bold text-white">{formatCurrency(p.amount)}</div>
                                            <Badge
                                                variant={p.status === "PAID" ? "success" : p.status === "DUE" ? "warning" : "danger"}
                                                className="text-[10px] h-5 px-1.5"
                                            >
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
