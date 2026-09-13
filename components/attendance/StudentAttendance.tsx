"use client";
import { useTranslation } from "@/components/settings/LocalizedText";
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
    const t = useTranslation();
    const duration = recordedMinutes(visit.checkIn, visit.checkOut);
    return <div className="space-y-1 text-sm">
        <p>{t("In: {time}", { time: attendanceTime(visit.checkIn, timezone) })}</p>
        <p>{t("Out: {time}", { time: visit.checkOut ? attendanceTime(visit.checkOut, timezone) : t("Not recorded") })}{duration !== null ? t(" · {minutes} min recorded", { minutes: duration }) : ""}</p>
        <p className="text-xs">{t("{source} · Recorded by {name}", { source: t.owned(visit.source), name: visit.actor.name || t("Staff") })}{visit.correctedAt ? t(" · Corrected") : ""}{visit.voidedAt ? t(" · Voided (excluded from attendance)") : ""}</p>
        {visit.note && <p className="whitespace-pre-wrap">{visit.note}</p>}
    </div>;
}
export function StudentAttendance({ branchId, studentId, access }: { branchId: string; studentId: string; access: BranchAccess }) {
    const t = useTranslation();
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
    return <section className="space-y-4" aria-label={t("Student attendance history")}>
        <h2 className="text-lg font-semibold">{t("Attendance history & QR")}</h2>
        <p className="text-sm">{t("Recorded facts only. No historical absence or attendance percentage is inferred from the current roster. Times shown in {timezone}.", { timezone: data?.timezone ?? "Asia/Kolkata" })}</p>
        <div className="grid grid-cols-2 gap-2"><label className="text-sm">{t("From")}<input className={`${formControlClass} w-full p-2`} type="date" value={from || data?.from || ""} onChange={e => setFrom(e.target.value)} /></label>
            <label className="text-sm">{t("Through")}<input className={`${formControlClass} w-full p-2`} type="date" value={to || data?.to || ""} onChange={e => setTo(e.target.value)} /></label></div>
        <p className="text-xs">{t("Maximum range: 93 days. Visits are paginated in groups of 50.")}</p>
        {error && <p role="alert">{t.error(error)} <AppButton variant="secondary" onClick={() => void load()}>{t("Retry history")}</AppButton></p>}{notice && <p role="status">{t.owned(notice)}</p>}
        {loading ? <p role="status">{t("Loading attendance…")}</p> : !error && data && <>
            <div className="space-y-3"><h3 className="font-semibold">{t("Daily manual marks")}</h3>
                {data.marks.length === 0 && <p>{t("No manual marks in this range.")}</p>}
                {data.marks.map(mark => <article key={mark.date} className="rounded-lg border border-[color:var(--ui-form-surface-border)] p-3 text-sm">
                    <p>{mark.date.slice(0, 10)} · {t.owned(attendanceLabels[mark.status])}{mark.correctedAt ? t(" · Corrected") : ""}</p>
                    <p>{t.owned(mark.source)} · {mark.actor.name || "Staff"} · {attendanceTime(mark.updatedAt, data.timezone)}</p>{mark.note && <p className="whitespace-pre-wrap">{mark.note}</p>}
                </article>)}
            </div>
            <div className="space-y-3"><h3 className="font-semibold">{t("Recorded visits")}</h3>
                {data.visits.length === 0 && <p>{t("No visits in this range.")}</p>}
                {data.visits.map(visit => <article key={visit.id} className="space-y-2 rounded-lg border border-[color:var(--ui-form-surface-border)] p-3">
                    <p className="text-sm">{t("Attendance date:")} {visit.date.slice(0, 10)} ({visit.timezone})</p>
                    <VisitFacts visit={visit} timezone={data.timezone} />
                    {!visit.voidedAt && correct.allowed && <div className="flex flex-wrap gap-2">
                        <AppButton variant="secondary" onClick={() => setCommand({ key: crypto.randomUUID(), kind: "CORRECT_VISIT", studentId, visitId: visit.id, version: visit.version, checkIn: visit.checkIn, checkOut: visit.checkOut, note: visit.note ?? "" })}>{visit.checkOut ? t("Correct times") : t("Correct / close missed checkout")}</AppButton>
                        <AppButton variant="secondary" onClick={() => setCommand({ key: crypto.randomUUID(), kind: "VOID_VISIT", studentId, visitId: visit.id, version: visit.version })}>{t("Void visit")}</AppButton>
                    </div>}
                </article>)}
                <div className="flex gap-2"><AppButton variant="secondary" onClick={() => void load()}>{t("First visits")}</AppButton>{data.nextCursor && <AppButton variant="secondary" onClick={() => void load(data.nextCursor!)}>{t("Older visits")}</AppButton>}</div>
            </div>
        </>}
        {!loading && !error && data && <section className="space-y-2"><h3 className="font-semibold">{t("Change history · all dates")}</h3>
            <p className="text-xs">{t("Original and corrected evidence is retained. Latest 50 changes per page, independent of the attendance date range.")}</p>
            {data.audits.map(a => <details key={a.id} className="rounded-lg border border-[color:var(--ui-form-surface-border)] p-2 text-sm"><summary>{t.owned(a.kind.toLowerCase().replaceAll("_", " "))} · {a.actor || t("Staff")} · {attendanceTime(a.createdAt, data.timezone)}</summary>
                {a.reason && <p className="whitespace-pre-wrap">{t("Reason:")} {a.reason}</p>}
                {(["before", "after"] as const).map(side => <div key={side} className="my-2"><strong>{side === "before" ? t("Before") : t("After")}</strong>{a[side] ? <ul>{Object.entries(a[side]!).map(([field, value]) => <li key={field} className="whitespace-pre-wrap">{t.owned(({ date: "Attendance date", status: "Mark", checkIn: "Check in", checkOut: "Check out", note: "Note", voidedAt: "Voided at" } as Record<string, string>)[field] ?? field)}: {value == null ? t("Not recorded") : field === "status" ? t.owned(String(value)) : value}</li>)}</ul> : <p>{t("No previous record")}</p>}</div>)}
            </details>)}
            {data.auditNextCursor && <AppButton variant="secondary" onClick={() => void load(undefined, data.auditNextCursor!)}>{t("Older changes")}</AppButton>}
        </section>}
        {correct.allowed && <div className="space-y-2"><h3 className="font-semibold">{t("Correct a daily mark")}</h3>
            <label className="block text-sm">{t("Attendance date")}<input className={`${formControlClass} w-full p-2`} type="date" value={markDay || data?.today || ""} max={data?.today} onChange={e => setMarkDay(e.target.value)} /></label>
            <div className="flex flex-wrap gap-2">{(["PRESENT", "ABSENT", "NOT_MARKED"] as const).map(status => <AppButton key={status} variant="secondary" disabled={loading || !data} onClick={() => void mark(status)}>{status === "NOT_MARKED" ? t("Clear mark") : t(status === "PRESENT" ? "Mark Present" : "Mark Absent")}</AppButton>)}</div>
        </div>}
        {data?.qr ? <AttendanceQr code={data.qr} name={data.student.name} /> : <AppButton variant="secondary" disabled={!record.allowed || loading} onClick={() => setCommand({ key: crypto.randomUUID(), kind: "ISSUE_QR", studentId })}>{t("Generate attendance QR")}</AppButton>}
        {command && <AttendanceActionDialog branchId={branchId} title={command.kind === "ISSUE_QR" ? t("Generate student QR") : command.kind === "MARK" ? t("Correct mark · {date}", { date: command.date }) : command.kind === "VOID_VISIT" ? t("Void mistaken visit") : t("Correct visit times")}
            command={command} correction={command.kind !== "ISSUE_QR"} onClose={() => setCommand(null)} onSaved={r => { setNotice(r.message); void load(); }} />}
    </section>;
}
