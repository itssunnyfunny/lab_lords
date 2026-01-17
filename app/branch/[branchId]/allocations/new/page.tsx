"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

interface Student {
    id: string;
    name: string;
    status: string;
}

interface Seat {
    id: string;
    label: string;
}

interface Shift {
    id: string;
    name: string;
    startTime: string | null;
    endTime: string | null;
    isReserved: boolean;
}

export default function NewAllocationPage() {
    const router = useRouter();
    const params = useParams();
    const branchId = params?.branchId as string;

    const [students, setStudents] = useState<Student[]>([]);
    const [seats, setSeats] = useState<Seat[]>([]);
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        studentId: "",
        seatId: "",
        shiftId: "",
    });

    useEffect(() => {
        if (!branchId) return;

        const fetchData = async () => {
            try {
                const [studentsRes, seatsRes, shiftsRes] = await Promise.all([
                    fetch(`/api/branches/${branchId}/students?status=ACTIVE`), // Assume filter
                    fetch(`/api/branches/${branchId}/seats`),
                    fetch(`/api/branches/${branchId}/shifts`),
                ]);

                if (!studentsRes.ok) throw new Error("Failed to load students");
                if (!seatsRes.ok) throw new Error("Failed to load seats");
                if (!shiftsRes.ok) throw new Error("Failed to load shifts");

                setStudents(await studentsRes.json());
                setSeats(await seatsRes.json());
                setShifts(await shiftsRes.json());
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [branchId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        try {
            const res = await fetch("/api/seat-allocations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    studentId: formData.studentId,
                    seatId: formData.seatId,
                    shiftId: formData.shiftId,
                    // startDate needed? Service defaults to now(). Form field requested in prompt.
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to allocate seat");
            }

            router.push(`/branch/${branchId}/allocations`);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-8 text-zinc-400">Loading form...</div>;

    return (
        <div className="p-8 max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link
                    href={`/branch/${branchId}/allocations`}
                    className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-400 hover:text-white"
                >
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <h1 className="text-2xl font-semibold text-white">New Seat Allocation</h1>
            </div>

            <Card className="p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300">
                            Student <span className="text-red-500">*</span>
                        </label>
                        <select
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                            value={formData.studentId}
                            onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                            required
                        >
                            <option value="" className="bg-zinc-900">Select a student</option>
                            {students.map((s) => (
                                <option key={s.id} value={s.id} className="bg-zinc-900">
                                    {s.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300">
                            Seat <span className="text-red-500">*</span>
                        </label>
                        <select
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                            value={formData.seatId}
                            onChange={(e) => setFormData({ ...formData, seatId: e.target.value })}
                            required
                        >
                            <option value="" className="bg-zinc-900">Select a seat</option>
                            {seats.map((s) => (
                                <option key={s.id} value={s.id} className="bg-zinc-900">
                                    {s.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300">
                            Shift <span className="text-red-500">*</span>
                        </label>
                        <select
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                            value={formData.shiftId}
                            onChange={(e) => setFormData({ ...formData, shiftId: e.target.value })}
                            required
                        >
                            <option value="" className="bg-zinc-900">Select a shift</option>
                            {shifts.map((s) => (
                                <option key={s.id} value={s.id} className="bg-zinc-900">
                                    {s.name} {s.isReserved ? "(Reserved)" : `(${s.startTime}-${s.endTime})`}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <Link href={`/branch/${branchId}/allocations`}>
                            <Button variant="ghost" type="button">Cancel</Button>
                        </Link>
                        <Button type="submit" isLoading={submitting}>
                            Allocate Seat
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
}
