"use client";

import { Card } from "@/components/ui/Card";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { useEffect, useState } from "react";
import { analytics, BranchSnapshot } from "@/lib/api/analytics";

interface KpiRowProps {
    title: string;
    value: string;
    trend?: string; // e.g. "+12%"
    trendUp?: boolean;
    data?: number[]; // Mini sparkline data
    prefix?: string;
}

export function KpiCard({ title, value, trend, trendUp = true, data }: KpiRowProps) {
    const chartData = data ? data.map(v => ({ v })) : [];
    const color = trendUp ? "#10b981" : "#ef4444"; // Emerald or Red

    return (
        <Card className="p-0 border-transparent hover:border-white/10 bg-white/[0.02]">
            <div className="p-5 flex justify-between items-start">
                <div>
                    <p className="text-sm text-textSecondary mb-1 font-medium">{title}</p>
                    <h2 className="text-2xl font-bold text-white tracking-tight">{value}</h2>
                </div>
            </div>

            <div className="h-16 w-full relative group">
                {/* Background Glow */}
                <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id={`gradient-${title.replace(/\s+/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={color} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <Area
                            type="monotone"
                            dataKey="v"
                            stroke={color}
                            strokeWidth={2}
                            fill={`url(#gradient-${title.replace(/\s+/g, '-')})`}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
}

export function KpiRow({ snapshot, branchId }: { snapshot?: BranchSnapshot, branchId?: string }) {
    const [seatTrend, setSeatTrend] = useState<number[] | undefined>();
    const [paymentTrend, setPaymentTrend] = useState<number[] | undefined>();
    const [studentTrend, setStudentTrend] = useState<number[] | undefined>();
    const [dueTrend, setDueTrend] = useState<number[] | undefined>();

    useEffect(() => {
        if (!branchId) return;
        const loadTrends = async () => {
            try {
                const to = new Date().toISOString();
                const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

                const [seat, pay, stu] = await Promise.all([
                    analytics.getTrends(branchId, { from, to, type: "seat" }),
                    analytics.getTrends(branchId, { from, to, type: "payment" }),
                    analytics.getTrends(branchId, { from, to, type: "students" })
                ]);

                setSeatTrend(seat.map(t => t.value));
                setPaymentTrend(pay.filter(t => t.category === "Collected").map(t => t.value));
                setDueTrend(pay.filter(t => t.category === "Pending").map(t => t.value));
                setStudentTrend(stu.filter(t => t.category === "Active").map(t => t.value));
            } catch (err) {
                console.error("Failed to load KPI trends", err);
            }
        };
        loadTrends();
    }, [branchId]);

    if (!snapshot) {
        return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <KpiCard title="Collected Revenue" value="-" />
            <KpiCard title="Active Students" value="-" />
            <KpiCard title="Due Payments" value="-" />
            <KpiCard title="Total Utilization" value="-" />
        </div>;
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <KpiCard
                title="Collected Revenue"
                value={`₹${snapshot.paidAmount.toLocaleString()}`}
                trend="+12%"
                data={paymentTrend}
            />
            <KpiCard
                title="Active Students"
                value={snapshot.activeStudents.toString()}
                trend="+5%"
                data={studentTrend}
            />
            <KpiCard
                title="Due Payments"
                value={`₹${snapshot.dueAmount.toLocaleString()}`}
                trend="-4%"
                trendUp={false}
                data={dueTrend}
            />
            <KpiCard
                title="Total Utilization"
                value={`${snapshot.occupancyRate.toFixed(2)}%`}
                trend={
                    snapshot.seatDetails
                        ? `${snapshot.seatDetails.totalUsedSlots} / ${snapshot.seatDetails.totalShiftCapacity} slots`
                        : undefined
                }
                data={seatTrend}
            />
        </div>
    );
}

