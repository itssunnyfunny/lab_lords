"use client";
import { useTranslation } from "@/components/settings/LocalizedText";

import { DataTable } from "@/components/tables/DataTable";
import { ViewToggle } from "@/components/tables/ViewToggle";
import { Badge } from "@/components/ui/Badge";
import { AppButton, useToast } from "@/components/ui";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { RecordListPage, RecordListSurface, RecordListState } from "@/components/ui/RecordList";
import { RowActionsMenu } from "@/components/ui/RowActionsMenu";
import {
    formWarningBannerClass,
} from "@/components/ui/formSurface";
import {
    pageCountBadgeClass,
    pageFilterShellClass,
    pageGridCardClass,
    pageGridCardHoverClass,
    pageMutedTextClass,
    pageSubtleTextClass,
} from "@/components/ui/pageSurface";
import { CollectFeeDialog } from "@/components/payments/CollectFeeDialog";
import { PaymentCollectionPicker } from "@/components/payments/PaymentCollectionPicker";
import { CollectionHistory } from "@/components/payments/CollectionHistory";
import { remainingFee } from "@/lib/feeBalance";
import { PaymentAuditLog } from "@/components/payments/PaymentAuditLog";
import { BranchAccessGuard } from "@/components/auth/BranchAccessGuard";
import { CalendarDays, Check, ChevronLeft, ChevronRight, History, Ban, MoreHorizontal } from "lucide-react";
import { useCallback, useEffect, useState, use } from "react";
import { payments, type PaymentListItem } from "@/lib/api/payments";
import { format, addMonths, subMonths } from "date-fns";
import { isOverdue } from "@/lib/utils/paymentStatus";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { BRANCH_PAGE_ACCESS } from "@/lib/branchPageAccess";
import { getAnyPermissionHelpText } from "@/lib/permissionMessages";
import { useDataViewMode } from "@/hooks/useDataViewMode";
import { getBranchCapabilityDecision } from "@/lib/branchCapabilities";
import type { CapabilityDecision } from "@/types";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";

type PaymentRow = PaymentListItem;

type PaymentTab = "DUE" | "PAID" | "WAIVED";

export default function PaymentsPage({ params }: { params: Promise<{ branchId: string }> }) {
    const { branchId } = use(params);

    return (
        <BranchAccessGuard branchId={branchId} permission={BRANCH_PAGE_ACCESS.payments}>
            {access => {
                const recordDecision = getBranchCapabilityDecision(access, "paymentsRecord");
                const waiveDecision = getBranchCapabilityDecision(access, "paymentsWaive");
                const generateDecision = getBranchCapabilityDecision(access, "paymentsGenerate");
                return (
                    <PaymentsContent
                        key={branchId}
                        branchId={branchId}
                        owner={access.isOwner}
                        recordDecision={recordDecision}
                        waiveDecision={waiveDecision}
                        generateDecision={generateDecision}
                    />
                );
            }}
        </BranchAccessGuard>
    );
}

function PaymentsContent({
    branchId,
    recordDecision,
    owner,
    waiveDecision,
    generateDecision,
}: {
    branchId: string;
    owner: boolean;
    recordDecision: CapabilityDecision;
    waiveDecision: CapabilityDecision;
    generateDecision: CapabilityDecision;
}) {
    const t = useTranslation();
    const toast = useToast();
    const { formatDate, formatNumber } = useUserPreferences();
    const searchParams = useSearchParams();
    const targetPaymentId = searchParams.get("paymentId");
    const targetStatus = searchParams.get("status");
    const targetMonth = searchParams.get("month");
    const generationRequested = searchParams.get("generate") === "1";
    const collectionRequested = searchParams.get("action") === "collect";
    const [pickerClosed, setPickerClosed] = useState(false);
    const paymentActionHelpText = getAnyPermissionHelpText(["mark_payment_paid", "waive_payments"]);
    const canMarkPaid = recordDecision.allowed;
    const canWaivePayments = waiveDecision.allowed;
    const canGeneratePayments = generateDecision.allowed;
    const generateBlockedReason = generateDecision.allowed ? null : generateDecision.reason;
    const showRecordAction = recordDecision.allowed || recordDecision.blocker !== "permission";
    const showWaiveAction = waiveDecision.allowed || waiveDecision.blocker !== "permission";
    const showGenerateAction = generateDecision.allowed || generateDecision.blocker !== "permission";

    const [currentDate, setCurrentDate] = useState(() => (
        targetMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(targetMonth)
            ? new Date(`${targetMonth}-01T12:00:00`)
            : new Date()
    ));
    const [activeTab, setActiveTab] = useState<PaymentTab>(() => (
        targetStatus === "PAID" || targetStatus === "WAIVED" ? targetStatus : "DUE"
    ));
    const [viewMode, setViewMode] = useDataViewMode();

    const [data, setData] = useState<PaymentRow[]>([]);
    const [paymentTotals, setPaymentTotals] = useState<Record<PaymentTab, number>>({
        DUE: 0,
        PAID: 0,
        WAIVED: 0,
    });
    const [nextPaymentCursor, setNextPaymentCursor] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [paymentToMark, setPaymentToMark] = useState<string | null>(null);
    const [collectStudentId, setCollectStudentId] = useState<string | null>(null);

    const [paymentToWaive, setPaymentToWaive] = useState<string | null>(null);
    const [waiving, setWaiving] = useState(false);

    const [auditLog, setAuditLog] = useState<{ paymentId: string; studentName: string } | null>(null);
    const [generating, setGenerating] = useState(false);
    const [generationMessage, setGenerationMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

    const loadPayments = useCallback(async (cursor?: string, append = false) => {
        if (append) setLoadingMore(true);
        else setLoading(true);

        try {
            const monthStr = format(currentDate, "yyyy-MM");
            const options = { status: activeTab, month: monthStr };

            if (append) {
                const page = await payments.list(branchId, { ...options, cursor, limit: 50 });
                setData(previous => [...previous, ...page.items]);
                setNextPaymentCursor(page.nextCursor);
                setPaymentTotals(previous => ({ ...previous, [activeTab]: page.total }));
            } else {
                const shouldResolveDeepLink = Boolean(
                    targetPaymentId && (!targetStatus || targetStatus === activeTab)
                );
                const currentPagePromise = shouldResolveDeepLink
                    ? payments.listAll(branchId, options).then(items => ({
                        items,
                        nextCursor: null,
                        total: items.length,
                    }))
                    : payments.list(branchId, { ...options, limit: 50 });
                const countPromises = (["DUE", "PAID", "WAIVED"] as const)
                    .filter(status => status !== activeTab)
                    .map(status => payments.list(branchId, { status, month: monthStr, limit: 1 })
                        .then(page => [status, page.total] as const));
                const [page, otherCounts] = await Promise.all([
                    currentPagePromise,
                    Promise.all(countPromises),
                ]);
                const totals: Record<PaymentTab, number> = {
                    DUE: 0,
                    PAID: 0,
                    WAIVED: 0,
                    ...Object.fromEntries(otherCounts),
                    [activeTab]: page.total,
                };

                setData(page.items);
                setNextPaymentCursor(page.nextCursor);
                setPaymentTotals(totals);
            }
            setError(null);
        } catch (loadError: unknown) {
            console.error("Failed to load payments", loadError);
            if (append) {
                toast.show({
                    title: "More payments could not be loaded",
                    description: loadError instanceof Error ? loadError.message : "Try again.",
                    tone: "error",
                });
            } else {
                setError("Failed to load payments.");
            }
        } finally {
            if (append) setLoadingMore(false);
            else setLoading(false);
        }
    }, [activeTab, branchId, currentDate, targetPaymentId, targetStatus, toast]);

    useEffect(() => {
        void loadPayments();
    }, [loadPayments]);

    useEffect(() => {
        if (targetMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(targetMonth)) {
            setCurrentDate(new Date(`${targetMonth}-01T12:00:00`));
        }
        if (targetStatus === "DUE" || targetStatus === "PAID" || targetStatus === "WAIVED") {
            setActiveTab(targetStatus);
        }
    }, [targetMonth, targetStatus]);

    useEffect(() => {
        if (loading || !targetPaymentId) return;
        const candidates = [
            document.getElementById(`payment-grid-${targetPaymentId}`),
            document.getElementById(`payment-table-${targetPaymentId}`),
        ].filter((candidate): candidate is HTMLElement => Boolean(candidate));
        const target = candidates.find(candidate => (
            candidate.getClientRects().length > 0
            && window.getComputedStyle(candidate).visibility !== "hidden"
        ));
        if (!target) return;
        const focusFrame = window.requestAnimationFrame(() => {
            const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
            target.focus({ preventScroll: true });
        });
        return () => window.cancelAnimationFrame(focusFrame);
    }, [activeTab, data, loading, targetPaymentId]);

    useEffect(() => {
        const refresh = () => void loadPayments();
        window.addEventListener("fee-collection-changed", refresh);
        window.addEventListener("focus", refresh);
        return () => { window.removeEventListener("fee-collection-changed", refresh); window.removeEventListener("focus", refresh); };
    }, [loadPayments]);

    const generateMissingPayments = async () => {
        setGenerating(true);
        setGenerationMessage(null);
        try {
            const response = await fetch(`/api/branches/${branchId}/payments/generate`, {
                method: "POST",
                cache: "no-store",
            });
            const result = await response.json() as { generatedCount?: number; error?: string };
            if (!response.ok) throw new Error(result.error || "Payment generation failed");
            const generatedCount = result.generatedCount ?? 0;
            setGenerationMessage({
                tone: "success",
                text: generatedCount > 0
                    ? `Generated ${generatedCount} missing payment${generatedCount === 1 ? "" : "s"}.`
                    : "Payment schedule is already up to date.",
            });
            await loadPayments();
        } catch (error) {
            setGenerationMessage({
                tone: "error",
                text: error instanceof Error ? error.message : "Payment generation failed.",
            });
        } finally {
            setGenerating(false);
        }
    };

    const handleMonthChange = (direction: "prev" | "next") => {
        setCurrentDate(prev => direction === "prev" ? subMonths(prev, 1) : addMonths(prev, 1));
    };

    const handleMarkPaid = (id: string) => {
        setCollectStudentId(data.find(p => p.id === id)?.studentId ?? null);
        setPaymentToMark(id);
    };

    const confirmWaive = async () => {
        if (!paymentToWaive) return;
        setWaiving(true);
        try {
            await payments.markAsWaived(paymentToWaive);
            await loadPayments();
            setPaymentToWaive(null);
            toast.show({ title: "Payment waived", tone: "success" });
        } catch (error) {
            toast.show({
                title: "Payment was not waived",
                description: error instanceof Error ? error.message : "Try again. The due remains active.",
                tone: "error",
                persistent: true,
            });
        } finally {
            setWaiving(false);
        }
    };

    // Filter data based on active tab
    const filteredData = data;
    const dueCount = paymentTotals.DUE;
    const paidCount = paymentTotals.PAID;
    const waivedCount = paymentTotals.WAIVED;

    const isCurrentMonth = (date: Date) => formatDate(date, { year: "numeric", month: "2-digit" })
        === formatDate(new Date(), { year: "numeric", month: "2-digit" });

    const formatPaymentAmount = (amount: number) =>
        formatNumber(amount, {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0,
        });

    const renderDueDate = (item: PaymentRow) => {
        const overdue = item.status === "DUE" && isOverdue(item.dueDate);

        return (
            <div className="flex flex-wrap items-center gap-2">
                {item.collectedAmount > 0 && item.status === "DUE" && <Badge variant="warning">{t("Partially paid")}</Badge>}
                <span className={cn(overdue ? "font-medium text-[color:var(--ui-tone-danger-text)]" : pageMutedTextClass)}>
                    {formatDate(item.dueDate)}
                </span>
                {overdue && (
                    <Badge variant="danger" className="h-5 px-1 py-0 text-[10px]">{t("OVERDUE")}</Badge>
                )}
            </div>
        );
    };

    const renderPaymentStatus = (item: PaymentRow) => (
        <Badge
            variant={
                item.status === "PAID" ? "success" :
                    item.status === "DUE" ? "warning" :
                        "purple"
            }
        >
            {t.owned({ DUE: "Due", PAID: "Paid", WAIVED: "Waived" }[item.status])}
        </Badge>
    );

    const renderFeeAmounts = (item: PaymentRow) => <div className="space-y-1">
        <span className="font-semibold">{formatPaymentAmount(item.status === "DUE" ? remainingFee(item) : item.amount)}</span>
        {item.ledgerBacked ? <p className={cn("text-xs", pageMutedTextClass)}>{t("Fee ₹{amount} · Collected ₹{collectedAmount} · Waived ₹{waivedAmount} · Remaining ₹{remainingFee}", { amount: item.amount, collectedAmount: item.collectedAmount, waivedAmount: item.waivedAmount, remainingFee: remainingFee(item) })}</p> : item.status !== "DUE" ? <p className={cn("text-xs", pageMutedTextClass)}>{t("Historical record · no generated receipt")}</p> : null}
    </div>;

    const renderPaymentMethod = (item: PaymentRow) => {
        const m = item.paymentMethod ?? null;
        if (!m) return <span className={cn("text-xs", pageMutedTextClass)}>—</span>;
        const label = { CASH: "Cash", UPI: "UPI", BANK_TRANSFER: "Bank Transfer" }[m];
        return <span className={cn("text-xs font-medium", pageMutedTextClass)}>{t.owned(label)}</span>;
    };

    const renderPaymentActions = (item: PaymentRow) => (
        <div className="flex flex-wrap items-center justify-end gap-2">
            {(item.status === "PAID" || item.status === "WAIVED") && (
                <AppButton
                    variant="quiet"
                    size="sm"
                    density="compact"
                    icon={History}
                    className={cn("text-xs", pageSubtleTextClass)}
                    onClick={() =>
                        setAuditLog({
                            paymentId: item.id,
                            studentName: item.student?.name || "Unknown",
                        })
                    }
                >
                    {t("History")}</AppButton>
            )}

            {item.status === "DUE" && (showRecordAction || showWaiveAction) && (
                <>
                    {showRecordAction && (
                        <AppButton
                            variant="secondary"
                            size="sm"
                            density="compact"
                            icon={Check}
                            className="text-xs"
                            disabled={!canMarkPaid}
                            title={recordDecision.allowed ? undefined : recordDecision.reason}
                            onClick={() => handleMarkPaid(item.id)}
                        >
                            {t("Collect fee")}</AppButton>
                    )}

                    {showWaiveAction && (
                        <RowDropdown
                            onWaive={() => setPaymentToWaive(item.id)}
                            disabled={!canWaivePayments}
                            reason={waiveDecision.allowed ? undefined : waiveDecision.reason}
                        />
                    )}
                </>
            )}

            {item.status === "DUE" && !showRecordAction && !showWaiveAction && (
                <span className={cn("max-w-[180px] text-right text-xs leading-5", pageSubtleTextClass)} title={paymentActionHelpText}>
                    {paymentActionHelpText}
                </span>
            )}
        </div>
    );

    return (
        <RecordListPage
            eyebrow={t("Branch payments")}
            title={t("Payment history")}
            description={t("Review dues, record collections, and keep waived payments separate from active follow-up.")}
            actions={<>
                {showGenerateAction && (
                    <AppButton
                        variant="secondary"
                        density="compact"
                        isLoading={generating}
                        autoFocus={generationRequested}
                        disabled={!canGeneratePayments}
                        title={generateDecision.allowed ? undefined : generateDecision.reason}
                        onClick={() => void generateMissingPayments()}
                    >
                        {t("Generate missing dues")}</AppButton>
                )}
                <div className={cn("flex items-center justify-between gap-2 p-1.5 sm:gap-3", pageFilterShellClass)}>
                    <AppButton variant="quiet" size="icon" onClick={() => handleMonthChange("prev")} aria-label={t("Previous month")}>
                        <ChevronLeft className="h-4 w-4" />
                    </AppButton>
                    <div className="min-w-[132px] text-center">
                        <div className="font-semibold text-[color:var(--text-primary)]">{formatDate(currentDate, { month: "long", year: "numeric" })}</div>
                        {isCurrentMonth(currentDate) && (
                            <div className="text-xs font-medium text-[color:var(--ui-form-accent)]">{t("Current month")}</div>
                        )}
                    </div>
                    <AppButton variant="quiet" size="icon" onClick={() => handleMonthChange("next")} aria-label={t("Next month")}>
                        <ChevronRight className="h-4 w-4" />
                    </AppButton>
                </div>
            </>}
            notices={<>
                {generationRequested && !canGeneratePayments && generateBlockedReason && (
                <div role="alert" className={cn("px-4 py-3 text-sm", formWarningBannerClass)}>
                    {generateBlockedReason}
                </div>
                )}
                {generationMessage && (
                <div
                    role={generationMessage.tone === "error" ? "alert" : "status"}
                    className={cn(
                        "rounded-[var(--ui-radius-control)] border px-4 py-3 text-sm",
                        generationMessage.tone === "error"
                            ? "border-[color:var(--ui-badge-danger-border)] bg-[color:var(--ui-badge-danger-bg)] text-[color:var(--ui-badge-danger-text)]"
                            : "border-[color:var(--ui-badge-success-border)] bg-[color:var(--ui-badge-success-bg)] text-[color:var(--ui-badge-success-text)]"
                    )}
                >
                    {generationMessage.text}
                </div>
                )}
            </>}
        >
            <RecordListSurface label={t("Payments")} busy={loading}
                toolbar={<>
                <div className="flex max-w-full items-center gap-2 overflow-x-auto">
                    <PaymentTabButton
                        label={t("Due")}
                        count={dueCount}
                        active={activeTab === "DUE"}
                        tone="warning"
                        onClick={() => setActiveTab("DUE")}
                    />
                    <PaymentTabButton
                        label={t("Paid")}
                        count={paidCount}
                        active={activeTab === "PAID"}
                        tone="success"
                        onClick={() => setActiveTab("PAID")}
                    />
                    <PaymentTabButton
                        label={t("Waived")}
                        count={waivedCount}
                        active={activeTab === "WAIVED"}
                        tone="neutral"
                        onClick={() => setActiveTab("WAIVED")}
                    />
                </div>

                <ViewToggle value={viewMode} onChange={setViewMode} className="hidden lg:inline-flex" />
                </>}
                footer={!loading && !error && data.length > 0 ? (
                    <div className="flex flex-col items-center gap-2 text-center" aria-live="polite">
                        <p id="payments-pagination-status" className="text-sm">{t("Showing {count} of {value} {toLowerCase} payments", { count: data.length, value: paymentTotals[activeTab], toLowerCase: activeTab.toLowerCase() })}</p>
                        {nextPaymentCursor && <AppButton variant="secondary" density="compact" isLoading={loadingMore}
                            aria-describedby="payments-pagination-status"
                            onClick={() => void loadPayments(nextPaymentCursor, true)}>
                            {t("Load more payments")}</AppButton>}
                    </div>
                ) : undefined}
            >
            {loading ? <RecordListState kind="loading" title="Loading payment history" />
            : error ? <RecordListState kind="error" title="Something went wrong" description={t.error(error)} onRetry={() => void loadPayments()} />
            : !filteredData.length ? <RecordListState kind="empty" title="No payments found for this view." />
            : (
                <DataTable
                    density="compact"
                    caption="Payments"
                    data={filteredData}
                    getRowAttributes={(item, view) => ({
                        id: `payment-${view}-${item.id}`,
                        tabIndex: -1,
                        "aria-label": item.id === targetPaymentId
                            ? `${item.student?.name || "Payment"}, selected search result`
                            : undefined,
                        "aria-current": item.id === targetPaymentId ? "true" : undefined,
                        className: item.id === targetPaymentId
                            ? "rounded-[var(--ui-radius-control)] bg-[color:var(--ui-tone-info-bg)] outline outline-2 outline-[color:var(--ui-focus-ring)]"
                            : undefined,
                    })}
                    viewMode={viewMode}
                    renderGridCard={(item, actions) => (
                        <article data-payment-record-card className={cn(pageGridCardClass, pageGridCardHoverClass, "ui-record-card")}>
                            <div className="ui-record-card-identity">
                                <Avatar name={item.student?.name || "Unknown"} size="sm" tone="quiet" />
                                <div className="min-w-0 flex-1">
                                    <p className="ui-record-card-name">{item.student?.name || "Unknown"}</p>
                                    <p className="ui-record-card-meta">
                                        <span className="break-all">{item.student?.phone || t("No phone")}</span>
                                        <span className="font-mono">#{item.id.slice(-6)}</span>
                                    </p>
                                </div>
                                <div className="shrink-0">{renderPaymentStatus(item)}</div>
                            </div>
                            <div className="ui-record-card-context">
                                <CalendarDays size={14} aria-hidden="true" />
                                <div className="flex flex-wrap items-center gap-1">{t("Due date")}: {renderDueDate(item)}</div>
                            </div>
                            <div className="ui-record-card-summary">
                                <p className="ui-record-card-due">{t(item.status === "DUE" ? "Remaining balance" : "Amount")}: {formatPaymentAmount(item.status === "DUE" ? remainingFee(item) : item.amount)}</p>
                                {item.ledgerBacked ? <p>{t("Fee ₹{amount} · Collected ₹{collectedAmount} · Waived ₹{waivedAmount} · Remaining ₹{remainingFee}", { amount: item.amount, collectedAmount: item.collectedAmount, waivedAmount: item.waivedAmount, remainingFee: remainingFee(item) })}</p>
                                    : item.status !== "DUE" ? <p>{t("Historical record · no generated receipt")}</p> : null}
                                <p className="ui-record-card-joined">{t("Method")}: {renderPaymentMethod(item)}</p>
                                <div className="ui-record-card-actions mt-3 flex flex-wrap items-center gap-2">{actions?.(item)}</div>
                            </div>
                        </article>
                    )}
                    columns={[
                        {
                            header: "Student",
                            rowHeader: true,
                            accessor: (item) => (
                                <div>
                                    <div className="font-medium text-[color:var(--text-primary)]">{item.student?.name || "Unknown"}</div>
                                    <div className={cn("break-all text-xs", pageMutedTextClass)}>{item.student?.phone}</div>
                                    <div className={cn("font-mono text-xs", pageSubtleTextClass)}>#{item.id.slice(-6)}</div>
                                </div>
                            )
                        },
                        {
                            header: "Due Date",
                            accessor: renderDueDate
                        },
                        {
                            header: "Amount",
                            accessor: renderFeeAmounts
                        },
                        {
                            header: "Status",
                            accessor: renderPaymentStatus
                        },
                        {
                            header: "Method",
                            accessor: renderPaymentMethod
                        },
                    ]}
                    actions={renderPaymentActions}
                />
            )}
            </RecordListSurface>

            {collectionRequested && !pickerClosed && recordDecision.allowed && <PaymentCollectionPicker branchId={branchId} onClose={() => setPickerClosed(true)} onSelect={(studentId, paymentId) => { setPickerClosed(true); setCollectStudentId(studentId); setPaymentToMark(paymentId); }} />}
            {paymentToMark && collectStudentId && <CollectFeeDialog
                key={paymentToMark} branchId={branchId} studentId={collectStudentId}
                paymentId={paymentToMark} onClose={() => setPaymentToMark(null)} onSaved={() => { void loadPayments(); }} />}
            <CollectionHistory branchId={branchId} owner={owner} />

            <ConfirmDialog
                isOpen={!!paymentToWaive}
                onClose={() => setPaymentToWaive(null)}
                onConfirm={confirmWaive}
                title={t("Waive Payment")}
                description={t("Forgive the remaining debt. Existing collections and receipts remain in history. A fully collected fee has no remaining debt to waive.")}
                confirmText="Yes, Waive"
                loading={waiving}
                variant="warning"
            />

            <PaymentAuditLog
                isOpen={!!auditLog}
                onClose={() => setAuditLog(null)}
                paymentId={auditLog?.paymentId ?? ""}
                studentName={auditLog?.studentName ?? ""}
            />
        </RecordListPage>
    );
}

function RowDropdown({ onWaive, disabled, reason }: { onWaive: () => void; disabled?: boolean; reason?: string }) {
    return (
        <RowActionsMenu
            buttonIcon={MoreHorizontal}
            buttonClassName="hover:bg-[color:var(--ui-form-surface-hover-bg)]"
            menuWidthClassName="w-40"
            actions={[
                {
                    label: "Waive Payment",
                    icon: Ban,
                    variant: "warning",
                    onClick: onWaive,
                    disabled,
                    description: reason,
                },
            ]}
        />
    );
}

// ─── Collect fee Dialog ─────────────────────────────────────────────────────────

function PaymentTabButton({
    label,
    count,
    active,
    tone,
    onClick,
}: {
    label: string;
    count: number;
    active: boolean;
    tone: "warning" | "success" | "neutral";
    onClick: () => void;
}) {
    const activeClass = {
        warning: "border-[color:var(--ui-badge-warning-border)] bg-[color:var(--ui-badge-warning-bg)] text-[color:var(--ui-badge-warning-text)]",
        success: "border-[color:var(--ui-badge-success-border)] bg-[color:var(--ui-badge-success-bg)] text-[color:var(--ui-badge-success-text)]",
        neutral: "border-[color:var(--ui-badge-purple-border)] bg-[color:var(--ui-badge-purple-bg)] text-[color:var(--ui-badge-purple-text)]",
    }[tone];

    const dotClass = {
        warning: "bg-[color:var(--ui-tone-warning-progress)]",
        success: "bg-[color:var(--ui-tone-success-progress)]",
        neutral: "bg-[color:var(--ui-badge-purple-text)]",
    }[tone];

    return (
        <button
            type="button"
            onClick={onClick}
            aria-current={active ? "page" : undefined}
            className={cn(
                "inline-flex min-h-11 cursor-pointer items-center gap-2 whitespace-nowrap rounded-[var(--ui-radius-control)] border px-3 py-2 text-sm font-medium transition-colors lg:min-h-10",
                active
                    ? activeClass
                    : "border-transparent text-[color:var(--text-secondary)] hover:border-[color:var(--ui-form-surface-border)] hover:bg-[color:var(--ui-form-surface-hover-bg)] hover:text-[color:var(--text-primary)]"
            )}
        >
            {active && <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", dotClass)} />}
            {label}
            {count > 0 && <span className={pageCountBadgeClass}>{count}</span>}
        </button>
    );
}
