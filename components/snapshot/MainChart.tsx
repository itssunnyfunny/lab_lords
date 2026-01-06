"use client";

import { Card } from "@/components/ui/Card";
import { TrendData } from "@/lib/api/analytics";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format } from "date-fns";

interface MainChartProps {
    data?: TrendData;
}

const DEFAULT_DATA = [
    { date: '2023-01', value: 4000 },
    { date: '2023-02', value: 3000 },
    { date: '2023-03', value: 2000 },
];

export function MainChart({ data = DEFAULT_DATA }: MainChartProps) {
    // Map API data to chart format if needed, but TrendData is close.
    // Ensure date is formatted friendly
    const chartData = data.map(d => ({
        ...d,
        displayDate: format(new Date(d.date), 'MMM d')
    }));

    return (
        <Card className="col-span-1 lg:col-span-2 h-[400px] flex flex-col" title="Branch Health Trend">
            <div className="flex-1 w-full min-h-0 pt-4">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                        <XAxis
                            dataKey="displayDate"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#64748b', fontSize: 12 }}
                            dy={10}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#64748b', fontSize: 12 }}
                            tickFormatter={(value) => `${value}`} // Removed $ so it works for health score too
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                            itemStyle={{ color: '#fff' }}
                        />
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke="#6366f1"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorValue)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
}

