"use client";

import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { branches } from "@/lib/api/branches";

interface AddSeatDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    branchId: string;
}

export function AddSeatDialog({ isOpen, onClose, onSuccess, branchId }: AddSeatDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [label, setLabel] = useState("");

    useEffect(() => {
        if (!isOpen) {
            setError(null);
            setLabel("");
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!label.trim()) {
            setError("Seat label is required");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            await branches.createSeat(branchId, label.trim());
            onSuccess();
            onClose();
        } catch (err: any) {
            const message = err.response?.data?.error || err.response?.data?.message || err.message || "Failed to create seat.";
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="w-full max-w-md bg-[#0a0c14] border border-white/10 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02] flex-shrink-0">
                    <h2 className="text-lg font-semibold text-white">Add New Seat</h2>
                    <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6">
                    <form id="add-seat-form" onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="p-3 text-sm text-red-200 bg-red-900/30 border border-red-900/50 rounded-md">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label htmlFor="label" className="text-sm font-medium text-zinc-400">
                                Seat Label <span className="text-red-400">*</span>
                            </label>
                            <input
                                id="label"
                                type="text"
                                disabled={isLoading}
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white placeholder:text-zinc-600 disabled:opacity-50"
                                placeholder="e.g. S-01, Row A - 12"
                                autoFocus
                            />
                            <p className="text-xs text-zinc-500">
                                Provide a unique identifier for this seat to distinguish it in the study hall.
                            </p>
                        </div>
                    </form>
                </div>

                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5 bg-white/[0.01] flex-shrink-0">
                    <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button type="submit" form="add-seat-form" disabled={isLoading || !label.trim()} className="min-w-[120px]">
                        {isLoading ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                        ) : (
                            "Create Seat"
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
