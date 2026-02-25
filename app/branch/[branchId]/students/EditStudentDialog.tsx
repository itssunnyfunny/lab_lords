"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { X, Loader2, AlertCircle, User, Phone } from "lucide-react";
import { Student } from "@prisma/client";

interface EditStudentDialogProps {
    isOpen: boolean;
    student: Student | null;
    branchId: string;
    onClose: () => void;
    onSuccess: (updated: Student) => void;
}

export function EditStudentDialog({
    isOpen,
    student,
    branchId,
    onClose,
    onSuccess,
}: EditStudentDialogProps) {
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Sync form when student changes
    useEffect(() => {
        if (student) {
            setName(student.name ?? "");
            setPhone(student.phone ?? "");
            setError(null);
        }
    }, [student]);

    if (!isOpen || !student) return null;

    const hasChanges =
        name.trim() !== (student.name ?? "") ||
        phone.trim() !== (student.phone ?? "");

    const handleSave = async () => {
        if (!name.trim()) {
            setError("Name cannot be empty.");
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/branches/${branchId}/students`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: student.id,
                    name: name.trim(),
                    phone: phone.trim(),
                }),
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error || "Failed to update");
            }
            const updated = await res.json();
            onSuccess(updated);
            onClose();
        } catch (err: any) {
            setError(err.message || "Something went wrong.");
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (loading) return;
        setError(null);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

            <div className="relative w-full max-w-sm bg-[#0f111a] border border-white/10 rounded-2xl shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <div>
                        <h2 className="text-base font-bold text-white">Edit Student</h2>
                        <p className="text-xs text-gray-500 mt-0.5">Update profile details</p>
                    </div>
                    <button onClick={handleClose} disabled={loading} className="text-gray-500 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    {/* Name */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Full Name *</label>
                        <div className="relative">
                            <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                type="text"
                                value={name}
                                onChange={e => { setName(e.target.value); setError(null); }}
                                placeholder="Student's full name"
                                autoFocus
                                className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-9 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 text-sm transition-all"
                            />
                        </div>
                    </div>

                    {/* Phone */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Phone Number</label>
                        <div className="relative">
                            <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                type="tel"
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                placeholder="e.g. 9876543210"
                                className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-9 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 text-sm transition-all"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                            <AlertCircle size={13} /> {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/10">
                    <Button variant="ghost" onClick={handleClose} disabled={loading} className="text-sm h-8 px-3">
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={loading || !hasChanges || !name.trim()}
                        className="text-sm h-8 px-4 min-w-[90px] justify-center"
                    >
                        {loading
                            ? <><Loader2 size={12} className="animate-spin mr-1.5" /> Saving...</>
                            : "Save Changes"
                        }
                    </Button>
                </div>
            </div>
        </div>
    );
}
