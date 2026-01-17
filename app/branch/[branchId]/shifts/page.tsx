"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

interface Shift {
    id: string;
    name: string;
    startTime: string | null;
    endTime: string | null;
    isReserved: boolean;
    price: number;
}

export default function ShiftsPage() {
    const params = useParams();
    const branchId = params?.branchId as string;
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!branchId) return;

        const fetchShifts = async () => {
            try {
                const res = await fetch(`/api/branches/${branchId}/shifts`);
                if (!res.ok) throw new Error("Failed to load shifts");
                const data = await res.json();
                setShifts(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchShifts();
    }, [branchId]);

    if (loading) return <div className="p-8 text-zinc-400">Loading shifts...</div>;
    if (error) return <div className="p-8 text-red-500">Error: {error}</div>;

    if (shifts.length === 0) {
        return (
            <div className="p-8">
                <EmptyState
                    title="No Shifts Found"
                    description="This branch has no configured shifts."
                />
            </div>
        );
    }

    return (
        <div className="p-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-white">Shifts</h1>
                    <p className="text-zinc-400">Manage time windows for seat allocations</p>
                </div>
            </div>

            <Card className="overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-white/5 bg-white/5 text-zinc-400">
                            <th className="px-6 py-4 font-medium">Name</th>
                            <th className="px-6 py-4 font-medium">Time Window</th>
                            <th className="px-6 py-4 font-medium">Type</th>
                            <th className="px-6 py-4 font-medium">Price</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {shifts.map((shift) => (
                            <tr key={shift.id} className="group hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4 font-medium text-zinc-200">
                                    {shift.name}
                                </td>
                                <td className="px-6 py-4 text-zinc-400">
                                    {shift.startTime && shift.endTime ? (
                                        <span className="font-mono">
                                            {shift.startTime} - {shift.endTime}
                                        </span>
                                    ) : (
                                        <span className="text-zinc-500 italic">No time limit</span>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    {shift.isReserved ? (
                                        <Badge variant="purple">Reserved</Badge>
                                    ) : (
                                        <Badge variant="cyan">Standard</Badge>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-zinc-400">
                                    {shift.price > 0 ? `₹${shift.price}` : "Free"}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>
        </div>
    );
}
