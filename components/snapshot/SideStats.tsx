"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DollarSign, Wallet } from "lucide-react";
import { BranchSnapshot } from "@/lib/api/analytics";

export function SideStats({ snapshot }: { snapshot?: BranchSnapshot }) {
    if (!snapshot) {
        return <Card className="col-span-1 h-[400px]" title="Revenue & Sales">Loading...</Card>;
    }

    return (
        <Card className="col-span-1 h-[400px]" title="Revenue & Sales">
            <div className="flex flex-col h-full gap-4">
                {/* Stat Item 1 */}
                <div className="flex-1 bg-white/[0.02] rounded-xl p-4 border border-white/[0.05] flex flex-col justify-center relative overflow-hidden">
                    <div className="absolute right-0 top-0 p-3 opacity-10">
                        <DollarSign size={80} className="text-primary" />
                    </div>
                    <p className="text-textSecondary text-sm">Total Revenue</p>
                    <h3 className="text-3xl font-bold text-white mt-1">₹{snapshot.monthlyRevenue.toLocaleString()}</h3>
                    <div className="flex items-center gap-2 mt-2">
                        <Badge variant="success" className="bg-emerald-500/20 text-emerald-400">+12%</Badge>
                        <span className="text-xs text-textmuted">vs last month</span>
                    </div>
                </div>

                {/* Stat Item 2 */}
                <div className="flex-1 bg-white/[0.02] rounded-xl p-4 border border-white/[0.05] flex flex-col justify-center relative overflow-hidden">
                    <div className="absolute right-0 top-0 p-3 opacity-10">
                        <Wallet size={80} className="text-purple-500" />
                    </div>
                    <p className="text-textSecondary text-sm">Pending Fees</p>
                    <h3 className="text-3xl font-bold text-white mt-1">₹{snapshot.dueAmount.toLocaleString()}</h3>
                    <div className="flex items-center gap-2 mt-2">
                        <Badge variant="warning" className="bg-amber-500/20 text-amber-400">Due</Badge>
                        <span className="text-xs text-textmuted">students</span>
                    </div>
                </div>
            </div>
        </Card>
    );
}

