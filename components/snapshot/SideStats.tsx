"use client";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { AnalyticsPeriod, BranchSnapshot } from "@/lib/api/analytics";
import { IndianRupee, Wallet } from "lucide-react";

export function SideStats({
    snapshot,
    period = "all",
}: {
    snapshot?: BranchSnapshot;
    period?: AnalyticsPeriod;
}) {
    if (!snapshot) {
        return <Card className="col-span-1 h-[400px]" title="Revenue Summary">Loading...</Card>;
    }

    const periodLabel = period === "month" ? "This month" : "All time";

    return (
        <Card className="col-span-1 h-[400px]" title="Revenue Summary">
            <div className="flex flex-col h-full gap-4">
                <div className="flex-1 bg-white/[0.02] rounded-xl p-4 border border-white/[0.05] flex flex-col justify-center relative overflow-hidden">
                    <div className="absolute right-0 top-0 p-3 opacity-10">
                        <IndianRupee size={80} className="text-primary" />
                    </div>
                    <p className="text-textSecondary text-sm">Billable Revenue</p>
                    <h3 className="text-3xl font-bold text-white mt-1">₹{snapshot.monthlyRevenue.toLocaleString("en-IN")}</h3>
                    <div className="flex items-center gap-2 mt-2">
                        <Badge variant="purple">{periodLabel}</Badge>
                        <span className="text-xs text-textmuted">{snapshot.collectionRate.toFixed(0)}% collected</span>
                    </div>
                </div>

                <div className="flex-1 bg-white/[0.02] rounded-xl p-4 border border-white/[0.05] flex flex-col justify-center relative overflow-hidden">
                    <div className="absolute right-0 top-0 p-3 opacity-10">
                        <Wallet size={80} className="text-amber-500" />
                    </div>
                    <p className="text-textSecondary text-sm">All Pending Fees</p>
                    <h3 className="text-3xl font-bold text-white mt-1">₹{snapshot.dueAmount.toLocaleString("en-IN")}</h3>
                    <div className="flex items-center gap-2 mt-2">
                        <Badge variant="warning">All due</Badge>
                        <span className="text-xs text-textmuted">shown in every period</span>
                    </div>
                </div>
            </div>
        </Card>
    );
}
