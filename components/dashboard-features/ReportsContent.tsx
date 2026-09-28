"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AppButton, AppSelect } from "@/components/ui";
import { appActionClassName } from "@/components/ui/AppButton";
import { RecordListPage, RecordListSurface, RecordListState } from "@/components/ui/RecordList";
import { formControlClass, formErrorBannerClass, formLabelClass } from "@/components/ui/formSurface";
import { pageMutedTextClass } from "@/components/ui/pageSurface";
import { useTranslation } from "@/components/settings/LocalizedText";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import type { BranchReport } from "@/lib/branchReports";
import type { BranchAccess } from "@/types";
import { cn } from "@/lib/utils";
import { useDashboardResource } from "./shared";

export function ReportsContent({ branchId, access }: { branchId: string; access: BranchAccess }) {
    const t = useTranslation();
    const { documentLanguage } = useUserPreferences();
    const [kind, setKind] = useState(access.permissions.view_payments ? "fees" : "students");
    const [from, setFrom] = useState(() => `${new Date().toISOString().slice(0, 7)}-01`);
    const [through, setThrough] = useState(() => new Date().toISOString().slice(0, 10));
    const [status, setStatus] = useState("ALL");
    const [search, setSearch] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const controller = useRef<AbortController | null>(null);
    useEffect(() => () => controller.current?.abort(), []);

    const params = new URLSearchParams({ kind, from, through, status, search });
    // Language changes refresh document headers while preserving all active filters.
    const resource = useDashboardResource<BranchReport>(`/api/branches/${branchId}/reports?${params}&format=json`);
    useEffect(() => { void resource.reload(); }, [documentLanguage]); // eslint-disable-line react-hooks/exhaustive-deps
    const kinds = [
        ...(access.permissions.view_payments ? [{ value: "fees", label: t("Fee ledger") }] : []),
        ...(access.permissions.students ? [{ value: "students", label: t("Student admissions") }, { value: "attendance", label: t("Attendance marks") }] : []),
    ];
    const statuses = kind === "fees" ? ["DUE", "PAID", "WAIVED"] : kind === "students" ? ["ACTIVE", "INACTIVE"] : ["PRESENT", "ABSENT"];

    async function download() {
        if (busy) return;
        setBusy(true);
        setError(null);
        const request = new AbortController();
        controller.current = request;
        try {
            const response = await fetch(`/api/branches/${branchId}/reports?${params}&format=csv`, { cache: "no-store", signal: request.signal });
            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.error);
            }
            const url = URL.createObjectURL(await response.blob());
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = `lab-lords-${kind}-${from}-${through}.csv`;
            anchor.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (downloadError) {
            if (!request.signal.aborted) setError(downloadError instanceof Error ? downloadError.message : "Something went wrong. Try again.");
        } finally {
            if (!request.signal.aborted) setBusy(false);
        }
    }

    return <RecordListPage title={t("Exports & Reports")}
        description={t("Preview and download your authorized branch records using the same filters. Export headings use your document language.")}
        actions={access.permissions.analytics ? <Link className={appActionClassName("secondary")} href={`/branch/${branchId}/analytics`}>{t("Analytics")}</Link> : undefined}
        notices={error && <div role="alert" className={cn("flex flex-wrap items-center gap-3 p-3 text-sm", formErrorBannerClass)}>
            <span>{t.error(error)}</span><AppButton variant="secondary" density="compact" onClick={() => void download()}>{t("Retry")}</AppButton>
        </div>}>
        <RecordListSurface label={t("Report preview")} busy={resource.loading}
            toolbar={<div className="w-full space-y-3">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <AppSelect label={t("Report")} value={kind} onValueChange={value => { setKind(value); setStatus("ALL"); }} options={kinds} />
                    <label className={cn("block space-y-1", formLabelClass)}>{t("From date")}
                        <input className={`${formControlClass} min-h-11 w-full px-3`} type="date" value={from} onChange={event => setFrom(event.target.value)} />
                    </label>
                    <label className={cn("block space-y-1", formLabelClass)}>{t("Through date")}
                        <input className={`${formControlClass} min-h-11 w-full px-3`} type="date" value={through} onChange={event => setThrough(event.target.value)} />
                    </label>
                    <AppSelect label={t("Status")} value={status} onValueChange={setStatus}
                        options={[{ value: "ALL", label: t("All") }, ...statuses.map(value => ({ value, label: t.owned(value) }))]} />
                    <label className={cn("block space-y-1", formLabelClass)}>{t("Student name")}
                        <input type="search" className={`${formControlClass} min-h-11 w-full px-3`} maxLength={100} value={search} onChange={event => setSearch(event.target.value)} />
                    </label>
                </div>
                <p className={cn("text-sm", pageMutedTextClass)}>{t.owned(kind === "fees"
                    ? "Dates filter fee dates. Amounts are in whole rupees; balances include recorded collections and waivers."
                    : kind === "students"
                        ? "Dates filter joining dates. Only names, status and joining dates are exported."
                        : "Dates filter recorded attendance marks. Visits and unmarked students are not included.")}</p>
                <p className={cn("text-xs", pageMutedTextClass)}>{t("The preview shows the first 50 rows. The download includes every matching row within the limit.")}</p>
                <p className={cn("text-xs", pageMutedTextClass)}>{t("Choose up to 93 days. Larger than 10,000 rows requires narrower filters. No phone numbers or private notes are exported.")}</p>
            </div>}
            footer={!resource.loading && !resource.error && resource.data ? <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm">{t("{count} matching rows", { count: resource.data.count })}</span>
                <AppButton variant="primary" density="compact" onClick={() => void download()} isLoading={busy}>{t("Download CSV")}</AppButton>
            </div> : undefined}>
            {resource.loading ? <RecordListState kind="loading" title="Loading…" />
                : resource.error ? <RecordListState kind="error" title="Something went wrong" description={t.error(resource.error)} onRetry={() => void resource.reload()} />
                : !resource.data?.count ? <RecordListState kind="empty" title="No records match these filters." />
                : <div role="region" aria-label={t("Report preview")} tabIndex={0}
                    className="ui-table--compact w-full overflow-x-auto border border-[color:var(--ui-table-border)] bg-[color:var(--ui-table-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ui-focus-ring)]">
                    <table className="w-full min-w-[44rem] text-left text-sm">
                        <caption className="sr-only">{t("Report preview")}</caption>
                        <thead className="bg-[color:var(--ui-table-head-bg)] text-[color:var(--ui-table-muted)]">
                            <tr>{resource.data.columns.map((column, index) => <th key={`${column}-${index}`} scope="col">{column}</th>)}</tr>
                        </thead>
                        <tbody className="divide-y divide-[color:var(--ui-table-divider)]">
                            {resource.data.rows.slice(0, 50).map((row, index) => <tr key={index}>
                                {row.map((cell, column) => column === 0
                                    ? <th key={column} scope="row" className="text-[color:var(--ui-table-text)]">{cell}</th>
                                    : <td key={column} className="text-[color:var(--ui-table-text)]">{cell}</td>)}</tr>)}
                        </tbody>
                    </table>
                </div>}
        </RecordListSurface>
    </RecordListPage>;
}
