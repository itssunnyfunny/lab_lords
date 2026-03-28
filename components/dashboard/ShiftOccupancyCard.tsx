"use client";

import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { CalendarCheck } from "lucide-react";

interface Shift {
    shiftId: string;
    shiftName: string;
    used: number;
    capacity: number;
    occupancyPercent: number;
}

interface ShiftOccupancyCardProps {
    shifts: Shift[];
    branchId: string;
}

function getBarColor(pct: number) {
    if (pct >= 100) return { bar: "bg-rose-500", text: "text-rose-400", glow: "shadow-[0_0_8px_rgba(244,63,94,0.4)]" };
    if (pct >= 80)  return { bar: "bg-amber-500", text: "text-amber-400", glow: "" };
    return { bar: "bg-emerald-500", text: "text-emerald-400", glow: "" };
}

export function ShiftOccupancyCard({ shifts, branchId }: ShiftOccupancyCardProps) {
    const router = useRouter();

    return (
        <Card title="Shift Occupancy" className="h-full">
            {shifts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                        <CalendarCheck size={18} className="text-gray-500" />
                    </div>
                    <p className="text-xs text-gray-500 text-center">No shifts configured yet.</p>
                    <button
                        onClick={() => router.push(`/branch/${branchId}/shifts`)}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                        Set up shifts →
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {shifts.map((shift) => {
                        const pct = Math.min(shift.occupancyPercent, 100);
                        const color = getBarColor(shift.occupancyPercent);

                        return (
                            <div key={shift.shiftId}>
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-sm font-medium text-white">{shift.shiftName}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500">
                                            {shift.used}/{shift.capacity}
                                        </span>
                                        <span className={cn("text-xs font-bold", color.text)}>
                                            {shift.occupancyPercent.toFixed(0)}%
                                        </span>
                                    </div>
                                </div>
                                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className={cn("h-full rounded-full transition-all duration-700", color.bar, color.glow)}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </Card>
    );
}
