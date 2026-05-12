"use client";

import { AppPanel } from "@/components/ui";
import { TrendData } from "@/lib/api/analytics";
import { format } from "date-fns";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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
    valueFormatter = value => value.toLocaleString("en-IN"),
    color = "var(--ui-tone-info-progress)",
    emptyLabel = "No trend data available.",
}: MainChartProps) {
    const chartData = data.map(d => ({
        ...d,
        displayDate: variant === "bar" ? d.category ?? d.date : formatXAxis(d.date),
    }));

    if (chartData.length === 0) {
        return (
            <AppPanel
                className="col-span-1 flex h-[400px] flex-col lg:col-span-2"
                title={title}
                contentClassName="flex min-h-0 flex-1"
            >
                <div className="flex flex-1 items-center justify-center rounded-[var(--ui-radius-control)] border border-dashed border-[color:var(--ui-table-empty-border)] bg-[color:var(--ui-form-muted-surface-bg)] px-4 text-center text-sm text-[color:var(--text-secondary)]">
                    {emptyLabel}
                </div>
            </AppPanel>
        );
    }

    const tooltipStyle = {
        backgroundColor: "var(--ui-menu-bg)",
        border: "1px solid var(--ui-menu-border)",
        borderRadius: "8px",
    };

    return (
        <AppPanel
            className="col-span-1 flex h-[400px] flex-col lg:col-span-2"
            title={title}
            contentClassName="flex min-h-0 flex-1"
        >
            <div className="min-h-0 w-full flex-1 pt-4">
                <ResponsiveContainer width="100%" height="100%">
                    {variant === "bar" ? (
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--ui-table-divider)" />
                            <XAxis dataKey="displayDate" axisLine={false} tickLine={false} tick={{ fill: "var(--ui-table-muted)", fontSize: 12 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--ui-table-muted)", fontSize: 12 }} tickFormatter={value => valueFormatter(Number(value))} />
                            <Tooltip
                                cursor={{ fill: "var(--ui-form-muted-surface-bg)" }}
                                contentStyle={tooltipStyle}
                                itemStyle={{ color: "var(--text-primary)" }}
                                formatter={value => valueFormatter(Number(value))}
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
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--ui-table-divider)" />
                            <XAxis dataKey="displayDate" axisLine={false} tickLine={false} tick={{ fill: "var(--ui-table-muted)", fontSize: 12 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--ui-table-muted)", fontSize: 12 }} tickFormatter={value => valueFormatter(Number(value))} />
                            <Tooltip
                                contentStyle={tooltipStyle}
                                itemStyle={{ color: "var(--text-primary)" }}
                                formatter={value => valueFormatter(Number(value))}
                            />
                            <Area type="monotone" dataKey="value" stroke={color} strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                        </AreaChart>
                    )}
                </ResponsiveContainer>
            </div>
        </AppPanel>
    );
}
