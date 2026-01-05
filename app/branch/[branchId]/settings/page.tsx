"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function SettingsPage() {
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
                                <input type="text" defaultValue="Ashok Vihar Center" className="w-full bg-app border border-[var(--border-subtle)] rounded-[var(--radius-sm)] px-3 py-2 text-white focus:border-primary outline-none transition-colors" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm text-textSecondary">Location</label>
                                <input type="text" defaultValue="New Delhi, India" className="w-full bg-app border border-[var(--border-subtle)] rounded-[var(--radius-sm)] px-3 py-2 text-white focus:border-primary outline-none transition-colors" />
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
