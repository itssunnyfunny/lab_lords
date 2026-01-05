"use client";

import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, MoreHorizontal } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

interface KpiRowProps {
    title: string;
    value: string;
    trend?: string; // e.g. "+12%"
    trendUp?: boolean;
    data?: number[]; // Mini sparkline data
    prefix?: string;
}

// Mock data for sparklines if not provided
const DEFAULT_DATA = [
    { v: 10 }, { v: 15 }, { v: 13 }, { v: 20 }, { v: 18 }, { v: 25 }, { v: 30 }
];

export function KpiCard({ title, value, trend, trendUp = true, data }: KpiRowProps) {
    const chartData = data ? data.map(v => ({ v })) : DEFAULT_DATA;
    const color = trendUp ? "#10b981" : "#ef4444"; // Emerald or Red

    return (
        <Card className="p-0 border-transparent hover:border-white/10 bg-white/[0.02]">
            <div className="p-5 flex justify-between items-start">
                <div>
                    <p className="text-sm text-textSecondary mb-1 font-medium">{title}</p>
                    <h2 className="text-2xl font-bold text-white tracking-tight">{value}</h2>
                </div>
                <button className="text-textSecondary hover:text-white transition-colors">
                    <MoreHorizontal size={18} />
                </button>
            </div>

            <div className="h-16 w-full relative group">
                {/* Background Glow */}
                <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={color} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <Area
                            type="monotone"
                            dataKey="v"
                            stroke={color}
                            strokeWidth={2}
                            fill={`url(#gradient-${title})`}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
}

export function KpiRow() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <KpiCard title="Revenue" value="$85,420" trend="+12%" />
            <KpiCard title="Active Students" value="1,024" trend="+5%" />
            <KpiCard title="Due Payments" value="$36,780" trend="-4%" trendUp={false} />
            <KpiCard title="Total Seats" value="120" trend="+7%" />
        </div>
    );
}
