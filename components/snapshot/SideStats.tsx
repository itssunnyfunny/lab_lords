"use client";
import { useTranslation } from "@/components/settings/LocalizedText";
import { AppPanel } from "@/components/ui";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import type { AnalyticsPeriod, BranchSnapshot } from "@/lib/api/analytics";

export function SideStats({snapshot, period="all"}:{snapshot?:BranchSnapshot;period?:AnalyticsPeriod}) {
    const t=useTranslation();
    const {formatNumber}=useUserPreferences();
    const money=(value:number)=>formatNumber(value,{style:"currency",currency:"INR",maximumFractionDigits:0});
    if (!snapshot) return <AppPanel density="compact" title={t("Revenue Summary")}><p role="status">{t("Loading...")}</p></AppPanel>;
    if (!snapshot.financialAccess) return null;
    return <AppPanel density="compact" className="ui-analytics-revenue" title={t("Revenue Summary")} description={t(period==="month"?"This month":"All time")}>
        <dl className="divide-y divide-[color:var(--ui-form-section-divider)]">
            <div className="pb-2"><dt className="text-sm text-[color:var(--text-secondary)]">{t("Billable Revenue")}</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{money(snapshot.monthlyRevenue)}</dd></div>
            <div className="py-2"><dt className="text-sm text-[color:var(--text-secondary)]">{t("Collection rate")}</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{formatNumber(snapshot.collectionRate/100,{style:"percent",maximumFractionDigits:0})}</dd></div>
            <div className="pt-2"><dt className="text-sm text-[color:var(--text-secondary)]">{t("All Pending Fees")}</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{money(snapshot.dueAmount)}</dd><p className="mt-1 text-xs text-[color:var(--text-muted)]">{t("shown in every period")}</p></div>
        </dl>
    </AppPanel>;
}
