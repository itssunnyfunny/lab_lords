"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, CalendarCheck, Grid2X2, RefreshCw } from "lucide-react";
import { AppButton, AppPanel } from "@/components/ui";
import { useTranslation } from "@/components/settings/LocalizedText";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { getBranchCapabilityDecision } from "@/lib/branchCapabilities";
import type { BranchDashboardSources, DashboardResourceStatus } from "@/lib/branchDashboard";
import type { BranchAccess } from "@/types";

export function DashboardSourceNote({ status, label, onRetry }: { status: DashboardResourceStatus; label: string; onRetry: () => void }) {
    const t = useTranslation();
    return <div className="dashboard-source-note" role={status === "error" ? "status" : undefined}>
        <p>{status === "restricted" ? t("{source}: not included in your access.", { source: label }) : t("{source}: could not be refreshed.", { source: label })}</p>
        {status === "error" && <AppButton variant="quiet" size="sm" icon={RefreshCw} onClick={onRetry}>{t("Retry")}</AppButton>}
    </div>;
}

type PanelProps = { data: BranchDashboardSources; branchId: string; onRetry: () => void };

const SLOT_BINS = Array.from({ length: 8 }, (_, index) => index);

function slotBinFill(used: number, capacity: number, index: number) {
    if (capacity <= 0) return 0;
    return Math.min(100, Math.max(0, (used / capacity * SLOT_BINS.length - index) * 100));
}

export function DashboardSeating({ data, branchId, access, onRetry }: PanelProps & { access: BranchAccess }) {
    const t = useTranslation();
    const { formatNumber, formatDate } = useUserPreferences();
    const snap = data.snapshot;
    const attendance = data.attendance;
    const base = `/branch/${encodeURIComponent(branchId)}`;
    const seatDetails = snap?.seatDetails;
    const usedSlots = seatDetails?.totalUsedSlots ?? 0;
    const totalSlots = seatDetails?.totalShiftCapacity ?? 0;
    const hasVisualSlots = seatDetails?.shifts.some(shift => shift.capacity > 0) ?? false;
    return <AppPanel title={<span className="dashboard-panel-title"><Grid2X2 size={16} aria-hidden="true" />{t("Seating & attendance")}</span>} className="dashboard-seating" contentClassName="dashboard-seating-content">
            <div className="dashboard-seating-section">
                <div className="dashboard-seating-heading"><h3>{t("Shift slots")}</h3><span>{t("Allocated / capacity")}</span></div>
                {seatDetails ? <>
                    <div className="dashboard-slot-overview">
                        <p className="dashboard-slot-overview-number">
                            <span className="sr-only">{t("{used} of {total} shift slots", { used: formatNumber(usedSlots), total: formatNumber(totalSlots) })}</span>
                            <span aria-hidden="true"><strong>{formatNumber(usedSlots)}</strong><span> / {formatNumber(totalSlots)}</span></span>
                        </p>
                        <p>{t("Current allocated share")}</p>
                    </div>
                    {seatDetails.shifts.length ? <ul className="dashboard-shift-list">{seatDetails.shifts.map(shift => <li key={shift.shiftId} className="dashboard-shift">
                        <div className="dashboard-shift-label"><span>{shift.shiftName}</span><strong>{t("{used} / {total} slots", { used: formatNumber(shift.used), total: formatNumber(shift.capacity) })}</strong></div>
                        {shift.capacity > 0 ? <div className="dashboard-slot-bins" role="img" aria-label={`${t("{shift}: allocated shift slots", { shift: shift.shiftName })} · ${t("{used} / {total} slots", { used: formatNumber(shift.used), total: formatNumber(shift.capacity) })}`}>
                            {SLOT_BINS.map(index => <span key={index} style={{ "--dashboard-bin-fill": `${slotBinFill(shift.used, shift.capacity, index)}%` } as CSSProperties} />)}
                        </div> : <span className="dashboard-no-capacity">{t("No capacity")}</span>}
                    </li>)}</ul> : <p className="dashboard-footnote dashboard-no-shifts">{t("No shifts configured")}</p>}
                    {hasVisualSlots && <div className="dashboard-slot-legend">
                        <span><i className="dashboard-slot-key dashboard-slot-key-filled" aria-hidden="true" />{t("Allocated")}</span>
                        <span><i className="dashboard-slot-key dashboard-slot-key-empty" aria-hidden="true" />{t("Available share")}</span>
                        <p>{t("Each tile shows one eighth of its shift capacity; counts are exact.")}</p>
                    </div>}
                </> : snap ? <p className="dashboard-footnote">{t("Shift slots")}: {t("Unavailable")}</p>
                    : <DashboardSourceNote status={data.resources.analytics} label={t("Shift slots")} onRetry={onRetry} />}
            </div>
            <div className="dashboard-attendance-section">
                <div className="dashboard-attendance-heading"><h3>{t("Attendance today")}</h3>
                    {attendance && <span>{formatDate(`${attendance.date}T12:00:00`, { day: "numeric", month: "short" })} · {attendance.timezone}</span>}
                </div>
                {attendance ? <>
                    <dl className="dashboard-attendance-facts">
                        <div><dt>{t("Not marked")}</dt><dd>{attendance.counts.notMarked === null ? "—" : formatNumber(attendance.counts.notMarked)}</dd></div>
                        <div><dt>{t("Marked absent")}</dt><dd>{formatNumber(attendance.counts.absent)}</dd></div>
                        <div><dt>{t("Open visits")}</dt><dd>{formatNumber(attendance.counts.open)}</dd></div>
                    </dl>
                </> : <DashboardSourceNote status={data.resources.attendance} label={t("Attendance today")} onRetry={onRetry} />}
            </div>
            <div className="dashboard-seating-footer">
                {access.permissions.students && <Link className="dashboard-text-link" href={`${base}/attendance`}>{t("Open attendance")} <ArrowRight size={13} /></Link>}
                <details className="dashboard-details"><summary>{t("About slots & attendance")}</summary>
                    <p>{t("A physical seat may contribute a slot in more than one shift.")}</p>
                    <p>{t("Not marked does not mean absent. Open visits can include earlier dates.")}</p>
                    <p>{t("Present today counts students with a present mark or recorded visit.")}</p>
                </details>
            </div>
        </AppPanel>;
}

export function UpcomingFees({ data, branchId, onRetry }: PanelProps) {
    const t = useTranslation();
    const { formatDate, formatNumber } = useUserPreferences();
    const page = data.upcoming;
    return <AppPanel title={<span className="dashboard-panel-title"><CalendarCheck size={16} aria-hidden="true" />{t("Upcoming fees")}</span>} description={t("Next 7 days")} contentClassName="p-0" className="dashboard-upcoming"
        action={data.resources.upcoming !== "restricted" && <Link className="dashboard-text-link" href={`/branch/${encodeURIComponent(branchId)}/renewals`}>{t("View all")} <ArrowRight size={13} /></Link>}>
        {page ? <>
            {page.items.length ? <table className="dashboard-record-table dashboard-upcoming-table">
                <caption className="sr-only">{t("Upcoming fees")}</caption>
                <thead><tr>
                    <th scope="col">{t("Student")}</th><th scope="col">{t("Fee type")}</th><th scope="col">{t("Due date")}</th>
                    <th scope="col">{t("Amount")}</th><th scope="col">{t("Status")}</th>
                </tr></thead>
                <tbody>{page.items.map(row => <tr key={row.key}>
                    <td data-label={t("Student")} className="dashboard-record-name">{row.studentName}</td>
                    <td data-label={t("Fee type")}>{row.type === "ADMISSION" ? t("Admission") : t("Monthly")}</td>
                    <td data-label={t("Due date")}>{formatDate(row.dueDate, { day: "numeric", month: "short" })}</td>
                    <td data-label={t("Amount")} className="dashboard-record-amount">{formatNumber(row.amount, { style: "currency", currency: "INR", maximumFractionDigits: 0 })}</td>
                    <td data-label={t("Status")}><span className={`dashboard-fee-kind ${row.expected ? "dashboard-fee-expected" : "dashboard-fee-recorded"}`}>{row.expected ? t("Expected fee") : t("Recorded fee")}</span></td>
                </tr>)}</tbody>
            </table> : <p className="p-4 text-sm">{t("No upcoming fee dates in this window.")}</p>}
            <div className="dashboard-upcoming-footer">
                <details className="dashboard-details"><summary>{t("About expected fees")}</summary><p>{t("Expected fees are estimates, not recorded debt or membership expiry.")}</p></details>
                {page.nextCursor && <p className="dashboard-footnote">{t("Showing {shown} of {total} fee periods.", { shown: formatNumber(page.items.length), total: formatNumber(page.counts.UPCOMING) })}</p>}
            </div>
        </> : <DashboardSourceNote status={data.resources.upcoming} label={t("Upcoming fee dates")} onRetry={onRetry} />}
    </AppPanel>;
}

export function DashboardShortcuts({ branchId, access }: { branchId: string; access: BranchAccess }) {
    const t = useTranslation();
    const base = `/branch/${encodeURIComponent(branchId)}`;
    const actions = [
        { capability: "allocationsManage" as const, href: "/allocations", label: "Assign seat", icon: Grid2X2 },
        { capability: "shiftsView" as const, href: "/shifts", label: "Review shifts", icon: CalendarCheck },
    ].map(action => ({ ...action, decision: getBranchCapabilityDecision(access, action.capability) }))
        .filter(action => action.decision.allowed || action.decision.blocker !== "permission");
    if (!actions.length) return null;
    return <nav className="dashboard-shortcuts" aria-label={t("Quick actions")}>
        <h2>{t("Quick actions")}</h2>
        <div className="dashboard-shortcuts-grid">{actions.map(action => action.decision.allowed
            ? <Link key={action.href} href={`${base}${action.href}`}><action.icon size={16} aria-hidden="true" /><span>{t.owned(action.label)}</span></Link>
            : <button key={action.href} type="button" disabled title={t.owned(action.decision.reason ?? "")}><action.icon size={16} aria-hidden="true" /><span>{t.owned(action.label)}</span></button>)}</div>
    </nav>;
}
