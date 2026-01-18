"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable } from "@/components/tables/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Edit2, Loader2, Trash2, AlertCircle, ArrowLeft } from "lucide-react";
import { useEffect, useState, use } from "react";
import { students } from "@/lib/api/students";
import { branches } from "@/lib/api/branches";
import { Student, Shift } from "@prisma/client";
import { format } from "date-fns";
import { useRouter } from "next/navigation";

import { AddStudentDialog } from "./AddStudentDialog";

export default function StudentsPage({ params }: { params: Promise<{ branchId: string }> }) {
    const { branchId } = use(params);
    const router = useRouter();
    const [data, setData] = useState<Student[]>([]);
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [selectedShift, setSelectedShift] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // Initial load for Shifts
    useEffect(() => {
        const loadShifts = async () => {
            try {
                const list = await branches.getShifts(branchId);
                setShifts(list);
            } catch (err) {
                console.error("Failed to load shifts", err);
            }
        };
        loadShifts();
    }, [branchId]);

    // Load Students on change
    useEffect(() => {
        const loadStudents = async () => {
            setLoading(true);
            try {
                const list = await students.list(branchId, selectedShift || undefined);
                setData(list);
            } catch (error: any) {
                console.error("Failed to load students", error);
                if (error.message?.includes("Branch not found") || error.response?.status === 404) {
                    setError("Branch not found.");
                } else {
                    setError("Failed to load students.");
                }
            } finally {
                setLoading(false);
            }
        };
        loadStudents();
    }, [branchId, selectedShift]);

    const handleAddStudent = () => {
        setIsAddModalOpen(true);
    };

    const handleStudentAdded = (newStudent: Student) => {
        // If we are filtering, we might need to re-fetch if the new student doesn't match filter
        // But for simplicity, we add to list if no filter or re-fetch.
        // Actually simplest is to re-fetch or just append.
        // If filter is active, we don't know if student belongs to shift (unless we check logic).
        // Let's just append for now to give immediate feedback.
        setData((prev) => [newStudent, ...prev]);
    };

    if (loading) {
        return <div className="p-8 flex items-center justify-center text-white"><Loader2 className="animate-spin mr-2" /> Loading students...</div>;
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
        <div className="p-8">
            <PageHeader
                title="Student List"
                subtitle="Manage admissions, active students, and history."
                onSearch={() => { }}
                onFilter={() => { }}
                onExport={() => { }}
                onAdd={handleAddStudent}
                actionLabel="Add Student"
            />

            {/* Filter UI */}
            <div className="flex items-center gap-3 mb-6">
                <span className="text-sm text-textMuted">Filter by Allocated Shift:</span>
                <select
                    className="bg-surface border border-white/10 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary/50"
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

            <DataTable
                data={data}
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
                        header: "Joined",
                        accessor: (item) => format(new Date(item.joinedAt), "PP")
                    },
                    { header: "Fee Breakdown", accessor: (item) => `$0` }, // Placeholder for now
                    {
                        header: "Attendance",
                        accessor: (item) => (
                            <div className="flex items-center gap-2">
                                <span className="text-textMuted font-medium">
                                    -
                                </span>
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
                ]}
                actions={() => (
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10">
                            <Edit2 size={14} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10">
                            <Trash2 size={14} className="text-danger" />
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
        </div>
    );
}

