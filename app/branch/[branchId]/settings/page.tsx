"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { useEffect, useState, use } from "react";
import { branches } from "@/lib/api/branches";
import {
    Loader2, CheckCircle2, AlertCircle, ArrowRight,
    Armchair, Users, Clock, AlertTriangle, Shield,
    IndianRupee, Building2, CalendarClock,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type SaveStatus = "idle" | "saving" | "success" | "error";

interface ActiveShift {
    id: string;
    name: string;
    startTime: string | null;
    endTime: string | null;
    price: number;
    isReserved: boolean;
}

interface BranchData {
    id: string;
    name: string;
    city?: string | null;
    defaultFee?: number | null;
    createdAt: string;
    organization?: { name: string } | null;
    _count?: {
        seats: number;
        students: number;
        shifts: number;
        payments: number;
    };
    shifts?: ActiveShift[];
}

// ─── Stat Card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
    label: string;
    value: number | string;
    icon: React.ElementType;
    iconColor: string;
    iconBg: string;
    accent?: boolean;
}

function StatCard({ label, value, icon: Icon, iconColor, iconBg, accent }: StatCardProps) {
    return (
        <div className={cn(
            "relative overflow-hidden rounded-xl border p-4 transition-all",
            accent
                ? "bg-amber-500/[0.05] border-amber-500/20"
                : "bg-white/[0.03] border-white/8 hover:border-white/15 hover:bg-white/[0.05]"
        )}>
            <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
                    <p className={cn(
                        "text-2xl font-bold tabular-nums",
                        accent ? "text-amber-300" : "text-white"
                    )}>
                        {value}
                    </p>
                </div>
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", iconBg)}>
                    <Icon size={16} className={iconColor} />
                </div>
            </div>
        </div>
    );
}

// ─── Shift Row ─────────────────────────────────────────────────────────────────

function ShiftRow({ shift }: { shift: ActiveShift }) {
    const hasTime = shift.startTime && shift.endTime;
    const timeLabel = hasTime
        ? `${shift.startTime} – ${shift.endTime}`
        : "Open / Flexible";

    return (
        <div className="flex items-center gap-4 py-3 border-b border-white/[0.06] last:border-0 group">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
                <CalendarClock size={14} className="text-cyan-400" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-white">{shift.name}</span>
                    {shift.isReserved && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20 text-[10px] font-medium text-violet-400">
                            <Shield size={9} /> Reserved
                        </span>
                    )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                    <Clock size={10} /> {timeLabel}
                </p>
            </div>
            <div className="flex items-center gap-1 text-sm font-semibold text-emerald-400 shrink-0">
                <IndianRupee size={12} />{shift.price.toLocaleString("en-IN")}
                <span className="text-xs font-normal text-gray-600">/mo</span>
            </div>
        </div>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function SettingsPage({ params }: { params: Promise<{ branchId: string }> }) {
    const { branchId } = use(params);
    const router = useRouter();

    const [branch, setBranch] = useState<BranchData | null>(null);
    const [loading, setLoading] = useState(true);

    // Editable fields
    const [branchName, setBranchName] = useState("");
    const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        const loadBranch = async () => {
            try {
                const data = await branches.getDetails(branchId);
                setBranch(data);
                setBranchName(data.name ?? "");
            } catch (error) {
                console.error("Failed to load branch details", error);
            } finally {
                setLoading(false);
            }
        };
        loadBranch();
    }, [branchId]);

    const handleSave = async () => {
        if (!branchName.trim()) {
            setErrorMessage("Branch name cannot be empty.");
            setSaveStatus("error");
            return;
        }
        setSaveStatus("saving");
        setErrorMessage("");
        try {
            const res = await fetch(`/api/branches/${branchId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: branchName.trim() }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to save");
            }
            const updated = await res.json();
            setBranch(updated);
            setBranchName(updated.name);
            setSaveStatus("success");
            setTimeout(() => setSaveStatus("idle"), 3000);
        } catch (err: any) {
            setErrorMessage(err.message || "Something went wrong.");
            setSaveStatus("error");
        }
    };

    const hasChanges = branch && branchName.trim() !== branch.name;

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center text-white min-h-[300px]">
                <Loader2 className="animate-spin mr-2 text-cyan-400" />
                <span className="text-gray-400">Loading settings...</span>
            </div>
        );
    }

    if (!branch) {
        return (
            <div className="p-8 flex items-center gap-3 text-gray-400">
                <AlertCircle size={18} className="text-red-400" />
                Branch not found.
            </div>
        );
    }

    const counts = branch._count ?? { seats: 0, students: 0, shifts: 0, payments: 0 };
    const activeShifts = branch.shifts ?? [];

    return (
        <div className="p-8 max-w-4xl space-y-8">
            <PageHeader title="Branch Settings" subtitle="Manage branch details and view live operational stats." />

            {/* ─── At-a-Glance ─────────────────────────────────────────── */}
            <section>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">At a Glance</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatCard
                        label="Total Seats"
                        value={counts.seats}
                        icon={Armchair}
                        iconColor="text-cyan-400"
                        iconBg="bg-cyan-500/10"
                    />
                    <StatCard
                        label="Active Students"
                        value={counts.students}
                        icon={Users}
                        iconColor="text-emerald-400"
                        iconBg="bg-emerald-500/10"
                    />
                    <StatCard
                        label="Active Shifts"
                        value={counts.shifts}
                        icon={Clock}
                        iconColor="text-violet-400"
                        iconBg="bg-violet-500/10"
                    />
                    <StatCard
                        label="Payments Due"
                        value={counts.payments}
                        icon={AlertTriangle}
                        iconColor="text-amber-400"
                        iconBg="bg-amber-500/10"
                        accent={counts.payments > 0}
                    />
                </div>
            </section>

            {/* ─── Active Shifts ────────────────────────────────────────── */}
            <section>
                <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Active Shifts</p>
                    <button
                        onClick={() => router.push(`/branch/${branchId}/shifts`)}
                        className="flex items-center gap-1.5 text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                        Manage Shifts <ArrowRight size={13} />
                    </button>
                </div>

                <div className="bg-white/[0.03] border border-white/8 rounded-xl px-4">
                    {activeShifts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mb-3">
                                <CalendarClock size={18} className="text-gray-600" />
                            </div>
                            <p className="text-sm text-gray-500 font-medium">No active shifts</p>
                            <p className="text-xs text-gray-600 mt-1">Go to Manage Shifts to create one.</p>
                        </div>
                    ) : (
                        activeShifts.map(shift => <ShiftRow key={shift.id} shift={shift} />)
                    )}
                </div>
            </section>

            {/* ─── General Information ──────────────────────────────────── */}
            <section>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">General Information</p>
                <div className="bg-white/[0.03] border border-white/8 rounded-xl p-6 space-y-6">

                    {/* Fields grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        {/* Branch Name */}
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Building2 size={11} /> Branch Name
                            </label>
                            <input
                                type="text"
                                value={branchName}
                                onChange={(e) => {
                                    setBranchName(e.target.value);
                                    if (saveStatus === "error" || saveStatus === "success") {
                                        setSaveStatus("idle");
                                    }
                                }}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 text-sm transition-all"
                                placeholder="Enter branch name"
                            />
                        </div>

                        {/* Organization — read only */}
                        <div className="space-y-2">
                            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Building2 size={11} /> Organization
                            </label>
                            <input
                                type="text"
                                value={branch.organization?.name || "N/A"}
                                disabled
                                className="w-full bg-white/[0.02] border border-white/[0.06] rounded-lg px-4 py-2.5 text-gray-500 cursor-not-allowed text-sm"
                            />
                        </div>
                    </div>

                    {/* Meta row */}
                    <div className="flex items-center gap-4 pt-1 border-t border-white/[0.06]">
                        <div className="text-xs text-gray-600">
                            <span className="text-gray-500 font-medium">Branch ID</span>{" "}
                            <span className="font-mono text-gray-600">{branchId}</span>
                        </div>
                    </div>

                    {/* Status feedback */}
                    {saveStatus === "success" && (
                        <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-2.5">
                            <CheckCircle2 size={15} /> Branch name updated successfully.
                        </div>
                    )}
                    {saveStatus === "error" && (
                        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5">
                            <AlertCircle size={15} /> {errorMessage}
                        </div>
                    )}

                    <div className="flex justify-end">
                        <Button
                            onClick={handleSave}
                            disabled={saveStatus === "saving" || !hasChanges}
                            className="min-w-[130px] justify-center"
                        >
                            {saveStatus === "saving" ? (
                                <><Loader2 size={14} className="animate-spin mr-2" /> Saving...</>
                            ) : (
                                "Save Changes"
                            )}
                        </Button>
                    </div>
                </div>
            </section>
        </div>
    );
}
