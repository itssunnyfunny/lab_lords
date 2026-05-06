"use client";

import { useCallback, useEffect, useState, use, useRef } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
    Loader2, AlertCircle, MoreVertical,
    Pencil, Trash2, X, CheckCircle2, Shield, UserCog,
    UserPlus, Mail,
} from "lucide-react";
import { staff, StaffWithUser } from "@/lib/api/staff";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// ─── Types ──────────────────────────────────────────────────────────────────

type StaffMember = StaffWithUser;
type StaffRoleOption = "MANAGER" | "STAFF";

const ROLE_DETAILS: Record<StaffRoleOption, { label: string; summary: string; can: string[]; cannot: string[] }> = {
    MANAGER: {
        label: "Manager",
        summary: "Runs branch operations, payments, analytics, and setup.",
        can: [
            "Update branch settings, seats, shifts, and bundles",
            "Manage students and seat allocations",
            "View, collect, generate, and waive payments",
            "View analytics, AI reports, and staff overview",
        ],
        cannot: ["Add, remove, or change staff roles"],
    },
    STAFF: {
        label: "Staff",
        summary: "Handles daily desk work without setup or reporting powers.",
        can: [
            "Manage students and seat allocations",
            "View payments and mark them paid",
        ],
        cannot: [
            "Change branch settings, seats, shifts, or bundles",
            "Generate or waive payments",
            "View analytics, AI reports, or manage staff",
        ],
    },
};

function RolePermissionSummary({ role }: { role: StaffRoleOption }) {
    const details = ROLE_DETAILS[role];

    return (
        <div className="mt-2 space-y-2">
            <p className="text-xs text-gray-500">{details.summary}</p>
            <div className="grid gap-1.5">
                {details.can.map(item => (
                    <div key={item} className="flex items-start gap-2 text-xs text-emerald-300/90">
                        <CheckCircle2 size={12} className="mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                    </div>
                ))}
                {details.cannot.map(item => (
                    <div key={item} className="flex items-start gap-2 text-xs text-rose-300/90">
                        <X size={12} className="mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Row dropdown ────────────────────────────────────────────────────────────

function getErrorMessage(err: unknown, fallback = "Something went wrong.") {
    return err instanceof Error ? err.message : fallback;
}

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
        <div ref={ref} className="relative flex justify-end">
            <button onClick={() => setOpen(v => !v)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-all">
                <MoreVertical size={16} />
            </button>
            {open && (
                <div className="absolute right-0 top-9 z-50 w-44 bg-[#0f111a] border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                    {actions.map((a, i) => {
                        const Icon = a.icon;
                        return (
                            <button key={i} onClick={() => { a.onClick(); setOpen(false); }}
                                className={cn("w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                                    a.variant === "danger"
                                        ? "text-red-400 hover:bg-red-500/10"
                                        : "text-gray-300 hover:bg-white/5 hover:text-white"
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

// ─── Edit Role Dialog ────────────────────────────────────────────────────────

interface EditRoleDialogProps {
    isOpen: boolean;
    member: StaffMember | null;
    branchId: string;
    onClose: () => void;
    onSuccess: (updated: StaffMember) => void;
}

function EditRoleDialog({ isOpen, member, branchId, onClose, onSuccess }: EditRoleDialogProps) {
    const [role, setRole] = useState<StaffRoleOption>("STAFF");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (member) { setRole(member.role); setError(null); }
    }, [member]);

    if (!isOpen || !member) return null;

    const handleSave = async () => {
        if (role === member.role) { onClose(); return; }
        setLoading(true); setError(null);
        try {
            const res = await fetch(`/api/branches/${branchId}/staff/${member.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role }),
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error || "Failed to update role");
            }
            const updated = await res.json();
            onSuccess({ ...member, role: updated.role });
            onClose();
        } catch (err: unknown) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto bg-[#0f111a] border border-white/10 rounded-2xl shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <div>
                        <h2 className="text-base font-bold text-white">Change Role</h2>
                        <p className="text-xs text-gray-500 mt-0.5">{member.user?.name || member.user?.email}</p>
                    </div>
                    <button onClick={onClose} disabled={loading} className="text-gray-500 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-3">
                    {(["MANAGER", "STAFF"] as const).map(r => (
                        <button
                            key={r}
                            onClick={() => setRole(r)}
                            className={cn(
                                "w-full flex items-start gap-4 p-4 rounded-xl border transition-all text-left",
                                role === r
                                    ? "border-cyan-500/40 bg-cyan-500/5"
                                    : "border-white/5 bg-white/[0.02] hover:border-white/10"
                            )}
                        >
                            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5",
                                role === r ? "bg-cyan-500/20" : "bg-white/5"
                            )}>
                                {r === "MANAGER" ? <Shield size={15} className={role === r ? "text-cyan-400" : "text-gray-500"} /> : <UserCog size={15} className={role === r ? "text-cyan-400" : "text-gray-500"} />}
                            </div>
                            <div className="flex-1">
                                <p className={cn("text-sm font-semibold", role === r ? "text-white" : "text-gray-400")}>{ROLE_DETAILS[r].label}</p>
                                <RolePermissionSummary role={r} />
                            </div>
                            {role === r && <div className="w-4 h-4 rounded-full border-2 border-cyan-500 bg-cyan-500/30 flex-shrink-0 mt-1" />}
                        </button>
                    ))}

                    {error && (
                        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                            <AlertCircle size={13} /> {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/10">
                    <Button variant="ghost" onClick={onClose} disabled={loading} className="text-sm h-8 px-3">Cancel</Button>
                    <Button onClick={handleSave} disabled={loading || role === member.role} className="text-sm h-8 px-4 min-w-[110px] justify-center">
                        {loading
                            ? <><Loader2 size={12} className="animate-spin mr-1.5" /> Saving...</>
                            : "Save Role"
                        }
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Add Staff Dialog ────────────────────────────────────────────────────────

interface AddStaffDialogProps {
    isOpen: boolean;
    branchId: string;
    onClose: () => void;
    onSuccess: (member: StaffMember) => void;
}

function AddStaffDialog({ isOpen, branchId, onClose, onSuccess }: AddStaffDialogProps) {
    const [email, setEmail] = useState("");
    const [role, setRole] = useState<StaffRoleOption>("STAFF");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => { if (isOpen) { setEmail(""); setRole("STAFF"); setError(null); } }, [isOpen]);

    if (!isOpen) return null;

    const handleAdd = async () => {
        if (!email.trim()) { setError("Email is required."); return; }
        setLoading(true); setError(null);
        try {
            const res = await fetch(`/api/branches/${branchId}/staff`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim(), role }),
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error || "Failed to add staff");
            }
            const newMember = await res.json();
            onSuccess(newMember);
            onClose();
        } catch (err: unknown) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto bg-[#0f111a] border border-white/10 rounded-2xl shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <div>
                        <h2 className="text-base font-bold text-white">Add Staff Member</h2>
                        <p className="text-xs text-gray-500 mt-0.5">Enter their account email and assign a role</p>
                    </div>
                    <button onClick={onClose} disabled={loading} className="text-gray-500 hover:text-white transition-colors"><X size={18} /></button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Email *</label>
                        <div className="relative">
                            <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                type="email"
                                value={email}
                                onChange={e => { setEmail(e.target.value); setError(null); }}
                                placeholder="teammate@example.com"
                                autoFocus
                                className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 pl-9 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 text-sm transition-all"
                            />
                        </div>
                        <p className="text-xs text-gray-600">The user must sign in once before they can be added.</p>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Role</label>
                        <div className="grid gap-2">
                            {(["MANAGER", "STAFF"] as const).map(r => (
                                <button key={r} onClick={() => setRole(r)}
                                    className={cn("rounded-lg border p-3 text-left transition-all",
                                        role === r
                                            ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-400"
                                            : "border-white/10 bg-white/5 text-gray-400 hover:text-white hover:border-white/20"
                                    )}>
                                    <div className="flex items-center gap-2 text-sm font-semibold">
                                        {r === "MANAGER" ? <Shield size={14} /> : <UserCog size={14} />}
                                        {ROLE_DETAILS[r].label}
                                    </div>
                                    {role === r && <RolePermissionSummary role={r} />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                            <AlertCircle size={13} /> {error}
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/10">
                    <Button variant="ghost" onClick={onClose} disabled={loading} className="text-sm h-8 px-3">Cancel</Button>
                    <Button onClick={handleAdd} disabled={loading || !email.trim()} className="text-sm h-8 px-4 min-w-[100px] justify-center">
                        {loading
                            ? <><Loader2 size={12} className="animate-spin mr-1.5" /> Adding...</>
                            : "Add Staff"
                        }
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StaffPage({ params }: { params: Promise<{ branchId: string }> }) {
    const { branchId } = use(params);

    const [data, setData] = useState<StaffMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

    const [editTarget, setEditTarget] = useState<StaffMember | null>(null);
    const [addOpen, setAddOpen] = useState(false);

    const [removeTarget, setRemoveTarget] = useState<StaffMember | null>(null);
    const [removeLoading, setRemoveLoading] = useState(false);

    const showToast = (msg: string, type: "success" | "error" = "success") => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    const loadStaff = useCallback(async () => {
        try {
            const list = await staff.list(branchId);
            setData(list);
            setError(null);
        } catch {
            setError("Failed to load staff.");
        } finally {
            setLoading(false);
        }
    }, [branchId]);

    useEffect(() => { loadStaff(); }, [loadStaff]);

    const handleRemoveClick = (member: StaffMember) => {
        setRemoveTarget(member);
    };

    const confirmRemove = async () => {
        if (!removeTarget) return;
        setRemoveLoading(true);
        try {
            const res = await fetch(`/api/branches/${branchId}/staff/${removeTarget.id}`, { method: "DELETE" });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error || "Remove failed");
            }
            setData(prev => prev.filter(s => s.id !== removeTarget.id));
            setRemoveTarget(null);
            showToast(`${removeTarget.user?.name || "Member"} removed.`);
        } catch (err: unknown) {
            showToast(getErrorMessage(err, "Remove failed."), "error");
        } finally {
            setRemoveLoading(false);
        }
    };

    if (loading) return <div className="p-8 flex items-center justify-center text-white"><Loader2 className="animate-spin mr-2" /> Loading staff...</div>;

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
                title="Staff"
                subtitle="Manage team members and their access roles."
                onAdd={() => setAddOpen(true)}
                actionLabel="Add Staff"
            />

            {data.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-white/10 rounded-xl text-gray-500 space-y-3">
                    <UserPlus size={36} className="mx-auto opacity-30" />
                    <p>No staff members yet.</p>
                    <button onClick={() => setAddOpen(true)} className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors">
                        + Add your first staff member
                    </button>
                </div>
            ) : (
                <Card className="overflow-visible p-0">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/[0.02] text-zinc-400">
                                <th className="px-6 py-4 font-medium">Member</th>
                                <th className="px-6 py-4 font-medium">Role</th>
                                <th className="px-6 py-4 font-medium">Added</th>
                                <th className="px-6 py-4 font-medium w-14" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {data.map(member => (
                                <tr key={member.id} className="group hover:bg-white/[0.02] transition-colors">
                                    {/* Member */}
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-600/20 border border-white/5 flex items-center justify-center text-sm font-bold text-cyan-300 flex-shrink-0">
                                                {(member.user?.name || member.user?.email || "?")[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-medium text-zinc-200">{member.user?.name || <span className="text-gray-500 italic text-xs">No name</span>}</p>
                                                <p className="text-xs text-zinc-500 flex items-center gap-1">
                                                    <Mail size={10} />{member.user?.email}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    {/* Role */}
                                    <td className="px-6 py-4">
                                        <Badge variant={member.role === "MANAGER" ? "cyan" : "default"}>
                                            {member.role === "MANAGER"
                                                ? <><Shield size={10} className="mr-1" />Manager</>
                                                : <><UserCog size={10} className="mr-1" />Staff</>
                                            }
                                        </Badge>
                                    </td>
                                    {/* Date */}
                                    <td className="px-6 py-4 text-zinc-500 text-xs">
                                        {format(new Date(member.createdAt), "PP")}
                                    </td>
                                    {/* Actions */}
                                    <td className="px-6 py-4">
                                        <RowActions actions={[
                                            {
                                                label: "Change Role",
                                                icon: Pencil,
                                                onClick: () => setEditTarget(member),
                                            },
                                            {
                                                label: "Remove",
                                                icon: Trash2,
                                                variant: "danger",
                                                onClick: () => handleRemoveClick(member),
                                            },
                                        ]} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Card>
            )}

            {/* Edit role dialog */}
            <EditRoleDialog
                isOpen={!!editTarget}
                member={editTarget}
                branchId={branchId}
                onClose={() => setEditTarget(null)}
                onSuccess={updated => {
                    setData(prev => prev.map(m => m.id === updated.id ? updated : m));
                    setEditTarget(null);
                    showToast(`Role updated to ${updated.role}.`);
                }}
            />

            {/* Add staff dialog */}
            <AddStaffDialog
                isOpen={addOpen}
                branchId={branchId}
                onClose={() => setAddOpen(false)}
                onSuccess={member => {
                    setData(prev => [...prev, member]);
                    showToast(`Staff member added.`);
                }}
            />

            {/* Remove staff dialog */}
            <ConfirmDialog
                isOpen={!!removeTarget}
                onClose={() => setRemoveTarget(null)}
                onConfirm={confirmRemove}
                title="Remove Staff"
                description={`Are you sure you want to remove ${removeTarget?.user?.name || removeTarget?.user?.email} from this branch?`}
                confirmText="Remove"
                variant="danger"
                loading={removeLoading}
            />
        </div>
    );
}
