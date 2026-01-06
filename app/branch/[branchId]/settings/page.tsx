"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useEffect, useState, use } from "react";
import { branches } from "@/lib/api/branches";
import { Loader2 } from "lucide-react";

export default function SettingsPage({ params }: { params: Promise<{ branchId: string }> }) {
    const { branchId } = use(params);
    const [branch, setBranch] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadBranch = async () => {
            try {
                const data = await branches.getDetails(branchId);
                setBranch(data);
            } catch (error) {
                console.error("Failed to load branch details", error);
            } finally {
                setLoading(false);
            }
        };
        loadBranch();
    }, [branchId]);

    if (loading) {
        return <div className="p-8 flex items-center justify-center text-white"><Loader2 className="animate-spin mr-2" /> Loading settings...</div>;
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
                                <input type="text" defaultValue={branch.name} className="w-full bg-app border border-[var(--border-subtle)] rounded-[var(--radius-sm)] px-3 py-2 text-white focus:border-primary outline-none transition-colors" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm text-textSecondary">Organization</label>
                                <input type="text" defaultValue={branch.organization?.name || "N/A"} disabled className="w-full bg-app/50 border border-[var(--border-subtle)] rounded-[var(--radius-sm)] px-3 py-2 text-gray-400 cursor-not-allowed" />
                            </div>
                        </div>
                        <div className="flex justify-end pt-4">
                            <Button>Save Changes</Button>
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
                                <p className="text-xs text-textSecondary">Get a summary specific at 9 PM.</p>
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

