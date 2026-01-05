"use client";

import { KpiRow } from "@/components/snapshot/KpiRow";
import { MainChart } from "@/components/snapshot/MainChart";
import { SideStats } from "@/components/snapshot/SideStats";
import { SnapshotFooter } from "@/components/snapshot/SnapshotFooter";
import { Button } from "@/components/ui/Button";
import { Calendar, Download, Filter } from "lucide-react";

export default function BranchSnapshotPage() {
    return (
        <div className="p-8 space-y-8 fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Snapshot Dashboard</h1>
                    <p className="text-textSecondary mt-1">Real-time overview of branch performance</p>
                </div>

                <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" className="gap-2">
                        <Calendar size={16} />
                        <span>Oct 2023</span>
                    </Button>
                    <Button variant="outline" size="icon">
                        <Filter size={18} />
                    </Button>
                    <Button variant="outline" size="icon">
                        <Download size={18} />
                    </Button>
                    <div className="w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-500/50 flex items-center justify-center">
                        <img src="https://ui-avatars.com/api/?name=Admin+User&background=random" className="rounded-full w-8 h-8" alt="User" />
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <KpiRow />

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <MainChart />
                <SideStats />
            </div>

            {/* Bottom Section */}
            <SnapshotFooter />
        </div>
    );
}
