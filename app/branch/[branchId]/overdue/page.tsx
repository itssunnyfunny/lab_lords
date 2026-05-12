"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    AlertCircle,
    ArrowLeft,
    Check,
    Copy,
    CreditCard,
    Loader2,
    MessageSquare,
    Phone,
    RefreshCw,
    SearchX,
    Send,
    TriangleAlert,
} from "lucide-react";
import { format } from "date-fns";
import { BranchAccessGuard } from "@/components/auth/BranchAccessGuard";
import { Badge } from "@/components/ui/Badge";
import { AppButton, AppPanel, PageShell } from "@/components/ui";
import { formControlClass, formHelpTextClass, formWarningBannerClass } from "@/components/ui/formSurface";
import {
    pageCountBadgeClass,
    pageEmptyStateClass,
    pageErrorIconClass,
    pageErrorStateClass,
    pageGridCardClass,
    pageGridCardHoverClass,
    pageInsetSurfaceClass,
    pageLoadingStateClass,
    pageMutedTextClass,
    pageSectionDividerClass,
    pageSubtleTextClass,
    pageTableBodyDividerClass,
    pageTableHeadClass,
    pageTableRowClass,
    pageTableShellClass,
} from "@/components/ui/pageSurface";
import { BRANCH_PAGE_ACCESS } from "@/lib/branchPageAccess";
import { cn } from "@/lib/utils";

interface OverduePayment {
    paymentId: string;
    studentId: string;
    studentName: string;
    phone: string | null;
    dueDate: string;
    amount: number;
    daysOverdue?: number;
}

interface DraftMessage {
    paymentId: string;
    studentName: string;
    phone: string | null;
    message: string;
}

type QueueFilter = "ALL" | "CRITICAL" | "NO_PHONE";
type MessageLanguage = "EN" | "HI";

const formatMoney = (amount: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

const filters: { value: QueueFilter; label: string; description: string }[] = [
    { value: "ALL", label: "All overdue", description: "Full follow-up list" },
    { value: "CRITICAL", label: "Critical", description: "30+ days overdue" },
    { value: "NO_PHONE", label: "No phone", description: "Needs profile cleanup" },
];

function daysSinceDue(payment: OverduePayment) {
    if (typeof payment.daysOverdue === "number") return Math.max(0, payment.daysOverdue);
    const due = new Date(payment.dueDate);
    const today = new Date();
    due.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86_400_000));
}

function severityFor(days: number): { label: string; variant: "warning" | "danger" | "purple"; helper: string } {
    if (days >= 30) return { label: "Critical", variant: "danger", helper: "Needs owner follow-up" };
    if (days >= 14) return { label: "Escalate", variant: "purple", helper: "Second reminder window" };
    return { label: "Reminder", variant: "warning", helper: "Fresh overdue item" };
}

function formatDueDate(value: string) {
    return format(new Date(value), "dd MMM yyyy");
}

export default function OverduePage() {
    const params = useParams();
    const branchId = params.branchId as string;

    return (
        <BranchAccessGuard branchId={branchId} permission={BRANCH_PAGE_ACCESS.overdue}>
            <OverdueContent branchId={branchId} />
        </BranchAccessGuard>
    );
}

function OverdueContent({ branchId }: { branchId: string }) {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [generatingDrafts, setGeneratingDrafts] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [payments, setPayments] = useState<OverduePayment[]>([]);
    const [drafts, setDrafts] = useState<DraftMessage[]>([]);
    const [language, setLanguage] = useState<MessageLanguage>("EN");
    const [filter, setFilter] = useState<QueueFilter>("ALL");
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const fetchOverdue = useCallback(async (mode: "initial" | "refresh" = "initial") => {
        if (mode === "refresh") setRefreshing(true);
        if (mode === "initial") setLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/branches/${branchId}/payments/overdue`);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed to load overdue payments.");
            setPayments(Array.isArray(data.payments) ? data.payments : []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load overdue payments.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [branchId]);

    useEffect(() => {
        void fetchOverdue();
    }, [fetchOverdue]);

    useEffect(() => {
        async function loadDefaultLanguage() {
            try {
                const [branchRes, userRes] = await Promise.all([
                    fetch(`/api/branches/${branchId}`),
                    fetch("/api/users/me"),
                ]);
                const branch = branchRes.ok ? await branchRes.json() : null;
                const user = userRes.ok ? await userRes.json() : null;
                const preferred = branch?.defaultMessageLanguage || user?.defaultMessageLanguage;
                setLanguage(preferred === "hi" ? "HI" : "EN");
            } catch (err) {
                console.error(err);
            }
        }
        void loadDefaultLanguage();
    }, [branchId]);

    const sortedPayments = useMemo(() => {
        return [...payments].sort((a, b) => {
            const dayDiff = daysSinceDue(b) - daysSinceDue(a);
            if (dayDiff !== 0) return dayDiff;
            return b.amount - a.amount;
        });
    }, [payments]);

    const visiblePayments = useMemo(() => {
        return sortedPayments.filter((payment) => {
            if (filter === "CRITICAL") return daysSinceDue(payment) >= 30;
            if (filter === "NO_PHONE") return !payment.phone;
            return true;
        });
    }, [filter, sortedPayments]);

    const totals = useMemo(() => {
        const totalAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);
        const critical = payments.filter(payment => daysSinceDue(payment) >= 30);
        const missingPhone = payments.filter(payment => !payment.phone);
        const oldestDays = payments.reduce((max, payment) => Math.max(max, daysSinceDue(payment)), 0);

        return {
            totalAmount,
            criticalCount: critical.length,
            missingPhoneCount: missingPhone.length,
            oldestDays,
        };
    }, [payments]);

    const generateDrafts = async () => {
        setGeneratingDrafts(true);
        try {
            const nextDrafts = visiblePayments.map((payment) => {
                const amount = formatMoney(payment.amount);
                const date = formatDueDate(payment.dueDate);
                const message = language === "EN"
                    ? `Hi ${payment.studentName}, your ${amount} payment due on ${date} is pending. Please clear it at the earliest. Thank you.`
                    : `नमस्ते ${payment.studentName}, ${date} को देय ${amount} भुगतान अभी बाकी है। कृपया इसे जल्द जमा करें। धन्यवाद।`;

                return {
                    paymentId: payment.paymentId,
                    studentName: payment.studentName,
                    phone: payment.phone,
                    message,
                };
            });
            setDrafts(nextDrafts);
        } finally {
            setGeneratingDrafts(false);
        }
    };

    const copyToClipboard = async (text: string, id: string) => {
        await navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    if (loading) {
        return (
            <div className={pageLoadingStateClass}>
                <Loader2 className="mr-2 animate-spin" />
                Loading overdue queue...
            </div>
        );
    }

    if (error) {
        return (
            <div className={pageErrorStateClass}>
                <AlertCircle className={pageErrorIconClass} />
                <h2 className="text-xl font-semibold">Overdue queue did not load</h2>
                <p className={pageMutedTextClass}>{error}</p>
                <AppButton variant="secondary" icon={RefreshCw} onClick={() => fetchOverdue()}>
                    Try again
                </AppButton>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8">
            <PageShell>
                <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="min-w-0">
                        <AppButton variant="quiet" size="sm" icon={ArrowLeft} onClick={() => router.back()}>
                            Back
                        </AppButton>
                        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white md:text-3xl">
                            Overdue Collections
                        </h1>
                        <p className={cn("mt-2 max-w-2xl text-sm leading-6", pageMutedTextClass)}>
                            Work the collection queue by urgency, fix missing contact details, then copy reminder drafts for manual follow-up.
                        </p>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                        <AppButton
                            variant="secondary"
                            icon={RefreshCw}
                            onClick={() => fetchOverdue("refresh")}
                            disabled={refreshing}
                            className={refreshing ? "[&_svg]:animate-spin" : undefined}
                        >
                            Refresh
                        </AppButton>
                        <AppButton
                            variant="primary"
                            icon={CreditCard}
                            onClick={() => router.push(`/branch/${branchId}/payments`)}
                        >
                            Resolve in Payments
                        </AppButton>
                    </div>
                </header>

                {payments.length === 0 ? (
                    <div className={pageEmptyStateClass}>
                        <SearchX size={36} className="mb-4 opacity-60" />
                        <h2 className="text-lg font-semibold text-white">No overdue payments</h2>
                        <p className={cn("mt-2 max-w-md text-sm", pageMutedTextClass)}>
                            The collection queue is clear. New overdue payments will appear here after the grace period.
                        </p>
                    </div>
                ) : (
                    <>
                        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <MetricCard label="Overdue amount" value={formatMoney(totals.totalAmount)} detail={`${payments.length} open payment${payments.length === 1 ? "" : "s"}`} tone="danger" />
                            <MetricCard label="Critical queue" value={totals.criticalCount} detail="30+ days overdue" tone="danger" />
                            <MetricCard label="Missing phone" value={totals.missingPhoneCount} detail="Profile cleanup needed" tone={totals.missingPhoneCount > 0 ? "warning" : "success"} />
                            <MetricCard label="Oldest due" value={`${totals.oldestDays}d`} detail="Longest pending payment" tone={totals.oldestDays >= 30 ? "danger" : "warning"} />
                        </section>

                        <AppPanel
                            title="Collection Queue"
                            description="Sorted by highest urgency first. Use the filters to focus the work."
                            action={
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                    <select
                                        className={cn(formControlClass, "h-9 w-full bg-[color:var(--ui-form-input-select-bg)] px-3 text-xs sm:w-32")}
                                        value={language}
                                        onChange={(event) => setLanguage(event.target.value as MessageLanguage)}
                                    >
                                        <option value="EN">English</option>
                                        <option value="HI">Hindi</option>
                                    </select>
                                    <AppButton
                                        size="sm"
                                        variant="primary"
                                        icon={MessageSquare}
                                        onClick={generateDrafts}
                                        disabled={visiblePayments.length === 0}
                                        isLoading={generatingDrafts}
                                    >
                                        Draft selected
                                    </AppButton>
                                </div>
                            }
                            contentClassName="space-y-4"
                        >
                            <div className="grid gap-2 md:grid-cols-3">
                                {filters.map(item => {
                                    const active = filter === item.value;
                                    const count = item.value === "ALL"
                                        ? payments.length
                                        : item.value === "CRITICAL"
                                            ? totals.criticalCount
                                            : totals.missingPhoneCount;

                                    return (
                                        <button
                                            key={item.value}
                                            type="button"
                                            onClick={() => setFilter(item.value)}
                                            aria-pressed={active}
                                            className={cn(
                                                "rounded-[var(--ui-radius-control)] border px-3 py-2 text-left transition-colors",
                                                active
                                                    ? "border-[color:var(--ui-form-input-focus-border)] bg-[color:var(--ui-form-input-bg)] text-white"
                                                    : "border-[color:var(--ui-form-surface-border)] bg-[color:var(--ui-form-muted-surface-bg)] text-[color:var(--text-secondary)] hover:bg-[color:var(--ui-form-surface-hover-bg)] hover:text-white"
                                            )}
                                        >
                                            <span className="flex items-center justify-between gap-3">
                                                <span className="text-sm font-semibold">{item.label}</span>
                                                <span className={pageCountBadgeClass}>{count}</span>
                                            </span>
                                            <span className={cn("mt-1 block text-xs", pageSubtleTextClass)}>{item.description}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {totals.missingPhoneCount > 0 && (
                                <div className={cn("flex items-start gap-3 px-4 py-3 text-sm", formWarningBannerClass)}>
                                    <TriangleAlert size={16} className="mt-0.5 shrink-0" />
                                    <span>{totals.missingPhoneCount} overdue student{totals.missingPhoneCount === 1 ? "" : "s"} need a phone number before reminders can be sent cleanly.</span>
                                </div>
                            )}

                            {visiblePayments.length === 0 ? (
                                <div className={cn("min-h-[220px]", pageEmptyStateClass)}>
                                    <SearchX size={30} className="mb-3 opacity-60" />
                                    <p className="font-medium text-white">No payments in this queue</p>
                                    <p className={cn("mt-1 text-sm", pageMutedTextClass)}>Switch filters to continue collection work.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="grid gap-3 lg:hidden">
                                        {visiblePayments.map(payment => (
                                            <OverduePaymentCard key={payment.paymentId} payment={payment} />
                                        ))}
                                    </div>

                                    <div className={cn("hidden lg:block", pageTableShellClass)}>
                                        <div className="overflow-x-auto">
                                            <table className="w-full min-w-[760px] text-left text-sm">
                                                <thead className={pageTableHeadClass}>
                                                    <tr>
                                                        <th className="px-5 py-4 text-xs font-medium uppercase tracking-wider text-[color:var(--ui-table-muted)]">Student</th>
                                                        <th className="px-5 py-4 text-xs font-medium uppercase tracking-wider text-[color:var(--ui-table-muted)]">Contact</th>
                                                        <th className="px-5 py-4 text-xs font-medium uppercase tracking-wider text-[color:var(--ui-table-muted)]">Age</th>
                                                        <th className="px-5 py-4 text-xs font-medium uppercase tracking-wider text-[color:var(--ui-table-muted)]">Due date</th>
                                                        <th className="px-5 py-4 text-right text-xs font-medium uppercase tracking-wider text-[color:var(--ui-table-muted)]">Amount</th>
                                                    </tr>
                                                </thead>
                                                <tbody className={pageTableBodyDividerClass}>
                                                    {visiblePayments.map(payment => {
                                                        const days = daysSinceDue(payment);
                                                        const severity = severityFor(days);

                                                        return (
                                                            <tr key={payment.paymentId} className={pageTableRowClass}>
                                                                <td className="px-5 py-4">
                                                                    <p className="font-medium text-white">{payment.studentName}</p>
                                                                    <p className={cn("mt-1 text-xs", pageSubtleTextClass)}>{severity.helper}</p>
                                                                </td>
                                                                <td className="px-5 py-4">
                                                                    {payment.phone ? (
                                                                        <span className={cn("inline-flex items-center gap-1.5 text-sm", pageMutedTextClass)}>
                                                                            <Phone size={13} /> {payment.phone}
                                                                        </span>
                                                                    ) : (
                                                                        <Badge variant="warning">No phone</Badge>
                                                                    )}
                                                                </td>
                                                                <td className="px-5 py-4">
                                                                    <Badge variant={severity.variant}>{days} days</Badge>
                                                                </td>
                                                                <td className={cn("px-5 py-4", pageMutedTextClass)}>{formatDueDate(payment.dueDate)}</td>
                                                                <td className="px-5 py-4 text-right font-semibold text-white">{formatMoney(payment.amount)}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </>
                            )}
                        </AppPanel>

                        {drafts.length > 0 && (
                            <AppPanel
                                title="Reminder Drafts"
                                description="Drafts are not sent automatically. Copy the message and send through your normal channel."
                                action={<Badge variant="warning">Manual send</Badge>}
                                contentClassName="space-y-4"
                            >
                                <div className={cn("flex items-start gap-3 px-4 py-3 text-sm", formWarningBannerClass)}>
                                    <Send size={16} className="mt-0.5 shrink-0" />
                                    <span>These messages can affect collections. Review names, amounts, and tone before sending.</span>
                                </div>

                                <div className="grid gap-4 lg:grid-cols-2">
                                    {drafts.map((draft) => (
                                        <div key={draft.paymentId} className={cn(pageGridCardClass, pageGridCardHoverClass)}>
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="truncate font-semibold text-white">{draft.studentName}</p>
                                                    <p className={cn("mt-1 flex items-center gap-1.5 text-xs", pageSubtleTextClass)}>
                                                        <Phone size={12} /> {draft.phone || "Phone not added"}
                                                    </p>
                                                </div>
                                                {!draft.phone && <Badge variant="warning">Needs phone</Badge>}
                                            </div>

                                            <div className={cn("mt-4 p-3", pageInsetSurfaceClass)}>
                                                <p className="whitespace-pre-wrap text-sm leading-6 text-[color:var(--ui-table-text)]">{draft.message}</p>
                                            </div>

                                            <div className={cn("mt-4 flex justify-end border-t pt-4", pageSectionDividerClass)}>
                                                <AppButton
                                                    size="sm"
                                                    variant="secondary"
                                                    icon={copiedId === draft.paymentId ? Check : Copy}
                                                    onClick={() => copyToClipboard(draft.message, draft.paymentId)}
                                                >
                                                    {copiedId === draft.paymentId ? "Copied" : "Copy message"}
                                                </AppButton>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </AppPanel>
                        )}
                    </>
                )}
            </PageShell>
        </div>
    );
}

function MetricCard({
    label,
    value,
    detail,
    tone,
}: {
    label: string;
    value: string | number;
    detail: string;
    tone: "danger" | "warning" | "success";
}) {
    const valueClass = tone === "danger"
        ? "text-[color:var(--ui-tone-danger-text)]"
        : tone === "warning"
            ? "text-[color:var(--ui-tone-warning-text)]"
            : "text-[color:var(--ui-tone-success-text)]";

    return (
        <div className={cn("p-4", pageInsetSurfaceClass)}>
            <p className={cn("text-xs font-medium uppercase tracking-wide", pageSubtleTextClass)}>{label}</p>
            <p className={cn("mt-2 text-2xl font-semibold tracking-tight", valueClass)}>{value}</p>
            <p className={cn("mt-1 text-xs", pageMutedTextClass)}>{detail}</p>
        </div>
    );
}

function OverduePaymentCard({ payment }: { payment: OverduePayment }) {
    const days = daysSinceDue(payment);
    const severity = severityFor(days);

    return (
        <div className={cn(pageGridCardClass, pageGridCardHoverClass)}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="truncate font-semibold text-white">{payment.studentName}</p>
                    <p className={cn("mt-1 text-xs", pageSubtleTextClass)}>{severity.helper}</p>
                </div>
                <Badge variant={severity.variant}>{days} days</Badge>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className={cn("p-3", pageInsetSurfaceClass)}>
                    <p className={cn("text-xs", pageSubtleTextClass)}>Amount</p>
                    <p className="mt-1 font-semibold text-white">{formatMoney(payment.amount)}</p>
                </div>
                <div className={cn("p-3", pageInsetSurfaceClass)}>
                    <p className={cn("text-xs", pageSubtleTextClass)}>Due date</p>
                    <p className={cn("mt-1 text-xs", pageMutedTextClass)}>{formatDueDate(payment.dueDate)}</p>
                </div>
            </div>

            <div className={cn("mt-3 flex items-center gap-2 text-sm", payment.phone ? pageMutedTextClass : formHelpTextClass)}>
                <Phone size={14} />
                {payment.phone || "Phone number missing"}
            </div>
        </div>
    );
}
