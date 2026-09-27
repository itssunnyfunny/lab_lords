"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppButton, AppPanel, AppSelect } from "@/components/ui";
import { useTranslation } from "@/components/settings/LocalizedText";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { getBranchCapabilityDecision } from "@/lib/branchCapabilities";
import type { DashboardOverview, DashboardTerm } from "@/lib/dashboardContracts";
import type { BranchAccess } from "@/types";
import { dashboardRequest, FeaturePage, inputClass, ResourceError, tableClass, useDashboardResource } from "./shared";
type StudentOption = { id: string; name: string };
type Expectation = { studentId: string; weekdays: number[]; expectedBy: string; enabled: boolean };
const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export function DashboardSettingsContent({ branchId, access }: { branchId: string; access: BranchAccess }) {
    const t = useTranslation(); const write = getBranchCapabilityDecision(access, "settingsManage");
    const query = useSearchParams(); const [section, setSection] = useState(query.get("section") ?? "utilization");
    const overview = useDashboardResource<DashboardOverview>(`/api/branches/${branchId}/dashboard`);
    const seating = overview.data?.seating; const attendance = overview.data?.attendance;
    return <FeaturePage title="Dashboard setup" description="Choose attendance expectations, record membership terms and set an advisory utilization threshold. These settings do not change fees or student status.">
        <nav className="flex flex-wrap gap-2" aria-label={t("Dashboard setup")}>{[ ["utilization", "Utilization review"], ["expectations", "Attendance expectations"], ["terms", "Membership terms"] ].filter(([key]) => key === "utilization" ? access.permissions.seat_allocation || access.permissions.manage_branch : access.permissions.students).map(([value, label]) => <AppButton key={value} variant={section === value ? "primary" : "secondary"} aria-pressed={section === value} onClick={() => setSection(value)}>{t.owned(label)}</AppButton>)}</nav>
        <ResourceError error={overview.error} retry={() => void overview.reload()} />
        {section === "utilization" && <><AppPanel title={t("Utilization review")} description={t("Review available slots before changing allocations. Low utilization is advisory.")}>
            {seating?.data && <><p className="mb-3 text-2xl font-semibold">{seating.data.occupied} / {seating.data.capacity} <span className="text-sm font-normal">{t.owned("shift slots")}</span></p><div className="overflow-x-auto"><table className={tableClass}><thead><tr><th>{t("Shift")}</th><th>{t("Allocated / capacity")}</th></tr></thead><tbody>{seating.data.rows.map(row => { const cell = row.cells.at(-1); return <tr key={row.id}><td>{row.name}</td><td>{cell?.occupied ?? "—"} / {cell?.capacity ?? "—"}</td></tr>; })}</tbody></table></div></>}
            {access.permissions.seat_allocation && <Link className="inline-flex min-h-11 items-center text-sm underline" href={`/branch/${branchId}/seats`}>{t("Open seat map")}</Link>}
        </AppPanel>{access.permissions.manage_branch && <Threshold branchId={branchId} writable={write.allowed} />}</>}
        {section === "expectations" && access.permissions.students && <><AppPanel title={t("Expected students without attendance")} description={t("Configure only agreed attendance days. A gap appears after the expected time in the branch timezone, without marking anyone absent.")}>
            {attendance?.data?.gapsStudents.map(student => <div key={student.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--ui-panel-border)] py-3"><span className="text-sm font-semibold">{student.name}</span><span className="text-sm">{t("Expected by")}: {student.expectedBy}</span><a className="inline-flex min-h-11 items-center text-sm underline" href={`/branch/${branchId}/attendance?search=${encodeURIComponent(student.name)}`}>{t("Attendance")}</a></div>)}
            {attendance?.data && !attendance.data.gaps && <p className="text-sm">{t(attendance.data.configured ? "No attendance gaps are currently recorded." : "Attendance expectations are not configured.")}</p>}
        </AppPanel>{access.permissions.manage_branch ? <Expectations branchId={branchId} writable={write.allowed} /> : <p className="text-sm">{t("Ask a branch manager to change these settings.")}</p>}</>}
        {section === "terms" && access.permissions.students && <Terms branchId={branchId} writable={write.allowed} />}
        {!write.allowed && <p className="text-sm">{t.error(write.reason)}</p>}
    </FeaturePage>;
}
function Threshold({ branchId, writable }: { branchId: string; writable: boolean }) {
    const t = useTranslation();
    const settings = useDashboardResource<{ utilizationThreshold: number }>(`/api/branches/${branchId}/dashboard/settings`);
    const [threshold, setThreshold] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [saved, setSaved] = useState(false);
    async function save() { setBusy(true); setError(null); setSaved(false); try { await dashboardRequest(`/api/branches/${branchId}/dashboard/settings`, "POST", { utilizationThreshold: Number(threshold ?? settings.data?.utilizationThreshold ?? 30) }); await settings.reload(); setSaved(true); } catch (error) { setError(error instanceof Error ? error.message : "Something went wrong. Try again."); } finally { setBusy(false); } }
    return <AppPanel title={t("Low utilization threshold")} description={t("The dashboard compares allocated seat-shift slots with all available seat-shift slots. No automatic reallocation occurs.")}><div className="flex flex-wrap items-end gap-3"><label className="text-sm">{t("Threshold (%)")}<input type="number" min={1} max={100} className={inputClass} value={threshold ?? settings.data?.utilizationThreshold ?? ""} onChange={event => setThreshold(event.target.value)} disabled={!writable || busy} /></label><AppButton disabled={!writable || settings.loading} isLoading={busy} onClick={() => void save()}>{t("Save threshold")}</AppButton></div><ResourceError error={error || settings.error} />{saved && <p role="status" className="mt-3 text-sm">{t("Saved")}</p>}</AppPanel>;
}
function Expectations({ branchId, writable }: { branchId: string; writable: boolean }) {
    const t = useTranslation(); const resource = useDashboardResource<{ items: Expectation[]; students: StudentOption[] }>(`/api/branches/${branchId}/dashboard/expectations`);
    const [studentId, setStudent] = useState(""); const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6]); const [time, setTime] = useState("09:00"); const [enabled, setEnabled] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [saved, setSaved] = useState(false);
    function select(id: string) { setStudent(id); setSaved(false); const existing = resource.data?.items.find(item => item.studentId === id); setDays(existing?.weekdays ?? [1, 2, 3, 4, 5, 6]); setTime(existing?.expectedBy ?? "09:00"); setEnabled(existing?.enabled ?? true); }
    async function save() { if (busy) return; setBusy(true); setError(null); setSaved(false); try { await dashboardRequest(`/api/branches/${branchId}/dashboard/expectations`, "POST", { studentId, weekdays: days, expectedBy: time, enabled }); await resource.reload(); setSaved(true); } catch (error) { setError(error instanceof Error ? error.message : "Something went wrong. Try again."); } finally { setBusy(false); } }
    return <AppPanel title={t("Attendance expectations")} description={t("Configure only agreed attendance days. A gap appears after the expected time in the branch timezone, without marking anyone absent.")}><div className="space-y-4"><ResourceError error={resource.error || error} retry={() => void resource.reload()} />
        <div className="grid gap-3 sm:grid-cols-2"><AppSelect label={t("Student")} value={studentId} onValueChange={select} disabled={!writable || busy} options={[{ value: "", label: t("Choose student") }, ...(resource.data?.students.map(student => ({ value: student.id, label: student.name })) ?? [])]} /><label className="text-sm">{t("Expected by")}<input type="time" className={inputClass} value={time} disabled={!writable || busy} onChange={event => setTime(event.target.value)} /></label></div>
        <fieldset><legend className="mb-2 text-sm">{t("Expected days")}</legend><div className="flex flex-wrap gap-3">{weekdays.map((day, i) => <label key={day} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={days.includes(i)} disabled={!writable || busy} onChange={event => setDays(current => event.target.checked ? [...current, i].sort() : current.filter(value => value !== i))} />{t.owned(day)}</label>)}</div></fieldset>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={enabled} disabled={!writable || busy} onChange={event => setEnabled(event.target.checked)} />{t("Expectation enabled")}</label>
        <AppButton onClick={() => void save()} isLoading={busy} disabled={!writable || !studentId || !days.length}>{t("Save expectation")}</AppButton>{saved && <p role="status" className="text-sm">{t("Saved")}</p>}
        <div className="overflow-x-auto"><table className={tableClass}><thead><tr>{["Student", "Expected days", "Expected by", "Status", "Action"].map(label => <th key={label}>{t.owned(label)}</th>)}</tr></thead><tbody>{resource.data?.items.map(item => <tr key={item.studentId}><td>{resource.data?.students.find(student => student.id === item.studentId)?.name || t("Student")}</td><td>{item.weekdays.map(day => t.owned(weekdays[day])).join(", ")}</td><td>{item.expectedBy}</td><td>{t.owned(item.enabled ? "Enabled" : "Disabled")}</td><td><AppButton variant="secondary" disabled={!writable} onClick={() => select(item.studentId)}>{t("Edit")}</AppButton></td></tr>)}</tbody></table></div>
        {resource.data?.items.length === 0 && <p className="text-sm">{t("Attendance expectations are not configured.")}</p>}
    </div></AppPanel>;
}
function Terms({ branchId, writable }: { branchId: string; writable: boolean }) {
    const t = useTranslation(); const { formatDate } = useUserPreferences(); const resource = useDashboardResource<{ items: DashboardTerm[]; students: StudentOption[] }>(`/api/branches/${branchId}/dashboard/terms`);
    const query = useSearchParams();
    const [studentId, setStudent] = useState(""); const [label, setLabel] = useState(""); const [startDate, setStart] = useState(""); const [endDate, setEnd] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [saved, setSaved] = useState(false);
    function select(id: string) { setStudent(id); setSaved(false); const existing = resource.data?.items.find(item => item.studentId === id); setLabel(existing?.label ?? ""); setStart(existing ? new Date(Date.parse(existing.endDate.slice(0, 10)) + 86_400_000).toISOString().slice(0, 10) : ""); setEnd(""); }
    useEffect(() => {
        const target = query.get("studentId"); if (!target || !resource.data) return;
        const frame = requestAnimationFrame(() => Array.from(document.querySelectorAll<HTMLElement>("[data-membership-student]")).find(element => element.dataset.membershipStudent === target)?.scrollIntoView({ block: "nearest" }));
        return () => cancelAnimationFrame(frame);
    }, [query, resource.data]);
    async function save() { if (busy) return; setBusy(true); setError(null); setSaved(false); try { await dashboardRequest(`/api/branches/${branchId}/dashboard/terms`, "POST", { studentId, label, startDate, endDate }); await resource.reload(); setSaved(true); } catch (error) { setError(error instanceof Error ? error.message : "Something went wrong. Try again."); } finally { setBusy(false); } }
    return <AppPanel title={t("Membership terms")} description={t("Record agreed membership dates for renewal reminders. They are separate from monthly anniversary billing and never deactivate a student.")}><div className="space-y-4"><ResourceError error={resource.error || error} retry={() => void resource.reload()} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><AppSelect label={t("Student")} value={studentId} onValueChange={select} disabled={!writable || busy} options={[{ value: "", label: t("Choose student") }, ...(resource.data?.students.map(student => ({ value: student.id, label: student.name })) ?? [])]} /><label className="text-sm">{t("Membership label")}<input className={inputClass} maxLength={80} value={label} disabled={!writable || busy} onChange={event => setLabel(event.target.value)} /></label><label className="text-sm">{t("Start date")}<input type="date" className={inputClass} value={startDate} disabled={!writable || busy} onChange={event => setStart(event.target.value)} /></label><label className="text-sm">{t("End date")}<input type="date" className={inputClass} value={endDate} min={startDate || undefined} disabled={!writable || busy} onChange={event => setEnd(event.target.value)} /></label></div>
        <AppButton onClick={() => void save()} isLoading={busy} disabled={!writable || !studentId || !label.trim() || !startDate || !endDate || endDate < startDate}>{t("Save membership term")}</AppButton>{saved && <p role="status" className="text-sm">{t("Saved")}</p>}
        <div className="overflow-x-auto"><table className={tableClass}><thead><tr>{["Student", "Membership label", "Start date", "End date", "Action"].map(item => <th key={item}>{t.owned(item)}</th>)}</tr></thead><tbody>{resource.data?.items.map(item => <tr key={item.id} data-membership-student={item.studentId} className={query.get("studentId") === item.studentId ? "bg-emerald-50" : undefined}><td>{item.studentName}</td><td>{item.label}</td><td>{formatDate(item.startDate)}</td><td>{formatDate(item.endDate)}</td><td><AppButton variant="secondary" disabled={!writable} onClick={() => select(item.studentId)}>{t("Renew term")}</AppButton></td></tr>)}</tbody></table></div>
        {resource.data?.items.length === 0 && <p className="text-sm">{t("Membership terms are not configured.")}</p>}
    </div></AppPanel>;
}
