"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import {
    Building2, GitBranch, Loader2, CheckCircle2,
    AlertCircle, Pencil, ArrowLeft, Calendar,
    Hash, Briefcase, MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { format } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BranchSummary { id: string; name: string; city: string | null; createdAt: string; }

interface OrgDetails {
    id: string;
    name: string;
    businessType: string | null;
    ownerId: string;
    createdAt: string;
    branches: BranchSummary[];
    _count: { branches: number };
}

const BUSINESS_TYPES = [
    "Study Hall",
    "Library",
    "Coaching Center",
    "Tuition Class",
    "Other",
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrgSettingsPage({ params }: { params: Promise<{ orgId: string }> }) {
    const { orgId } = use(params);
    const router = useRouter();

    const [org, setOrg] = useState<OrgDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);

    // Edit state
    const [name, setName] = useState("");
    const [businessType, setBusinessType] = useState("");
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
    const [saveError, setSaveError] = useState("");

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch(`/api/organizations/${orgId}`);
                if (!res.ok) throw new Error("Failed to load organization");
                const data = await res.json();
                setOrg(data);
                setName(data.name ?? "");
                setBusinessType(data.businessType ?? "");
            } catch (err: any) {
                setFetchError(err.message || "Something went wrong.");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [orgId]);

    const hasChanges = org && (
        name.trim() !== org.name ||
        businessType.trim() !== (org.businessType ?? "")
    );

    const handleSave = async () => {
        if (!name.trim()) { setSaveError("Organization name cannot be empty."); setSaveStatus("error"); return; }
        setSaving(true); setSaveStatus("idle"); setSaveError("");
        try {
            const res = await fetch(`/api/organizations/${orgId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim(), businessType: businessType.trim() }),
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error || "Save failed");
            }
            const updated = await res.json();
            setOrg(prev => prev ? { ...prev, name: updated.name, businessType: updated.businessType } : prev);
            setName(updated.name);
            setBusinessType(updated.businessType ?? "");
            setSaveStatus("success");
            setTimeout(() => setSaveStatus("idle"), 3000);
        } catch (err: any) {
            setSaveError(err.message || "Save failed.");
            setSaveStatus("error");
        } finally {
            setSaving(false);
        }
    };

    // ── Loading
    if (loading) return (
        <div className="min-h-screen bg-[#050508] flex items-center justify-center text-white">
            <Loader2 className="animate-spin mr-3 text-cyan-500" size={22} /> Loading organization...
        </div>
    );

    // ── Error
    if (fetchError || !org) return (
        <div className="min-h-screen bg-[#050508] flex items-center justify-center text-white">
            <div className="text-center space-y-4">
                <AlertCircle size={40} className="text-red-400 mx-auto" />
                <p className="text-gray-400">{fetchError || "Organization not found."}</p>
                <Button variant="outline" onClick={() => router.back()}><ArrowLeft size={14} className="mr-2" /> Back</Button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#050508] text-white p-6 md:p-10 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Organization Settings</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage your organization profile and branches.</p>
                </div>
                <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors group">
                    <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" /> Back
                </button>
            </div>

            <div className="max-w-3xl space-y-6">

                {/* ── Identity card ── */}
                <Card className="relative overflow-hidden">
                    <div className="absolute -top-16 -right-16 w-48 h-48 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
                    <div className="relative flex items-center gap-4 mb-6">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600/30 to-indigo-600/30 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
                            <Building2 size={26} className="text-purple-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">{org.name}</h2>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge variant="purple">{org.businessType || "Education Business"}</Badge>
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                    <GitBranch size={10} /> {org._count.branches} {org._count.branches === 1 ? "branch" : "branches"}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Meta info */}
                    <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-white/[0.02] rounded-xl border border-white/5">
                        <div className="flex items-center gap-3">
                            <Hash size={13} className="text-gray-600 flex-shrink-0" />
                            <div>
                                <p className="text-xs text-gray-500">Org ID</p>
                                <p className="text-xs font-mono text-gray-400 truncate">{org.id}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Calendar size={13} className="text-gray-600 flex-shrink-0" />
                            <div>
                                <p className="text-xs text-gray-500">Created</p>
                                <p className="text-xs text-gray-400">{format(new Date(org.createdAt), "PP")}</p>
                            </div>
                        </div>
                    </div>

                    {/* Editable fields */}
                    <div className="space-y-4">
                        {/* Name */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Building2 size={11} /> Organization Name <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => { setName(e.target.value); if (saveStatus !== "idle") setSaveStatus("idle"); }}
                                placeholder="Your organization name"
                                className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 px-4 text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 text-sm transition-all"
                            />
                        </div>

                        {/* Business type */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Briefcase size={11} /> Business Type
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {BUSINESS_TYPES.map(type => (
                                    <button
                                        key={type}
                                        onClick={() => setBusinessType(type === businessType ? "" : type)}
                                        className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${businessType === type
                                                ? "border-purple-500/40 bg-purple-500/10 text-purple-400"
                                                : "border-white/10 bg-white/5 text-gray-400 hover:text-white hover:border-white/20"
                                            }`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Status / Save */}
                    <div className="mt-6 flex items-center justify-between">
                        <div>
                            {saveStatus === "success" && (
                                <p className="flex items-center gap-1.5 text-sm text-emerald-400">
                                    <CheckCircle2 size={14} /> Saved successfully.
                                </p>
                            )}
                            {saveStatus === "error" && (
                                <p className="flex items-center gap-1.5 text-sm text-red-400">
                                    <AlertCircle size={14} /> {saveError}
                                </p>
                            )}
                        </div>
                        <Button
                            onClick={handleSave}
                            disabled={saving || !hasChanges}
                            className="min-w-[120px] justify-center"
                        >
                            {saving
                                ? <><Loader2 size={13} className="animate-spin mr-2" /> Saving...</>
                                : "Save Changes"
                            }
                        </Button>
                    </div>
                </Card>

                {/* ── Branches ── */}
                <div className="space-y-3">
                    <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <GitBranch size={14} /> Branches ({org.branches.length})
                    </h2>

                    {org.branches.length === 0 ? (
                        <div className="text-center py-10 border border-dashed border-white/10 rounded-xl text-gray-500">
                            No branches yet.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {org.branches.map(branch => (
                                <button
                                    key={branch.id}
                                    onClick={() => router.push(`/branch/${branch.id}`)}
                                    className="w-full group flex items-center justify-between p-4 bg-[#0f111a] border border-white/5 rounded-xl hover:border-cyan-500/20 hover:bg-white/[0.03] transition-all text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center group-hover:border-cyan-500/20 transition-colors">
                                            <GitBranch size={15} className="text-gray-500 group-hover:text-cyan-400 transition-colors" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-white text-sm">{branch.name}</p>
                                            {branch.city && (
                                                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                                    <MapPin size={9} /> {branch.city}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-gray-600">{format(new Date(branch.createdAt), "PP")}</span>
                                        <span className="text-xs text-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity">Open →</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Danger zone ── */}
                <Card className="border-red-500/10 bg-red-500/[0.02]">
                    <h3 className="text-sm font-semibold text-red-400 mb-1">Danger Zone</h3>
                    <p className="text-xs text-gray-500 mb-4">
                        These actions are irreversible. Proceed with caution.
                    </p>
                    <Button
                        variant="ghost"
                        className="border border-red-500/20 text-red-400 hover:bg-red-500/10 text-sm h-8 px-4"
                        onClick={() => alert("Organization deletion is not yet available. Contact support.")}
                    >
                        Delete Organization
                    </Button>
                </Card>

            </div>
        </div>
    );
}
