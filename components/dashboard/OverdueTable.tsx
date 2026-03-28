"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { AlertCircle, CheckCircle2, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";

interface OverduePayment {
    paymentId: string;
    studentId: string;
    studentName: string;
    phone: string | null;
    dueDate: string;
    amount: number;
}

interface OverdueTableProps {
    payments: OverduePayment[];
    branchId: string;
}

function getInitials(name: string) {
    return name
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase();
}

const avatarColors = [
    "bg-violet-500/20 text-violet-300",
    "bg-rose-500/20 text-rose-300",
    "bg-amber-500/20 text-amber-300",
    "bg-cyan-500/20 text-cyan-300",
    "bg-emerald-500/20 text-emerald-300",
];

export function OverdueTable({ payments, branchId }: OverdueTableProps) {
    const router = useRouter();
    const shown = payments.slice(0, 5);

    return (
        <Card
            title="Overdue Payments"
            action={
                <div className="flex items-center gap-2">
                    {payments.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 border border-rose-500/20 text-rose-400">
                            {payments.length} pending
                        </span>
                    )}
                    {payments.length > 5 && (
                        <button
                            onClick={() => router.push(`/branch/${branchId}/payments`)}
                            className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 transition-colors"
                        >
                            View all <ChevronRight size={12} />
                        </button>
                    )}
                </div>
            }
            className="h-full"
        >
            {payments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                        <CheckCircle2 size={22} className="text-emerald-400" />
                    </div>
                    <p className="text-sm font-semibold text-white">All caught up!</p>
                    <p className="text-xs text-gray-500">No overdue payments right now.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {shown.map((p, i) => {
                        const daysOverdue = Math.floor(
                            (Date.now() - new Date(p.dueDate).getTime()) / (1000 * 60 * 60 * 24)
                        );
                        return (
                            <div
                                key={p.paymentId}
                                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-white/10 transition-all duration-200 group"
                            >
                                {/* Avatar */}
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${avatarColors[i % avatarColors.length]}`}>
                                    {getInitials(p.studentName)}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-white truncate">{p.studentName}</p>
                                    <p className="text-xs text-gray-500">
                                        {daysOverdue === 0 ? "Due today" : `${daysOverdue}d overdue`}
                                    </p>
                                </div>

                                {/* Amount */}
                                <div className="text-right flex-shrink-0">
                                    <p className="text-sm font-bold text-rose-400">₹{p.amount.toLocaleString()}</p>
                                    <Badge variant="danger" className="text-[9px]">DUE</Badge>
                                </div>
                            </div>
                        );
                    })}

                    {payments.length > 5 && (
                        <button
                            onClick={() => router.push(`/branch/${branchId}/payments`)}
                            className="w-full mt-2 py-2.5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] text-xs text-gray-400 hover:text-white flex items-center justify-center gap-1.5 transition-all duration-200"
                        >
                            <AlertCircle size={12} />
                            {payments.length - 5} more overdue payments
                            <ChevronRight size={12} />
                        </button>
                    )}
                </div>
            )}
        </Card>
    );
}
