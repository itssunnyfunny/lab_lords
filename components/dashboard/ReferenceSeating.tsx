"use client";
import { useId, useState } from "react";
import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";
import { useTranslation } from "@/components/settings/LocalizedText";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import type { DashboardOverview } from "@/lib/dashboardContracts";
import { SourceState } from "./ReferenceDashboard";

export function ReferenceSeating({ seating, attendance, base, retry }: { seating: DashboardOverview["seating"]; attendance: DashboardOverview["attendance"]; base: string; retry: () => void }) {
    const t = useTranslation(); const { formatNumber, formatDate } = useUserPreferences();
    const [tab, setTab] = useState("week"); const [detail, setDetail] = useState<string | null>(null);
    const panelId = `seating-${useId().replaceAll(":", "")}`;
    const data = seating.data; const a = attendance.data;
    const tone = (used: number | null, capacity: number | null) => used == null || capacity == null ? "unknown" : !used ? "empty" : used / Math.max(1, capacity) >= .65 ? "full" : "partial";
    return <section className="rd-panel rd-seating"><div className="rd-panel-heading"><div><Users size={19} fill="currentColor" /><h2>{t.owned("Attendance & Seat Occupancy")}</h2></div>{seating.status !== "restricted" && <Link href={`${base}/seats`} aria-label={t.owned("Review seats")}><ArrowRight size={14} /></Link>}</div>
        <div className="rd-tabs" role="tablist" aria-label={t.owned("Seating view")}>{[["today", "Today"], ["week", "This week"], ["map", "Seat map"]].map(([key, label], index) => <button key={key} role="tab" aria-selected={tab === key} aria-controls={panelId} id={`${panelId}-${key}`} tabIndex={tab === key ? 0 : -1} type="button" onClick={() => { setTab(key); setDetail(null); }} onKeyDown={event => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault(); const tabs = ["today", "week", "map"];
            const next = event.key === "Home" ? 0 : event.key === "End" ? 2 : (index + (event.key === "ArrowRight" ? 1 : -1) + 3) % 3;
            setTab(tabs[next]); setDetail(null); document.getElementById(`${panelId}-${tabs[next]}`)?.focus();
        }}>{t.owned(label)}</button>)}</div>
        <div className="rd-seating-visual" id={panelId} role="tabpanel" tabIndex={0} aria-labelledby={`${panelId}-${tab}`}>
            {data ? tab === "map" ? <div className="rd-seat-map">{data.seatsPreview.map(seat => <button type="button" key={seat.id} data-fill={seat.occupiedShifts ? "full" : "empty"} onClick={() => setDetail(`${seat.label} · ${t.owned("{count} allocated shifts", { count: formatNumber(seat.occupiedShifts) })}`)}>{seat.label}</button>)}<Link href={`${base}/seats`}>{t.owned("Open complete seat map")}<ArrowRight size={12} /></Link></div> : tab === "today" ? <div className="rd-today-matrix">{data.rows.map(row => { const cell = row.cells.at(-1); return <div key={row.id}><span>{row.name}<small>{row.startTime ?? "—"} – {row.endTime ?? "—"}</small></span><button type="button" data-fill={tone(cell?.occupied ?? null, cell?.capacity ?? null)} onClick={() => setDetail(`${row.name} · ${t("{used} of {total} shift slots", { used: formatNumber(cell?.occupied ?? 0), total: formatNumber(cell?.capacity ?? 0) })}`)}>{cell?.occupied ?? "—"} / {cell?.capacity ?? "—"}</button></div>; })}{!data.rows.length && <p>{t("No shifts configured")}</p>}</div> : <table className="rd-heatmap"><thead><tr><th><span className="sr-only">{t("Shift")}</span></th>{data.days.map(day => <th key={day}>{formatDate(`${day}T12:00:00Z`, { weekday: "short", timeZone: "UTC" })}</th>)}</tr></thead><tbody>{data.rows.slice(0, 4).map(row => <tr key={row.id}><th>{row.name}<small>{row.startTime ?? "—"} – {row.endTime ?? "—"}</small></th>{row.cells.map(cell => <td key={cell.date}><button type="button" data-fill={tone(cell.occupied, cell.capacity)} aria-label={`${row.name}, ${cell.date}: ${cell.occupied == null ? t.owned("No recorded observation") : t("{used} of {total} shift slots", { used: formatNumber(cell.occupied), total: formatNumber(cell.capacity ?? 0) })}`} onClick={() => setDetail(`${row.name} · ${formatDate(`${cell.date}T12:00:00Z`, { day: "numeric", month: "short", timeZone: "UTC" })} · ${cell.occupied == null ? t.owned("No recorded observation") : t("{used} of {total} shift slots", { used: formatNumber(cell.occupied), total: formatNumber(cell.capacity ?? 0) })}`)}>{cell.occupied == null ? <span aria-hidden="true">·</span> : <span className="sr-only">{cell.occupied}</span>}</button></td>)}</tr>)}</tbody></table> : <SourceState source={seating} retry={retry} />}
        </div>
        <div className="rd-matrix-legend">{[["full", "Occupied"], ["partial", "Partly allocated"], ["empty", "Empty"], ["unknown", "No history"]].map(([fill, label]) => <span key={fill}><i data-fill={fill} />{t.owned(label)}</span>)}</div>
        {detail && <p className="rd-cell-detail" role="status">{detail}</p>}
        <dl className="rd-seating-summary"><div><dd>{data ? `${formatNumber(data.physicalSeatsInUse)} / ${formatNumber(data.seats)}` : "—"}</dd><dt>{t.owned("Physical seats in use")}</dt></div><div><dd>{a?.configured ? formatNumber(a.expectedToday) : "—"}</dd><dt>{t.owned("Expected today")}</dt></div><div><dd>{a ? formatNumber(a.attendedToday) : "—"}</dd><dt>{attendance.status === "restricted" ? t.owned("Attended today") : <a href={`${base}/attendance`}>{t.owned("Attended today")}</a>}</dt></div></dl>
        <details className="rd-chart-details"><summary>{t.owned("About this view")}</summary><p>{t.owned("Today uses current allocations. Past cells use the first recorded observation that day; unobserved days stay blank. Allocations are not attendance.")}</p>{data?.coverageStartedAt && <p>{t.owned("Recorded coverage begins")}: {formatDate(data.coverageStartedAt, { day: "numeric", month: "short", year: "numeric" })}</p>}</details>
    </section>;
}
