"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
    User,
    Mail,
    Building2,
    GitBranch,
    Shield,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Pencil,
    X,
    ArrowLeft,
    Calendar,
    Hash,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { format } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
    id: string;
    name: string | null;
    email: string;
    createdAt: string;
    organizations: {
        id: string;
        name: string;
        businessType: string | null;
        branches: { id: string }[];
    }[];
    staff: {
        id: string;
        role: string;
        branch: { id: string; name: string };
    }[];
}

type SaveStatus = "idle" | "saving" | "success" | "error";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Avatar({ name }: { name: string | null }) {
    const initials = name
        ? name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
        : "??";
    return (
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-600/30 border-2 border-cyan-500/40 flex items-center justify-center text-3xl font-bold text-cyan-300 shadow-[0_0_30px_rgba(6,182,212,0.2)]">
            {initials}
        </div>
    );
}

function InfoRow({ icon: Icon, label, value, mono = false }: {
    icon: React.ElementType;
    label: string;
    value: string;
    mono?: boolean;
}) {
    return (
        <div className="flex items-center gap-4 py-3 border-b border-white/5 last:border-0">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                <Icon size={15} className="text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                <p className={`text-sm text-white truncate ${mono ? "font-mono" : "font-medium"}`}>{value}</p>
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AccountPage() {
    const router = useRouter();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);

    // Edit name state
    const [isEditing, setIsEditing] = useState(false);
    const [nameInput, setNameInput] = useState("");
    const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
    const [saveError, setSaveError] = useState("");

    // ── Load user
    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch("/api/users/me");
                if (!res.ok) throw new Error("Failed to load profile");
                const data = await res.json();
                setProfile(data);
                setNameInput(data.name ?? "");
            } catch (err: any) {
                setFetchError(err.message || "Something went wrong.");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    // ── Save name
    const handleSaveName = async () => {
        if (!nameInput.trim()) {
            setSaveError("Name cannot be empty.");
            setSaveStatus("error");
            return;
        }
        setSaveStatus("saving");
        setSaveError("");
        try {
            const res = await fetch("/api/users/me", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: nameInput.trim() }),
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error || "Failed to save");
            }
            const updated = await res.json();
            setProfile(prev => prev ? { ...prev, name: updated.name } : prev);
            setNameInput(updated.name ?? "");
            setSaveStatus("success");
            setIsEditing(false);
            setTimeout(() => setSaveStatus("idle"), 3000);
        } catch (err: any) {
            setSaveError(err.message || "Save failed.");
            setSaveStatus("error");
        }
    };

    const cancelEdit = () => {
        setIsEditing(false);
        setNameInput(profile?.name ?? "");
        setSaveStatus("idle");
        setSaveError("");
    };

    // ──────────────────────────────────────────────────────────── Loading state
    if (loading) {
        return (
            <div className="min-h-screen bg-[#050508] flex items-center justify-center text-white">
                <Loader2 className="animate-spin mr-3 text-cyan-500" size={24} />
                <span className="text-gray-400">Loading profile...</span>
            </div>
        );
    }

    // ──────────────────────────────────────────────────────────── Error state
    if (fetchError || !profile) {
        return (
            <div className="min-h-screen bg-[#050508] flex items-center justify-center text-white">
                <div className="text-center space-y-4">
                    <AlertCircle size={40} className="text-red-400 mx-auto" />
                    <p className="text-gray-400">{fetchError || "Profile not found."}</p>
                    <Button variant="outline" onClick={() => router.back()}>
                        <ArrowLeft size={14} className="mr-2" /> Go Back
                    </Button>
                </div>
            </div>
        );
    }

    const totalBranches = profile.organizations.reduce(
        (sum, org) => sum + org.branches.length, 0
    );

    // ──────────────────────────────────────────────────────────── Main render
    return (
        <div className="min-h-screen bg-[#050508] text-white p-6 md:p-10">
            {/* Back button */}
            <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors mb-8 group"
            >
                <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
                Back
            </button>

            <div className="max-w-3xl mx-auto space-y-6">

                {/* ── Hero card ── */}
                <div className="relative rounded-2xl bg-gradient-to-br from-[#0f111a] to-[#0a0c14] border border-white/10 overflow-hidden p-8">
                    {/* Ambient glow */}
                    <div className="absolute -top-20 -right-20 w-60 h-60 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

                    <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-6">
                        <Avatar name={profile.name} />

                        <div className="flex-1 min-w-0">
                            {/* Name / edit */}
                            {isEditing ? (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={nameInput}
                                            onChange={e => {
                                                setNameInput(e.target.value);
                                                if (saveStatus !== "idle") setSaveStatus("idle");
                                            }}
                                            autoFocus
                                            placeholder="Your display name"
                                            className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-lg font-bold focus:outline-none focus:border-cyan-500/60 transition-all"
                                        />
                                    </div>
                                    {saveStatus === "error" && (
                                        <p className="text-xs text-red-400 flex items-center gap-1">
                                            <AlertCircle size={12} /> {saveError}
                                        </p>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <Button
                                            onClick={handleSaveName}
                                            disabled={saveStatus === "saving"}
                                            className="h-8 text-xs px-4"
                                        >
                                            {saveStatus === "saving"
                                                ? <><Loader2 size={12} className="animate-spin mr-1" /> Saving...</>
                                                : "Save Name"
                                            }
                                        </Button>
                                        <Button variant="ghost" onClick={cancelEdit} className="h-8 text-xs px-3">
                                            <X size={12} className="mr-1" /> Cancel
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 mb-1">
                                    <h1 className="text-2xl font-bold text-white truncate">
                                        {profile.name || <span className="text-gray-500 italic">No name set</span>}
                                    </h1>
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="text-gray-600 hover:text-cyan-400 transition-colors flex-shrink-0"
                                        title="Edit name"
                                    >
                                        <Pencil size={15} />
                                    </button>
                                </div>
                            )}

                            {!isEditing && (
                                <>
                                    <p className="text-gray-400 text-sm mb-4">{profile.email}</p>
                                    <div className="flex flex-wrap gap-3">
                                        <Stat value={profile.organizations.length} label="Organizations" />
                                        <Stat value={totalBranches} label="Branches" />
                                        <Stat value={profile.staff.length} label="Roles" />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Success banner */}
                    {saveStatus === "success" && (
                        <div className="mt-4 flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-2">
                            <CheckCircle2 size={14} /> Name updated successfully.
                        </div>
                    )}
                </div>

                {/* ── Account details ── */}
                <Section title="Account Details" icon={User}>
                    <InfoRow icon={Mail} label="Email address" value={profile.email} />
                    <InfoRow icon={Hash} label="User ID" value={profile.id} mono />
                    <InfoRow
                        icon={Calendar}
                        label="Member since"
                        value={format(new Date(profile.createdAt), "PPP")}
                    />
                </Section>

                {/* ── Organizations ── */}
                <Section title="Your Organizations" icon={Building2}>
                    {profile.organizations.length === 0 ? (
                        <p className="text-sm text-gray-500 italic py-2">No organizations found.</p>
                    ) : (
                        profile.organizations.map(org => (
                            <div
                                key={org.id}
                                className="flex items-center justify-between py-3 border-b border-white/5 last:border-0"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                                        <Building2 size={14} className="text-cyan-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-white">{org.name}</p>
                                        <p className="text-xs text-gray-500">{org.businessType || "Education Business"}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-400">
                                    <GitBranch size={12} />
                                    {org.branches.length} {org.branches.length === 1 ? "branch" : "branches"}
                                </div>
                            </div>
                        ))
                    )}
                </Section>

                {/* ── Branch Roles ── */}
                {profile.staff.length > 0 && (
                    <Section title="Branch Roles" icon={Shield}>
                        {profile.staff.map(s => (
                            <div
                                key={s.id}
                                className="flex items-center justify-between py-3 border-b border-white/5 last:border-0"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                                        <GitBranch size={14} className="text-purple-400" />
                                    </div>
                                    <p className="text-sm font-medium text-white">{s.branch.name}</p>
                                </div>
                                <RoleBadge role={s.role} />
                            </div>
                        ))}
                    </Section>
                )}

            </div>
        </div>
    );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function Stat({ value, label }: { value: number; label: string }) {
    return (
        <div className="bg-white/5 border border-white/5 rounded-lg px-3 py-1.5 text-center min-w-[70px]">
            <div className="text-lg font-bold text-white">{value}</div>
            <div className="text-[10px] text-gray-500">{label}</div>
        </div>
    );
}

function Section({ title, icon: Icon, children }: {
    title: string;
    icon: React.ElementType;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-2xl bg-[#0f111a] border border-white/10 overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-white/5">
                <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
                    <Icon size={14} className="text-gray-400" />
                </div>
                <h2 className="text-sm font-semibold text-white tracking-wide">{title}</h2>
            </div>
            <div className="px-6 py-2">{children}</div>
        </div>
    );
}

function RoleBadge({ role }: { role: string }) {
    const styles: Record<string, string> = {
        MANAGER: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
        STAFF: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    };
    return (
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${styles[role] || "bg-white/5 text-gray-400 border-white/10"}`}>
            {role}
        </span>
    );
}
