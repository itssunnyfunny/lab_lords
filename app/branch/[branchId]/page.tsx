"use client";

import { use } from "react";
import { LayoutDashboard, Sparkles, Clock } from "lucide-react";

export default function BranchDashboardPage({ params }: { params: Promise<{ branchId: string }> }) {
    // branchId reserved for future use
    use(params);

    return (
        <div className="p-8 flex flex-col items-center justify-center min-h-[70vh] text-white">
            <div className="flex flex-col items-center gap-6 max-w-md text-center">
                {/* Icon */}
                <div className="relative">
                    <div className="w-24 h-24 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                        <LayoutDashboard size={40} className="text-indigo-400" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                        <Sparkles size={14} className="text-amber-400" />
                    </div>
                </div>

                {/* Heading */}
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Dashboard</h1>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-4">
                        <Clock size={12} />
                        Coming Soon
                    </div>
                    <p className="text-gray-400 text-sm leading-relaxed">
                        A personalised command centre for your branch is on its way.
                        In the meantime, head to <span className="text-indigo-400 font-medium">Analytics</span> for
                        real-time metrics and performance insights.
                    </p>
                </div>

                {/* Divider */}
                <div className="w-full h-px bg-white/5" />

                {/* What's coming */}
                <div className="w-full text-left space-y-3">
                    <p className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">What&apos;s coming</p>
                    {[
                        "At-a-glance KPI summary cards",
                        "Revenue & occupancy quick view",
                        "Pending actions & alerts",
                        "Recent activity feed",
                    ].map((item) => (
                        <div key={item} className="flex items-center gap-3 text-sm text-gray-400">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/60 flex-shrink-0" />
                            {item}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
