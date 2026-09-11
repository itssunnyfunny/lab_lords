"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppButton, AppPanel, Drawer, PageShell } from "@/components/ui";
import { formControlClass } from "@/components/ui/formSurface";
import { pageTitleClass, pageDescriptionClass } from "@/components/ui/pageSurface";
import { attendance } from "@/lib/api/attendance";
import { attendanceLabels, type AttendanceCommand, type AttendancePage, type AttendanceRow } from "@/lib/attendance";
import { getBranchCapabilityDecision } from "@/lib/branchCapabilities";
import type { BranchAccess } from "@/types";
import { AttendanceActionDialog } from "./AttendanceActionDialog";
import { AttendanceScanner } from "./AttendanceScanner";
import { StudentAttendance, VisitFacts } from "./StudentAttendance";

export function AttendanceContent({ branchId, access }: { branchId: string; access: BranchAccess }) {
    const [date, setDate] = useState(""), [search, setSearch] = useState(""), [query, setQuery] = useState("");
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
    return <PageShell><div className="space-y-5">
        <header className="flex flex-wrap justify-between gap-3"><div><h1 className={pageTitleClass}>Attendance</h1><p className={pageDescriptionClass}>Daily marks and recorded visits, independent of fees and seats.</p></div>
            <div className="flex gap-2"><AppButton variant="secondary" disabled={loading} onClick={() => void load()}>Refresh</AppButton><AppButton disabled={!record.allowed} onClick={() => setScanner(true)}>Open QR scanner</AppButton></div></header>
        {!record.allowed && <p>{record.reason}</p>}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <AppPanel title="Attended on selected date"><p className="text-2xl font-semibold">{page?.counts.attended ?? "—"}</p></AppPanel>
            <AppPanel title="Explicitly absent"><p className="text-2xl font-semibold">{page?.counts.absent ?? "—"}</p></AppPanel>
            <AppPanel title="Not marked · today's roster"><p className="text-2xl font-semibold">{page?.counts.notMarked ?? "—"}</p></AppPanel>
            <AppPanel title="Currently checked in · all dates"><p className="text-2xl font-semibold">{page?.counts.open ?? "—"}</p></AppPanel>
        </div>
        <div className="flex flex-wrap gap-2"><AppButton variant={!open ? "primary" : "secondary"} aria-pressed={!open} onClick={() => setOpen(false)}>Daily attendance</AppButton><AppButton variant={open ? "primary" : "secondary"} aria-pressed={open} onClick={() => { setOpen(true); setStatus("ALL"); }}>Open visits</AppButton></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm">Date<input aria-label="Attendance date" className={`${formControlClass} w-full p-2`} type="date" value={date || page?.date || ""} max={page?.today} onChange={e => { setDate(e.target.value); setShift(""); }} /></label>
            <label className="text-sm">Search name or phone<input className={`${formControlClass} w-full p-2`} type="search" maxLength={100} value={search} onChange={e => setSearch(e.target.value)} /></label>
            <label className="text-sm">Attendance status<select className={`${formControlClass} w-full p-2`} value={status} onChange={e => setStatus(e.target.value)}><option value="ALL">All statuses</option>{Object.entries(attendanceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            {access.permissions.seat_allocation && <label className="text-sm">Current shift (today only)<select className={`${formControlClass} w-full p-2`} value={shift} disabled={!today} onChange={e => setShift(e.target.value)}><option value="">All shifts / no seat</option>{page?.shifts.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
        </div>
        <p className="text-xs">Times: {page?.timezone ?? "organization timezone"}. Daily counts follow the search, shift and list filters. Open-visit count covers the whole branch across dates. Current allocations are context only, including on historical dates.</p>
        {!today && <p className="text-sm">Historical view shows recorded facts only. No historical roster or unmarked total is inferred.</p>}
        {notice && <p role="status">{notice}</p>}{error && <p role="alert">{error} <AppButton variant="secondary" onClick={() => void load()}>Retry</AppButton></p>}
        {loading ? <p role="status">Loading attendance…</p> : !error && page && <>
            {page.items.length === 0 ? <AppPanel title="No students in this view"><p>Try another date, status or search.</p></AppPanel> : <>
                <div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" aria-label="Select this page" checked={page.items.filter(canSelect).length > 0 && page.items.filter(canSelect).every(r => selected.includes(r.id))} onChange={e => setSelected(e.target.checked ? page.items.filter(canSelect).map(r => r.id) : [])} />Select this page</label>
                    <span className="text-sm">{selected.length} explicitly selected</span>
                    <AppButton variant="secondary" disabled={!selected.length} onClick={() => mark(page.items.filter(r => selected.includes(r.id)), "PRESENT")}>Selected Present</AppButton>
                    <AppButton variant="secondary" disabled={!selected.length} onClick={() => mark(page.items.filter(r => selected.includes(r.id)), "ABSENT")}>Selected Absent</AppButton></div>
                <div className="grid gap-3 lg:grid-cols-2">{page.items.map(row => <article key={row.id} className="space-y-3 rounded-xl border border-[color:var(--ui-form-surface-border)] bg-[color:var(--ui-form-surface-bg)] p-4" aria-label={`Attendance for ${row.name}`}>
                    <div className="flex justify-between gap-2"><label className="flex items-start gap-2"><input type="checkbox" className="mt-1" aria-label={`Select ${row.name}`} disabled={!canSelect(row)} checked={selected.includes(row.id)} onChange={e => setSelected(s => e.target.checked ? [...s, row.id] : s.filter(id => id !== row.id))} /><span><span className="font-semibold">{row.name}</span><span className="block text-xs">{row.phone} · {row.status.toLowerCase()}</span></span></label><strong className="text-sm">{attendanceLabels[row.attendance]}</strong></div>
                    {access.permissions.seat_allocation && <p className="text-xs">Current seat / shift: {row.currentAllocations.length ? [...new Set(row.currentAllocations.map(a => `${a.seat} / ${a.shift}`))].join(", ") : "No seat allocated"}</p>}
                    {row.mark?.note && <p className="text-sm whitespace-pre-wrap">{row.mark.note}</p>}
                    {row.openVisit && <div className="space-y-1"><strong className="text-sm">Checked in{row.openVisit.date.slice(0, 10) < page.today ? " · Since previous day" : ""}</strong><VisitFacts visit={row.openVisit} timezone={page.timezone} /></div>}
                    {row.visits.filter(v => !v.voidedAt && v.checkOut).map(v => <VisitFacts key={v.id} visit={v} timezone={page.timezone} />)}
                    {!row.openVisit && row.visits.every(v => !!v.voidedAt) && <p className="text-xs">No visit times recorded. A manual Present mark does not mean checked in.</p>}
                    <div className="flex flex-wrap gap-2">
                        {canSelect(row) && <><AppButton variant="secondary" onClick={() => mark([row], "PRESENT")}>Mark Present</AppButton><AppButton variant="secondary" onClick={() => mark([row], "ABSENT")}>Mark Absent</AppButton></>}
                        {correct.allowed && row.mark && <AppButton variant="secondary" onClick={() => mark([row], "NOT_MARKED")}>Clear mark</AppButton>}
                        {record.allowed && today && !row.openVisit && row.status === "ACTIVE" && <AppButton onClick={() => setCommand({ key: crypto.randomUUID(), kind: "CHECK_IN", studentId: row.id, source: "MANUAL" })}>Check in</AppButton>}
                        {record.allowed && row.openVisit && <AppButton onClick={() => setCommand({ key: crypto.randomUUID(), kind: "CHECK_OUT", studentId: row.id, visitId: row.openVisit!.id, version: row.openVisit!.version })}>Check out</AppButton>}
                        <AppButton variant="secondary" onClick={() => setStudent(row)}>History &amp; QR</AppButton>
                    </div>
                </article>)}</div>
            </>}
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm">{page.total} students · {page.items.length} shown</span><div className="flex gap-2"><AppButton variant="secondary" onClick={() => void load()}>First page</AppButton>{page.nextCursor && <AppButton variant="secondary" onClick={() => void load(page.nextCursor!)}>Next page</AppButton>}</div></div>
        </>}
        {command && <AttendanceActionDialog branchId={branchId} title={command.kind === "MARK" ? `${needsCorrection ? "Correct" : "Mark"} ${command.students.length} selected student(s) · ${command.date}` : command.kind === "CHECK_IN" ? "Check in student" : "Check out recorded visit"}
            command={command} correction={!!needsCorrection} onClose={() => setCommand(null)} onSaved={r => { setNotice(r.message); void load(); }} />}
        {scanner && <AttendanceScanner branchId={branchId} onClose={() => { setScanner(false); void load(); }} onSaved={() => void load()} />}
        <Drawer open={!!student} title={student?.name ?? "Student attendance"} onClose={() => { setStudent(null); void load(); }}>
            {student && <StudentAttendance key={student.id} branchId={branchId} studentId={student.id} access={access} />}
        </Drawer>
    </div></PageShell>;
}
