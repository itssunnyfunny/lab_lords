"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, LockKeyhole } from "lucide-react";
import { AppPanel } from "@/components/ui";
import { useTranslation } from "@/components/settings/LocalizedText";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { getOverdueBulkReviewHref, getOverduePaymentHref, getOverdueStudentHref, updateQueueSelection } from "@/lib/overdueQueue";
import { followUpOutcomes, type FollowUpOutcome, type RenewalRow } from "@/lib/renewals";
import type { DashboardResourceStatus } from "@/lib/branchDashboard";
import type { CapabilityDecision } from "@/types";

interface OverduePayment {
    paymentId: string; studentId: string; studentName: string; phone: string | null; dueDate: string; amount: number;
}
interface OverdueTableProps {
    payments: OverduePayment[]; branchId: string; recordDecision: CapabilityDecision;
    canViewStudents?: boolean; followUps?: RenewalRow[]; followUpsStatus?: DashboardResourceStatus;
    onCollect?: (payment: OverduePayment) => void;
}
const actionLinkClass = "dashboard-record-action inline-flex items-center justify-center rounded-[var(--ui-radius-control)] border border-[color:var(--ui-button-secondary-border)] bg-[color:var(--ui-button-secondary-bg)] px-2 text-xs font-semibold text-[color:var(--ui-button-secondary-text)] transition-colors hover:bg-[color:var(--ui-button-secondary-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ui-focus-ring)]";
const compactOutcomes: Partial<Record<FollowUpOutcome, string>> = {
    ATTEMPTED: "Attempted",
    PROMISED_PAYMENT: "Promised",
};

function DashboardPaymentAction({ href, decision, onCollect }: { href: string; decision: CapabilityDecision; onCollect?: () => void }) {
    const t = useTranslation();
    if (decision.allowed) return onCollect
        ? <button type="button" onClick={onCollect} className={actionLinkClass}>{t("Record payment")}</button>
        : <Link href={href} className={actionLinkClass}>{t("Record payment")}</Link>;
    if (decision.blocker === "permission") return <Link href={href} className={actionLinkClass}>{t("View payment")}</Link>;
    return <div className="dashboard-record-action-group">
        <Link href={href} className={actionLinkClass}>{t("View payment")}</Link>
        <button type="button" disabled aria-describedby="dashboard-overdue-record-blocker" className={actionLinkClass}>
            <LockKeyhole size={13} aria-hidden="true" /> {t("Record payment")}
        </button>
    </div>;
}

export function OverdueTable({ payments, branchId, recordDecision, canViewStudents = true, followUps, followUpsStatus, onCollect }: OverdueTableProps) {
    const t = useTranslation();
    const shown = payments.slice(0, 4);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
    const selectAllRef = useRef<HTMLInputElement>(null);
    const { formatDate, formatNumber } = useUserPreferences();
    const selectedPayments = shown.filter(payment => selectedIds.has(payment.paymentId));
    const shownIds = shown.map(payment => payment.paymentId);
    const selectedShownCount = selectedPayments.length;
    const allShownSelected = shown.length > 0 && selectedShownCount === shown.length;
    const someShownSelected = selectedShownCount > 0 && !allShownSelected;
    const base = `/branch/${encodeURIComponent(branchId)}`;
    useEffect(() => { if (selectAllRef.current) selectAllRef.current.indeterminate = someShownSelected; }, [someShownSelected]);
    const contact = (paymentId: string) => {
        const row = followUps?.find(item => item.paymentId === paymentId);
        if (followUpsStatus === "error") return { full: t("Contact details unavailable"), compact: t("Unavailable") };
        if (!row) return { full: t("Contact details in fee queue"), compact: t("Fee queue") };
        const outcome = t.owned(followUpOutcomes[row.followUp?.outcome ?? "NOT_CONTACTED"]);
        const shorter = compactOutcomes[row.followUp?.outcome ?? "NOT_CONTACTED"];
        const compactOutcome = shorter ? t.owned(shorter) : outcome;
        const nextDate = row.followUp?.nextFollowUpAt;
        const date = nextDate ? formatDate(nextDate, { day: "numeric", month: "short" }) : null;
        return {
            full: date ? t("{outcome} · next contact {date}", { outcome, date }) : outcome,
            compact: date ? `${compactOutcome} · ${date}` : compactOutcome,
        };
    };
    return <AppPanel title={t("Follow-ups")} description={t("Overdue fees · oldest first")} className="dashboard-overdue-queue" contentClassName="p-0"
        action={<Link href={`${base}/renewals`} className="dashboard-text-link">{t("View all")} <ArrowRight size={13} /></Link>}>
        {!recordDecision.allowed && recordDecision.blocker !== "permission" && <div id="dashboard-overdue-record-blocker" className="border-b bg-[color:var(--ui-tone-warning-bg)] px-4 py-3 text-sm">
            <p>{t("Recording payments is unavailable.")} {t.owned(recordDecision.reason ?? "")}</p>
            {recordDecision.recoveryHref && <Link href={recordDecision.recoveryHref} className="font-semibold underline">{t("Resolve access")}</Link>}
        </div>}
        {payments.length === 0 ? <div className="flex items-start gap-3 px-4 py-6">
            <CheckCircle2 size={20} className="shrink-0 text-[color:var(--ui-tone-success-text)]" />
            <p className="text-sm">{t("No overdue payments returned")}</p>
        </div> : <>
            <div className="dashboard-queue-toolbar">
                <label><input ref={selectAllRef} type="checkbox" checked={allShownSelected}
                    onChange={event => setSelectedIds(current => updateQueueSelection(current, shownIds, event.target.checked))}
                    className="h-4 w-4 accent-[color:var(--ui-form-checkbox-accent)]" />
                    {t("Select all")} {formatNumber(shown.length)}
                </label>
                <span aria-live="polite">{t("{formatNumber} selected", { formatNumber: formatNumber(selectedShownCount) })}</span>
                {selectedPayments.length > 0 && <Link href={getOverdueBulkReviewHref(branchId, selectedPayments)} className="dashboard-text-link">
                    {selectedPayments.length === 1 ? t("Review selected payment") : t("Open matching due queue")}
                </Link>}
                <Link href={`${base}/overdue`} className="dashboard-text-link dashboard-full-queue-link">
                    {t("Full overdue queue")} <ArrowRight size={12} aria-hidden="true" />
                </Link>
            </div>
            <table className="dashboard-record-table dashboard-followup-table">
                <caption className="sr-only">{t("Overdue fees · oldest first")}</caption>
                <thead><tr>
                    <th scope="col"><span className="sr-only">{t("Select")}</span></th>
                    <th scope="col">{t("Student")}</th>
                    <th scope="col">{t("Due date")}</th>
                    <th scope="col">{t("Remaining balance")}</th>
                    <th scope="col">{t("Contact")}</th>
                    <th scope="col">{t("Action")}</th>
                </tr></thead>
                <tbody>{shown.map(payment => {
                    const contactInfo = contact(payment.paymentId);
                    return <tr className="dashboard-followup-row" key={payment.paymentId}>
                    <td className="dashboard-followup-select">
                        <input className="dashboard-followup-checkbox" type="checkbox" checked={selectedIds.has(payment.paymentId)}
                            onChange={event => setSelectedIds(current => updateQueueSelection(current, [payment.paymentId], event.target.checked))}
                            aria-label={t("Select {name}'s overdue payment", { name: payment.studentName })} />
                    </td>
                    <th scope="row" className="dashboard-followup-student">
                        <span className="dashboard-record-mobile-label">{t("Student")}</span>
                        {canViewStudents ? <Link href={getOverdueStudentHref(branchId, payment.studentId)}>{payment.studentName}</Link> : <span>{payment.studentName}</span>}
                    </th>
                    <td className="dashboard-followup-due">
                        <span className="dashboard-record-mobile-label">{t("Due date")}</span>
                        <time dateTime={payment.dueDate}>{formatDate(payment.dueDate, { day: "numeric", month: "short" })}</time>
                    </td>
                    <td className="dashboard-followup-amount tabular-nums">
                        <span className="dashboard-record-mobile-label">{t("Remaining balance")}</span>
                        {formatNumber(payment.amount, { style: "currency", currency: "INR", maximumFractionDigits: 0 })}
                    </td>
                    <td className="dashboard-followup-contact" title={contactInfo.full} aria-label={contactInfo.full}>
                        <span className="dashboard-record-mobile-label">{t("Contact")}</span>
                        {contactInfo.full !== contactInfo.compact
                            ? <details className="dashboard-contact-disclosure">
                                <summary className="dashboard-contact-compact" aria-label={contactInfo.full}>{contactInfo.compact}</summary>
                                <span className="dashboard-contact-reveal">{contactInfo.full}</span>
                            </details>
                            : <span className="dashboard-contact-compact">{contactInfo.compact}</span>}
                        <span className="dashboard-contact-full">{contactInfo.full}</span>
                    </td>
                    <td className="dashboard-followup-action">
                        <DashboardPaymentAction href={getOverduePaymentHref(branchId, payment)} decision={recordDecision} onCollect={onCollect ? () => onCollect(payment) : undefined} />
                    </td>
                </tr>; })}</tbody>
            </table>
        </>}
    </AppPanel>;
}
