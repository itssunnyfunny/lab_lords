"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MOCK_SEATS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { User } from "lucide-react";

export default function SeatsPage() {
    return (
        <div className="p-8">
            <PageHeader
                title="Seat Management"
                subtitle="Visual map of study hall occupancy."
                onFilter={() => { }}
                onAdd={() => { }}
                actionLabel="Add Seat"
            />

            {/* Legend */}
            <div className="flex gap-6 mb-6 text-sm text-textSecondary">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/50" /> Occupied
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-slate-500/20 border border-slate-500/50" /> Available
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-rose-500/20 border border-rose-500/50" /> Maintenance
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {MOCK_SEATS.map((seat) => (
                    <Card
                        key={seat.id}
                        className={cn(
                            "p-4 flex flex-col items-center justify-center min-h-[140px] cursor-pointer transition-all hover:scale-105 hover:shadow-glow",
                            seat.status === "Occupied" && "border-emerald-500/20 bg-emerald-500/[0.02]",
                            seat.status === "Available" && "border-dashed opacity-70 hover:opacity-100",
                            seat.status === "Maintenance" && "border-rose-500/20 bg-rose-500/[0.02] opacity-80"
                        )}
                    >
                        <div className="text-xl font-bold text-white mb-2">{seat.id}</div>

                        {seat.status === "Occupied" ? (
                            <div className="text-center">
                                <div className="w-8 h-8 mx-auto bg-emerald-500/20 rounded-full flex items-center justify-center mb-2">
                                    <User size={14} className="text-emerald-400" />
                                </div>
                                <p className="text-xs text-emerald-400 font-medium truncate w-24">{seat.student}</p>
                            </div>
                        ) : seat.status === "Available" ? (
                            <span className="text-xs text-textMuted">Open</span>
                        ) : (
                            <span className="text-xs text-rose-400">Maintenance</span>
                        )}
                    </Card>
                ))}
            </div>
        </div>
    );
}
