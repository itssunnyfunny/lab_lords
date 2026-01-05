"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Bot, FileText, Sparkles } from "lucide-react";

export default function AIReportsPage() {
    return (
        <div className="p-8">
            <PageHeader
                title="AI Reports"
                subtitle="Generated insights based on branch data."
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                    <Card key={i} className="group cursor-pointer hover:border-primary/50 transition-all">
                        <div className="flex items-start justify-between mb-4">
                            <div className="p-3 rounded-lg bg-primary/10 text-primary">
                                <FileText size={20} />
                            </div>
                            <span className="text-xs text-textmuted">2 days ago</span>
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">Monthly Revenue Analysis</h3>
                        <p className="text-sm text-textSecondary mb-4">
                            Automated summary of October revenue streams, identifying a 12% growth in premium seat bookings.
                        </p>
                        <div className="flex items-center text-sm text-primary font-medium group-hover:underline">
                            View Report <Sparkles size={14} className="ml-1" />
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
}
