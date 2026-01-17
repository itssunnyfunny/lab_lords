"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { X } from "lucide-react";

interface Student {
    id: string;
    name: string;
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

interface AllocateSeatModalProps {
    branchId: string;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function AllocateSeatModal({ branchId, isOpen, onClose, onSuccess }: AllocateSeatModalProps) {
    const [students, setStudents] = useState<Student[]>([]);
    const [seats, setSeats] = useState<Seat[]>([]);
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [loadingData, setLoadingData] = useState(true);

    const [formData, setFormData] = useState({
        studentId: "",
        seatId: "",
        shiftId: "",
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        const fetchData = async () => {
            setLoadingData(true);
            try {
                const [studentsRes, seatsRes, shiftsRes] = await Promise.all([
                    fetch(`/api/branches/${branchId}/students?status=ACTIVE`),
                    fetch(`/api/branches/${branchId}/seats`),
                    fetch(`/api/branches/${branchId}/shifts`),
                ]);

                if (!studentsRes.ok || !seatsRes.ok || !shiftsRes.ok) throw new Error("Failed to load options");

                const sData = await studentsRes.json();
                const seatsData = await seatsRes.json();
                const shiftsData = await shiftsRes.json();

                setStudents(sData);
                setSeats(seatsData);
                setShifts(shiftsData);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoadingData(false);
            }
        };

        fetchData();
        return () => {
            setFormData({ studentId: "", seatId: "", shiftId: "" });
            setError(null);
        };
    }, [isOpen, branchId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        try {
            const res = await fetch("/api/seat-allocations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            const data = await res.json();

            if (!res.ok) {
                // Throw specific error message from backend
                throw new Error(data.error || "Failed to allocate seat");
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-[#0a0a0e] border border-white/10 rounded-xl w-full max-w-md shadow-2xl relative overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/[0.02]">
                    <h2 className="text-xl font-semibold text-white">Allocate Seat</h2>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6">
                    {loadingData ? (
                        <div className="text-center py-8 text-zinc-500">Loading options...</div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-5">
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
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 appearance-none"
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
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 appearance-none"
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
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 appearance-none"
                                    value={formData.shiftId}
                                    onChange={(e) => setFormData({ ...formData, shiftId: e.target.value })}
                                    required
                                >
                                    <option value="" className="bg-zinc-900">Select a shift</option>
                                    {shifts.map((s) => (
                                        <option key={s.id} value={s.id} className="bg-zinc-900">
                                            {s.name} {s.isReserved ? "(Reserved)" : ""}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <Button
                                    variant="ghost"
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1"
                                    disabled={submitting}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    isLoading={submitting}
                                    className="flex-1"
                                >
                                    Allocate
                                </Button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
