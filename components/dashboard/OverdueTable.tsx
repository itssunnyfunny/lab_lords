"use client";

import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { DashboardButton } from "@/components/dashboard/DashboardButton";
import { daysPastDue } from "@/lib/utils/paymentStatus";
import { ArrowRight, CheckCircle2, Phone } from "lucide-react";
import { useRouter } from "next/navigation";

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
        .map((part) => part[0])
        .join("")
        .toUpperCase();
}

function formatMoney(amount: number) {
    return `Rs ${amount.toLocaleString("en-IN")}`;
}

function formatDueDate(value: string) {
    return new Date(value).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
    });
}

export function OverdueTable({ payments, branchId }: OverdueTableProps) {
    const router = useRouter();
    const shown = payments.slice(0, 6);

    return (
        <DashboardPanel
            title="Payment follow-ups"
            description="Students with overdue dues, ordered for collection work."
            action={
                <DashboardButton
                    onClick={() => router.push(`/branch/${branchId}/payments`)}
                    variant="quiet"
                    size="sm"
                    rightIcon={ArrowRight}
                >
                    Payments
                </DashboardButton>
            }
            contentClassName="p-0"
            className="h-full"
        >
            {payments.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-emerald-400/20 bg-emerald-400/10">
                        <CheckCircle2 size={20} className="text-emerald-300" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-white">No overdue payments</p>
                        <p className="mt-1 text-xs text-gray-500">Collections are clear right now.</p>
                    </div>
                </div>
            ) : (
                <>
                    <div className="hidden md:block">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b border-white/10 text-xs font-medium text-gray-500">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Student</th>
                                    <th className="px-4 py-3 font-medium">Due date</th>
                                    <th className="px-4 py-3 font-medium">Phone</th>
                                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                                {shown.map((payment) => {
                                    const overdueDays = daysPastDue(payment.dueDate);

                                    return (
                                        <tr key={payment.paymentId} className="transition-colors hover:bg-white/[0.03]">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-white/[0.05] text-xs font-semibold text-gray-300">
                                                        {getInitials(payment.studentName)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="truncate font-medium text-white">{payment.studentName}</p>
                                                        <p className="text-xs text-rose-300">
                                                            {overdueDays === 0 ? "Due today" : `${overdueDays} days overdue`}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-gray-300">{formatDueDate(payment.dueDate)}</td>
                                            <td className="px-4 py-3 text-gray-400">
                                                {payment.phone ? (
                                                    <span className="inline-flex items-center gap-1.5">
                                                        <Phone size={12} />
                                                        {payment.phone}
                                                    </span>
                                                ) : (
                                                    "Not added"
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right font-semibold text-white">{formatMoney(payment.amount)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="divide-y divide-white/10 md:hidden">
                        {shown.map((payment) => {
                            const overdueDays = daysPastDue(payment.dueDate);

                            return (
                                <div key={payment.paymentId} className="px-4 py-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-white">{payment.studentName}</p>
                                            <p className="mt-1 text-xs text-rose-300">
                                                {overdueDays === 0 ? "Due today" : `${overdueDays} days overdue`}
                                            </p>
                                            <p className="mt-1 text-xs text-gray-500">{payment.phone ?? "Phone not added"}</p>
                                        </div>
                                        <p className="shrink-0 text-sm font-semibold text-white">{formatMoney(payment.amount)}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {payments.length > shown.length && (
                        <button
                            type="button"
                            onClick={() => router.push(`/branch/${branchId}/payments`)}
                            className="flex w-full items-center justify-center gap-1.5 border-t border-white/10 px-4 py-3 text-xs font-medium text-gray-400 transition-colors hover:bg-white/[0.03] hover:text-white"
                        >
                            View {payments.length - shown.length} more overdue payments
                            <ArrowRight size={13} />
                        </button>
                    )}
                </>
            )}
        </DashboardPanel>
    );
}
