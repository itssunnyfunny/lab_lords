"use client";

import { Card } from "@/components/ui/Card";
import { TrendData } from "@/lib/api/analytics";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format } from "date-fns";

interface MainChartProps {
    data?: TrendData;
    title?: string;
    variant?: "area" | "bar";
    valueFormatter?: (value: number) => string;
    color?: string;
    emptyLabel?: string;
}

function formatXAxis(value: string) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return format(parsed, "MMM d");
}

export function MainChart({
    data = [],
    title = "Analytics Trend",
    variant = "area",
    valueFormatter = (value) => value.toLocaleString("en-IN"),
    color = "#6366f1",
    emptyLabel = "No trend data available.",
}: MainChartProps) {
    const chartData = data.map(d => ({
        ...d,
        displayDate: variant === "bar" ? d.category ?? d.date : formatXAxis(d.date),
    }));

    if (chartData.length === 0) {
        return (
            <Card className="col-span-1 lg:col-span-2 h-[400px] flex flex-col" title={title}>
                <div className="flex-1 flex items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] text-sm text-textSecondary">
                    {emptyLabel}
                </div>
            </Card>
        );
    }

    return (
        <Card className="col-span-1 lg:col-span-2 h-[400px] flex flex-col" title={title}>
            <div className="flex-1 w-full min-h-0 pt-4">
                <ResponsiveContainer width="100%" height="100%">
                    {variant === "bar" ? (
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="displayDate" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} tickFormatter={(value) => valueFormatter(Number(value))} />
                            <Tooltip
                                cursor={{ fill: "rgba(255,255,255,0.05)" }}
                                contentStyle={{ backgroundColor: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                                itemStyle={{ color: "#fff" }}
                                formatter={(value) => valueFormatter(Number(value))}
                            />
                            <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} />
                        </BarChart>
                    ) : (
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="displayDate" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} tickFormatter={(value) => valueFormatter(Number(value))} />
                            <Tooltip
                                contentStyle={{ backgroundColor: "#1e293b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                                itemStyle={{ color: "#fff" }}
                                formatter={(value) => valueFormatter(Number(value))}
                            />
                            <Area type="monotone" dataKey="value" stroke={color} strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                        </AreaChart>
                    )}
                </ResponsiveContainer>
            </div>
        </Card>
    );
}

