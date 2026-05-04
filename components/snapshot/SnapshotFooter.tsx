"use client";

import { Card } from "@/components/ui/Card";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { useEffect, useState } from "react";
import { analytics, BranchSnapshot } from "@/lib/api/analytics";
import { format } from "date-fns";

export function SnapshotFooter({ snapshot, branchId }: { snapshot?: BranchSnapshot, branchId?: string }) {
    const [studentData, setStudentData] = useState<{ name: string, active: number, inactive: number }[]>([]);
    const [paymentData, setPaymentData] = useState<{ name: string, paid: number, due: number }[]>([]);

    useEffect(() => {
        if (!branchId) return;
        const loadTrends = async () => {
            try {
                const to = new Date().toISOString();
                const from = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();

                const [stu, pay] = await Promise.all([
                    analytics.getTrends(branchId, { from, to, type: "students" }),
                    analytics.getTrends(branchId, { from, to, type: "payment" })
                ]);

                // Group stu by date
                const stuMap = new Map();
                stu.forEach(t => {
                    const d = format(new Date(t.date), "EEE"); // Mon, Tue...
                    if (!stuMap.has(d)) stuMap.set(d, { name: d, active: 0, inactive: 0 });
                    if (t.category === "Active") stuMap.get(d).active = t.value;
                    if (t.category === "Inactive") stuMap.get(d).inactive = t.value;
                });
                setStudentData(Array.from(stuMap.values()));

                const payMap = new Map();
                pay.forEach(t => {
                    const d = format(new Date(t.date), "EEE");
                    if (!payMap.has(d)) payMap.set(d, { name: d, paid: 0, due: 0 });
                    if (t.category === "Collected") payMap.get(d).paid = t.value;
                    if (t.category === "Pending") payMap.get(d).due = t.value;
                });
                setPaymentData(Array.from(payMap.values()));

            } catch (err) {
                console.error("Failed to load footer trends", err);
            }
        };
        loadTrends();
    }, [branchId]);

    if (!snapshot) return null;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* Active vs Inactive */}
            <Card title="Active vs. Inactive Students" className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={studentData.length > 0 ? studentData : [{ name: 'Loading', active: 0, inactive: 0 }]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                        <Tooltip
                            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                        />
                        <Bar name="Active" dataKey="active" fill="#6366f1" radius={[4, 4, 0, 0]} stackId="a" />
                        <Bar name="Inactive" dataKey="inactive" fill="#475569" radius={[4, 4, 0, 0]} stackId="a" />
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
                            <BarChart data={paymentData.length > 0 ? paymentData : [{ name: 'Loading', paid: 0, due: 0 }]} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                    formatter={(value: number | string | undefined, name: string | number | undefined) => [`₹${value ?? 0}`, String(name ?? "")]}
                                />
                                <Bar name="Collected" dataKey="paid" fill="#10b981" radius={[4, 4, 0, 0]} stackId="b" />
                                <Bar name="Pending" dataKey="due" fill="#ef4444" radius={[4, 4, 0, 0]} stackId="b" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </Card>
        </div>
    );
}

