"use client";

import { Card } from "@/components/ui/Card";
import { Bar, BarChart, ResponsiveContainer, XAxis, Tooltip } from "recharts";
import { BranchSnapshot } from "@/lib/api/analytics";

const DATA_MOCK = [
    { name: 'Mon', active: 400, inactive: 240 },
    { name: 'Tue', active: 300, inactive: 139 },
    { name: 'Wed', active: 200, inactive: 980 },
    { name: 'Thu', active: 278, inactive: 390 },
    { name: 'Fri', active: 189, inactive: 480 },
    { name: 'Sat', active: 239, inactive: 380 },
    { name: 'Sun', active: 349, inactive: 430 },
];

export function SnapshotFooter({ snapshot }: { snapshot?: BranchSnapshot }) {
    if (!snapshot) return null;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* Active vs Inactive */}
            <Card title="Active vs. Inactive Students" className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={DATA_MOCK}>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                        <Tooltip
                            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                        />
                        <Bar dataKey="active" fill="#6366f1" radius={[4, 4, 0, 0]} stackId="a" />
                        <Bar dataKey="inactive" fill="#1e293b" radius={[4, 4, 0, 0]} stackId="a" />
                    </BarChart>
                </ResponsiveContainer>
            </Card>

            {/* Due vs Paid */}
            <Card title="Due vs. Paid Payments" className="h-[300px]">
                <div className="flex items-end justify-between h-full pb-4">
                    <div className="space-y-4">
                        <div>
                            <p className="text-textSecondary text-sm">Collected</p>
                            <h3 className="text-2xl font-bold text-white">₹{snapshot.paidAmount.toLocaleString()}</h3>
                        </div>
                        <div>
                            <p className="text-textSecondary text-sm">Pending</p>
                            <h3 className="text-2xl font-bold text-rose-400">₹{snapshot.dueAmount.toLocaleString()}</h3>
                        </div>
                    </div>
                    <div className="flex-1 h-[200px] ml-10">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={DATA_MOCK}>
                                <Bar dataKey="active" fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </Card>
        </div>
    );
}

