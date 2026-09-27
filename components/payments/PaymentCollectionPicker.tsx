"use client";
import { useState } from "react";
import { Dialog, AppButton } from "@/components/ui";
import { useTranslation } from "@/components/settings/LocalizedText";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import type { RenewalPage } from "@/lib/renewals";
import { inputClass, ResourceError, useDashboardResource } from "@/components/dashboard-features/shared";
/** The existing renewal queue supplies authorized due records across fee months. */
export function PaymentCollectionPicker({ branchId, onClose, onSelect }: { branchId: string; onClose: () => void; onSelect: (studentId: string, paymentId: string) => void }) {
    const t = useTranslation(); const { formatDate, formatNumber } = useUserPreferences();
    const [search, setSearch] = useState(""); const [cursor, setCursor] = useState("");
    const resource = useDashboardResource<RenewalPage>(`/api/branches/${branchId}/renewals?${new URLSearchParams({ filter: "OUTSTANDING", days: "7", search, limit: "25", ...(cursor ? { cursor } : {}) })}`);
    return <Dialog open title={t("Record payment")} description={t("Choose a recorded due to open the collection form. No payment is recorded until you confirm.")} onClose={onClose} className="max-w-2xl"><div className="space-y-4"><label className="block text-sm">{t("Search by name or phone")}<input autoFocus type="search" className={inputClass} value={search} maxLength={100} onChange={event => { setSearch(event.target.value); setCursor(""); }} /></label><ResourceError error={resource.error} retry={() => void resource.reload()} />
        <ul className="divide-y divide-[color:var(--ui-panel-border)]">{resource.data?.items.filter(row => row.paymentId).map(row => <li key={row.key}><button type="button" className="flex min-h-14 w-full items-center justify-between gap-3 rounded-lg p-3 text-left hover:bg-[color:var(--ui-form-surface-hover-bg)]" onClick={() => onSelect(row.studentId, row.paymentId!)}><span className="min-w-0"><strong className="block">{row.studentName}</strong><span className="text-xs">{t("Fee date")}: {formatDate(row.dueDate)}</span></span><span className="shrink-0 font-semibold">{formatNumber(row.amount, { style: "currency", currency: "INR", maximumFractionDigits: 0 })}</span></button></li>)}</ul>
        {resource.loading && <p role="status">{t("Loading…")}</p>}{!resource.loading && !resource.error && !resource.data?.items.length && <p>{t("No recorded dues found.")}</p>}
        <div className="flex gap-2"><AppButton variant="secondary" disabled={!cursor} onClick={() => setCursor("")}>{t("First page")}</AppButton><AppButton variant="secondary" disabled={!resource.data?.nextCursor} onClick={() => setCursor(resource.data?.nextCursor ?? "")}>{t("Next page")}</AppButton></div>
    </div></Dialog>;
}
