"use client";
import { useState } from "react";
import { Dialog, AppButton } from "@/components/ui";
import { formControlClass, formLabelClass } from "@/components/ui/formSurface";
import { useTranslation } from "@/components/settings/LocalizedText";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import type { RenewalPage } from "@/lib/renewals";
import { ResourceError, useDashboardResource } from "@/components/dashboard-features/shared";
/** The existing renewal queue supplies authorized due records across fee months. */
export function PaymentCollectionPicker({ branchId, onClose, onSelect }: { branchId: string; onClose: () => void; onSelect: (studentId: string, paymentId: string) => void }) {
    const t = useTranslation(); const { formatDate, formatNumber } = useUserPreferences();
    const [search, setSearch] = useState(""); const [cursor, setCursor] = useState("");
    const resource = useDashboardResource<RenewalPage>(`/api/branches/${branchId}/renewals?${new URLSearchParams({ filter: "OUTSTANDING", days: "7", search, limit: "25", ...(cursor ? { cursor } : {}) })}`);
    const recordedDues = resource.data?.items.filter(row => row.paymentId) ?? [];
    return <Dialog open density="compact" languagePlacement="header" title={t("Record payment")}
        description={t("Choose a recorded due to open the collection form. No payment is recorded until you confirm.")}
        onClose={onClose} className="max-w-2xl"><div className="space-y-4">
        <label className={`block space-y-1 ${formLabelClass}`}>{t("Search by name or phone")}
            <input autoFocus type="search" className={`${formControlClass} min-h-11 w-full px-3`} value={search} maxLength={100} onChange={event => { setSearch(event.target.value); setCursor(""); }} />
        </label>
        <ResourceError error={resource.error} retry={() => void resource.reload()} />
        <ul className="divide-y divide-[color:var(--ui-form-section-divider)]">{recordedDues.map(row => <li key={row.key}>
            <button type="button" className="flex min-h-14 w-full flex-wrap items-center justify-between gap-2 rounded-[var(--ui-radius-control)] p-3 text-left hover:bg-[color:var(--ui-form-surface-hover-bg)] focus-visible:outline-2 focus-visible:outline-[color:var(--ui-focus-ring)]"
                onClick={() => onSelect(row.studentId, row.paymentId!)}>
                <span className="min-w-0"><strong className="block break-words">{row.studentName}</strong><span className="text-xs text-[color:var(--text-secondary)]">{t("Fee date")}: {formatDate(row.dueDate)}</span></span>
                <span className="font-semibold tabular-nums">{formatNumber(row.amount, { style: "currency", currency: "INR", maximumFractionDigits: 0 })}</span>
            </button>
        </li>)}</ul>
        {resource.loading && <p role="status">{t("Loading…")}</p>}{!resource.loading && !resource.error && recordedDues.length === 0 && <p>{t("No recorded dues found.")}</p>}
        <div className="flex flex-wrap gap-2"><AppButton variant="secondary" density="compact" disabled={!cursor} onClick={() => setCursor("")}>{t("First page")}</AppButton><AppButton variant="secondary" density="compact" disabled={!resource.data?.nextCursor} onClick={() => setCursor(resource.data?.nextCursor ?? "")}>{t("Next page")}</AppButton></div>
    </div></Dialog>;
}
