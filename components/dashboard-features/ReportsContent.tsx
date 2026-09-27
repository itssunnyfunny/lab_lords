"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AppButton, AppPanel, AppSelect } from "@/components/ui";
import { useTranslation } from "@/components/settings/LocalizedText";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import type { BranchReport } from "@/lib/branchReports";
import type { BranchAccess } from "@/types";
import { FeaturePage, inputClass, ResourceError, tableClass, useDashboardResource } from "./shared";
export function ReportsContent({ branchId, access }: { branchId: string; access: BranchAccess }) {
    const t = useTranslation(); const { documentLanguage } = useUserPreferences();
    const [kind, setKind] = useState(access.permissions.view_payments ? "fees" : "students");
    const [from, setFrom] = useState(() => `${new Date().toISOString().slice(0, 7)}-01`); const [through, setThrough] = useState(() => new Date().toISOString().slice(0, 10)); const [status, setStatus] = useState("ALL"); const [search, setSearch] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
    const controller = useRef<AbortController | null>(null); useEffect(() => () => controller.current?.abort(), []);
    const params = new URLSearchParams({ kind, from, through, status, search });
    // Language changes refresh document headers while preserving all active filters.
    const resource = useDashboardResource<BranchReport>(`/api/branches/${branchId}/reports?${params}&format=json`);
    useEffect(() => { void resource.reload(); }, [documentLanguage]); // eslint-disable-line react-hooks/exhaustive-deps
    const kinds = [...(access.permissions.view_payments ? [{ value: "fees", label: t("Fee ledger") }] : []), ...(access.permissions.students ? [{ value: "students", label: t("Student admissions") }, { value: "attendance", label: t("Attendance marks") }] : [])];
    const statuses = kind === "fees" ? ["DUE", "PAID", "WAIVED"] : kind === "students" ? ["ACTIVE", "INACTIVE"] : ["PRESENT", "ABSENT"];
    async function download() {
        if (busy) return; setBusy(true); setError(null); const request = new AbortController(); controller.current = request;
        try { const response = await fetch(`/api/branches/${branchId}/reports?${params}&format=csv`, { cache: "no-store", signal: request.signal });
            if (!response.ok) { const result = await response.json(); throw new Error(result.error); }
            const url = URL.createObjectURL(await response.blob()); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `lab-lords-${kind}-${from}-${through}.csv`; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (error) { if (!request.signal.aborted) setError(error instanceof Error ? error.message : "Something went wrong. Try again."); } finally { if (!request.signal.aborted) setBusy(false); }
    }
    return <FeaturePage title="Exports & Reports" description="Preview and download your authorized branch records using the same filters. Export headings use your document language."
        action={access.permissions.analytics && <Link className="text-sm underline" href={`/branch/${branchId}/analytics`}>{t("Analytics")}</Link>}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><AppSelect label={t("Report")} value={kind} onValueChange={value => { setKind(value); setStatus("ALL"); }} options={kinds} /><label className="text-sm">{t("From date")}<input className={inputClass} type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><label className="text-sm">{t("Through date")}<input className={inputClass} type="date" value={through} onChange={event => setThrough(event.target.value)} /></label><AppSelect label={t("Status")} value={status} onValueChange={setStatus} options={[{ value: "ALL", label: t("All") }, ...statuses.map(value => ({ value, label: t.owned(value) }))]} /><label className="text-sm">{t("Student name")}<input type="search" className={inputClass} maxLength={100} value={search} onChange={event => setSearch(event.target.value)} /></label></div>
        <p className="text-sm text-[color:var(--text-muted)]">{t.owned(kind === "fees" ? "Dates filter fee dates. Amounts are in whole rupees; balances include recorded collections and waivers." : kind === "students" ? "Dates filter joining dates. Only names, status and joining dates are exported." : "Dates filter recorded attendance marks. Visits and unmarked students are not included.")}</p>
        <p className="text-xs text-[color:var(--text-muted)]">{t("Choose up to 93 days. Larger than 10,000 rows requires narrower filters. No phone numbers or private notes are exported.")}</p>
        <ResourceError error={error || resource.error} retry={() => void resource.reload()} /><div className="flex flex-wrap items-center justify-between gap-3"><span className="text-sm">{resource.data ? t("{count} matching rows", { count: resource.data.count }) : "—"}</span><AppButton onClick={() => void download()} isLoading={busy} disabled={resource.loading || Boolean(resource.error) || !resource.data}>{t("Download CSV")}</AppButton></div>
        <AppPanel title={t("Report preview")} description={t("The preview shows the first 50 rows. The download includes every matching row within the limit.")} contentClassName="overflow-x-auto p-0">{resource.loading ? <p role="status" className="p-6">{t("Loading…")}</p> : resource.data && <table className={tableClass}><thead><tr>{resource.data.columns.map(column => <th key={column}>{column}</th>)}</tr></thead><tbody>{resource.data.rows.slice(0, 50).map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody></table>}{!resource.loading && resource.data?.count === 0 && <p className="p-6 text-sm">{t("No records match these filters.")}</p>}</AppPanel>
    </FeaturePage>;
}
