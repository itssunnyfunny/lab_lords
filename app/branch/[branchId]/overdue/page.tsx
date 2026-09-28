"use client";
import { LocalizedError } from "@/components/settings/LocalizedText";
import { useTranslation } from "@/components/settings/LocalizedText";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
    AlertCircle,
    ArrowLeft,
    Check,
    Copy,
    CreditCard,
    MessageSquare,
    LockKeyhole,
    Phone,
    RefreshCw,
    Send,
    TriangleAlert,
} from "lucide-react";
import { BranchAccessGuard } from "@/components/auth/BranchAccessGuard";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { Badge } from "@/components/ui/Badge";
import { AppButton, AppPanel, AppSelect, PageLoadingSkeleton } from "@/components/ui";
import { appActionClassName } from "@/components/ui/AppButton";
import { RecordListPage, RecordListSurface, RecordListState } from "@/components/ui/RecordList";
import { DataTable } from "@/components/tables/DataTable";
import { formHelpTextClass, formWarningBannerClass } from "@/components/ui/formSurface";
import {
    pageCountBadgeClass,
    pageErrorIconClass,
    pageErrorStateClass,
    pageGridCardClass,
    pageGridCardHoverClass,
    pageInsetSurfaceClass,
    pageMutedTextClass,
    pageSectionDividerClass,
    pageSubtleTextClass,
} from "@/components/ui/pageSurface";
import { BRANCH_PAGE_ACCESS } from "@/lib/branchPageAccess";
import { getBranchCapabilityDecision } from "@/lib/branchCapabilities";
import {
    getOverdueBulkReviewHref,
    getOverduePaymentHref,
    getOverdueStudentHref,
    updateQueueSelection,
    type OverdueQueuePayment,
} from "@/lib/overdueQueue";
import { cn } from "@/lib/utils";
import type { CapabilityDecision } from "@/types";
import { payments as paymentApi } from "@/lib/api/payments";
import { ApprovedPaymentReminderReview } from "@/components/whatsapp/ApprovedPaymentReminderReview";
import { paymentReminderDraft } from "@/lib/paymentReminderDraft";

interface OverduePayment extends OverdueQueuePayment {
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

const filters: { value: QueueFilter; label: string; description: string }[] = [
    { value: "ALL", label: "Loaded overdue", description: "Loaded follow-up rows" },
    { value: "CRITICAL", label: "Loaded critical", description: "30+ days overdue" },
    { value: "NO_PHONE", label: "Loaded without phone", description: "Needs profile cleanup" },
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

export default function OverduePage() {
    const params = useParams();
    const branchId = params.branchId as string;

    return (
        <BranchAccessGuard branchId={branchId} permission={BRANCH_PAGE_ACCESS.overdue}>
            {access => (
                <OverdueContent
                    key={branchId}
                    branchId={branchId}
                    recordDecision={getBranchCapabilityDecision(access, "paymentsRecord")}
                    whatsAppSendDecision={getBranchCapabilityDecision(access, "whatsappSend")}
                />
            )}
        </BranchAccessGuard>
    );
}

function OverdueContent({
    branchId,
    recordDecision,
    whatsAppSendDecision,
}: {
    branchId: string;
    recordDecision: CapabilityDecision;
    whatsAppSendDecision: CapabilityDecision;
}) {
    const t = useTranslation();
    const router = useRouter();
    const { formatDate, formatDateTime, formatNumber } = useUserPreferences();
    const formatMoney = (amount: number) => formatNumber(amount, {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [generatingDrafts, setGeneratingDrafts] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
    const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
    const [payments, setPayments] = useState<OverduePayment[]>([]);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [total, setTotal] = useState(0);
    const [drafts, setDrafts] = useState<DraftMessage[]>([]);
    const [language, setLanguage] = useState<MessageLanguage>("EN");
    const [filter, setFilter] = useState<QueueFilter>("ALL");
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
    const selectAllRef = useRef<HTMLInputElement>(null);

    const fetchOverdue = useCallback(async (
        mode: "initial" | "refresh" | "more" = "initial",
        cursor?: string | null
    ) => {
        if (mode === "refresh") setRefreshing(true);
        if (mode === "initial") setLoading(true);
        if (mode === "more") setLoadingMore(true);
        if (mode !== "more") setError(null);
        setLoadMoreError(null);

        try {
            const page = await paymentApi.listOverdue(branchId, { cursor });
            const nextPayments: OverduePayment[] = page.items;
            if (mode === "more") {
                setPayments(current => {
                    const knownIds = new Set(current.map(payment => payment.paymentId));
                    return [
                        ...current,
                        ...nextPayments.filter(payment => !knownIds.has(payment.paymentId)),
                    ];
                });
            } else {
                setPayments(nextPayments);
                setSelectedIds(current => {
                    const available = new Set(nextPayments.map(payment => payment.paymentId));
                    return new Set([...current].filter(paymentId => available.has(paymentId)));
                });
            }
            setNextCursor(page.nextCursor);
            setTotal(page.total);
            setUpdatedAt(new Date());
            setError(null);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load overdue payments.";
            if (mode === "more") setLoadMoreError(message);
            else setError(message);
        } finally {
            if (mode === "initial") setLoading(false);
            if (mode === "refresh") setRefreshing(false);
            if (mode === "more") setLoadingMore(false);
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

    const selectedPayments = useMemo(
        () => payments.filter(payment => selectedIds.has(payment.paymentId)),
        [payments, selectedIds]
    );
    const visiblePaymentIds = useMemo(
        () => visiblePayments.map(payment => payment.paymentId),
        [visiblePayments]
    );
    const visibleSelectedCount = visiblePaymentIds.filter(paymentId => selectedIds.has(paymentId)).length;
    const allVisibleSelected = visiblePaymentIds.length > 0 && visibleSelectedCount === visiblePaymentIds.length;
    const someVisibleSelected = visibleSelectedCount > 0 && !allVisibleSelected;

    useEffect(() => {
        if (selectAllRef.current) selectAllRef.current.indeterminate = someVisibleSelected;
    }, [someVisibleSelected]);

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
            const nextDrafts = selectedPayments.map((payment) => {
                const amount = formatMoney(payment.amount);
                const date = formatDate(payment.dueDate);
                const message = paymentReminderDraft({ studentName: payment.studentName, amount, date, language });

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

    const togglePayment = (paymentId: string, checked: boolean) => {
        setSelectedIds(current => updateQueueSelection(current, [paymentId], checked));
    };

    const toggleAllVisible = (checked: boolean) => {
        setSelectedIds(current => updateQueueSelection(current, visiblePaymentIds, checked));
    };

    const bulkReviewHref = getOverdueBulkReviewHref(branchId, selectedPayments);

    if (loading) {
        return <PageLoadingSkeleton label={t("Loading overdue queue")} variant="table" rows={5} />;
    }

    if (error && !updatedAt) {
        return (
            <div className={pageErrorStateClass}>
                <AlertCircle className={pageErrorIconClass} />
                <h2 className="text-xl font-semibold">{t("Overdue queue did not load")}</h2>
                <p className={pageMutedTextClass}><LocalizedError error={error} /></p>
                <AppButton variant="secondary" icon={RefreshCw} onClick={() => fetchOverdue()}>
                    {t("Try again")}</AppButton>
            </div>
        );
    }

    return (
        <RecordListPage eyebrow={t("Collections queue")} title={t("Overdue collections")}
            description={t("Work the collection queue by urgency, fix missing contact details, then copy reminder drafts for manual follow-up.")}
            actions={<>
                <AppButton density="compact" variant="quiet" icon={ArrowLeft} onClick={() => router.back()}>{t("Back")}</AppButton>
                <AppButton density="compact" variant="secondary" icon={RefreshCw} onClick={() => fetchOverdue("refresh")} disabled={refreshing}>{t("Refresh")}</AppButton>
                <AppButton density="compact" variant="primary" icon={CreditCard} onClick={() => router.push(bulkReviewHref)}>
                    {selectedPayments.length === 1 ? t("Review selected payment") : t("Review due payments")}
                </AppButton>
            </>}
            notices={updatedAt && <p className={cn("text-xs", pageSubtleTextClass)}>{t("Updated")} {formatDateTime(updatedAt)}</p>}>

                {error && updatedAt && (
                    <div className={cn("flex items-start gap-3 px-4 py-3 text-sm", formWarningBannerClass)} role="status">
                        <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                        <span>
                            {t("Refresh failed. Showing data last updated {time}.", { time: formatDateTime(updatedAt) })} <LocalizedError error={error} />
                        </span>
                    </div>
                )}

                {!recordDecision.allowed && recordDecision.blocker !== "permission" && (
                    <div id="overdue-record-blocker" className={cn("flex flex-col gap-3 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between", formWarningBannerClass)}>
                        <span className="flex items-start gap-2">
                            <LockKeyhole size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                            <span><span className="font-semibold">{t("Recording payments is unavailable.")}</span> {recordDecision.reason}</span>
                        </span>
                        {recordDecision.recoveryHref && (
                            <Link href={recordDecision.recoveryHref} className="shrink-0 font-semibold underline underline-offset-4">
                                {t("Resolve access")}</Link>
                        )}
                    </div>
                )}

                {payments.length === 0 ? (
                    <RecordListState kind="empty" title="No overdue payments" description="The collection queue is clear. New overdue payments will appear here after the grace period." />
                ) : (
                    <>
                        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <MetricCard label={t("Loaded overdue amount")} value={formatMoney(totals.totalAmount)} detail={`${payments.length} of ${total} open payments loaded`} tone="danger" />
                            <MetricCard label={t("Loaded critical")} value={formatNumber(totals.criticalCount)} detail="30+ days overdue in loaded rows" tone="danger" />
                            <MetricCard label={t("Loaded missing phone")} value={formatNumber(totals.missingPhoneCount)} detail="Profile cleanup in loaded rows" tone={totals.missingPhoneCount > 0 ? "warning" : "success"} />
                            <MetricCard label={t("Oldest due")} value={`${formatNumber(totals.oldestDays)}d`} detail="Oldest loaded payment" tone={totals.oldestDays >= 30 ? "danger" : "warning"} />
                        </section>

                        <RecordListSurface label={t("Collection Queue")} busy={refreshing || loadingMore} toolbar={<div className="w-full space-y-3">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div><h2 className="text-sm font-semibold">{t("Collection Queue")}</h2><p className="text-xs text-[color:var(--text-muted)]">{t("Oldest dues load first. Filters and bulk selection apply to the rows currently loaded.")}</p></div>
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                    <AppSelect
                                        aria-label={t("Reminder language")}
                                        className="h-11 w-full text-xs sm:w-32 lg:min-h-9 lg:h-9"
                                        containerClassName="w-full sm:w-32"
                                        value={language}
                                        onValueChange={value => setLanguage(value as MessageLanguage)}
                                        options={[
                                            { value: "EN", label: "English" },
                                            { value: "HI", label: t("Hindi") },
                                        ]}
                                    />
                                    <AppButton
                                        density="compact"
                                        variant="primary"
                                        icon={MessageSquare}
                                        onClick={generateDrafts}
                                        disabled={selectedPayments.length === 0}
                                        isLoading={generatingDrafts}
                                    >{t("Draft selected ({count})", { count: selectedPayments.length })}</AppButton>
                                </div>
                            </div>
                            <div className="grid gap-2 md:grid-cols-3">
                                {filters.map(item => {
                                    const active = filter === item.value;
                                    const count = item.value === "ALL"
                                        ? payments.length
                                        : item.value === "CRITICAL"
                                            ? totals.criticalCount
                                            : totals.missingPhoneCount;

                                    return (
                                        <AppButton
                                            density="compact"
                                            variant={active ? "primary" : "secondary"}
                                            key={item.value}
                                            onClick={() => setFilter(item.value)}
                                            aria-pressed={active}
                                            className="w-full !justify-start text-left [&>span]:w-full [&>span]:flex-col [&>span]:items-stretch"
                                        >
                                            <span className="flex items-center justify-between gap-3">
                                                <span className="text-sm font-semibold">{t.owned(item.label)}</span>
                                                <span className={pageCountBadgeClass}>{count}</span>
                                            </span>
                                            <span className={cn("mt-1 block text-xs", pageSubtleTextClass)}>{t.owned(item.description)}</span>
                                        </AppButton>
                                    );
                                })}
                            </div>
                        </div>}>
                            <div className="space-y-4 p-4">
                            <div className={cn("flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between", pageInsetSurfaceClass)}>
                                <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-[color:var(--text-primary)]">
                                    <input
                                        ref={selectAllRef}
                                        type="checkbox"
                                        checked={allVisibleSelected}
                                        onChange={event => toggleAllVisible(event.target.checked)}
                                        disabled={visiblePayments.length === 0}
                                        className="h-5 w-5 rounded border-[color:var(--ui-form-input-border)] accent-[color:var(--ui-focus-ring)]"
                                    />
                                    {t("Select all")} {visiblePayments.length}  {t("shown")}</label>
                                <div className="flex flex-wrap items-center gap-3">
                                    <span className={cn("text-sm", pageMutedTextClass)} aria-live="polite">{t("{count} selected", { count: selectedPayments.length })}</span>
                                    {selectedPayments.length > 0 && (
                                        <Link
                                            href={bulkReviewHref}
                                            className={appActionClassName("secondary")}
                                        >
                                            {selectedPayments.length === 1 ? t("Review selected payment") : t("Open matching due queue")}
                                        </Link>
                                    )}
                                </div>
                            </div>

                            {totals.missingPhoneCount > 0 && (
                                <div className={cn("flex items-start gap-3 px-4 py-3 text-sm", formWarningBannerClass)}>
                                    <TriangleAlert size={16} className="mt-0.5 shrink-0" />
                                    <span>{t("{missingPhoneCount} loaded overdue student(s) need a phone number before reminders can be sent cleanly.", { missingPhoneCount: totals.missingPhoneCount })}</span>
                                </div>
                            )}

                            {visiblePayments.length === 0 ? <RecordListState kind="empty" title="No payments in this queue" description="Switch filters to continue collection work." /> :
                                <DataTable density="compact" caption="Overdue payments completion queue"
                                    data={visiblePayments.map(payment => ({ ...payment, id: payment.paymentId }))}
                                    columns={[
                                        { header: "Select payment", accessor: payment => <input type="checkbox" checked={selectedIds.has(payment.paymentId)} onChange={event => togglePayment(payment.paymentId, event.target.checked)} aria-label={`Select ${payment.studentName}'s overdue payment`} className="h-5 w-5 rounded border-[color:var(--ui-form-input-border)] accent-[color:var(--ui-focus-ring)]" />, className: "w-14" },
                                        { header: "Student", accessor: payment => <><Link href={getOverdueStudentHref(branchId, payment.studentId)} className="font-semibold text-[color:var(--text-primary)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ui-focus-ring)]">{payment.studentName}</Link><p className={cn("mt-1 text-xs", pageSubtleTextClass)}>{severityFor(daysSinceDue(payment)).helper}</p></>, rowHeader: true },
                                        { header: "Contact", accessor: payment => payment.phone ? <span className={cn("inline-flex items-center gap-1.5", pageMutedTextClass)}><Phone size={13} aria-hidden="true" />{payment.phone}</span> : <Badge variant="warning">{t("No phone")}</Badge> },
                                        { header: "Age", accessor: payment => <Badge variant={severityFor(daysSinceDue(payment)).variant}>{t("{days} days", { days: daysSinceDue(payment) })}</Badge> },
                                        { header: "Due date", accessor: payment => formatDate(payment.dueDate) },
                                        { header: "Amount", accessor: payment => <strong className="tabular-nums">{formatMoney(payment.amount)}</strong> },
                                    ]}
                                    actions={payment => <PaymentQueueAction href={getOverduePaymentHref(branchId, payment)} decision={recordDecision} />}
                                    renderGridCard={payment => <OverduePaymentCard payment={payment} branchId={branchId} selected={selectedIds.has(payment.paymentId)} onSelectedChange={checked => togglePayment(payment.paymentId, checked)} recordDecision={recordDecision} />}
                                />}

                            <div className="flex flex-col items-center gap-3 border-t border-[color:var(--ui-form-section-divider)] pt-4 text-center">
                                <p id="overdue-pagination-status" className={cn("text-sm", pageMutedTextClass)} aria-live="polite">{t("Showing {count} of {total} overdue payment(s)", { count: payments.length, total: total })}</p>
                                {nextCursor && (
                                    <AppButton
                                        type="button"
                                        variant="secondary"
                                        onClick={() => void fetchOverdue("more", nextCursor)}
                                        isLoading={loadingMore}
                                        disabled={loadingMore}
                                        aria-describedby="overdue-pagination-status"
                                        className="min-h-11 min-w-36 justify-center"
                                    >
                                        {loadingMore ? t("Loading...") : t("Load more payments")}
                                    </AppButton>
                                )}
                                {loadMoreError && (
                                    <div className={cn("flex items-center gap-2 px-3 py-2 text-sm", formWarningBannerClass)} role="alert">
                                        <AlertCircle size={14} aria-hidden="true" />
                                        <span><LocalizedError error={loadMoreError} /></span>
                                    </div>
                                )}
                            </div>
                            </div>
                        </RecordListSurface>

                        <ApprovedPaymentReminderReview
                            branchId={branchId}
                            paymentIds={selectedPayments.map(payment => payment.paymentId)}
                            canSend={whatsAppSendDecision.allowed}
                            blockedReason={whatsAppSendDecision.reason ?? undefined}
                        />

                        {drafts.length > 0 && (
                            <AppPanel
                                title={t("Reminder Drafts")}
                                description={t("Drafts are not sent automatically. Copy the message and send through your normal channel.")}
                                action={<Badge variant="warning">{t("Manual send")}</Badge>}
                                contentClassName="space-y-4"
                            >
                                <div className={cn("flex items-start gap-3 px-4 py-3 text-sm", formWarningBannerClass)}>
                                    <Send size={16} className="mt-0.5 shrink-0" />
                                    <span>{t("These messages can affect collections. Review names, amounts, and tone before sending.")}</span>
                                </div>

                                <div className="grid gap-4 lg:grid-cols-2">
                                    {drafts.map((draft) => (
                                        <div key={draft.paymentId} className={cn(pageGridCardClass, pageGridCardHoverClass)}>
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="truncate font-semibold text-[color:var(--text-primary)]">{draft.studentName}</p>
                                                    <p className={cn("mt-1 flex items-center gap-1.5 text-xs", pageSubtleTextClass)}>
                                                        <Phone size={12} /> {draft.phone || "Phone not added"}
                                                    </p>
                                                </div>
                                                {!draft.phone && <Badge variant="warning">{t("Needs phone")}</Badge>}
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
                                                    {copiedId === draft.paymentId ? t("Copied") : t("Copy message")}
                                                </AppButton>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </AppPanel>
                        )}
                    </>
                )}
        </RecordListPage>
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
        <AppPanel density="compact" title={label}>
            <p className={cn("text-2xl font-semibold tracking-tight tabular-nums", valueClass)}>{value}</p>
            <p className={cn("mt-1 text-xs", pageMutedTextClass)}>{detail}</p>
        </AppPanel>
    );
}

function PaymentQueueAction({ href, decision }: { href: string; decision: CapabilityDecision }) {
    const t = useTranslation();
    if (decision.allowed) {
        return <Link href={href} className={appActionClassName("secondary")}>{t("Record payment")}</Link>;
    }

    if (decision.blocker === "permission") {
        return <Link href={href} className={appActionClassName("secondary")}>{t("View payment")}</Link>;
    }

    return (
        <div className="inline-flex flex-wrap justify-end gap-2">
            <Link href={href} className={appActionClassName("secondary")}>{t("View payment")}</Link>
            <AppButton density="compact" variant="secondary" disabled aria-describedby="overdue-record-blocker" icon={LockKeyhole}>{t("Record payment")}</AppButton>
        </div>
    );
}

function OverduePaymentCard({
    payment,
    branchId,
    selected,
    onSelectedChange,
    recordDecision,
}: {
    payment: OverduePayment;
    branchId: string;
    selected: boolean;
    onSelectedChange: (checked: boolean) => void;
    recordDecision: CapabilityDecision;
}) {
    const t = useTranslation();
    const { formatDate, formatNumber } = useUserPreferences();
    const formattedAmount = formatNumber(payment.amount, {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    });
    const days = daysSinceDue(payment);
    const severity = severityFor(days);

    return (
        <article className={cn(pageGridCardClass, pageGridCardHoverClass, "ui-record-card")}>
            <div className="ui-record-card-identity">
                <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center">
                    <input type="checkbox" checked={selected} onChange={event => onSelectedChange(event.target.checked)} aria-label={`Select ${payment.studentName}'s overdue payment`}
                        className="h-5 w-5 rounded border-[color:var(--ui-form-input-border)] accent-[color:var(--ui-focus-ring)]" />
                </label>
                <div className="min-w-0 flex-1"><Link href={getOverdueStudentHref(branchId, payment.studentId)} className="ui-record-card-name underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ui-focus-ring)]">{payment.studentName}</Link>
                    <p className="ui-record-card-meta">{severity.helper}</p></div>
                <Badge variant={severity.variant}>{t("{days} days", { days })}</Badge>
            </div>
            <div className={cn("ui-record-card-context", payment.phone ? pageMutedTextClass : formHelpTextClass)}><Phone size={14} aria-hidden="true" /><span>{payment.phone || "Phone number missing"}</span></div>
            <div className="ui-record-card-summary">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p>{t("Amount")}</p><p className="ui-record-card-due tabular-nums">{formattedAmount}</p></div><div><p>{t("Due date")}</p><p className="font-medium">{formatDate(payment.dueDate)}</p></div></div>
                <div className="mt-3 flex justify-end"><PaymentQueueAction href={getOverduePaymentHref(branchId, payment)} decision={recordDecision} /></div>
            </div>
        </article>
    );
}
