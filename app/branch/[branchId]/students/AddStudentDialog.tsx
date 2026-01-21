"use client";

import { useState, useEffect } from "react";
import { X, Loader2, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { students } from "@/lib/api/students";
import { branches } from "@/lib/api/branches";
import { CreateStudentDto } from "@/types";
import type { Shift, Seat } from "@prisma/client";

interface AddStudentDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (student: any) => void;
    branchId: string;
}

export function AddStudentDialog({ isOpen, onClose, onSuccess, branchId }: AddStudentDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState<CreateStudentDto>({
        name: "",
        phone: "",
        monthlyFee: undefined
    });

    const [shifts, setShifts] = useState<Shift[]>([]);
    const [seats, setSeats] = useState<Seat[]>([]);
    const [isFetchingOptions, setIsFetchingOptions] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchOptions();
        }
    }, [isOpen, branchId]);

    const fetchOptions = async () => {
        setIsFetchingOptions(true);
        try {
            const [fetchedShifts, fetchedSeats] = await Promise.all([
                branches.getShifts(branchId),
                branches.getSeats(branchId)
            ]);
            setShifts(fetchedShifts);
            setSeats(fetchedSeats);
        } catch (err) {
            console.error("Failed to fetch shifts/seats:", err);
            // We continue even if this fails, just fields will be empty
        } finally {
            setIsFetchingOptions(false);
        }
    };

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            setError("Name is required");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const newStudent = await students.create(branchId, formData);
            onSuccess(newStudent);
            onClose();
            // Reset form
            setFormData({ name: "", phone: "" });
        } catch (err: any) {
            console.error("Failed to create student:", err);
            setError(err.response?.data?.error || err.response?.data?.message || err.message || "Failed to create student.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="w-full max-w-md bg-surface border border-white/10 rounded-xl shadow-2xl animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5 rounded-t-xl">
                    <h2 className="text-lg font-semibold text-white">Add New Student</h2>
                    <button
                        onClick={onClose}
                        className="text-textMuted hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="p-3 text-sm text-red-200 bg-red-900/30 border border-red-900/50 rounded-md">
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label htmlFor="name" className="text-sm font-medium text-textMuted">
                            Full Name <span className="text-red-400">*</span>
                        </label>
                        <input
                            id="name"
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 bg-background border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-white placeholder:text-white/20"
                            placeholder="e.g. John Doe"
                            autoFocus
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="phone" className="text-sm font-medium text-textMuted">
                            Phone Number
                        </label>
                        <input
                            id="phone"
                            type="tel"
                            value={formData.phone || ""}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full px-3 py-2 bg-background border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-white placeholder:text-white/20"
                            placeholder="e.g. +91 98765 43210"
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="monthlyFee" className="text-sm font-medium text-textMuted">
                            Monthly Fee (Optional)
                        </label>
                        <input
                            id="monthlyFee"
                            type="number"
                            value={formData.monthlyFee || ""}
                            onChange={(e) => setFormData({ ...formData, monthlyFee: e.target.value ? Number(e.target.value) : undefined })}
                            className="w-full px-3 py-2 bg-background border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-white placeholder:text-white/20"
                            placeholder="Leave empty for branch default"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label htmlFor="shift" className="text-sm font-medium text-textMuted">
                                Shift (Optional)
                            </label>
                            <CustomSelect
                                value={formData.shiftId}
                                onChange={(val) => setFormData({ ...formData, shiftId: val })}
                                options={shifts.map(s => ({
                                    label: `${s.name} (${s.startTime}-${s.endTime})`,
                                    value: s.id
                                }))}
                                placeholder="None"
                                disabled={isFetchingOptions}
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="seat" className="text-sm font-medium text-textMuted">
                                Seat (Optional)
                            </label>
                            <CustomSelect
                                value={formData.seatId}
                                onChange={(val) => setFormData({ ...formData, seatId: val })}
                                options={seats.map(s => ({ label: s.label, value: s.id }))}
                                placeholder="None"
                                disabled={isFetchingOptions}
                            />
                        </div>
                    </div>

                    <div className="pt-2 flex justify-end gap-3">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onClose}
                            disabled={isLoading}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="min-w-[100px]"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Adding...
                                </>
                            ) : (
                                "Add Student"
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

interface CustomSelectProps {
    value?: string;
    onChange: (value: string | undefined) => void;
    options: { label: string; value: string }[];
    placeholder?: string;
    disabled?: boolean;
}

function CustomSelect({ value, onChange, options, placeholder = "Select...", disabled }: CustomSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const selectedLabel = options.find(o => o.value === value)?.label || placeholder;

    return (
        <div className="relative">
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-transparent"
                    onClick={() => setIsOpen(false)}
                />
            )}
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`w-full px-3 py-2 bg-app border border-white/10 rounded-lg flex items-center justify-between text-left focus:outline-none focus:ring-2 focus:ring-primary/50 text-white transition-colors ${disabled ? "opacity-50 cursor-not-allowed" : "hover:border-white/20"
                    }`}
            >
                <span className={!value ? "text-white/50" : ""}>{selectedLabel}</span>
                <ChevronDown size={16} className={`text-white/50 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-surface border border-white/10 rounded-lg shadow-xl max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-100 p-1">
                    <button
                        type="button"
                        onClick={() => {
                            onChange(undefined);
                            setIsOpen(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-white/70 hover:bg-white/5 rounded-md transition-colors flex items-center gap-2"
                    >
                        <span>None</span>
                        {!value && <Check size={14} className="ml-auto text-primary" />}
                    </button>
                    {options.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                                onChange(option.value);
                                setIsOpen(false);
                            }}
                            className={`w-full px-3 py-2 text-left text-sm rounded-md transition-colors flex items-center gap-2 ${value === option.value
                                ? "bg-primary/10 text-primary"
                                : "text-white hover:bg-white/5"
                                }`}
                        >
                            <span className="truncate">{option.label}</span>
                            {value === option.value && <Check size={14} className="ml-auto" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
