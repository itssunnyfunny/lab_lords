"use client";

import { AppButton, AppPanel } from "@/components/ui";
import {
    pageInsetSurfaceClass,
    pageSectionDividerClass,
    pageSubtleTextClass,
    pageTableBodyDividerClass,
    pageTableHeadClass,
    pageTableRowClass,
} from "@/components/ui/pageSurface";
import { cn } from "@/lib/utils";
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
        <AppPanel
            title="Payment follow-ups"
            description="Students with overdue dues, ordered for collection work."
            action={
                <AppButton
                    onClick={() => router.push(`/branch/${branchId}/payments`)}
                    variant="quiet"
                    size="sm"
                    rightIcon={ArrowRight}
                >
                    Payments
                </AppButton>
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
                        <p className="text-sm font-medium text-[color:var(--text-primary)]">No overdue payments</p>
                        <p className={cn("mt-1 text-xs", pageSubtleTextClass)}>Collections are clear right now.</p>
                    </div>
                </div>
            ) : (
                <>
                    <div className="hidden md:block">
                        <table className="w-full text-left text-sm">
                            <thead className={cn("border-b text-xs font-medium text-[color:var(--ui-table-muted)]", pageSectionDividerClass, pageTableHeadClass)}>
                                <tr>
                                    <th className="px-4 py-3 font-medium">Student</th>
                                    <th className="px-4 py-3 font-medium">Due date</th>
                                    <th className="px-4 py-3 font-medium">Phone</th>
                                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                                </tr>
                            </thead>
                            <tbody className={pageTableBodyDividerClass}>
                                {shown.map((payment) => {
                                    const overdueDays = daysPastDue(payment.dueDate);

                                    return (
                                        <tr key={payment.paymentId} className={pageTableRowClass}>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center text-xs font-semibold text-[color:var(--text-secondary)]", pageInsetSurfaceClass)}>
                                                        {getInitials(payment.studentName)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="truncate font-medium text-[color:var(--text-primary)]">{payment.studentName}</p>
                                                        <p className="text-xs text-rose-300">
                                                            {overdueDays === 0 ? "Due today" : `${overdueDays} days overdue`}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-[color:var(--text-secondary)]">{formatDueDate(payment.dueDate)}</td>
                                            <td className="px-4 py-3 text-[color:var(--text-secondary)]">
                                                {payment.phone ? (
                                                    <span className="inline-flex items-center gap-1.5">
                                                        <Phone size={12} />
                                                        {payment.phone}
                                                    </span>
                                                ) : (
                                                    "Not added"
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right font-semibold text-[color:var(--text-primary)]">{formatMoney(payment.amount)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className={cn("divide-y md:hidden", pageSectionDividerClass)}>
                        {shown.map((payment) => {
                            const overdueDays = daysPastDue(payment.dueDate);

                            return (
                                <div key={payment.paymentId} className="px-4 py-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-[color:var(--text-primary)]">{payment.studentName}</p>
                                            <p className="mt-1 text-xs text-rose-300">
                                                {overdueDays === 0 ? "Due today" : `${overdueDays} days overdue`}
                                            </p>
                                            <p className={cn("mt-1 text-xs", pageSubtleTextClass)}>{payment.phone ?? "Phone not added"}</p>
                                        </div>
                                        <p className="shrink-0 text-sm font-semibold text-[color:var(--text-primary)]">{formatMoney(payment.amount)}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {payments.length > shown.length && (
                        <button
                            type="button"
                            onClick={() => router.push(`/branch/${branchId}/payments`)}
                            className={cn("flex w-full items-center justify-center gap-1.5 border-t px-4 py-3 text-xs font-medium text-[color:var(--text-secondary)] transition-colors hover:bg-[color:var(--ui-table-row-hover-bg)] hover:text-[color:var(--text-primary)]", pageSectionDividerClass)}
                        >
                            View {payments.length - shown.length} more overdue payments
                            <ArrowRight size={13} />
                        </button>
                    )}
                </>
            )}
        </AppPanel>
    );
}
