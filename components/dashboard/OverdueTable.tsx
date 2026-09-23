"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, LockKeyhole } from "lucide-react";
import { AppPanel } from "@/components/ui";
import { useTranslation } from "@/components/settings/LocalizedText";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { getOverdueBulkReviewHref, getOverduePaymentHref, getOverdueStudentHref, updateQueueSelection } from "@/lib/overdueQueue";
import { followUpOutcomes, type RenewalRow } from "@/lib/renewals";
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
const actionLinkClass = "inline-flex min-h-11 items-center justify-center rounded-[var(--ui-radius-control)] border border-[color:var(--ui-button-secondary-border)] bg-[color:var(--ui-button-secondary-bg)] px-3 text-xs font-semibold text-[color:var(--ui-button-secondary-text)] transition-colors hover:bg-[color:var(--ui-button-secondary-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ui-focus-ring)]";

function DashboardPaymentAction({ href, decision, onCollect }: { href: string; decision: CapabilityDecision; onCollect?: () => void }) {
    const t = useTranslation();
    if (decision.allowed) return onCollect
        ? <button type="button" onClick={onCollect} className={actionLinkClass}>{t("Record payment")}</button>
        : <Link href={href} className={actionLinkClass}>{t("Record payment")}</Link>;
    if (decision.blocker === "permission") return <Link href={href} className={actionLinkClass}>{t("View payment")}</Link>;
    return <div className="flex flex-wrap justify-end gap-2">
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
        if (followUpsStatus === "error") return t("Contact details unavailable");
        if (!row) return t("Contact details in fee queue");
        const outcome = t.owned(followUpOutcomes[row.followUp?.outcome ?? "NOT_CONTACTED"]);
        return row.followUp?.nextFollowUpAt
            ? t("{outcome} · next contact {date}", { outcome, date: formatDate(row.followUp.nextFollowUpAt, { day: "numeric", month: "short" }) }) : outcome;
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
            </div>
            <ul className="dashboard-followup-list">{shown.map(payment => <li key={payment.paymentId}>
                <input type="checkbox" checked={selectedIds.has(payment.paymentId)}
                    onChange={event => setSelectedIds(current => updateQueueSelection(current, [payment.paymentId], event.target.checked))}
                    aria-label={t("Select {name}'s overdue payment", { name: payment.studentName })} />
                <div className="dashboard-followup-person">
                    {canViewStudents ? <Link href={getOverdueStudentHref(branchId, payment.studentId)}>{payment.studentName}</Link> : <span className="font-semibold">{payment.studentName}</span>}
                    <p className="dashboard-footnote">{t("Due {date}", { date: formatDate(payment.dueDate, { day: "numeric", month: "short" }) })}</p>
                    <p className="dashboard-footnote">{contact(payment.paymentId)}</p>
                </div>
                <div className="dashboard-followup-action">
                    <span className="font-semibold">{formatNumber(payment.amount, { style: "currency", currency: "INR", maximumFractionDigits: 0 })}</span>
                    <DashboardPaymentAction href={getOverduePaymentHref(branchId, payment)} decision={recordDecision} onCollect={onCollect ? () => onCollect(payment) : undefined} />
                </div>
            </li>)}</ul>
            <Link href={`${base}/overdue`} className="dashboard-text-link px-4 py-2">{t("Full overdue queue")} <ArrowRight size={13} /></Link>
        </>}
    </AppPanel>;
}
