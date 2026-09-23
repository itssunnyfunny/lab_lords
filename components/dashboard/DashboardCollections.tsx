"use client";

import { AppPanel } from "@/components/ui";
import { useTranslation } from "@/components/settings/LocalizedText";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { dailyDashboardCollections } from "@/lib/dashboardPresentation";
import type { BranchDashboardSources } from "@/lib/branchDashboard";
import { DashboardSourceNote } from "./DashboardPanels";

export function DashboardCollections({ data, onRetry }: { data: BranchDashboardSources; onRetry: () => void }) {
    const t = useTranslation();
    const { formatNumber, formatDate } = useUserPreferences();
    const daily = dailyDashboardCollections(data.collectionsTrend);
    const money = (amount: number) => formatNumber(amount, { style: "currency", currency: "INR", maximumFractionDigits: 0 });
    const shortDate = (date: string) => formatDate(date, { day: "numeric", month: "short" });
    const maximum = Math.max(100, ...daily.map(point => point.amount));
    const ceiling = Math.ceil(maximum / 100) * 100;
    const range = daily.length ? `${shortDate(daily[0].date)} – ${shortDate(daily[daily.length - 1].date)}` : t("Last 14 days");
    return <AppPanel title={t("Collections")} action={<span className="dashboard-period">{t("Last 14 days")}</span>} className="dashboard-collections">
        {data.resources.collectionsTrend === "success" && daily.length ? <figure className="dashboard-collection-chart">
            <figcaption><span className="dashboard-chart-key" />{t("Daily collections")}<span>{range}</span></figcaption>
            <div className="dashboard-chart-body" role="img" aria-label={t("Daily collections from {from} to {to}: {amount}. Full values below.", {
                from: shortDate(daily[0].date), to: shortDate(daily[daily.length - 1].date), amount: money(daily.reduce((sum, point) => sum + point.amount, 0)),
            })}>
                <div className="dashboard-chart-axis" aria-hidden="true">{[1, .5, 0].map(ratio => <span key={ratio}>{money(ceiling * ratio)}</span>)}</div>
                <div className="dashboard-chart-plot" aria-hidden="true">
                    <div className="dashboard-chart-bars">{daily.map(point => <div key={point.date}>
                        <span style={{ height: `${point.amount / ceiling * 100}%` }} />
                    </div>)}</div>
                    {!daily.some(point => point.amount > 0) && <p className="dashboard-chart-empty">{t("No collections in this period")}</p>}
                </div>
            </div>
            <div className="dashboard-chart-dates" aria-hidden="true">{[daily[0], daily[Math.floor(daily.length / 2)], daily[daily.length - 1]].map(point => <span key={point.date}>{shortDate(point.date)}</span>)}</div>
        </figure> : data.resources.collectionsTrend === "success"
            ? <p className="dashboard-chart-unavailable">{t("Daily collection history is unavailable.")}</p>
            : <DashboardSourceNote status={data.resources.collectionsTrend} label={t("Daily collections")} onRetry={onRetry} />}
        {data.snapshot ? <dl className="dashboard-financial-facts">
            <div><dt>{t("Billed this month")}</dt><dd>{money(data.snapshot.monthlyRevenue)}</dd></div>
            <div><dt>{t("Outstanding today")}</dt><dd>{money(data.snapshot.dueAmount)}</dd></div>
        </dl> : <DashboardSourceNote status={data.resources.analytics} label={t("Collections")} onRetry={onRetry} />}
        <details className="dashboard-details">
            <summary>{t("Amounts & daily breakdown")}</summary>
            <p>{t("Collections can settle older fees. These amounts are not parts of one monthly total.")}</p>
            <p>{t("Billed: fees due this month. Outstanding: unpaid balances due through today.")}</p>
            {daily.length > 0 && <table><caption>{t("Daily collections")} · {range}</caption><thead><tr><th>{t("Date")}</th><th>{t("Amount")}</th></tr></thead>
                <tbody>{daily.map(point => <tr key={point.date}><td>{shortDate(point.date)}</td><td>{money(point.amount)}</td></tr>)}</tbody></table>}
        </details>
    </AppPanel>;
}
