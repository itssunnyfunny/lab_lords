
import { useTranslation } from "@/components/settings/LocalizedText";import { useEffect, useRef, useState } from "react";
import { RotateCcw, UploadCloud } from "lucide-react";
import { AppButton, AppPanel, AppSelect } from "@/components/ui";
import { Badge } from "@/components/ui/Badge";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { cn } from "@/lib/utils";
import { importSessions, type ImportPlanPaymentDetailsResponse } from "@/lib/api/importSessions";
import type { ImportOptions } from "@/importing/contracts/import-session.contract";
import type { ImportReadinessPolicy } from "@/importing/contracts/import-v2.contract";
import { isImportPlanFresh, isPaymentSkipped } from "@/importing/utils/import-wizard-view-model";
import { pageInsetSurfaceClass, pageMutedTextClass, pageTableBodyDividerClass, pageTableHeadClass, pageTableRowClass } from "@/components/ui/pageSurface";
import { AccessibleTableScroll, PlanCheckBadge, StepNotice } from "./shared";
import type { Plan } from "./types";

const PAYMENT_BREAKDOWN_PAGE_SIZE = 20;

type PreviewStepProps = {
    branchId: string;
    sessionId: string;
    plan: Plan | null;
    importOptions: ImportOptions;
    readinessPolicy: ImportReadinessPolicy;
    currentRevision: number;
    saving: boolean;
    mutationsDisabled: boolean;
    onPolicyChange: (policy: ImportReadinessPolicy) => void;
    onRefreshPlan: () => void;
    onConfirmImport: () => void;
};

function checkLabel(code: string) {
    return code.toLowerCase().replace(/_/g, " ").replace(/^\w/, letter => letter.toUpperCase());
}

function mutationSummary(plan: Plan | null) {
    return plan?.summary?.mutations ?? plan?.mutationSummary;
}

export function PreviewStep({
    branchId,
    sessionId,
    plan,
    importOptions,
    readinessPolicy,
    currentRevision,
    saving,
    mutationsDisabled,
    onPolicyChange,
    onRefreshPlan,
    onConfirmImport,
}: PreviewStepProps) {
    const t = useTranslation();
    const { formatDate, formatDateTime, formatNumber } = useUserPreferences();
    const [paymentPageIndex, setPaymentPageIndex] = useState(0);
    const [paymentCyclePages, setPaymentCyclePages] = useState<ImportPlanPaymentDetailsResponse[]>([]);
    const [paymentCyclePageIndex, setPaymentCyclePageIndex] = useState(0);
    const [paymentCycleLoading, setPaymentCycleLoading] = useState(false);
    const [paymentCycleError, setPaymentCycleError] = useState<string | null>(null);
    const [paymentCycleRetry, setPaymentCycleRetry] = useState<{ cursor: string | null; pageIndex: number } | null>(null);
    const paymentPlanIdRef = useRef(plan?.id);
    paymentPlanIdRef.current = plan?.id;
    const planFresh = isImportPlanFresh(plan, readinessPolicy, currentRevision);
    const mutations = mutationSummary(plan);
    const rowsNotImported = (plan?.blockedRows ?? 0) + (plan?.skippedRows ?? 0);
    const permissions = plan?.summary?.requiredPermissions ?? plan?.requiredPermissions ?? [];
    const configurationApproval = plan?.configurationApproval;
    const paymentsSkipped = isPaymentSkipped(importOptions);
    const paymentBreakdown = mutations?.paymentBreakdown ?? [];
    const paymentPageCount = Math.max(1, Math.ceil(paymentBreakdown.length / PAYMENT_BREAKDOWN_PAGE_SIZE));
    const paymentPage = Math.min(paymentPageIndex, paymentPageCount - 1);
    const visiblePayments = paymentBreakdown.slice(
        paymentPage * PAYMENT_BREAKDOWN_PAGE_SIZE,
        (paymentPage + 1) * PAYMENT_BREAKDOWN_PAGE_SIZE
    );
    const readyLabel = readinessPolicy === "READY_ROWS_ONLY" ? "Import ready rows" : "Require every row ready";
    const paymentCyclePage = paymentCyclePages[paymentCyclePageIndex] ?? null;
    const exactPaymentPageCount = Math.max(1, Math.ceil(
        (plan?.paymentDetails?.totalCycles ?? 0) / (paymentCyclePage?.page.limit ?? 50)
    ));
    const hasNextPaymentCyclePage = paymentCyclePageIndex < paymentCyclePages.length - 1
        || Boolean(paymentCyclePage?.page.hasMore);
    const planNotice = !plan
        ? {
            tone: "cyan" as const,
            title: "Build a reviewed plan",
            message: "The plan checks the current saved revision and shows which kinds of records will be created. It does not create branch records.",
        }
        : !planFresh
            ? {
                tone: "warning" as const,
                title: "Plan needs refresh",
                message: "A saved decision, row, or readiness policy changed. Refresh so you do not import an older revision.",
            }
            : plan.canRun
                ? {
                    tone: "success" as const,
                    title: "Reviewed plan is ready",
                    message: "Confirming starts a background import. You can leave this page and resume progress from this session.",
                }
                : {
                    tone: "danger" as const,
                    title: "Plan is blocked",
                    message: "Follow the blocked checks below. If only some rows are unresolved, choose Import ready rows to keep them staged.",
                };

    useEffect(() => {
        setPaymentPageIndex(0);
        setPaymentCyclePages([]);
        setPaymentCyclePageIndex(0);
        setPaymentCycleLoading(false);
        setPaymentCycleError(null);
        setPaymentCycleRetry(null);
    }, [plan?.id]);

    const loadPaymentCyclePage = async (cursor: string | null, pageIndex: number) => {
        const requestedPaymentDetails = plan?.paymentDetails;
        if (!plan || !requestedPaymentDetails || paymentCycleLoading) return;
        const requestedPlan = plan;
        setPaymentCycleLoading(true);
        setPaymentCycleError(null);
        setPaymentCycleRetry(null);
        try {
            const response = await importSessions.getPlanPayments(branchId, sessionId, requestedPlan.id, {
                limit: Math.min(50, requestedPaymentDetails.maxPageSize),
                cursor,
            });
            if (paymentPlanIdRef.current !== requestedPlan.id) return;
            if (
                response.planId !== requestedPlan.id
                || response.revision !== requestedPlan.revision
                || response.planVersion !== requestedPlan.planVersion
            ) {
                throw new Error("Payment details no longer match this reviewed plan. Refresh the plan before importing.");
            }
            setPaymentCyclePages(current => {
                const next = [...current];
                next[pageIndex] = response;
                return next;
            });
            setPaymentCyclePageIndex(pageIndex);
        } catch (paymentError) {
            if (paymentPlanIdRef.current === requestedPlan.id) {
                setPaymentCycleError(paymentError instanceof Error ? paymentError.message : "Failed to load exact payment records.");
                setPaymentCycleRetry({ cursor, pageIndex });
            }
        } finally {
            if (paymentPlanIdRef.current === requestedPlan.id) setPaymentCycleLoading(false);
        }
    };

    return (
        <div className="space-y-5">
            <AppPanel
                title={t("Review & import")}
                description={plan?.planVersion ? `Reviewed plan ${plan.planVersion}` : t("Build a plan from your saved changes.")}
                action={
                    <div className="flex flex-wrap gap-2">
                        <label htmlFor="import-readiness-policy" className="sr-only">{t("Rows required before import")}</label>
                        <AppSelect
                            id="import-readiness-policy"
                            value={readinessPolicy}
                            onValueChange={value => onPolicyChange(value as ImportReadinessPolicy)}
                            options={[
                                { value: "READY_ROWS_ONLY", label: t("Import ready rows (recommended)") },
                                { value: "REQUIRE_ALL_ROWS_READY", label: t("Require every row ready") },
                            ]}
                        />
                        <AppButton variant="secondary" icon={RotateCcw} onClick={onRefreshPlan} isLoading={saving}>
                            {t("Refresh plan")}</AppButton>
                    </div>
                }
            >
                <div className="space-y-5">
                    <StepNotice tone={planNotice.tone} title={planNotice.title} message={planNotice.message} />

                    <div className={cn("p-4 text-xs leading-5", pageInsetSurfaceClass, pageMutedTextClass)}>
                        {readinessPolicy === "READY_ROWS_ONLY"
                            ? t("Ready and warning rows can run; blocked and skipped rows stay in this import workspace for later correction.")
                            : t("The import cannot start until every non-skipped row passes. Runtime work is processed in durable batches, so completed records remain if a later item fails.")}
                    </div>

                    {plan && (
                        <>
                            <div className="flex flex-wrap items-center gap-2" aria-live="polite">
                                <Badge variant={plan.canRun ? "success" : "danger"}>{plan.canRun ? t("Ready to start") : t("Blocked")}</Badge>
                                <Badge variant={planFresh ? "success" : "warning"}>{planFresh ? t("Current revision") : t("Refresh needed")}</Badge>
                                <Badge variant="cyan">{readyLabel}</Badge>
                                {plan.createdAt && <span className={cn("text-xs", pageMutedTextClass)}>{formatDateTime(plan.createdAt)}</span>}
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                                {[
                                    ["Ready rows", plan.readyRows],
                                    ["Warnings", plan.warningRows],
                                    ["Blocked", plan.blockedRows],
                                    ["Skipped", plan.skippedRows],
                                    ["Total rows", plan.totalRows],
                                ].map(([label, value]) => (
                                    <div key={String(label)} className={cn("p-3", pageInsetSurfaceClass)}>
                                        <p className={cn("text-xs", pageMutedTextClass)}>{label}</p>
                                        <p className="mt-1 text-lg font-semibold text-[color:var(--text-primary)]">{formatNumber(Number(value))}</p>
                                    </div>
                                ))}
                            </div>

                            {mutations && (
                                <>
                                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={t("Records this plan will create")}>
                                        {[
                                            ["Students", mutations.students],
                                            ["Seat links", mutations.allocations],
                                            ["Payment cycles", paymentsSkipped ? 0 : mutations.paymentCycles],
                                            ["Setup records", mutations.configuration],
                                        ].map(([label, value]) => (
                                            <div key={String(label)} className={cn("p-3", pageInsetSurfaceClass)}>
                                                <p className={cn("text-xs", pageMutedTextClass)}>{label}</p>
                                                <p className="mt-1 text-lg font-semibold text-[color:var(--text-primary)]">{formatNumber(Number(value))}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {!paymentsSkipped && mutations.paymentCycles > 0 && (
                                        <div className="space-y-3" aria-label={t("Payment totals by cycle and status")}>
                                            <div>
                                                <p className="text-sm font-semibold text-[color:var(--text-primary)]">{t("Exact payment totals")}</p>
                                                <p className={cn("mt-1 text-xs leading-5", pageMutedTextClass)}>
                                                    {t("Historical and current joined-date cycles are counted separately by final payment status.")}</p>
                                            </div>
                                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                                {[
                                                    ["Historical due", mutations.payments.historical.DUE],
                                                    ["Historical paid", mutations.payments.historical.PAID],
                                                    ["Historical waived", mutations.payments.historical.WAIVED],
                                                    ["Current due", mutations.payments.current.DUE],
                                                    ["Current paid", mutations.payments.current.PAID],
                                                    ["Current waived", mutations.payments.current.WAIVED],
                                                ].map(([label, value]) => (
                                                    <div key={String(label)} className={cn("p-3", pageInsetSurfaceClass)}>
                                                        <p className={cn("text-xs", pageMutedTextClass)}>{label}</p>
                                                        <p className="mt-1 text-lg font-semibold text-[color:var(--text-primary)]">{formatNumber(Number(value))}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {paymentBreakdown.length > 0 && (
                                <details
                                    className={cn("rounded-[8px] border border-[color:var(--ui-form-surface-border)]", pageInsetSurfaceClass)}
                                    onToggle={event => {
                                        if (event.currentTarget.open && paymentCyclePages.length === 0 && plan?.paymentDetails?.totalCycles) {
                                            void loadPaymentCyclePage(null, 0);
                                        }
                                    }}
                                >
                                    <summary className="cursor-pointer list-none text-sm font-semibold text-[color:var(--text-primary)]">{t("Payment history by student ({formatNumber})", { formatNumber: formatNumber(paymentBreakdown.length) })}</summary>
                                    <p className={cn("mt-2 text-xs leading-5", pageMutedTextClass)}>
                                        {t("Aggregate counts per student. Historical cycles run from the joined date; current means the student's current joined-date cycle.")}</p>
                                    <AccessibleTableScroll label={t("Planned payment history by student")} className="mt-3 rounded-[8px] border border-[color:var(--ui-table-border)]">
                                        <table className="w-full min-w-[940px] text-left text-xs">
                                            <caption className="sr-only">{t("Remaining historical and current payment records planned for each student")}</caption>
                                            <thead className={pageTableHeadClass}>
                                                <tr className="uppercase tracking-wide text-[color:var(--text-muted)]">
                                                    <th scope="col" className="p-3">{t("Row")}</th>
                                                    <th scope="col" className="p-3">{t("Student")}</th>
                                                    <th scope="col" className="p-3">{t("Historical due")}</th>
                                                    <th scope="col" className="p-3">{t("Historical paid")}</th>
                                                    <th scope="col" className="p-3">{t("Historical waived")}</th>
                                                    <th scope="col" className="p-3">{t("Current due")}</th>
                                                    <th scope="col" className="p-3">{t("Current paid")}</th>
                                                    <th scope="col" className="p-3">{t("Current waived")}</th>
                                                    <th scope="col" className="p-3">{t("Total")}</th>
                                                </tr>
                                            </thead>
                                            <tbody className={pageTableBodyDividerClass}>
                                                {visiblePayments.map(item => (
                                                    <tr key={item.rowId} className={pageTableRowClass}>
                                                        <th scope="row" className="p-3">{formatNumber(item.rowNumber)}</th>
                                                        <td className="p-3 font-medium text-[color:var(--text-primary)]">{item.studentName || "Unnamed student"}</td>
                                                        <td className="p-3">{formatNumber(item.historical.DUE)}</td>
                                                        <td className="p-3">{formatNumber(item.historical.PAID)}</td>
                                                        <td className="p-3">{formatNumber(item.historical.WAIVED)}</td>
                                                        <td className="p-3">{formatNumber(item.current.DUE)}</td>
                                                        <td className="p-3">{formatNumber(item.current.PAID)}</td>
                                                        <td className="p-3">{formatNumber(item.current.WAIVED)}</td>
                                                        <td className="p-3 font-semibold text-[color:var(--text-primary)]">{formatNumber(item.total)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </AccessibleTableScroll>
                                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                                        <span className={cn("text-xs", pageMutedTextClass)} role="status" aria-live="polite">{t("Page {formatNumber} of {formatNumber2}", { formatNumber: formatNumber(paymentPage + 1), formatNumber2: formatNumber(paymentPageCount) })}</span>
                                        <div className="flex gap-2">
                                            <AppButton size="sm" variant="quiet" disabled={paymentPage === 0} onClick={() => setPaymentPageIndex(current => Math.max(0, current - 1))}>{t("Previous")}</AppButton>
                                            <AppButton size="sm" variant="quiet" disabled={paymentPage >= paymentPageCount - 1} onClick={() => setPaymentPageIndex(current => Math.min(paymentPageCount - 1, current + 1))}>{t("Next")}</AppButton>
                                        </div>
                                    </div>

                                    <div className="mt-5 border-t border-[color:var(--ui-form-surface-border)] pt-4">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div>
                                                <p className="text-sm font-semibold text-[color:var(--text-primary)]">{t("Exact payment cycle records")}</p>
                                                <p className={cn("mt-1 text-xs leading-5", pageMutedTextClass)}>{t("{formatNumber} immutable cycle records across {formatNumber2} students.", { formatNumber: formatNumber(plan.paymentDetails?.totalCycles ?? mutations?.paymentCycles ?? 0), formatNumber2: formatNumber(plan.paymentDetails?.affectedStudents ?? paymentBreakdown.length) })}</p>
                                            </div>
                                            {paymentCycleLoading && <span className={cn("text-xs", pageMutedTextClass)} role="status">{t("Loading exact payment records…")}</span>}
                                        </div>

                                        {paymentCycleError && (
                                            <div className="mt-3" role="alert">
                                                <StepNotice tone="danger" title={t("Exact payment records unavailable")} message={paymentCycleError} />
                                                <AppButton className="mt-2" size="sm" variant="secondary" disabled={!paymentCycleRetry} onClick={() => paymentCycleRetry && void loadPaymentCyclePage(paymentCycleRetry.cursor, paymentCycleRetry.pageIndex)}>
                                                    {t("Try again")}</AppButton>
                                            </div>
                                        )}

                                        {paymentCyclePage && (
                                            <>
                                                <AccessibleTableScroll label={t("Exact planned payment cycle records")} className="mt-3 rounded-[8px] border border-[color:var(--ui-table-border)]">
                                                    <table className="w-full min-w-[1080px] text-left text-xs">
                                                        <caption className="sr-only">{t("Exact immutable payment cycle records in this reviewed import plan")}</caption>
                                                        <thead className={pageTableHeadClass}>
                                                            <tr className="uppercase tracking-wide text-[color:var(--text-muted)]">
                                                                <th scope="col" className="p-3">{t("Row")}</th>
                                                                <th scope="col" className="p-3">{t("Student")}</th>
                                                                <th scope="col" className="p-3">{t("Cycle")}</th>
                                                                <th scope="col" className="p-3">{t("Period")}</th>
                                                                <th scope="col" className="p-3">{t("Due date")}</th>
                                                                <th scope="col" className="p-3">{t("Amount")}</th>
                                                                <th scope="col" className="p-3">{t("Status")}</th>
                                                                <th scope="col" className="p-3">{t("Method / reference")}</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className={pageTableBodyDividerClass}>
                                                            {paymentCyclePage.cycles.map(cycle => (
                                                                <tr key={cycle.itemKey} className={pageTableRowClass}>
                                                                    <th scope="row" className="p-3">{formatNumber(cycle.rowNumber)}</th>
                                                                    <td className="p-3 font-medium text-[color:var(--text-primary)]">{cycle.studentName || "Unnamed student"}</td>
                                                                    <td className="p-3 capitalize">{cycle.bucket}</td>
                                                                    <td className="p-3">{formatDate(cycle.periodStart)} – {formatDate(cycle.periodEnd)}</td>
                                                                    <td className="p-3">{formatDate(cycle.dueDate)}</td>
                                                                    <td className="p-3 font-medium text-[color:var(--text-primary)]">{formatNumber(cycle.amount, { style: "currency", currency: "INR", maximumFractionDigits: 0 })}</td>
                                                                    <td className="p-3"><Badge variant={cycle.status === "PAID" ? "success" : cycle.status === "WAIVED" ? "default" : "warning"}>{cycle.status}</Badge></td>
                                                                    <td className="p-3">
                                                                        <span>{cycle.method?.replace(/_/g, " ") ?? "—"}</span>
                                                                        {cycle.referenceId && <span className={cn("mt-1 block", pageMutedTextClass)}>{cycle.referenceId}</span>}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </AccessibleTableScroll>
                                                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                                                    <span className={cn("text-xs", pageMutedTextClass)} role="status" aria-live="polite">{t("Exact records page {formatNumber} of {formatNumber2}", { formatNumber: formatNumber(paymentCyclePageIndex + 1), formatNumber2: formatNumber(exactPaymentPageCount) })}</span>
                                                    <div className="flex gap-2">
                                                        <AppButton size="sm" variant="quiet" disabled={paymentCyclePageIndex === 0 || paymentCycleLoading} onClick={() => setPaymentCyclePageIndex(current => Math.max(0, current - 1))}>{t("Previous exact records")}</AppButton>
                                                        <AppButton
                                                            size="sm"
                                                            variant="quiet"
                                                            disabled={!hasNextPaymentCyclePage || paymentCycleLoading}
                                                            onClick={() => {
                                                                const nextIndex = paymentCyclePageIndex + 1;
                                                                if (paymentCyclePages[nextIndex]) setPaymentCyclePageIndex(nextIndex);
                                                                else void loadPaymentCyclePage(paymentCyclePage.page.nextCursor, nextIndex);
                                                            }}
                                                        >
                                                            {t("Next exact records")}</AppButton>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </details>
                            )}

                            {configurationApproval?.required && (
                                <StepNotice
                                    tone={configurationApproval.approved ? "success" : "danger"}
                                    title={configurationApproval.approved ? t("Setup creation approved") : t("Setup creation needs approval")}
                                    message={`${formatNumber(configurationApproval.affectedRows)} affected row${configurationApproval.affectedRows === 1 ? "" : "s"} may create missing seats, shifts, or bundles. Review and approve this batch in Decisions.`}
                                />
                            )}

                            <div className="space-y-2">
                                {plan.checks.map(check => (
                                    <div key={check.code} className={cn("p-3", pageInsetSurfaceClass)}>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <PlanCheckBadge status={check.status} />
                                            <p className="text-sm font-semibold text-[color:var(--text-primary)]">{checkLabel(check.code)}</p>
                                            {typeof check.count === "number" && <Badge variant="default">{formatNumber(check.count)}</Badge>}
                                        </div>
                                        <p className={cn("mt-1 text-xs leading-5", pageMutedTextClass)}>{check.message}</p>
                                    </div>
                                ))}
                            </div>

                            {permissions.length > 0 && (
                                <div className={cn("p-3", pageInsetSurfaceClass)}>
                                    <p className="text-sm font-semibold text-[color:var(--text-primary)]">{t("Required access")}</p>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {permissions.map(permission => <Badge key={permission} variant="default">{checkLabel(permission)}</Badge>)}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    <AppButton
                        variant="primary"
                        icon={UploadCloud}
                        onClick={plan ? onConfirmImport : onRefreshPlan}
                        disabled={plan ? mutationsDisabled || !plan.canRun || !planFresh : mutationsDisabled}
                        aria-describedby={plan && mutationsDisabled ? "import-session-mutation-blocker" : undefined}
                        isLoading={saving}
                    >
                        {!plan ? t("Build reviewed plan") : readinessPolicy === "READY_ROWS_ONLY"
                            ? `Import ${formatNumber(plan.readyRows)} ready row${plan.readyRows === 1 ? "" : "s"}${rowsNotImported ? `; keep ${formatNumber(rowsNotImported)} staged` : ""}`
                            : t("Start checked import")}
                    </AppButton>
                </div>
            </AppPanel>

        </div>
    );
}
