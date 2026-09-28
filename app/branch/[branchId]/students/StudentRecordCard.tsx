"use client";
import type { ReactNode } from "react";
import { Armchair } from "lucide-react";
import type { StudentListItem } from "@/lib/api/students";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { pageGridCardClass, pageGridCardHoverClass } from "@/components/ui/pageSurface";
import { useTranslation } from "@/components/settings/LocalizedText";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { cn } from "@/lib/utils";

export type StudentCardFinancials = { totalDue: number; totalPaid: number; totalWaived: number };
export type StudentRecordCardProps = {
    student: Pick<StudentListItem, "name" | "phone" | "status" | "monthlyFee" | "joinedAt" | "seatAllocations">;
    financials?: StudentCardFinancials;
    canViewPayments: boolean;
    actions?: ReactNode;
    onDetails: () => void;
    detailsLabel: string;
    detailsDisabled?: boolean;
    detailsReason?: string;
};

/** Feature-owned values and allocation pairs; no reads, commands or fee arithmetic. */
export function StudentRecordCard({ student, financials, canViewPayments, actions, onDetails, detailsLabel, detailsDisabled, detailsReason }: StudentRecordCardProps) {
    const t = useTranslation();
    const { formatNumber, formatDate } = useUserPreferences();
    const currency = (value: number) => formatNumber(value, { style: "currency", currency: "INR", maximumFractionDigits: 0 });
    const allocations = student.seatAllocations ?? [];
    return <article data-student-record-card className={cn(pageGridCardClass, pageGridCardHoverClass, "ui-record-card")}>
        <div className="ui-record-card-identity">
            <Avatar name={student.name} size="sm" tone="quiet" />
            <div className="min-w-0 flex-1">
                <p className="ui-record-card-name"><button type="button" className="ui-record-card-details" onClick={onDetails} disabled={detailsDisabled} title={detailsReason} aria-label={`${t.owned(detailsLabel)} · ${student.name}`}>{student.name}</button></p>
                <div className="ui-record-card-meta"><p>{student.phone || t("No phone")}</p><Badge variant={student.status === "ACTIVE" ? "success" : "default"}>{t(student.status === "ACTIVE" ? "Active" : "Inactive")}</Badge></div>
            </div>
            {actions && <div className="ui-record-card-actions">{actions}</div>}
        </div>
        <div className="ui-record-card-context" aria-label={t("Seat & shift")}>
            <Armchair size={14} aria-hidden="true" />
            {allocations.length ? <ul>{allocations.map(allocation => <li key={allocation.id}><span>{allocation.seat.label}</span><span aria-hidden="true"> · </span><span>{allocation.multiShift ? `${allocation.multiShift.name} (${allocation.shift.name})` : allocation.shift.name}</span></li>)}</ul> : <p>{t("No seat assigned")}</p>}
        </div>
        <div className="ui-record-card-summary">
            {!canViewPayments ? <p>{t("No payment access")}</p> : !financials ? <p>{t("Fee summary")}: {t("Not recorded")}</p> : <>
                <p className={cn("ui-record-card-due", financials.totalDue > 0 && "text-[color:var(--ui-tone-danger-text)]")}>{t("Due: {formatCurrency}", { formatCurrency: currency(financials.totalDue) })}</p>
                <div className="ui-record-card-meta"><span>{t("Monthly fee")}: {typeof student.monthlyFee === "number" ? currency(student.monthlyFee) : t("Not set")}</span><span>{t("Paid: {formatCurrency}", { formatCurrency: currency(financials.totalPaid) })}</span>{financials.totalWaived > 0 && <span>{t("Waived: {formatCurrency}", { formatCurrency: currency(financials.totalWaived) })}</span>}</div>
            </>}
            <p className="ui-record-card-joined">{t("Joined")}: {formatDate(student.joinedAt)}</p>
        </div>
    </article>;
}
