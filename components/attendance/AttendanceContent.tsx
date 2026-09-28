"use client";
import { useTranslation } from "@/components/settings/LocalizedText";
import { useCallback, useEffect, useRef, useState } from "react";
import { QrCode, RefreshCw } from "lucide-react";
import { AppButton, AppPanel, Drawer, PageShell } from "@/components/ui";
import { Badge } from "@/components/ui/Badge";
import { RecordListState, RecordListSurface } from "@/components/ui/RecordList";
import { formCheckboxClass, formControlClass, formLabelClass } from "@/components/ui/formSurface";
import { attendance } from "@/lib/api/attendance";
import { attendanceLabels, type AttendanceCommand, type AttendancePage, type AttendanceRow } from "@/lib/attendance";
import { getBranchCapabilityDecision } from "@/lib/branchCapabilities";
import type { BranchAccess } from "@/types";
import { AttendanceActionDialog } from "./AttendanceActionDialog";
import { AttendanceScanner } from "./AttendanceScanner";
import { StudentAttendance, VisitFacts } from "./StudentAttendance";
import { useSearchParams } from "next/navigation";

export function AttendanceContent({ branchId, access }: { branchId: string; access: BranchAccess }) {
    const t = useTranslation();
    const searchParams = useSearchParams();
    const [date, setDate] = useState(""), [search, setSearch] = useState(searchParams.get("search")?.slice(0, 100) ?? ""), [query, setQuery] = useState(searchParams.get("search")?.slice(0, 100) ?? "");
    const [status, setStatus] = useState("ALL"), [shift, setShift] = useState(""), [open, setOpen] = useState(false);
    const [page, setPage] = useState<AttendancePage | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState(""), [notice, setNotice] = useState("");
    const [selected, setSelected] = useState<string[]>([]), [student, setStudent] = useState<AttendanceRow | null>(null);
    const [scanner, setScanner] = useState(false), [command, setCommand] = useState<AttendanceCommand | null>(null);
    const request = useRef(0), record = getBranchCapabilityDecision(access, "attendanceRecord"), correct = getBranchCapabilityDecision(access, "attendanceCorrect");
    useEffect(() => { const timer = setTimeout(() => setQuery(search.trim()), 300); return () => clearTimeout(timer); }, [search]);
    const load = useCallback(async (cursor?: string) => {
        const id = ++request.current; setLoading(true); setError(""); setSelected([]);
        try { const result = await attendance.list(branchId, { ...(date ? { date } : {}), search: query, status, open: String(open), ...(shift ? { shiftId: shift } : {}), ...(cursor ? { cursor } : {}) }); if (id === request.current) setPage(result); }
        catch (err) { if (id === request.current) setError(err instanceof Error ? err.message : "Attendance unavailable"); }
        finally { if (id === request.current) setLoading(false); }
    }, [branchId, date, query, status, shift, open]);
    useEffect(() => { const sequence = request; void load(); return () => { sequence.current++; }; }, [load]);
    const today = page?.date === page?.today;
    function mark(rows: AttendanceRow[], value: "PRESENT" | "ABSENT" | "NOT_MARKED") {
        if (!page || !rows.length) return;
        setCommand({ key: crypto.randomUUID(), kind: "MARK", date: page.date, status: value, students: rows.map(r => ({ studentId: r.id, version: r.mark?.version ?? 0 })) });
    }
    const needsCorrection = command?.kind === "MARK" && (!today || command.status === "NOT_MARKED" || command.students.some(s => (page?.items.find(r => r.id === s.studentId)?.mark) || page?.items.find(r => r.id === s.studentId)?.status !== "ACTIVE"));
    const canSelect = (r: AttendanceRow) => record.allowed && (correct.allowed || (today && !r.mark && r.status === "ACTIVE"));
    const selectables = page?.items.filter(canSelect) ?? [];
    return <PageShell className="ui-record-page"><div className="space-y-5">
        <header className="ui-record-header"><div className="min-w-0"><h1>{t("Attendance")}</h1><p className="ui-record-description">{t("Daily marks and recorded visits, independent of fees and seats.")}</p></div>
            <div className="ui-record-actions"><AppButton density="compact" variant="secondary" icon={RefreshCw} disabled={loading} onClick={() => void load()}>{t("Refresh")}</AppButton><AppButton density="compact" variant="primary" icon={QrCode} disabled={!record.allowed} onClick={() => setScanner(true)}>{t("Open QR scanner")}</AppButton></div></header>
        {!record.allowed && <p className="text-sm text-[color:var(--text-muted)]">{t.error(record.reason)}</p>}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy={loading || undefined}>
            {([
                ["Attended on selected date", page?.counts.attended],
                ["Explicitly absent", page?.counts.absent],
                ["Not marked · today's roster", page?.counts.notMarked],
                ["Currently checked in · all dates", page?.counts.open],
            ] as const).map(([label, value]) => <AppPanel key={label} density="compact" className="min-h-24" contentClassName="space-y-2">
                <p className="text-xs leading-5 text-[color:var(--text-secondary)]">{t(label)}</p>
                <p className="text-2xl font-semibold tabular-nums text-[color:var(--text-primary)]">{value ?? "—"}</p>
            </AppPanel>)}
        </div>
        <AppPanel density="compact" padding="none" aria-label={t(open ? "Open visits" : "Daily attendance")}>
            <div className="flex flex-wrap gap-2 border-b border-[color:var(--ui-panel-compact-border)] p-4"><AppButton density="compact" variant={!open ? "primary" : "secondary"} aria-pressed={!open} onClick={() => setOpen(false)}>{t("Daily attendance")}</AppButton><AppButton density="compact" variant={open ? "primary" : "secondary"} aria-pressed={open} onClick={() => { setOpen(true); setStatus("ALL"); }}>{t("Open visits")}</AppButton></div>
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className={formLabelClass}>{t("Date")}<input aria-label={t("Attendance date")} className={`${formControlClass} mt-1 min-h-11 p-2`} type="date" value={date || page?.date || ""} max={page?.today} onChange={e => { setDate(e.target.value); setShift(""); }} /></label>
                <label className={formLabelClass}>{t("Search name or phone")}<input className={`${formControlClass} mt-1 min-h-11 p-2`} type="search" maxLength={100} value={search} onChange={e => setSearch(e.target.value)} /></label>
                <label className={formLabelClass}>{t("Attendance status")}<select className={`${formControlClass} mt-1 min-h-11 p-2`} value={status} onChange={e => setStatus(e.target.value)}><option value="ALL">{t("All statuses")}</option>{Object.entries(attendanceLabels).map(([value, label]) => <option key={value} value={value}>{t.owned(label)}</option>)}</select></label>
                {access.permissions.seat_allocation && <label className={formLabelClass}>{t("Current shift (today only)")}<select className={`${formControlClass} mt-1 min-h-11 p-2`} value={shift} disabled={!today} onChange={e => setShift(e.target.value)}><option value="">{t("All shifts / no seat")}</option>{page?.shifts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
            </div>
            <div className="space-y-1 border-t border-[color:var(--ui-panel-compact-border)] px-4 py-3 text-xs leading-5 text-[color:var(--text-muted)]">
                <p>{t("Times: {timezone}. Daily counts follow the search, shift and list filters. Open-visit count covers the whole branch across dates. Current allocations are context only, including on historical dates.", { timezone: page?.timezone ?? "Asia/Kolkata" })}</p>
                {!today && <p>{t("Historical view shows recorded facts only. No historical roster or unmarked total is inferred.")}</p>}
            </div>
        </AppPanel>
        {notice && <p role="status" className="text-sm text-[color:var(--ui-tone-success-text)]">{t.owned(notice)}</p>}
        <RecordListSurface label={t(open ? "Open visits" : "Daily attendance")} busy={loading} toolbar={<div className="flex w-full flex-wrap items-center gap-2">
            <label className="flex min-h-11 items-center gap-2 text-sm text-[color:var(--text-secondary)]"><input type="checkbox" className={formCheckboxClass} aria-label={t("Select this page")} disabled={loading || !selectables.length} checked={selectables.length > 0 && selectables.every(r => selected.includes(r.id))} onChange={e => setSelected(e.target.checked ? selectables.map(r => r.id) : [])} />{t("Select this page")}</label>
            <span className="text-xs text-[color:var(--text-muted)]">{t("{count} explicitly selected", { count: selected.length })}</span>
            <div className="flex flex-wrap gap-2 sm:ml-auto"><AppButton density="compact" variant="secondary" disabled={!selected.length} onClick={() => mark(page!.items.filter(r => selected.includes(r.id)), "PRESENT")}>{t("Selected Present")}</AppButton><AppButton density="compact" variant="secondary" disabled={!selected.length} onClick={() => mark(page!.items.filter(r => selected.includes(r.id)), "ABSENT")}>{t("Selected Absent")}</AppButton></div>
        </div>} footer={page && !loading && !error && <div className="flex w-full flex-wrap items-center justify-between gap-2"><span className="text-sm">{t("{total} students · {shown} shown", { total: page.total, shown: page.items.length })}</span><div className="flex flex-wrap gap-2"><AppButton density="compact" variant="secondary" onClick={() => void load()}>{t("First page")}</AppButton>{page.nextCursor && <AppButton density="compact" variant="secondary" onClick={() => void load(page.nextCursor!)}>{t("Next page")}</AppButton>}</div></div>}>
            {loading ? <RecordListState kind="loading" title="Loading attendance…" /> : error ? <div role="alert" className="p-4 text-sm text-[color:var(--ui-form-error-text)]">{t.error(error)} <AppButton density="compact" variant="secondary" onClick={() => void load()}>{t("Retry")}</AppButton></div> : page?.items.length === 0 ?
                <RecordListState kind="empty" title="No students in this view" description="Try another date, status or search." /> :
                <div className="grid items-start gap-3 lg:grid-cols-2">{page?.items.map(row => <article key={row.id} className="ui-panel--compact ui-record-card flex min-w-0 flex-col gap-3" aria-label={t("Attendance for {name}", { name: row.name })}>
                    <div className="flex min-w-0 items-start justify-between gap-3"><label className="flex min-h-11 min-w-0 items-start gap-2"><input type="checkbox" className={`${formCheckboxClass} mt-1.5 shrink-0`} aria-label={t("Select {name}", { name: row.name })} disabled={!canSelect(row)} checked={selected.includes(row.id)} onChange={e => setSelected(s => e.target.checked ? [...s, row.id] : s.filter(id => id !== row.id))} /><span className="min-w-0"><span className="ui-record-card-name block">{row.name}</span><span className="block break-words text-xs leading-5 text-[color:var(--text-muted)]">{row.phone ? `${row.phone} · ` : ""}{t.owned(row.status.toLowerCase())}</span></span></label><Badge variant={row.attendance === "PRESENT" ? "success" : row.attendance === "ABSENT" ? "danger" : "default"} className="shrink-0">{t.owned(attendanceLabels[row.attendance])}</Badge></div>
                    {access.permissions.seat_allocation && <p className="break-words text-xs leading-5 text-[color:var(--text-secondary)]">{t("Current seat / shift: {allocations}", { allocations: row.currentAllocations.length ? [...new Set(row.currentAllocations.map(a => `${a.seat} / ${a.shift}`))].join(", ") : t("No seat allocated") })}</p>}
                    {row.mark?.note && <p className="whitespace-pre-wrap break-words text-sm text-[color:var(--text-secondary)]">{row.mark.note}</p>}
                    {(row.openVisit || row.visits.some(v => !v.voidedAt && v.checkOut)) && <div className="space-y-3 border-t border-[color:var(--ui-form-section-divider)] pt-3">{row.openVisit && <div className="space-y-1"><strong className="text-sm text-[color:var(--text-primary)]">{t("Checked in")}{row.openVisit.date.slice(0, 10) < page!.today ? t(" · Since previous day") : ""}</strong><VisitFacts visit={row.openVisit} timezone={page!.timezone} /></div>}{row.visits.filter(v => !v.voidedAt && v.checkOut).map(v => <VisitFacts key={v.id} visit={v} timezone={page!.timezone} />)}</div>}
                    {!row.openVisit && row.visits.every(v => !!v.voidedAt) && <p className="text-xs leading-5 text-[color:var(--text-muted)]">{t("No visit times recorded. A manual Present mark does not mean checked in.")}</p>}
                    <div className="flex flex-wrap gap-2 border-t border-[color:var(--ui-form-section-divider)] pt-3">
                        {canSelect(row) && <><AppButton density="compact" variant="secondary" onClick={() => mark([row], "PRESENT")}>{t("Mark Present")}</AppButton><AppButton density="compact" variant="secondary" onClick={() => mark([row], "ABSENT")}>{t("Mark Absent")}</AppButton></>}
                        {correct.allowed && row.mark && <AppButton density="compact" variant="secondary" onClick={() => mark([row], "NOT_MARKED")}>{t("Clear mark")}</AppButton>}
                        {record.allowed && today && !row.openVisit && row.status === "ACTIVE" && <AppButton density="compact" variant="primary" onClick={() => setCommand({ key: crypto.randomUUID(), kind: "CHECK_IN", studentId: row.id, source: "MANUAL" })}>{t("Check in")}</AppButton>}
                        {record.allowed && row.openVisit && <AppButton density="compact" variant="primary" onClick={() => setCommand({ key: crypto.randomUUID(), kind: "CHECK_OUT", studentId: row.id, visitId: row.openVisit!.id, version: row.openVisit!.version })}>{t("Check out")}</AppButton>}
                        <AppButton density="compact" variant="quiet" onClick={() => setStudent(row)}>{t("History & QR")}</AppButton>
                    </div>
                </article>)}</div>}
        </RecordListSurface>
        {command && <AttendanceActionDialog branchId={branchId} title={command.kind === "MARK" ? t(needsCorrection ? "Correct {count} selected student(s) · {date}" : "Mark {count} selected student(s) · {date}", { count: command.students.length, date: command.date }) : command.kind === "CHECK_IN" ? t("Check in student") : t("Check out recorded visit")}
            command={command} correction={!!needsCorrection} onClose={() => setCommand(null)} onSaved={r => { setNotice(r.message); void load(); }} />}
        {scanner && <AttendanceScanner branchId={branchId} onClose={() => { setScanner(false); void load(); }} onSaved={() => void load()} />}
        <Drawer open={!!student} density="compact" languagePlacement="header" title={student?.name ?? "Student attendance"} onClose={() => { setStudent(null); void load(); }}>
            {student && <StudentAttendance key={student.id} branchId={branchId} studentId={student.id} access={access} />}
        </Drawer>
    </div></PageShell>;
}
