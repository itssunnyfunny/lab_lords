"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useEffect, useState, use } from "react";
import { branches } from "@/lib/api/branches";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

type SaveStatus = "idle" | "saving" | "success" | "error";

export default function SettingsPage({ params }: { params: Promise<{ branchId: string }> }) {
    const { branchId } = use(params);
    const [branch, setBranch] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Controlled state for editable fields
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

            // Reset to idle after 3 seconds
            setTimeout(() => setSaveStatus("idle"), 3000);
        } catch (err: any) {
            setErrorMessage(err.message || "Something went wrong.");
            setSaveStatus("error");
        }
    };

    const hasChanges = branch && branchName.trim() !== branch.name;

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center text-white">
                <Loader2 className="animate-spin mr-2" /> Loading settings...
            </div>
        );
    }

    if (!branch) {
        return <div className="p-8 text-white">Branch not found</div>;
    }

    return (
        <div className="p-8 max-w-4xl">
            <PageHeader title="Branch Settings" subtitle="Configure branch details and preferences." />

            <div className="space-y-6">
                {/* Branch Info */}
                <Card title="General Information" className="p-0">
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm text-textSecondary">Branch Name</label>
                                <input
                                    type="text"
                                    value={branchName}
                                    onChange={(e) => {
                                        setBranchName(e.target.value);
                                        if (saveStatus === "error" || saveStatus === "success") {
                                            setSaveStatus("idle");
                                        }
                                    }}
                                    className="w-full bg-app border border-[var(--border-subtle)] rounded-[var(--radius-sm)] px-3 py-2 text-white focus:border-primary outline-none transition-colors"
                                    placeholder="Enter branch name"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm text-textSecondary">Organization</label>
                                <input
                                    type="text"
                                    defaultValue={branch.organization?.name || "N/A"}
                                    disabled
                                    className="w-full bg-app/50 border border-[var(--border-subtle)] rounded-[var(--radius-sm)] px-3 py-2 text-gray-400 cursor-not-allowed"
                                />
                            </div>
                        </div>

                        {/* Status feedback */}
                        {saveStatus === "success" && (
                            <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                                <CheckCircle2 size={15} />
                                Branch name updated successfully.
                            </div>
                        )}
                        {saveStatus === "error" && (
                            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                                <AlertCircle size={15} />
                                {errorMessage}
                            </div>
                        )}

                        <div className="flex justify-end pt-2">
                            <Button
                                onClick={handleSave}
                                disabled={saveStatus === "saving" || !hasChanges}
                                className="min-w-[120px]"
                            >
                                {saveStatus === "saving" ? (
                                    <><Loader2 size={14} className="animate-spin mr-2" /> Saving...</>
                                ) : (
                                    "Save Changes"
                                )}
                            </Button>
                        </div>
                    </div>
                </Card>

                {/* Branch Info — Read Only */}
                <Card title="Branch Details" className="p-0">
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between items-center py-2 border-b border-[var(--border-subtle)]">
                            <span className="text-textSecondary">Branch ID</span>
                            <span className="font-mono text-xs text-textMuted bg-white/5 px-2 py-1 rounded">{branchId}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-[var(--border-subtle)]">
                            <span className="text-textSecondary">Total Seats</span>
                            <span className="text-white font-medium">{branch.totalSeats ?? "—"}</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                            <span className="text-textSecondary">Organization</span>
                            <span className="text-white font-medium">{branch.organization?.name ?? "—"}</span>
                        </div>
                    </div>
                </Card>

                {/* Notifications */}
                <Card title="Notifications" className="p-0">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
                            <div>
                                <p className="text-white font-medium">Payment Alerts</p>
                                <p className="text-xs text-textSecondary">Receive emails when payments fail.</p>
                            </div>
                            <div className="w-10 h-5 bg-primary rounded-full relative cursor-pointer">
                                <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full shadow-sm" />
                            </div>
                        </div>
                        <div className="flex items-center justify-between py-2">
                            <div>
                                <p className="text-white font-medium">Daily Reports</p>
                                <p className="text-xs text-textSecondary">Get a summary at 9 PM.</p>
                            </div>
                            <div className="w-10 h-5 bg-white/10 rounded-full relative cursor-pointer">
                                <div className="absolute left-1 top-1 w-3 h-3 bg-white/50 rounded-full shadow-sm" />
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
