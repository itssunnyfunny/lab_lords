"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppButton } from "@/components/ui";
import { formControlClass } from "@/components/ui/formSurface";
import { attendance } from "@/lib/api/attendance";
import { attendanceLabels, attendanceTime, recordedMinutes, type AttendanceCommand, type AttendanceHistory, type AttendanceVisitView } from "@/lib/attendance";
import { getBranchCapabilityDecision } from "@/lib/branchCapabilities";
import type { BranchAccess } from "@/types";
import { AttendanceActionDialog } from "./AttendanceActionDialog";
import { AttendanceQr } from "./AttendanceQr";

export function VisitFacts({ visit, timezone }: { visit: AttendanceVisitView; timezone: string }) {
    const duration = recordedMinutes(visit.checkIn, visit.checkOut);
    return <div className="space-y-1 text-sm">
        <p>In: {attendanceTime(visit.checkIn, timezone)}</p>
        <p>Out: {visit.checkOut ? attendanceTime(visit.checkOut, timezone) : "Not recorded"}{duration !== null ? ` · ${duration} min recorded` : ""}</p>
        <p className="text-xs">{visit.source} · Recorded by {visit.actor.name || "Staff"}{visit.correctedAt ? " · Corrected" : ""}{visit.voidedAt ? " · Voided (excluded from attendance)" : ""}</p>
        {visit.note && <p className="whitespace-pre-wrap">{visit.note}</p>}
    </div>;
}
export function StudentAttendance({ branchId, studentId, access }: { branchId: string; studentId: string; access: BranchAccess }) {
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [data, setData] = useState<AttendanceHistory | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState(""), [notice, setNotice] = useState("");
    const [markDay, setMarkDay] = useState(to), [command, setCommand] = useState<AttendanceCommand | null>(null);
    const counter = useRef(0);
    const record = getBranchCapabilityDecision(access, "attendanceRecord"), correct = getBranchCapabilityDecision(access, "attendanceCorrect");
    const load = useCallback(async (cursor?: string, auditCursor?: string) => {
        const id = ++counter.current; setLoading(true); setError("");
        try { const result = await attendance.history(branchId, { studentId, ...(from ? { from } : {}), ...(to ? { to } : {}), ...(cursor ? { cursor } : {}), ...(auditCursor ? { auditCursor } : {}) }); if (id === counter.current) setData(result); }
        catch (err) { if (id === counter.current) setError(err instanceof Error ? err.message : "History unavailable"); }
        finally { if (id === counter.current) setLoading(false); }
    }, [branchId, studentId, from, to]);
    useEffect(() => { const sequence = counter; void load(); return () => { sequence.current++; }; }, [load]);
    async function mark(status: "PRESENT" | "ABSENT" | "NOT_MARKED") {
        if (loading || !data) return;
        setLoading(true); setError("");
        try {
            const day = markDay || data.today;
            const snapshot = await attendance.history(branchId, { studentId, from: day, to: day });
            setCommand({ key: crypto.randomUUID(), kind: "MARK", date: day, status,
                students: [{ studentId, version: snapshot.marks[0]?.version ?? 0 }] });
        } catch (err) { setError(err instanceof Error ? err.message : "Unable to read the selected day"); }
        finally { setLoading(false); }
    }
    return <section className="space-y-4" aria-label="Student attendance history">
        <h2 className="text-lg font-semibold">Attendance history &amp; QR</h2>
        <p className="text-sm">Recorded facts only. No historical absence or attendance percentage is inferred from the current roster. Times shown in {data?.timezone ?? "Asia/Kolkata"}.</p>
        <div className="grid grid-cols-2 gap-2"><label className="text-sm">From<input className={`${formControlClass} w-full p-2`} type="date" value={from || data?.from || ""} onChange={e => setFrom(e.target.value)} /></label>
            <label className="text-sm">Through<input className={`${formControlClass} w-full p-2`} type="date" value={to || data?.to || ""} onChange={e => setTo(e.target.value)} /></label></div>
        <p className="text-xs">Maximum range: 93 days. Visits are paginated in groups of 50.</p>
        {error && <p role="alert">{error} <AppButton variant="secondary" onClick={() => void load()}>Retry history</AppButton></p>}{notice && <p role="status">{notice}</p>}
        {loading ? <p role="status">Loading attendance…</p> : !error && data && <>
            <div className="space-y-3"><h3 className="font-semibold">Daily manual marks</h3>
                {data.marks.length === 0 && <p>No manual marks in this range.</p>}
                {data.marks.map(mark => <article key={mark.date} className="rounded-lg border border-[color:var(--ui-form-surface-border)] p-3 text-sm">
                    <p>{mark.date.slice(0, 10)} · {attendanceLabels[mark.status]}{mark.correctedAt ? " · Corrected" : ""}</p>
                    <p>{mark.source} · {mark.actor.name || "Staff"} · {attendanceTime(mark.updatedAt, data.timezone)}</p>{mark.note && <p className="whitespace-pre-wrap">{mark.note}</p>}
                </article>)}
            </div>
            <div className="space-y-3"><h3 className="font-semibold">Recorded visits</h3>
                {data.visits.length === 0 && <p>No visits in this range.</p>}
                {data.visits.map(visit => <article key={visit.id} className="space-y-2 rounded-lg border border-[color:var(--ui-form-surface-border)] p-3">
                    <p className="text-sm">Attendance date: {visit.date.slice(0, 10)} ({visit.timezone})</p>
                    <VisitFacts visit={visit} timezone={data.timezone} />
                    {!visit.voidedAt && correct.allowed && <div className="flex flex-wrap gap-2">
                        <AppButton variant="secondary" onClick={() => setCommand({ key: crypto.randomUUID(), kind: "CORRECT_VISIT", studentId, visitId: visit.id, version: visit.version, checkIn: visit.checkIn, checkOut: visit.checkOut, note: visit.note ?? "" })}>{visit.checkOut ? "Correct times" : "Correct / close missed checkout"}</AppButton>
                        <AppButton variant="secondary" onClick={() => setCommand({ key: crypto.randomUUID(), kind: "VOID_VISIT", studentId, visitId: visit.id, version: visit.version })}>Void visit</AppButton>
                    </div>}
                </article>)}
                <div className="flex gap-2"><AppButton variant="secondary" onClick={() => void load()}>First visits</AppButton>{data.nextCursor && <AppButton variant="secondary" onClick={() => void load(data.nextCursor!)}>Older visits</AppButton>}</div>
            </div>
        </>}
        {!loading && !error && data && <section className="space-y-2"><h3 className="font-semibold">Change history · all dates</h3>
            <p className="text-xs">Original and corrected evidence is retained. Latest 50 changes per page, independent of the attendance date range.</p>
            {data.audits.map(a => <details key={a.id} className="rounded-lg border border-[color:var(--ui-form-surface-border)] p-2 text-sm"><summary>{a.kind.toLowerCase().replaceAll("_", " ")} · {a.actor || "Staff"} · {attendanceTime(a.createdAt, data.timezone)}</summary>
                {a.reason && <p className="whitespace-pre-wrap">Reason: {a.reason}</p>}
                {(["before", "after"] as const).map(side => <div key={side} className="my-2"><strong>{side === "before" ? "Before" : "After"}</strong>{a[side] ? <ul>{Object.entries(a[side]!).map(([field, value]) => <li key={field} className="whitespace-pre-wrap">{({ date: "Attendance date", status: "Mark", checkIn: "Check in", checkOut: "Check out", note: "Note", voidedAt: "Voided at" } as Record<string, string>)[field]}: {value ?? "Not recorded"}</li>)}</ul> : <p>No previous record</p>}</div>)}
            </details>)}
            {data.auditNextCursor && <AppButton variant="secondary" onClick={() => void load(undefined, data.auditNextCursor!)}>Older changes</AppButton>}
        </section>}
        {correct.allowed && <div className="space-y-2"><h3 className="font-semibold">Correct a daily mark</h3>
            <label className="block text-sm">Attendance date<input className={`${formControlClass} w-full p-2`} type="date" value={markDay || data?.today || ""} max={data?.today} onChange={e => setMarkDay(e.target.value)} /></label>
            <div className="flex flex-wrap gap-2">{(["PRESENT", "ABSENT", "NOT_MARKED"] as const).map(status => <AppButton key={status} variant="secondary" disabled={loading || !data} onClick={() => void mark(status)}>{status === "NOT_MARKED" ? "Clear mark" : `Mark ${attendanceLabels[status]}`}</AppButton>)}</div>
        </div>}
        {data?.qr ? <AttendanceQr code={data.qr} name={data.student.name} /> : <AppButton variant="secondary" disabled={!record.allowed || loading} onClick={() => setCommand({ key: crypto.randomUUID(), kind: "ISSUE_QR", studentId })}>Generate attendance QR</AppButton>}
        {command && <AttendanceActionDialog branchId={branchId} title={command.kind === "ISSUE_QR" ? "Generate student QR" : command.kind === "MARK" ? `Correct mark · ${command.date}` : command.kind === "VOID_VISIT" ? "Void mistaken visit" : "Correct visit times"}
            command={command} correction={command.kind !== "ISSUE_QR"} onClose={() => setCommand(null)} onSaved={r => { setNotice(r.message); void load(); }} />}
    </section>;
}
