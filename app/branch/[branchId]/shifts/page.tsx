"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/PageHeader";
import {
    MoreVertical, Plus, Pencil, Trash2,
    Loader2, AlertCircle, Clock, IndianRupee,
    CheckCircle2, X, Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Shift {
    id: string;
    name: string;
    startTime: string | null;
    endTime: string | null;
    isReserved: boolean;
    price: number;
}

// ─── Add/Edit Dialog ────────────────────────────────────────────────────────────

interface ShiftDialogProps {
    isOpen: boolean;
    mode: "add" | "edit";
    initial?: Shift;
    branchId: string;
    onClose: () => void;
    onSuccess: (shift: Shift) => void;
}

function ShiftDialog({ isOpen, mode, initial, branchId, onClose, onSuccess }: ShiftDialogProps) {
    const [name, setName] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");
    const [price, setPrice] = useState("0");
    const [isReserved, setIsReserved] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setName(initial?.name ?? "");
            setStartTime(initial?.startTime ?? "");
            setEndTime(initial?.endTime ?? "");
            setPrice(String(initial?.price ?? 0));
            setIsReserved(initial?.isReserved ?? false);
            setError(null);
        }
    }, [isOpen, initial]);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (!name.trim()) { setError("Shift name is required."); return; }
        setLoading(true);
        setError(null);
        try {
            const url = mode === "edit" && initial
                ? `/api/branches/${branchId}/shifts/${initial.id}`
                : `/api/branches/${branchId}/shifts`;
            const method = mode === "edit" ? "PATCH" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    startTime: startTime || null,
                    endTime: endTime || null,
                    price: Number(price) || 0,
                    isReserved,
                }),
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error || "Operation failed");
            }
            const saved = await res.json();
            onSuccess(saved);
            onClose();
        } catch (err: any) {
            setError(err.message || "Something went wrong.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-sm bg-[#0f111a] border border-white/10 rounded-2xl shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <div>
                        <h2 className="text-base font-bold text-white">{mode === "add" ? "Add Shift" : "Edit Shift"}</h2>
                        <p className="text-xs text-gray-500 mt-0.5">{mode === "add" ? "Create a new time window" : "Update shift details"}</p>
                    </div>
                    <button onClick={onClose} disabled={loading} className="text-gray-500 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Shift Name *</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => { setName(e.target.value); setError(null); }}
                            placeholder="e.g. Morning, Full Time"
                            autoFocus
                            className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 px-4 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 text-sm transition-all"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Start Time</label>
                            <input
                                type="time"
                                value={startTime}
                                onChange={e => setStartTime(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 px-3 text-white focus:outline-none focus:border-cyan-500/50 text-sm transition-all"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">End Time</label>
                            <input
                                type="time"
                                value={endTime}
                                onChange={e => setEndTime(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 px-3 text-white focus:outline-none focus:border-cyan-500/50 text-sm transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Monthly Price (₹)</label>
                        <div className="relative">
                            <IndianRupee size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                type="number"
                                value={price}
                                onChange={e => setPrice(e.target.value)}
                                min="0"
                                placeholder="0"
                                className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-8 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 text-sm transition-all"
                            />
                        </div>
                    </div>

                    {/* Reserved toggle */}
                    <div className="flex items-center justify-between py-1">
                        <div>
                            <p className="text-sm text-white font-medium">Reserved Shift</p>
                            <p className="text-xs text-gray-500">Seats in this shift require manual allocation</p>
                        </div>
                        <button
                            onClick={() => setIsReserved(v => !v)}
                            className={cn(
                                "w-10 h-5 rounded-full relative transition-colors",
                                isReserved ? "bg-cyan-500" : "bg-white/10"
                            )}
                        >
                            <div className={cn(
                                "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform",
                                isReserved ? "translate-x-5" : "translate-x-0.5"
                            )} />
                        </button>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                            <AlertCircle size={13} /> {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/10">
                    <Button variant="ghost" onClick={onClose} disabled={loading} className="text-sm h-8 px-3">
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={loading || !name.trim()}
                        className="text-sm h-8 px-4 min-w-[100px] justify-center"
                    >
                        {loading
                            ? <><Loader2 size={12} className="animate-spin mr-1.5" /> {mode === "add" ? "Adding..." : "Saving..."}</>
                            : mode === "add" ? "Add Shift" : "Save Changes"
                        }
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Row dropdown ──────────────────────────────────────────────────────────────

interface RowAction { label: string; icon: React.ElementType; onClick: () => void; variant?: "danger" }

function RowActions({ actions }: { actions: RowAction[] }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open) return;
        const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, [open]);

    return (
        <div ref={ref} className="relative">
            <button onClick={() => setOpen(v => !v)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-all">
                <MoreVertical size={16} />
            </button>
            {open && (
                <div className="absolute right-0 top-9 z-50 w-40 bg-[#0f111a] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                    {actions.map((a, i) => {
                        const Icon = a.icon;
                        return (
                            <button key={i} onClick={() => { a.onClick(); setOpen(false); }}
                                className={cn("w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                                    a.variant === "danger" ? "text-red-400 hover:bg-red-500/10" : "text-gray-300 hover:bg-white/5 hover:text-white"
                                )}>
                                <Icon size={14} /> {a.label}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function ShiftsPage() {
    const params = useParams();
    const branchId = params?.branchId as string;

    const [shifts, setShifts] = useState<Shift[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

    // Dialog state
    const [dialog, setDialog] = useState<{ open: boolean; mode: "add" | "edit"; shift?: Shift }>({
        open: false, mode: "add",
    });

    const showToast = (msg: string, type: "success" | "error" = "success") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    const loadShifts = async () => {
        if (!branchId) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/branches/${branchId}/shifts`);
            if (!res.ok) throw new Error("Failed to load shifts");
            setShifts(await res.json());
            setError(null);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadShifts(); }, [branchId]);

    const handleDelete = async (shift: Shift) => {
        if (!confirm(`Delete shift "${shift.name}"? This cannot be undone.`)) return;
        try {
            const res = await fetch(`/api/branches/${branchId}/shifts/${shift.id}`, { method: "DELETE" });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error || "Delete failed");
            }
            setShifts(prev => prev.filter(s => s.id !== shift.id));
            showToast(`"${shift.name}" deleted.`);
        } catch (err: any) {
            showToast(err.message || "Delete failed.", "error");
        }
    };

    const handleDialogSuccess = (saved: Shift) => {
        setShifts(prev => {
            const idx = prev.findIndex(s => s.id === saved.id);
            if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
            return [...prev, saved];
        });
        showToast(dialog.mode === "add" ? `"${saved.name}" added.` : `"${saved.name}" updated.`);
    };

    // ── Loading
    if (loading) return <div className="p-8 flex items-center justify-center text-white"><Loader2 className="animate-spin mr-2" /> Loading shifts...</div>;

    // ── Error
    if (error) return (
        <div className="p-8 flex flex-col items-center justify-center text-white h-[50vh] space-y-4">
            <AlertCircle className="w-12 h-12 text-red-400 opacity-80" />
            <p className="text-gray-400">{error}</p>
        </div>
    );

    return (
        <div className="p-8 space-y-6 relative">
            {/* Toast */}
            {toast && (
                <div className={cn(
                    "fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border text-sm shadow-2xl animate-in fade-in slide-in-from-bottom-2",
                    toast.type === "success"
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        : "bg-red-500/10 border-red-500/20 text-red-400"
                )}>
                    {toast.type === "success" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                    {toast.msg}
                </div>
            )}

            <PageHeader
                title="Shifts"
                subtitle="Manage time windows for seat allocations."
                onAdd={() => setDialog({ open: true, mode: "add" })}
                actionLabel="Add Shift"
            />

            {shifts.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-white/10 rounded-xl text-gray-500">
                    <Clock size={36} className="mx-auto mb-3 opacity-30" />
                    <p>No shifts found.</p>
                    <button
                        onClick={() => setDialog({ open: true, mode: "add" })}
                        className="mt-3 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                        + Add your first shift
                    </button>
                </div>
            ) : (
                <Card className="overflow-hidden p-0">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/[0.02] text-zinc-400">
                                <th className="px-6 py-4 font-medium">Name</th>
                                <th className="px-6 py-4 font-medium">Time Window</th>
                                <th className="px-6 py-4 font-medium">Type</th>
                                <th className="px-6 py-4 font-medium">Price</th>
                                <th className="px-6 py-4 font-medium w-14" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {shifts.map(shift => (
                                <tr key={shift.id} className="group hover:bg-white/[0.02] transition-colors">
                                    <td className="px-6 py-4 font-medium text-zinc-200">{shift.name}</td>
                                    <td className="px-6 py-4 text-zinc-400">
                                        {shift.startTime && shift.endTime ? (
                                            <span className="font-mono flex items-center gap-1.5">
                                                <Clock size={12} className="text-zinc-600" />
                                                {shift.startTime} – {shift.endTime}
                                            </span>
                                        ) : (
                                            <span className="text-zinc-500 italic text-xs">No time limit</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {shift.isReserved
                                            ? <Badge variant="purple"><Shield size={10} className="mr-1" />Reserved</Badge>
                                            : <Badge variant="cyan">Standard</Badge>
                                        }
                                    </td>
                                    <td className="px-6 py-4 text-zinc-400">
                                        {shift.price > 0
                                            ? <span className="text-white font-medium">₹{shift.price.toLocaleString("en-IN")}</span>
                                            : <span className="text-zinc-600 italic text-xs">No price</span>
                                        }
                                    </td>
                                    <td className="px-6 py-4">
                                        <RowActions actions={[
                                            {
                                                label: "Edit",
                                                icon: Pencil,
                                                onClick: () => setDialog({ open: true, mode: "edit", shift }),
                                            },
                                            {
                                                label: "Delete",
                                                icon: Trash2,
                                                variant: "danger",
                                                onClick: () => handleDelete(shift),
                                            },
                                        ]} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
            )}

            <ShiftDialog
                isOpen={dialog.open}
                mode={dialog.mode}
                initial={dialog.shift}
                branchId={branchId}
                onClose={() => setDialog(d => ({ ...d, open: false }))}
                onSuccess={handleDialogSuccess}
            />
        </div>
    );
}
